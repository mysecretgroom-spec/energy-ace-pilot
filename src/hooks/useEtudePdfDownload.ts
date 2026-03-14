import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPreEtudePdfBlob, getResultatPdfBlob, EtudeData } from "@/lib/exportEtudePdf";
import { toast } from "sonner";

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
      const blob = await generatePdfFromEtude(etude, client, mode, options);
      
      // Upload/replace for future use (only for pre-etude to keep backward compat)
      if (mode === "pre-etude") {
        await uploadGeneratedPdf(blob, etude, client);
      }

      // Share or download
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
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

async function generatePdfFromEtude(etude: any, client: any, mode: PdfMode, options?: { showLogos?: boolean }): Promise<Blob> {
  const refId = (etude.id || "").substring(0, 8).toUpperCase();
  const paramOverrides = (etude.param_overrides || {}) as any;
  
  // Récupération fiable des valeurs de rentabilité
  const autoconsommationEuros = etude.economie_autoconso_mensuelle || etude.gain_autoconso_euros || 0;
  const reventeMensuelleEstimee = etude.revente_mensuelle_estimee || 0;
  const mensualite = etude.mensualite_estimee || 0;
  
  // Recalculer le résultat pour garantir la cohérence affichée
  // (autoconso + revente - mensualité = résultat)
  const resultatTransfertCharge = autoconsommationEuros + reventeMensuelleEstimee - mensualite;

  // Déterminer les produits actifs
  const activeProducts: string[] = etude.active_products || ["PV"];
  
  // Déterminer si la consommation est estimée
  const consoIsEstimated = paramOverrides.consoIsEstimated ?? 
    (etude.consommation_annuelle_kwh && !etude.numero_pdl ? true : false);

  const pdfData: EtudeData = {
    // Multi-product
    activeProducts,
    referenceEtude: refId ? `PE-${refId}` : undefined,
    clientNom: client.nom || "",
    clientPrenom: client.prenom || "",
    clientAdresse: client.adresse || "",
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
  };

  return mode === "resultat" ? getResultatPdfBlob(pdfData, options) : getPreEtudePdfBlob(pdfData);
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
