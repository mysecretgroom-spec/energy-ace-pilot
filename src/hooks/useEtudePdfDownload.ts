import { deliverFile } from "@/lib/fileDelivery";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPreEtudePdfBlob, getResultatPdfBlob, EtudeData, PacData, IteData } from "@/lib/exportEtudePdf";
import { appendStudyPhotosToPdf } from "@/lib/appendStudyPhotosToPdf";
import { appendRoofMapAnnexeToPdf } from "@/lib/appendRoofMapAnnexeToPdf";
import { toast } from "sonner";
import { parseRoofMapViewport } from "@/lib/roofMapViewport";

type PdfMode = "pre-etude" | "resultat";

/**
 * Hook to download/share an étude PDF.
 * mode = "pre-etude" → lightweight version (from étude form)
 * mode = "resultat" → full formal version (from client detail)
 */
export function useEtudePdfDownload() {
  const [loading, setLoading] = useState(false);

  const downloadOrShare = useCallback(async (etudeId: string, mode: PdfMode = "pre-etude", options?: { showLogos?: boolean }) => {
    setLoading(true);
    try {
      // 1. Fetch étude row
      const { data: etude, error: eErr } = await supabase
        .from("etudes")
        .select("*, clients!inner(nom, prenom, adresse, ville, code_postal, telephone)")
        .eq("id", etudeId)
        .maybeSingle();

      if (eErr || !etude) throw new Error("Étude introuvable");

      const client = etude.clients as any;
      const prefix = mode === "resultat" ? "Resultat" : "PreEtude";
      const filename = `${prefix}_${etude.product_type || "PV"}_${client.nom || ""}.pdf`;

      // Generate PDF based on mode
      const { blob: baseBlob, pdfData } = await generatePdfFromEtude(etude, client, mode, options);

      // Ajoute les photos d'étude, puis la carte en annexe (dernière page)
      const photosBlob = await appendStudyPhotosToPdf(
        baseBlob,
        etude.user_id,
        etude.client_id,
        etude.id
      );
      const blob = await appendRoofMapAnnexeToPdf(photosBlob, pdfData, etude.id);

      // Upload/replace for future use (only for pre-etude to keep backward compat)
      if (mode === "pre-etude") {
        await uploadGeneratedPdf(blob, etude, client);
      }


      await deliverFile(blob, filename);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : "";
        console.error("[PDF Download] Error:", errMsg);
        console.error("[PDF Download] Stack:", errStack);
        console.error("[PDF Download] Full error:", err);
        toast.error(`Erreur PDF: ${errMsg?.substring(0, 80) || "inconnue"}`);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  return { downloadOrShare, loading };
}

export async function generatePdfFromEtude(etude: any, client: any, mode: PdfMode, options?: { showLogos?: boolean }): Promise<{ blob: Blob; pdfData: EtudeData }> {
  const refId = (etude.id || "").substring(0, 8).toUpperCase();
  const paramOverrides = (etude.param_overrides || {}) as any;
  
  // Récupération fiable des valeurs de rentabilité
  const autoconsommationEuros = etude.economie_autoconso_mensuelle || etude.gain_autoconso_euros || 0;
  const reventeMensuelleEstimee = etude.revente_mensuelle_estimee || 0;
  const mensualite = etude.mensualite_estimee || 0;
  
  // Recalculer le résultat pour garantir la cohérence affichée
  const resultatTransfertCharge = autoconsommationEuros + reventeMensuelleEstimee - mensualite;

  // Déterminer les produits actifs
  const activeProducts: string[] = etude.active_products || ["PV"];
  
  // Déterminer si la consommation est estimée
  const consoIsEstimated = paramOverrides.consoIsEstimated ?? 
    (etude.consommation_annuelle_kwh && !etude.numero_pdl ? true : false);

  // ── Projection 10 ans ──
  // Déterminer l'énergie de référence (PAC = énergie actuelle, sinon électricité)
  const typeEnergieRef = activeProducts.includes("PAC") && etude.pac_energie_actuelle
    ? etude.pac_energie_actuelle.toLowerCase()
    : "electricite";

  // Charger le taux d'augmentation depuis la table paramétrable
  let tauxAugmentation = 4; // default
  let typeEnergieLabel = "Électricité";
  let sourceEvolutionPrix = "";
  try {
    const { data: evolutionData } = await supabase
      .from("data_evolution_prix_energie")
      .select("*")
      .eq("actif", true)
      .order("user_id", { ascending: false, nullsFirst: false });
    
    if (evolutionData && evolutionData.length > 0) {
      // Find matching energy type (user-specific first, then global)
      const match = evolutionData.find((e: any) => 
        e.type_energie.toLowerCase().includes(typeEnergieRef.replace(/[éè]/g, "e"))
      ) || evolutionData.find((e: any) => e.type_energie === "electricite");
      
      if (match) {
        tauxAugmentation = match.taux_augmentation_annuel;
        sourceEvolutionPrix = match.description || "";
        const labels: Record<string, string> = {
          electricite: "Électricité", gaz: "Gaz naturel", fioul: "Fioul",
          propane: "Propane", bois: "Bois/Granulés"
        };
        typeEnergieLabel = labels[match.type_energie] || match.type_energie;
      }
    }
  } catch (e) {
    console.warn("[PDF] Could not fetch evolution data, using defaults", e);
  }

  // Gain mensuel du projet (transfert de charge)
  // resultatTransfertCharge = autoconso + revente - mensualité
  const gainProjetAnnuel = resultatTransfertCharge * 12;
  
  // Prix kWh de référence actuel
  const prixKwhActuel = etude.pac_prix_kwh_elec || 0.2516; // tarif réglementé 2026

  // Coût annuel actuel (basé sur la conso estimée)
  const consoAnnuelleKwh = etude.consommation_annuelle_kwh || 0;
  const coutAnnuelActuel = consoAnnuelleKwh * prixKwhActuel;

  // Construire la projection sur 10 ans
  const projection10ans: { annee: number; prixKwhElec: number; coutAnnuelProjecte: number; coutAugmentation: number; gainAnnuel: number; gainCumule: number }[] = [];
  let cumulGain = 0;
  for (let i = 1; i <= 10; i++) {
    // Année 1 = prix actuel, inflation à partir de l'année 2
    const multiplicateur = Math.pow(1 + tauxAugmentation / 100, i - 1);
    const prixKwh = prixKwhActuel * multiplicateur;
    const coutAnnuelProjecte = consoAnnuelleKwh * prixKwh;
    const coutAugmentation = coutAnnuelProjecte - coutAnnuelActuel;
    // Gain annuel = gain projet (transfert de charge) + économie liée à l'inflation évitée
    const gainAnnuel = gainProjetAnnuel + coutAugmentation;
    cumulGain += gainAnnuel;
    projection10ans.push({
      annee: i,
      prixKwhElec: Math.round(prixKwh * 10000) / 10000,
      coutAnnuelProjecte: Math.round(coutAnnuelProjecte * 100) / 100,
      coutAugmentation: Math.round(coutAugmentation * 100) / 100,
      gainAnnuel: Math.round(gainAnnuel * 100) / 100,
      gainCumule: Math.round(cumulGain * 100) / 100,
    });
  }

  const pdfData: EtudeData = {
    // Multi-product
    activeProducts,
    referenceEtude: refId ? `PE-${refId}` : undefined,
    clientNom: client.nom || "",
    clientPrenom: client.prenom || "",
    clientAdresse: client.adresse || "",
    roofLatitude: (etude as any).roof_latitude ?? null,
    roofLongitude: (etude as any).roof_longitude ?? null,
    roofMapViewport: parseRoofMapViewport(paramOverrides.roofMapViewport),
    clientVille: client.ville || "",
    clientCodePostal: client.code_postal || "",
    clientTelephone: client.telephone || undefined,
    departement: (client.code_postal || "").substring(0, 2),
    dateEtude: new Date(etude.created_at).toLocaleDateString("fr-FR"),
    ombreToiture: etude.ombre_toiture || "Non défini",
    surfaceToiture: etude.surface_toiture || "Non défini",
    typeToiture: etude.type_toiture || "Non défini",
    etatToiture: etude.etat_toiture || "Non défini",
    orientation: etude.orientation || "Non défini",
    inclinaison: etude.inclinaison || 0,
    typeCompteurElectrique: etude.type_compteur_electrique || "Non défini",
    numeroPdl: etude.numero_pdl || "",
    typeRaccordement: etude.type_raccordement || "Non défini",
    amperageDisjoncteur: etude.amperage_disjoncteur || 0,
    emplacementBoitier: etude.emplacement_boitier || "Non défini",
    potentielFaisabilite: etude.potentiel_faisabilite || "Non défini",
    consoAnnuelle: etude.consommation_annuelle_kwh || 0,
    factureMensuelle: etude.facture_annuelle_euros ? etude.facture_annuelle_euros / 12 : 0,
    consoIsEstimated,
    bouquetNom: `${etude.puissance_kwc || 0} kWc`,
    puissanceKwc: etude.puissance_kwc || 0,
    typeRevente: etude.type_revente || "Non défini",
    supportInstallation: etude.support || "Non défini",
    surfaceInstallation: etude.surface_installation_m2 || 0,
    heuresEnsoleillement: paramOverrides.heuresEnsoleillement || 1000,
    rendementProductivite: etude.rendement_productivite || 100,
    productionAnnuelle: etude.production_annuelle_kwh || 0,
    surplusProduction: etude.surplus_production_kwh || 0,
    autoconsoPct: etude.autoconsommation_pct || 0,
    prixInstallation: etude.prix_installation || 0,
    surcoutSupport: etude.surcout_support || 0,
    surcoutCompteur: etude.surcout_compteur || 0,
    autreSurcout: etude.autre_surcout || 0,
    prixTotalHorsAides: etude.prix_total || 0,
    primeAutoconsommation: etude.prime_autoconsommation || 0,
    ecoTva: etude.eco_tva || 0,
    totalAides: etude.total_aides || 0,
    totalAidesDeduites: etude.total_aides_deduites || 0,
    financementNom: etude.mode_financement || "Non défini",
    tauxFinancement: etude.taux_financement || 0,
    dureeMois: etude.duree_financement_mois || 120,
    mensualite,
    autoconsommationEuros,
    reventeMensuelleEstimee,
    resultatTransfertCharge,
    verdict: etude.verdict || "invalide",
    classification: etude.classification || undefined,
    classificationComment: etude.classification_comment || undefined,
    
    // Multi-product PAC data
    pac: activeProducts.includes("PAC") ? buildPacData(etude) : undefined,
    // Multi-product ITE data
    ite: activeProducts.includes("ITE") ? buildIteData(etude) : undefined,
    
    // Projection 10 ans
    projection10ans,
    tauxAugmentationEnergie: tauxAugmentation,
    typeEnergieReference: typeEnergieLabel,
    sourceEvolutionPrix,
    
    // Estimation details (from ConsumptionEstimator)
    estimationDetails: paramOverrides.estimationDetails || undefined,
  };

  const blob = mode === "resultat"
    ? await getResultatPdfBlob(pdfData, options)
    : await getPreEtudePdfBlob(pdfData);
  return { blob, pdfData };
}

function buildPacData(etude: any) {
  const aidesManuelles = etude.aides_manuelles || {};
  return {
    subtype: (etude.pac_subtype || "air_eau") as "air_air" | "air_eau",
    surfaceChauffee: etude.pac_surface_chauffee || 0,
    typeEmetteurs: etude.pac_type_emetteurs || "Non défini",
    puissanceCalorifique: etude.pac_puissance_calorifique || 0,
    cop: etude.pac_cop || 3.5,
    ecsIntegre: etude.pac_ecs_integre || false,
    volumeBallon: etude.pac_volume_ballon || 0,
    energieActuelle: etude.pac_energie_actuelle || "Non défini",
    niveauIsolation: etude.pac_niveau_isolation || "moyen",
    prixInstallation: etude.prix_installation || 0,
    aides: {
      maPrimeRenov: aidesManuelles.maPrimeRenov || 0,
      cee: aidesManuelles.cee || 0,
      ecoTva: aidesManuelles.ecoTva || 0,
      aideLocale: aidesManuelles.aideLocale || 0,
    },
    economies: etude.pac_besoins_chauffage_kwh ? {
      besoinsChauffageKwh: etude.pac_besoins_chauffage_kwh || 0,
      consoElecPacKwh: etude.pac_conso_elec_pac_kwh || 0,
      surcoutElecEuros: etude.pac_surcout_elec_euros || 0,
      economieNetteEuros: etude.pac_economie_nette_euros || 0,
      economieNetteMessage: etude.pac_economie_nette_euros || 0,
    } : null,
    factureChauffage: etude.pac_facture_chauffage_euros || 0,
    factureElec: etude.pac_facture_elec_euros || 0,
    prixKwhElec: etude.pac_prix_kwh_elec || 0.23,
  };
}

function buildIteData(etude: any) {
  const aidesManuelles = etude.aides_manuelles || {};
  return {
    surfaceIsoler: etude.ite_surface_isoler || 0,
    typeFacade: etude.ite_type_facade || "Non défini",
    epaisseurIsolant: etude.ite_epaisseur_isolant || 120,
    typeIsolant: etude.ite_type_isolant || "Non défini",
    rActuel: etude.ite_r_actuel || 0,
    rCible: etude.ite_r_cible || 3.7,
    nombreFacades: etude.ite_nombre_facades || 1,
    surfaceOuvertures: etude.ite_surface_ouvertures || 0,
    finition: etude.ite_finition || "Non défini",
    economieChauffagePct: etude.ite_economie_chauffage_pct || 0,
    factureChaufActuelle: etude.pac_facture_chauffage_euros || 0,
    prixInstallation: etude.prix_installation || 0,
    aides: {
      maPrimeRenov: aidesManuelles.maPrimeRenov || 0,
      cee: aidesManuelles.cee || 0,
      ecoTva: aidesManuelles.ecoTva || 0,
      aideLocale: aidesManuelles.aideLocale || 0,
    },
  };
}

async function uploadGeneratedPdf(blob: Blob, etude: any, client: any) {
  try {
    const safeName = `${client.prenom || ""}_${client.nom || ""}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `${etude.user_id}/${etude.id}/${safeName}.pdf`;

    const { data, error } = await supabase.storage
      .from("etudes-pdf")
      .upload(fileName, blob, { contentType: "application/pdf", upsert: true });

    if (!error && data) {
      await supabase
        .from("etudes")
        .update({ pdf_url: data.path, pdf_generated_at: new Date().toISOString() })
        .eq("id", etude.id);
    }
  } catch (e) {
    console.warn("[PDF Upload] Failed to store generated PDF:", e);
  }
}
