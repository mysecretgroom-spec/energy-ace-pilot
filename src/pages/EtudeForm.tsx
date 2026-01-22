import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Sun,
  Zap,
  Calculator,
  Euro,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Save,
  Loader2,
  Lock,
  Compass,
  Gauge,
  ShieldCheck,
  Home,
  Ruler,
  Plug,
  Settings,
  FileText,
  CreditCard,
  PiggyBank,
  Download,
  Check,
  Share2,
  Eye,
  MessageSquare,
  Tag,
  History,
  Clock,
} from "lucide-react";
import { exportEtudePdf, getEtudePdfBlob, getEtudePdfDataUrl, EtudeData } from "@/lib/exportEtudePdf";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PinDialog } from "@/components/auth/PinDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useWhatsAppNotification } from "@/hooks/useWhatsAppNotification";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

interface DataPsh {
  department_code: string;
  department_name: string;
  psh_value: number;
  max_psh_value: number;
  heures_ensoleillement_annuel: number;
}

interface DataOrientation {
  orientation: string;
  inclinaison: number;
  coefficient: number;
}

interface DataTarif {
  type_revente: string;
  puissance_min: number;
  puissance_max: number;
  prix_kwh: number;
}

interface DataBouquet {
  id: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  prix_max: number;
}

interface DataSurcout {
  id: string;
  code: string;
  nom: string;
  prix: number;
}

interface DataCalibre {
  id: string;
  calibre_amperes: number;
  puissance_kva: number;
}

interface DataCompteur {
  id: string;
  type_compteur: string;
  montant: number;
}

interface DataAide {
  id: string;
  code: string;
  nom: string;
  type_calcul: string;
  valeur: number;
  puissance_min: number;
  puissance_max: number;
  actif: boolean;
}

interface DataFinancement {
  id: string;
  nom: string;
  taux_effectif: number;
  taeg: number;
  duree_mois: number;
  actif: boolean;
}

const EtudeForm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendWhatsAppNotification } = useWhatsAppNotification();
  const clientId = searchParams.get("clientId") || searchParams.get("client");
  const rdvId = searchParams.get("rdvId") || searchParams.get("rdv");
  const etudeId = searchParams.get("etudeId") || searchParams.get("etude");
  const isEditMode = !!etudeId;

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentEtudeId, setCurrentEtudeId] = useState<string | null>(etudeId);
  const [originalClassification, setOriginalClassification] = useState<string>("");
  
  // Client info
  const [clientName, setClientName] = useState("");
  const [clientPrenom, setClientPrenom] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientVille, setClientVille] = useState("");
  const [clientCodePostal, setClientCodePostal] = useState("");
  const [departement, setDepartement] = useState("");

  // === VISITE TECHNIQUE - TOITURE ===
  const [ombreToiture, setOmbreToiture] = useState("0 à 5%");
  const [surfaceToiture, setSurfaceToiture] = useState("OK");
  const [typeToiture, setTypeToiture] = useState("TUILE");
  const [etatToiture, setEtatToiture] = useState("OK");

  // === COMPTEUR ÉLECTRIQUE ===
  const [typeCompteurElectrique, setTypeCompteurElectrique] = useState("Linky");
  const [numeroPdl, setNumeroPdl] = useState("");
  const [typeRaccordement, setTypeRaccordement] = useState("MONOPHASÉ");

  // === TABLEAU ÉLECTRIQUE ===
  const [amperageDisjoncteur, setAmperageDisjoncteur] = useState<number>(45);
  const [emplacementBoitier, setEmplacementBoitier] = useState("À côté");

  // === RÉSULTAT VISITE TECHNIQUE ===
  const [potentielFaisabilite, setPotentielFaisabilite] = useState("Faisable");

  // === CONSOMMATIONS ===
  const [consoAnnuelle, setConsoAnnuelle] = useState<number | "">("");
  const [factureMensuelle, setFactureMensuelle] = useState<number | "">("");

  // === PRÉCONISATION ===
  const [bouquetId, setBouquetId] = useState("");
  const [puissanceKwc, setPuissanceKwc] = useState<number | "">("");
  const [typeRevente, setTypeRevente] = useState("autoconsommation");
  const [supportInstallation, setSupportInstallation] = useState("TOITURE SURIMPOSITION");

  // === DONNÉES TECHNIQUES ===
  const [orientation, setOrientation] = useState("SUD");
  const [inclinaison, setInclinaison] = useState(30);
  const [surfaceInstallation, setSurfaceInstallation] = useState<number | "">("");
  const [rendementProductivite, setRendementProductivite] = useState(100);

  // === FINANCEMENT ===
  const [financementId, setFinancementId] = useState("");
  const [mensualiteManuelle, setMensualiteManuelle] = useState<number | "">("");

  // === PRIX MANUEL ===
  const [prixInstallationManuel, setPrixInstallationManuel] = useState<number | "">("");

  // Surcoûts
  const [selectedSurcouts, setSelectedSurcouts] = useState<string[]>([]);
  const [surcoutSupport, setSurcoutSupport] = useState(0);
  const [surcoutCompteur, setSurcoutCompteur] = useState(0);
  const [autreSurcout, setAutreSurcout] = useState(0);

  // Mode HEJJA
  const [modeHejjaActive, setModeHejjaActive] = useState(false);
  const [modeHejjaPsh, setModeHejjaPsh] = useState(true);
  const [modeHejjaPrix, setModeHejjaPrix] = useState(false);
  const [prixManuel, setPrixManuel] = useState<number | "">("");
  const [showPinDialog, setShowPinDialog] = useState(false);

  // Animation de succès
  const [showSuccess, setShowSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string>("");

  // Classification du dossier
  const [classification, setClassification] = useState<string>("");
  const [classificationComment, setClassificationComment] = useState<string>("");
  const [r2DateHeure, setR2DateHeure] = useState<Date | undefined>(undefined);
  const [r2Time, setR2Time] = useState<string>("10:00");
  const [cqTime, setCqTime] = useState<string>("10:00");
  const [classificationHistory, setClassificationHistory] = useState<{
    id: string;
    classification: string;
    comment: string | null;
    r2_date_heure: string | null;
    created_at: string;
  }[]>([]);
  const [existingEtudeId, setExistingEtudeId] = useState<string | null>(null);

  // Data tables
  const [dataPsh, setDataPsh] = useState<DataPsh[]>([]);
  const [dataOrientation, setDataOrientation] = useState<DataOrientation[]>([]);
  const [dataTarifs, setDataTarifs] = useState<DataTarif[]>([]);
  const [dataBouquets, setDataBouquets] = useState<DataBouquet[]>([]);
  const [dataSurcouts, setDataSurcouts] = useState<DataSurcout[]>([]);
  const [dataCalibres, setDataCalibres] = useState<DataCalibre[]>([]);
  const [dataCompteurs, setDataCompteurs] = useState<DataCompteur[]>([]);
  const [dataAides, setDataAides] = useState<DataAide[]>([]);
  const [dataFinancements, setDataFinancements] = useState<DataFinancement[]>([]);
  // Heures d'ensoleillement affichées
  const [heuresEnsoleillement, setHeuresEnsoleillement] = useState<number>(2890);
  const [usePshCalculation, setUsePshCalculation] = useState(true); // true = PSH, false = Heures

  // Calculated values
  const [calculatedResults, setCalculatedResults] = useState<{
    productionAnnuelle: number;
    surplusProduction: number;
    autoconsoPct: number;
    prixInstallation: number;
    prixSurcouts: number;
    prixTotalHorsAides: number;
    primeAutoconsommation: number;
    ecoTva: number;
    totalAides: number;
    totalAidesDeduites: number;
    mensualite: number;
    autoconsommationEuros: number;
    reventeMensuelleEstimee: number;
    resultatTransfertCharge: number;
    verdict: "valide" | "a_etudier" | "invalide" | null;
  } | null>(null);

  // Load data on mount
  useEffect(() => {
    const init = async () => {
      await loadReferenceData();
      await loadDefaultCqTime();
      if (clientId) {
        await loadClientInfo();
      }
      if (etudeId) {
        await loadExistingEtude();
      }
    };
    init();
  }, [clientId, etudeId]);

  // Load default CQ time from settings
  const loadDefaultCqTime = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("settings_notifications")
      .select("default_cq_time")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data?.default_cq_time) {
      // Extract HH:mm from time string
      const timeStr = data.default_cq_time.substring(0, 5);
      setCqTime(timeStr);
    }
  };

  // Recalculate when inputs change
  useEffect(() => {
    if (puissanceKwc && consoAnnuelle) {
      calculateResults();
    }
  }, [
    puissanceKwc,
    departement,
    consoAnnuelle,
    factureMensuelle,
    orientation,
    inclinaison,
    typeRevente,
    selectedSurcouts,
    bouquetId,
    modeHejjaPsh,
    prixManuel,
    prixInstallationManuel,
    rendementProductivite,
    financementId,
    mensualiteManuelle,
    surcoutSupport,
    surcoutCompteur,
    autreSurcout,
    typeRaccordement,
    supportInstallation,
    heuresEnsoleillement,
    dataOrientation,
    dataTarifs,
    dataBouquets,
    dataCompteurs,
    dataAides,
    dataFinancements,
    usePshCalculation,
    dataPsh,
  ]);

  const loadReferenceData = async () => {
    setLoading(true);

    const [pshRes, orientRes, tarifsRes, bouquetsRes, surcoutsRes, calibresRes, compteursRes, aidesRes, financementsRes] = await Promise.all([
      supabase.from("data_psh").select("*").order("department_code"),
      supabase.from("data_orientation").select("*"),
      supabase.from("data_tarifs_revente").select("*").eq("actif", true),
      supabase.from("data_prix_bouquets").select("*").eq("actif", true).order("puissance_kwc"),
      supabase.from("data_surcouts").select("*").eq("actif", true),
      supabase.from("data_calibres").select("*").eq("actif", true).order("calibre_amperes"),
      supabase.from("data_compteurs").select("*").eq("actif", true),
      supabase.from("data_aides").select("*").eq("actif", true),
      supabase.from("data_financements").select("*").eq("actif", true).order("duree_mois"),
    ]);

    if (pshRes.data) setDataPsh(pshRes.data);
    if (orientRes.data) setDataOrientation(orientRes.data);
    if (tarifsRes.data) setDataTarifs(tarifsRes.data);
    if (bouquetsRes.data) setDataBouquets(bouquetsRes.data);
    if (surcoutsRes.data) setDataSurcouts(surcoutsRes.data);
    if (calibresRes.data) setDataCalibres(calibresRes.data);
    if (compteursRes.data) setDataCompteurs(compteursRes.data);
    if (aidesRes.data) setDataAides(aidesRes.data);
    if (financementsRes.data) setDataFinancements(financementsRes.data);

    setLoading(false);
  };

  const loadClientInfo = async () => {
    if (!clientId) return;

    console.log("[DEBUG] Loading client info for clientId:", clientId);

    const { data } = await supabase
      .from("clients")
      .select("nom, prenom, adresse, ville, code_postal")
      .eq("id", clientId)
      .maybeSingle();

    console.log("[DEBUG] Client data loaded:", data);

    if (data) {
      setClientName(data.nom || "");
      setClientPrenom(data.prenom || "");
      setClientAdresse(data.adresse || "");
      setClientVille(data.ville || "");
      setClientCodePostal(data.code_postal || "");
      if (data.code_postal) {
        const deptCode = data.code_postal.substring(0, 2);
        console.log("[DEBUG] Code postal:", data.code_postal, "=> Département extrait:", deptCode);
        setDepartement(deptCode);
      } else {
        console.log("[DEBUG] Pas de code postal pour ce client");
      }
    }
  };

  // Charger une étude existante pour modification
  const loadExistingEtude = async () => {
    if (!etudeId) return;

    const { data: etude } = await supabase
      .from("etudes")
      .select("*")
      .eq("id", etudeId)
      .maybeSingle();

    if (etude) {
      setCurrentEtudeId(etude.id);
      // Consommation
      setConsoAnnuelle(etude.consommation_annuelle_kwh || 0);
      setFactureMensuelle(etude.facture_annuelle_euros ? etude.facture_annuelle_euros / 12 : 0);
      // Visite technique - Toiture
      setOmbreToiture(etude.ombre_toiture || "0 à 5%");
      setSurfaceToiture(etude.surface_toiture || "OK");
      setTypeToiture(etude.type_toiture || "TUILE");
      setEtatToiture(etude.etat_toiture || "OK");
      // Compteur électrique
      setTypeCompteurElectrique(etude.type_compteur_electrique || "Linky");
      setNumeroPdl(etude.numero_pdl || "");
      setTypeRaccordement(etude.type_raccordement || "MONOPHASÉ");
      // Tableau électrique
      setAmperageDisjoncteur(etude.amperage_disjoncteur || 45);
      setEmplacementBoitier(etude.emplacement_boitier || "À côté");
      // Résultat visite
      setPotentielFaisabilite(etude.potentiel_faisabilite || "Faisable");
      // Préconisation
      setPuissanceKwc(etude.puissance_kwc || 0);
      setTypeRevente(etude.type_revente || "surplus");
      setSupportInstallation(etude.support || "TOITURE SURIMPOSITION");
      setOrientation(etude.orientation || "SUD");
      setInclinaison(etude.inclinaison || 30);
      // Données techniques
      setSurfaceInstallation(etude.surface_installation_m2 || 0);
      setRendementProductivite(etude.rendement_productivite || 100);
      // Surcoûts
      setSelectedSurcouts(etude.surcouts as string[] || []);
      setSurcoutSupport(etude.surcout_support || 0);
      setSurcoutCompteur(etude.surcout_compteur || 0);
      setAutreSurcout(etude.autre_surcout || 0);
      // Modes
      setModeHejjaPsh(etude.mode_hejja_psh || false);
      setModeHejjaPrix(etude.mode_hejja_prix || false);
      // Classification
      setClassification(etude.classification || "");
      setOriginalClassification(etude.classification || "");
      setClassificationComment(etude.classification_comment || "");
      // R2 Date/Heure
      if (etude.r2_date_heure) {
        const r2Date = new Date(etude.r2_date_heure);
        setR2DateHeure(r2Date);
        setR2Time(format(r2Date, "HH:mm"));
      }

      // Charger l'historique des classifications
      const { data: history } = await supabase
        .from("etudes_classification_history")
        .select("*")
        .eq("etude_id", etudeId)
        .order("created_at", { ascending: false });

      if (history) {
        setClassificationHistory(history);
      }
    }
  };

  // Mise à jour automatique quand le département change
  useEffect(() => {
    console.log("[DEBUG] useEffect département:", departement, "| dataPsh.length:", dataPsh.length);
    if (departement && dataPsh.length > 0) {
      const pshData = dataPsh.find((p) => p.department_code === departement);
      console.log("[DEBUG] PSH trouvé pour", departement, ":", pshData);
      if (pshData) {
        setHeuresEnsoleillement(pshData.heures_ensoleillement_annuel || 2890);
      } else {
        console.log("[DEBUG] Aucun PSH trouvé! Codes disponibles:", dataPsh.map(p => p.department_code).slice(0, 10));
      }
    }
  }, [departement, dataPsh]);

  // Mise à jour du surcoût compteur selon le type de raccordement
  useEffect(() => {
    const compteur = dataCompteurs.find(c => c.type_compteur === typeRaccordement);
    if (compteur) {
      setSurcoutCompteur(compteur.montant);
    }
  }, [typeRaccordement, dataCompteurs]);

  // Mise à jour du surcoût support selon le type de support
  useEffect(() => {
    // Surcoûts support selon l'Excel
    const surcoûtsSupport: Record<string, number> = {
      "PERGOLA / CARPORT": 3900,
      "BAC GSE (SOL)": 1800,
      "TOITURE SURIMPOSITION": 0,
      "TOITURE INTEGRATION": 0,
    };
    setSurcoutSupport(surcoûtsSupport[supportInstallation] || 0);
  }, [supportInstallation]);

  // Mise à jour automatique du rendement selon orientation et inclinaison
  useEffect(() => {
    if (dataOrientation.length > 0) {
      const orientData = dataOrientation.find(
        (o) => o.orientation.toUpperCase() === orientation.toUpperCase() && o.inclinaison === inclinaison
      );
      if (orientData) {
        // Coefficient d'orientation converti en pourcentage (ex: 1.0 = 100%, 0.95 = 95%)
        setRendementProductivite(Math.round(orientData.coefficient * 100));
      }
    }
  }, [orientation, inclinaison, dataOrientation]);

  // Mise à jour de la surface d'installation quand la puissance change
  useEffect(() => {
    if (puissanceKwc) {
      // Surface = puissance × 4 m² par kWc (selon Excel: 6kWc = 24m²)
      setSurfaceInstallation(Number(puissanceKwc) * 4);
    }
  }, [puissanceKwc]);

  // Rien à faire ici maintenant - le taux vient de dataFinancements

  const calculateResults = () => {
    if (!puissanceKwc || !consoAnnuelle) return;

    const puissance = Number(puissanceKwc);
    const conso = Number(consoAnnuelle);
    const facture = Number(factureMensuelle || 0);

    // Get orientation coefficient (maintenant stocké dans rendementProductivite en %)
    const rendementCoeff = rendementProductivite / 100;

    // === PRODUCTION ANNUELLE ===
    // Deux modes de calcul :
    // - PSH : Puissance × PSH × Rendement
    // - Heures : Puissance × Heures × Rendement
    const pshData = dataPsh.find((p) => p.department_code === departement);
    const pshValue = pshData?.psh_value || 1200;
    
    let productionAnnuelle = 0;
    if (usePshCalculation) {
      // Méthode PSH (kWh/kWc/an)
      productionAnnuelle = puissance * pshValue * rendementCoeff;
    } else {
      // Méthode Heures d'ensoleillement
      productionAnnuelle = puissance * heuresEnsoleillement * rendementCoeff;
    }

    // === SURPLUS DE PRODUCTION ===
    // Surplus = Production - Consommation (si positif)
    const surplusProduction = Math.max(0, productionAnnuelle - conso);

    // === AUTOCONSOMMATION % ===
    // Formule Excel : (Production / Consommation) × 100
    // Si production >= consommation, autoconso > 100% = VALIDE
    const autoconsoPct = (productionAnnuelle / conso) * 100;

    // === PRIX INSTALLATION ===
    const bouquet = dataBouquets.find((b) => b.id === bouquetId);
    
    // Priorité : prixInstallationManuel > prixManuel (mode HEJJA) > prix bouquet
    let prixInstallation = 0;
    if (prixInstallationManuel) {
      prixInstallation = Number(prixInstallationManuel);
    } else if (bouquet) {
      prixInstallation = modeHejjaPrix && prixManuel
        ? Number(prixManuel)
        : modeHejjaPrix
        ? bouquet.prix_max
        : bouquet.prix_recommande;
    } else {
      prixInstallation = puissance * 4500; // Prix par défaut si pas de bouquet
    }

    // === SURCOÛTS ===
    const prixSurcoûtsOptions = selectedSurcouts.reduce((total, code) => {
      const surcout = dataSurcouts.find((s) => s.code === code);
      return total + (surcout?.prix || 0);
    }, 0);
    const prixSurcouts = prixSurcoûtsOptions + surcoutSupport + surcoutCompteur + autreSurcout;

    const prixTotalHorsAides = prixInstallation + prixSurcouts;

    // === PRIME AUTOCONSOMMATION (depuis data_aides) ===
    // La prime s'applique pour tous les bouquets > 3 kWc
    let primeAutoconsommation = 0;
    if (puissance > 3) {
      // Chercher l'aide prime_autoconso applicable selon la puissance
      const primeAide = dataAides.find(
        (a) => a.code.startsWith("prime_autoconso") && 
               a.actif &&
               puissance >= (a.puissance_min || 0) && 
               puissance <= (a.puissance_max || 999)
      );
      if (primeAide) {
        if (primeAide.type_calcul === "par_kwc") {
          primeAutoconsommation = puissance * primeAide.valeur;
        } else if (primeAide.type_calcul === "fixe") {
          primeAutoconsommation = primeAide.valeur;
        }
      }
    }

    // === ECO TVA (depuis data_aides) ===
    // Chercher l'aide eco_tva applicable selon la puissance
    const ecoTvaAide = dataAides.find(
      (a) => a.code.startsWith("eco_tva") && 
             puissance >= a.puissance_min && 
             puissance <= a.puissance_max
    );
    let ecoTva = 0;
    if (ecoTvaAide) {
      if (ecoTvaAide.type_calcul === "pourcentage") {
        // Pour installations ≤ 3kWc : TVA réduite 10% au lieu de 20% = économie ~16.67%
        // Pour installations > 3kWc : Récupération TVA 20% sur le prix total
        if (ecoTvaAide.code === "eco_tva_3kwc_plus") {
          // Récupération de 20% de TVA sur le prix total TTC
          ecoTva = prixTotalHorsAides * (ecoTvaAide.valeur / 100);
        } else {
          // Économie de TVA (10% au lieu de 20%)
          ecoTva = prixTotalHorsAides * (ecoTvaAide.valeur / 60);
        }
      } else if (ecoTvaAide.type_calcul === "fixe") {
        ecoTva = ecoTvaAide.valeur;
      }
    }

    const totalAides = primeAutoconsommation + ecoTva;
    const totalAidesDeduites = prixTotalHorsAides - totalAides;

    // === MENSUALITÉ ===
    // Si mensualité manuelle, l'utiliser, sinon calculer
    let mensualite = 0;
    const selectedFinancement = dataFinancements.find(f => f.id === financementId);
    const dureeMois = selectedFinancement?.duree_mois || 180;
    const tauxEffectif = selectedFinancement?.taux_effectif || 0;
    const tauxMensuel = tauxEffectif / 100 / 12;
    
    if (mensualiteManuelle) {
      mensualite = Number(mensualiteManuelle);
    } else if (tauxMensuel === 0) {
      mensualite = totalAidesDeduites / dureeMois;
    } else {
      // Formule de mensualité avec intérêts
      mensualite = (totalAidesDeduites * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -dureeMois));
    }

    // === RENTABILITÉ FINANCIÈRE ===
    // Autoconsommation (€) = % autoconso (plafonné à 100%) × facture mensuelle
    const autoconsoPctCapped = Math.min(autoconsoPct, 100);
    const autoconsommationEuros = (autoconsoPctCapped / 100) * facture;

    // Revente mensuelle = Surplus × Prix revente / 12
    // Chercher le tarif de revente applicable selon le type et la puissance
    const tarifRevente = dataTarifs.find(
      (t) => t.type_revente === typeRevente && 
             puissance >= t.puissance_min && 
             puissance <= t.puissance_max
    );
    const prixRevente = tarifRevente?.prix_kwh || 0.10;
    const reventeMensuelleEstimee = (surplusProduction * prixRevente) / 12;

    // Résultat transfert de charge = Autoconso € + Revente - Mensualité
    const resultatTransfertCharge = autoconsommationEuros + reventeMensuelleEstimee - mensualite;

    // === VERDICT ===
    let verdict: "valide" | "a_etudier" | "invalide" | null = null;
    if (resultatTransfertCharge > 0) {
      verdict = "valide";
    } else if (resultatTransfertCharge >= -30) {
      verdict = "a_etudier";
    } else {
      verdict = "invalide";
    }

    setCalculatedResults({
      productionAnnuelle: Math.round(productionAnnuelle),
      surplusProduction: Math.round(surplusProduction),
      autoconsoPct: Math.round(autoconsoPct * 100) / 100,
      prixInstallation: Math.round(prixInstallation * 100) / 100,
      prixSurcouts: Math.round(prixSurcouts * 100) / 100,
      prixTotalHorsAides: Math.round(prixTotalHorsAides * 100) / 100,
      primeAutoconsommation: Math.round(primeAutoconsommation * 100) / 100,
      ecoTva: Math.round(ecoTva * 100) / 100,
      totalAides: Math.round(totalAides * 100) / 100,
      totalAidesDeduites: Math.round(totalAidesDeduites * 100) / 100,
      mensualite: Math.round(mensualite * 100) / 100,
      autoconsommationEuros: Math.round(autoconsommationEuros * 100) / 100,
      reventeMensuelleEstimee: Math.round(reventeMensuelleEstimee * 100) / 100,
      resultatTransfertCharge: Math.round(resultatTransfertCharge * 100) / 100,
      verdict,
    });
  };

  const handleSave = async () => {
    if (!clientId || !user || !calculatedResults) return;

    setSaving(true);

    const etudeData = {
      user_id: user.id,
      client_id: clientId,
      rdv_id: rdvId || null,
      // Consommation
      consommation_annuelle_kwh: consoAnnuelle || null,
      facture_annuelle_euros: Number(factureMensuelle || 0) * 12,
      // Visite technique - Toiture
      ombre_toiture: ombreToiture,
      surface_toiture: surfaceToiture,
      type_toiture: typeToiture,
      etat_toiture: etatToiture,
      // Compteur électrique
      type_compteur_electrique: typeCompteurElectrique,
      numero_pdl: numeroPdl || null,
      type_raccordement: typeRaccordement,
      // Tableau électrique
      amperage_disjoncteur: amperageDisjoncteur,
      emplacement_boitier: emplacementBoitier,
      // Résultat visite
      potentiel_faisabilite: potentielFaisabilite,
      // Préconisation
      puissance_kwc: puissanceKwc || null,
      type_revente: typeRevente,
      support: supportInstallation,
      orientation,
      inclinaison,
      // Données techniques
      surface_installation_m2: surfaceInstallation || null,
      rendement_productivite: rendementProductivite,
      // Résultats calculs
      production_annuelle_kwh: calculatedResults.productionAnnuelle,
      autoconsommation_pct: calculatedResults.autoconsoPct,
      surplus_production_kwh: calculatedResults.surplusProduction,
      revente_kwh: calculatedResults.surplusProduction,
      // Prix
      prix_installation: calculatedResults.prixInstallation,
      surcouts: selectedSurcouts,
      surcout_support: surcoutSupport,
      surcout_compteur: surcoutCompteur,
      autre_surcout: autreSurcout,
      prix_total: calculatedResults.prixTotalHorsAides,
      // Aides
      prime_autoconsommation: calculatedResults.primeAutoconsommation,
      eco_tva: calculatedResults.ecoTva,
      total_aides: calculatedResults.totalAides,
      total_aides_deduites: calculatedResults.totalAidesDeduites,
      // Financement
      mode_financement: dataFinancements.find(f => f.id === financementId)?.nom || null,
      duree_financement_mois: dataFinancements.find(f => f.id === financementId)?.duree_mois || null,
      taux_financement: dataFinancements.find(f => f.id === financementId)?.taux_effectif || null,
      mensualite_estimee: calculatedResults.mensualite,
      // Rentabilité
      economie_autoconso_mensuelle: calculatedResults.autoconsommationEuros,
      revente_mensuelle_estimee: calculatedResults.reventeMensuelleEstimee,
      resultat_transfert_charge: calculatedResults.resultatTransfertCharge,
      resultat_mensuel: calculatedResults.resultatTransfertCharge,
      verdict: calculatedResults.verdict,
      mode_hejja_psh: modeHejjaPsh,
      mode_hejja_prix: modeHejjaPrix,
      classification: classification || null,
      classification_comment: classificationComment || null,
      classification_updated_at: classification ? new Date().toISOString() : null,
      classification_updated_by: classification ? user.id : null,
      r2_date_heure: (classification === "r2" || classification === "r2_prestudy") && r2DateHeure
        ? new Date(`${format(r2DateHeure, "yyyy-MM-dd")}T${r2Time}:00`).toISOString()
        : null,
    };

    let savedEtudeId: string | null = null;
    let error: Error | null = null;

    if (isEditMode && currentEtudeId) {
      // UPDATE existing étude
      const result = await supabase
        .from("etudes")
        .update(etudeData)
        .eq("id", currentEtudeId)
        .select()
        .single();
      
      error = result.error;
      savedEtudeId = currentEtudeId;
    } else {
      // INSERT new étude
      const result = await supabase
        .from("etudes")
        .insert(etudeData)
        .select()
        .single();
      
      error = result.error;
      savedEtudeId = result.data?.id || null;
    }

    if (error) {
      console.error("Erreur sauvegarde:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder l'étude",
      });
      setSaving(false);
    } else {
      // Sauvegarder l'historique de classification si la classification a changé
      const classificationChanged = classification !== originalClassification;
      const r2DateTime = (classification === "r2" || classification === "r2_prestudy") && r2DateHeure
        ? new Date(`${format(r2DateHeure, "yyyy-MM-dd")}T${r2Time}:00`).toISOString()
        : null;
      
      if (classification && savedEtudeId && classificationChanged) {
        await supabase.from("etudes_classification_history").insert({
          etude_id: savedEtudeId,
          user_id: user.id,
          classification: classification,
          comment: classificationComment || null,
          r2_date_heure: r2DateTime,
        });
      }
      
      // Créer automatiquement un RDV R2 si une date est définie
      if ((classification === "r2" || classification === "r2_prestudy") && r2DateTime && savedEtudeId) {
        // Vérifier s'il existe déjà un RDV R2 pour cette étude
        const { data: existingR2Rdv } = await supabase
          .from("rdv")
          .select("id")
          .eq("etude_id", savedEtudeId)
          .eq("is_r2", true)
          .maybeSingle();
        
        if (existingR2Rdv) {
          // Mettre à jour le RDV existant
          await supabase
            .from("rdv")
            .update({
              date_heure: r2DateTime,
              r2_type: classification,
              status: "nouveau",
            })
            .eq("id", existingR2Rdv.id);
        } else {
          // Créer un nouveau RDV R2
          await supabase.from("rdv").insert({
            user_id: user.id,
            client_id: clientId,
            etude_id: savedEtudeId,
            date_heure: r2DateTime,
            duree_minutes: 90,
            type_projet: "photovoltaique",
            status: "nouveau",
            source: "r2_etude",
            is_r2: true,
            r2_type: classification,
            commentaire: `R2 ${classification === "r2_prestudy" ? "Pré-étude" : ""} - ${classificationComment || "Suivi étude"}`,
          });
        }
        
        toast({
          title: "RDV R2 créé",
          description: `Un rendez-vous R2 a été planifié pour le ${format(new Date(r2DateTime), "dd/MM/yyyy 'à' HH:mm")}`,
        });
      }
      
      // Envoyer notification WhatsApp au confirmateur si classification définie
      if (classification && classificationChanged) {
        // Construire les données PDF pour r2_prestudy
        const pdfDataForWhatsApp = classification === "r2_prestudy" ? buildPdfData() : undefined;
        
        await sendWhatsAppNotification({
          clientName: clientName,
          clientPrenom: clientPrenom,
          classification: classification,
          comment: classificationComment,
          r2DateTime: r2DateTime,
          userId: user.id,
          cqTime: cqTime,
          pdfData: pdfDataForWhatsApp || undefined,
        });
      }

      // Créer une vente automatiquement si statut Positif et changement de classification
      if (classification === "positif" && classificationChanged && savedEtudeId && clientId) {
        // Vérifier s'il existe déjà une vente pour cette étude
        const { data: existingVente } = await supabase
          .from("ventes")
          .select("id")
          .eq("etude_id", savedEtudeId)
          .maybeSingle();

        if (!existingVente) {
          // Créer la vente
          const { error: venteError } = await supabase.from("ventes").insert({
            user_id: user.id,
            client_id: clientId,
            etude_id: savedEtudeId,
            montant_ht: calculatedResults?.prixTotalHorsAides || 0,
            montant_ttc: calculatedResults?.prixTotalHorsAides || 0,
            puissance_kwc: Number(puissanceKwc) || null,
            nombre_panneaux: Math.ceil((Number(puissanceKwc) || 0) / 0.5), // ~500W par panneau
            type_installation: supportInstallation,
            status: "signe",
            date_signature: new Date().toISOString(),
            notes: classificationComment || "Vente créée automatiquement depuis étude positive",
          });

          if (!venteError) {
            toast({
              title: "Vente créée",
              description: `Une vente de ${(calculatedResults?.prixTotalHorsAides || 0).toLocaleString("fr-FR")}€ a été enregistrée`,
            });
          }
        }
      }
      
      // Afficher l'animation de succès
      setShowSuccess(true);
      setSaving(false);
      
      toast({
        title: isEditMode ? "Étude modifiée" : "Étude créée",
        description: isEditMode 
          ? "L'étude a été mise à jour avec succès" 
          : "L'étude a été enregistrée avec succès",
      });
      
      // Attendre l'animation avant de naviguer
      setTimeout(() => {
        setShowSuccess(false);
        navigate(`/clients/${clientId}`);
      }, 1500);
    }
  };

  const handleExportPdf = () => {
    if (!calculatedResults) return;
    
    setExporting(true);
    
    const selectedBouquet = dataBouquets.find(b => b.id === bouquetId);
    const selectedFinancement = dataFinancements.find(f => f.id === financementId);
    
    const pdfData: EtudeData = {
      // Client
      clientNom: clientName,
      clientPrenom: clientPrenom,
      clientAdresse: clientAdresse,
      clientVille: clientVille,
      clientCodePostal: clientCodePostal,
      departement: departement,
      dateEtude: new Date().toLocaleDateString("fr-FR"),
      
      // Visite technique
      ombreToiture: ombreToiture,
      surfaceToiture: surfaceToiture,
      typeToiture: typeToiture,
      etatToiture: etatToiture,
      orientation: orientation,
      inclinaison: inclinaison,
      
      // Compteur
      typeCompteurElectrique: typeCompteurElectrique,
      numeroPdl: numeroPdl,
      typeRaccordement: typeRaccordement,
      amperageDisjoncteur: amperageDisjoncteur,
      emplacementBoitier: emplacementBoitier,
      potentielFaisabilite: potentielFaisabilite,
      
      // Consommation
      consoAnnuelle: Number(consoAnnuelle) || 0,
      factureMensuelle: Number(factureMensuelle) || 0,
      
      // Préconisation
      bouquetNom: selectedBouquet?.nom_bouquet || "Non défini",
      puissanceKwc: Number(puissanceKwc) || 0,
      typeRevente: typeRevente,
      supportInstallation: supportInstallation,
      
      // Données techniques
      surfaceInstallation: Number(surfaceInstallation) || 0,
      heuresEnsoleillement: heuresEnsoleillement,
      rendementProductivite: rendementProductivite,
      
      // Résultats calculs
      productionAnnuelle: calculatedResults.productionAnnuelle,
      surplusProduction: calculatedResults.surplusProduction,
      autoconsoPct: calculatedResults.autoconsoPct,
      
      // Prix
      prixInstallation: calculatedResults.prixInstallation,
      surcoutSupport: surcoutSupport,
      surcoutCompteur: surcoutCompteur,
      autreSurcout: autreSurcout,
      prixTotalHorsAides: calculatedResults.prixTotalHorsAides,
      
      // Aides
      primeAutoconsommation: calculatedResults.primeAutoconsommation,
      ecoTva: calculatedResults.ecoTva,
      totalAides: calculatedResults.totalAides,
      totalAidesDeduites: calculatedResults.totalAidesDeduites,
      
      // Financement
      financementNom: selectedFinancement?.nom || "Non défini",
      tauxFinancement: selectedFinancement?.taux_effectif || 0,
      dureeMois: selectedFinancement?.duree_mois || 180,
      mensualite: calculatedResults.mensualite,
      
      // Rentabilité
      autoconsommationEuros: calculatedResults.autoconsommationEuros,
      reventeMensuelleEstimee: calculatedResults.reventeMensuelleEstimee,
      resultatTransfertCharge: calculatedResults.resultatTransfertCharge,
      verdict: calculatedResults.verdict || "invalide",
      
      // Classification
      classification: classification || undefined,
      classificationComment: classificationComment || undefined,
    };
    
    try {
      exportEtudePdf(pdfData);
      toast({
        title: "PDF exporté",
        description: "L'étude a été téléchargée",
      });
    } catch (error) {
      console.error("Erreur export PDF:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'exporter le PDF",
      });
    } finally {
      setExporting(false);
    }
  };

  const buildPdfData = (): EtudeData | null => {
    if (!calculatedResults) return null;
    
    const selectedBouquet = dataBouquets.find(b => b.id === bouquetId);
    const selectedFinancement = dataFinancements.find(f => f.id === financementId);
    
    return {
      clientNom: clientName,
      clientPrenom: clientPrenom,
      clientAdresse: clientAdresse,
      clientVille: clientVille,
      clientCodePostal: clientCodePostal,
      departement: departement,
      dateEtude: new Date().toLocaleDateString("fr-FR"),
      ombreToiture: ombreToiture,
      surfaceToiture: surfaceToiture,
      typeToiture: typeToiture,
      etatToiture: etatToiture,
      orientation: orientation,
      inclinaison: inclinaison,
      typeCompteurElectrique: typeCompteurElectrique,
      numeroPdl: numeroPdl,
      typeRaccordement: typeRaccordement,
      amperageDisjoncteur: amperageDisjoncteur,
      emplacementBoitier: emplacementBoitier,
      potentielFaisabilite: potentielFaisabilite,
      consoAnnuelle: Number(consoAnnuelle) || 0,
      factureMensuelle: Number(factureMensuelle) || 0,
      bouquetNom: selectedBouquet?.nom_bouquet || "Non défini",
      puissanceKwc: Number(puissanceKwc) || 0,
      typeRevente: typeRevente,
      supportInstallation: supportInstallation,
      surfaceInstallation: Number(surfaceInstallation) || 0,
      heuresEnsoleillement: heuresEnsoleillement,
      rendementProductivite: rendementProductivite,
      productionAnnuelle: calculatedResults.productionAnnuelle,
      surplusProduction: calculatedResults.surplusProduction,
      autoconsoPct: calculatedResults.autoconsoPct,
      prixInstallation: calculatedResults.prixInstallation,
      surcoutSupport: surcoutSupport,
      surcoutCompteur: surcoutCompteur,
      autreSurcout: autreSurcout,
      prixTotalHorsAides: calculatedResults.prixTotalHorsAides,
      primeAutoconsommation: calculatedResults.primeAutoconsommation,
      ecoTva: calculatedResults.ecoTva,
      totalAides: calculatedResults.totalAides,
      totalAidesDeduites: calculatedResults.totalAidesDeduites,
      financementNom: selectedFinancement?.nom || "Non défini",
      tauxFinancement: selectedFinancement?.taux_effectif || 0,
      dureeMois: selectedFinancement?.duree_mois || 180,
      mensualite: calculatedResults.mensualite,
      autoconsommationEuros: calculatedResults.autoconsommationEuros,
      reventeMensuelleEstimee: calculatedResults.reventeMensuelleEstimee,
      resultatTransfertCharge: calculatedResults.resultatTransfertCharge,
      verdict: calculatedResults.verdict || "invalide",
      classification: classification || undefined,
      classificationComment: classificationComment || undefined,
    };
  };

  const handlePreview = () => {
    const pdfData = buildPdfData();
    if (!pdfData) return;
    
    const dataUrl = getEtudePdfDataUrl(pdfData);
    setPdfDataUrl(dataUrl);
    setShowPreview(true);
  };

  const handleShare = async () => {
    const pdfData = buildPdfData();
    if (!pdfData) return;
    
    try {
      const blob = getEtudePdfBlob(pdfData);
      const fileName = `Etude_${clientName}_${clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Étude photovoltaïque - ${clientPrenom} ${clientName}`,
          text: `Étude de faisabilité pour ${clientPrenom} ${clientName}`,
          files: [file],
        });
      } else {
        // Fallback: télécharger le PDF
        exportEtudePdf(pdfData);
        toast({
          title: "PDF téléchargé",
          description: "Partagez-le depuis vos fichiers",
        });
      }
    } catch (error) {
      console.error("Erreur partage:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de partager le PDF",
      });
    }
  };

  const getVerdictDisplay = () => {
    if (!calculatedResults?.verdict) return null;

    switch (calculatedResults.verdict) {
      case "valide":
        return (
          <Badge className="bg-status-signed text-white text-sm px-3 py-1">VALIDE</Badge>
        );
      case "a_etudier":
        return (
          <Badge className="bg-status-reported text-white text-sm px-3 py-1">À Étudier</Badge>
        );
      case "invalide":
        return (
          <Badge className="bg-status-negative text-white text-sm px-3 py-1">INVALIDE</Badge>
        );
    }
  };

  const getClassificationLabel = (value: string) => {
    switch (value) {
      case "positif":
        return "✅ Positif - Vente signée";
      case "negatif":
        return "❌ Négatif - Projet abandonné";
      case "r2":
        return "📈 R2 - Second rendez-vous";
      case "r2_prestudy":
        return "⚠️ R2 Pré-étude - En attente";
      default:
        return value;
    }
  };

  if (loading) {
    return (
      <MobileLayout title={isEditMode ? "Modifier l'étude" : "Nouvelle étude"}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      {/* Overlay de succès avec animation */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="flex flex-col items-center gap-4 animate-scale-in">
            <div className="h-20 w-20 rounded-full bg-status-signed flex items-center justify-center">
              <Check className="h-10 w-10 text-white animate-[bounce_0.5s_ease-in-out]" />
            </div>
            <p className="text-lg font-bold text-foreground">Étude sauvegardée !</p>
            <p className="text-sm text-muted-foreground">Redirection en cours...</p>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-foreground">
              Étude Photovoltaïque
            </h1>
            {clientName && (
              <p className="text-sm text-muted-foreground">
                {clientPrenom} {clientName} • {clientVille}
              </p>
            )}
          </div>
        </div>

        {/* Mode HEJJA */}
        <Card className={`shadow-card border-2 transition-all ${modeHejjaActive ? "border-amber-500 bg-amber-500/5" : "border-primary/30 bg-primary/5"}`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                {modeHejjaActive ? (
                  <ShieldCheck className="h-4 w-4 text-amber-600" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Mode Interne HEJJA
              </CardTitle>
              {modeHejjaActive && (
                <Badge className="bg-amber-500 text-white">ACTIF</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {!modeHejjaActive ? (
              <Button
                variant="outline"
                className="w-full gap-2 border-primary/30"
                onClick={() => setShowPinDialog(true)}
              >
                <Lock className="h-4 w-4" />
                Déverrouiller le mode HEJJA
              </Button>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Prix élevé</p>
                    <p className="text-xs text-muted-foreground">Grille prix max</p>
                  </div>
                  <Switch
                    checked={modeHejjaPrix}
                    onCheckedChange={setModeHejjaPrix}
                  />
                </div>
                {modeHejjaPrix && (
                  <div className="pt-2">
                    <Label>Prix manuel (optionnel)</Label>
                    <Input
                      type="number"
                      placeholder="Prix en €"
                      value={prixManuel}
                      onChange={(e) => setPrixManuel(e.target.value ? Number(e.target.value) : "")}
                    />
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => {
                    setModeHejjaActive(false);
                    setModeHejjaPsh(false);
                    setModeHejjaPrix(false);
                    setPrixManuel("");
                  }}
                >
                  Désactiver le mode HEJJA
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* PIN Dialog */}
        <PinDialog
          open={showPinDialog}
          onOpenChange={setShowPinDialog}
          onSuccess={() => setModeHejjaActive(true)}
          title="Mode HEJJA"
          description="Entrez le code PIN interne pour activer le mode HEJJA"
        />

        {/* =============== ÉTUDE TECHNIQUE =============== */}
        <div className="pt-2">
          <h2 className="text-lg font-display font-bold text-center text-primary mb-4">
            ÉTUDE TECHNIQUE
          </h2>
        </div>

        {/* VISITE TECHNIQUE - TOITURE */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              Visite Technique - Toiture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Ombre sur toiture</Label>
                <Select value={ombreToiture} onValueChange={setOmbreToiture}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0 à 5%">0 à 5%</SelectItem>
                    <SelectItem value="5 à 15%">5 à 15%</SelectItem>
                    <SelectItem value="15 à 30%">15 à 30%</SelectItem>
                    <SelectItem value="> 30%">&gt; 30%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Surface Toiture</Label>
                <Select value={surfaceToiture} onValueChange={setSurfaceToiture}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="LIMITE">LIMITE</SelectItem>
                    <SelectItem value="NON CONFORME">NON CONFORME</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type de Toiture</Label>
                <Select value={typeToiture} onValueChange={setTypeToiture}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TUILE">TUILE</SelectItem>
                    <SelectItem value="ARDOISE">ARDOISE</SelectItem>
                    <SelectItem value="BAC ACIER">BAC ACIER</SelectItem>
                    <SelectItem value="FIBROCIMENT">FIBROCIMENT</SelectItem>
                    <SelectItem value="TOIT PLAT">TOIT PLAT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">État Toiture</Label>
                <Select value={etatToiture} onValueChange={setEtatToiture}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="À RÉNOVER">À RÉNOVER</SelectItem>
                    <SelectItem value="NON CONFORME">NON CONFORME</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Orientation Toiture</Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUD">SUD</SelectItem>
                    <SelectItem value="SUD-EST">SUD-EST</SelectItem>
                    <SelectItem value="SUD-OUEST">SUD-OUEST</SelectItem>
                    <SelectItem value="EST">EST</SelectItem>
                    <SelectItem value="OUEST">OUEST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Inclinaison Toiture</Label>
                <Select value={String(inclinaison)} onValueChange={(v) => setInclinaison(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0°</SelectItem>
                    <SelectItem value="30">30°</SelectItem>
                    <SelectItem value="45">45°</SelectItem>
                    <SelectItem value="60">60°</SelectItem>
                    <SelectItem value="90">90°</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* COMPTEUR ÉLECTRIQUE */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              Compteur Électrique
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Compteur</Label>
                <Select value={typeCompteurElectrique} onValueChange={setTypeCompteurElectrique}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Linky">Linky</SelectItem>
                    <SelectItem value="Électromécanique">Électromécanique</SelectItem>
                    <SelectItem value="Électronique">Électronique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type de Compteur</Label>
                <Select value={typeRaccordement} onValueChange={setTypeRaccordement}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONOPHASÉ">MONOPHASÉ</SelectItem>
                    <SelectItem value="TRIPHASÉ">TRIPHASÉ (+{dataCompteurs.find(c => c.type_compteur === "TRIPHASÉ")?.montant || 500}€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Numéro PDL</Label>
              <Input
                type="text"
                placeholder="ex: 16271345864078"
                value={numeroPdl}
                onChange={(e) => setNumeroPdl(e.target.value)}
                className="h-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* TABLEAU ÉLECTRIQUE */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Tableau Électrique
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Ampérage Disjoncteur</Label>
                <Select value={String(amperageDisjoncteur)} onValueChange={(v) => setAmperageDisjoncteur(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dataCalibres.map((c) => (
                      <SelectItem key={c.id} value={String(c.calibre_amperes)}>
                        {c.calibre_amperes} A ({c.puissance_kva} kVA)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Emplacement Boîtier</Label>
                <Select value={emplacementBoitier} onValueChange={setEmplacementBoitier}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="À côté">À côté</SelectItem>
                    <SelectItem value="Distant (&lt; 10m)">Distant (&lt; 10m)</SelectItem>
                    <SelectItem value="Distant (&gt; 10m)">Distant (&gt; 10m)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RÉSULTAT VISITE TECHNIQUE */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-secondary/20">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-secondary" />
              Résultat de la Visite Technique
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div>
              <Label className="text-xs">Potentiel de Faisabilité Technique (PFT)</Label>
              <Select value={potentielFaisabilite} onValueChange={setPotentielFaisabilite}>
                <SelectTrigger className={`h-10 ${
                  potentielFaisabilite === "Faisable" ? "bg-status-signed/10 border-status-signed text-status-signed" :
                  potentielFaisabilite === "À étudier" ? "bg-status-reported/10 border-status-reported text-status-reported" :
                  "bg-status-negative/10 border-status-negative text-status-negative"
                }`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Faisable">Faisable</SelectItem>
                  <SelectItem value="À étudier">À étudier</SelectItem>
                  <SelectItem value="Non faisable">Non faisable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* =============== PRÉCONISATION TECHNIQUE =============== */}
        <div className="pt-4">
          <h2 className="text-lg font-display font-bold text-center text-primary mb-4">
            PRÉCONISATION TECHNIQUE
          </h2>
        </div>

        {/* CONSOMMATIONS */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-secondary" />
              Consommations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Consommation annuelle</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="ex: 11600"
                    value={consoAnnuelle}
                    onChange={(e) => setConsoAnnuelle(e.target.value ? Number(e.target.value) : "")}
                    className="h-9"
                  />
                  <span className="flex items-center text-xs text-muted-foreground">kWh/an</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Facture mensuelle (hors abo)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="ex: 230"
                    value={factureMensuelle}
                    onChange={(e) => setFactureMensuelle(e.target.value ? Number(e.target.value) : "")}
                    className="h-9"
                  />
                  <span className="flex items-center text-xs text-muted-foreground">€/mois</span>
                </div>
              </div>
            </div>
            {/* Prix unitaire calculé */}
            {consoAnnuelle && factureMensuelle && Number(consoAnnuelle) > 0 && (
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-xs text-muted-foreground">Prix unitaire kWh (calculé)</p>
                <p className="font-bold text-primary">
                  {((Number(factureMensuelle) * 12) / Number(consoAnnuelle)).toFixed(4)} €/kWh
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Facture annuelle : {(Number(factureMensuelle) * 12).toLocaleString("fr-FR")} €
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PRÉCONISATION */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sun className="h-4 w-4 text-primary" />
              Préconisation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div>
              <Label className="text-xs">Bouquet</Label>
              <Select value={bouquetId} onValueChange={(v) => {
                setBouquetId(v);
                const b = dataBouquets.find((b) => b.id === v);
                if (b) setPuissanceKwc(b.puissance_kwc);
              }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choisir un bouquet" />
                </SelectTrigger>
                <SelectContent>
                  {dataBouquets.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nom_bouquet} ({b.puissance_kwc} kWc)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Puissance Préconisée (kWc)</Label>
                <Input
                  type="number"
                  step="1"
                  value={puissanceKwc}
                  onChange={(e) => setPuissanceKwc(e.target.value ? Number(e.target.value) : "")}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Type de Revente</Label>
                <Select value={typeRevente} onValueChange={setTypeRevente}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choisir un type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(dataTarifs.map(t => t.type_revente))].map((type) => {
                      const label = type === "autoconsommation" ? "Autoconsommation" :
                                    type === "revente_totale" ? "Revente totale" :
                                    type === "surplus" ? "Surplus" : type;
                      return (
                        <SelectItem key={type} value={type}>
                          {label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Support d'installation</Label>
              <Select value={supportInstallation} onValueChange={setSupportInstallation}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOITURE SURIMPOSITION">TOITURE SURIMPOSITION (0€)</SelectItem>
                  <SelectItem value="TOITURE INTEGRATION">TOITURE INTÉGRATION (0€)</SelectItem>
                  <SelectItem value="BAC GSE (SOL)">BAC GSE - SOL (+1 800€)</SelectItem>
                  <SelectItem value="PERGOLA / CARPORT">PERGOLA / CARPORT (+3 900€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* DONNÉES TECHNIQUES */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              Données Techniques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {/* Switch mode de calcul */}
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-amber-500" />
                <span className="text-xs font-medium">Mode de calcul production</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs ${!usePshCalculation ? "font-bold text-primary" : "text-muted-foreground"}`}>Heures</span>
                <Switch
                  checked={usePshCalculation}
                  onCheckedChange={setUsePshCalculation}
                />
                <span className={`text-xs ${usePshCalculation ? "font-bold text-primary" : "text-muted-foreground"}`}>PSH</span>
              </div>
            </div>
            
            {/* Affichage conditionnel selon le mode */}
            {usePshCalculation ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">PSH (kWh/kWc/an)</span>
                    <span className="text-xs text-amber-600/70">
                      {dataPsh.find(p => p.department_code === departement)?.department_name ?? "—"}
                    </span>
                  </div>
                  <span className="font-bold text-amber-600 text-lg">
                    {dataPsh.find(p => p.department_code === departement)?.psh_value ?? "N/A"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Formule : Puissance × PSH × Rendement
                </p>
              </div>
            ) : (
              <div>
                <Label className="text-xs">Heures d'ensoleillement (Heures/An)</Label>
                <Input
                  type="number"
                  value={heuresEnsoleillement}
                  onChange={(e) => setHeuresEnsoleillement(Number(e.target.value) || 2890)}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Formule: Puissance × Heures × Rendement
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Surface d'installation (m²)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    value={surfaceInstallation}
                    onChange={(e) => setSurfaceInstallation(e.target.value ? Number(e.target.value) : "")}
                    className="h-9"
                  />
                  <span className="flex items-center text-xs text-muted-foreground">m²</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Rendement (auto.)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    value={rendementProductivite}
                    onChange={(e) => setRendementProductivite(Number(e.target.value) || 100)}
                    className="h-9 bg-muted/30"
                    readOnly
                  />
                  <span className="flex items-center text-xs text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Calculé selon {orientation} / {inclinaison}°
                </p>
              </div>
            </div>
            {departement && (
              <p className="text-xs text-muted-foreground text-center">
                Département: {dataPsh.find(p => p.department_code === departement)?.department_name || departement}
                {usePshCalculation && ` • PSH: ${dataPsh.find(p => p.department_code === departement)?.psh_value || "N/A"} kWh/kWc/an`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* RÉSULTAT DE LA PRÉCONISATION */}
        {calculatedResults && (
          <Card className="shadow-card border-2 border-secondary/50">
            <CardHeader className="pb-2 bg-secondary/20">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4 text-secondary" />
                Résultat de la Préconisation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Production Annuelle</p>
                  <p className="font-bold text-lg">{calculatedResults.productionAnnuelle.toLocaleString("fr-FR")} <span className="text-xs font-normal">kWh</span></p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Surplus de Production</p>
                  <p className="font-bold text-lg">{calculatedResults.surplusProduction.toLocaleString("fr-FR")} <span className="text-xs font-normal">kWh</span></p>
                </div>
              </div>
              <div className={`rounded-lg p-3 text-center ${
                calculatedResults.autoconsoPct >= 100 ? "bg-status-signed/10" :
                calculatedResults.autoconsoPct >= 80 ? "bg-status-reported/10" :
                "bg-muted/50"
              }`}>
                <p className="text-xs text-muted-foreground">Autoconsommation</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-bold text-xl">{calculatedResults.autoconsoPct.toFixed(2)}%</span>
                  {calculatedResults.autoconsoPct >= 100 && (
                    <Badge className="bg-status-signed text-white">VALIDE</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* =============== PRÉ-ÉTUDE FINANCIÈRE =============== */}
        <div className="pt-4">
          <h2 className="text-lg font-display font-bold text-center text-primary mb-4">
            PRÉ-ÉTUDE FINANCIÈRE
          </h2>
        </div>

        {/* PRIX & AIDES */}
        {calculatedResults && (
          <div className="grid grid-cols-2 gap-3">
            {/* PRIX */}
            <Card className="shadow-card">
              <CardHeader className="pb-2 bg-primary/10">
                <CardTitle className="text-xs flex items-center gap-1">
                  <Euro className="h-3 w-3" />
                  PRIX
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-2 text-xs">
                <div>
                  <label className="text-xs text-muted-foreground">Prix Installation TTC</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={prixInstallationManuel || ""}
                    onChange={(e) => setPrixInstallationManuel(e.target.value ? Number(e.target.value) : "")}
                    placeholder={`Base: ${calculatedResults.prixInstallation.toFixed(0)}€`}
                    className="h-7 text-xs font-medium"
                  />
                </div>
                <div className="flex justify-between pt-1">
                  <span>Installation TTC</span>
                  <span className="font-medium">{calculatedResults.prixInstallation.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Surcoût Support</span>
                  <span>{surcoutSupport.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Surcoût Compteur</span>
                  <span>{surcoutCompteur.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Autre Surcoût</span>
                  <Input
                    type="number"
                    value={autreSurcout}
                    onChange={(e) => setAutreSurcout(Number(e.target.value) || 0)}
                    className="h-6 w-16 text-right text-xs"
                  />
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-bold">
                  <span>TOTAL Hors Aides</span>
                  <span>{calculatedResults.prixTotalHorsAides.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
                <div className="flex justify-between text-status-signed">
                  <span>TOTAL Aides</span>
                  <span>{calculatedResults.totalAides.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
                <div className="flex justify-between font-bold text-primary bg-primary/10 rounded p-1 mt-1">
                  <span>Aides Déduites</span>
                  <span>{calculatedResults.totalAidesDeduites.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
              </CardContent>
            </Card>

            {/* AIDES */}
            <Card className="shadow-card">
              <CardHeader className="pb-2 bg-status-signed/10">
                <CardTitle className="text-xs flex items-center gap-1">
                  <PiggyBank className="h-3 w-3 text-status-signed" />
                  AIDES
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-2 text-xs">
                <div className="flex justify-between">
                  <span>Prime Autoconso</span>
                  <span className="font-medium text-status-signed">{calculatedResults.primeAutoconsommation.toLocaleString("fr-FR")}€</span>
                </div>
                <div className="flex justify-between">
                  <span>ECO TVA</span>
                  <span className="font-medium text-status-signed">{calculatedResults.ecoTva.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
                <Separator className="my-2" />
                <div className="pt-2">
                  <p className="text-xs font-bold mb-1">FINANCEMENT</p>
                  <Select value={financementId} onValueChange={setFinancementId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataFinancements.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nom} ({f.taux_effectif}% - {f.duree_mois} mois)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {financementId && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <div className="flex justify-between">
                      <span>Taux effectif</span>
                      <span>{dataFinancements.find(f => f.id === financementId)?.taux_effectif}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TAEG</span>
                      <span>{dataFinancements.find(f => f.id === financementId)?.taeg}%</span>
                    </div>
                  </div>
                )}
                <div className="mt-2">
                  <label className="text-xs text-muted-foreground">Mensualité manuelle</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mensualiteManuelle}
                    onChange={(e) => setMensualiteManuelle(e.target.value ? Number(e.target.value) : "")}
                    placeholder={`Calculée: ${calculatedResults.mensualite.toFixed(2)}€`}
                    className="h-7 text-xs"
                  />
                </div>
                <div className="flex justify-between font-bold bg-muted/50 rounded p-1 mt-1">
                  <span>Mensualité</span>
                  <span>{calculatedResults.mensualite.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* RENTABILITÉ FINANCIÈRE */}
        {calculatedResults && (
          <Card className="shadow-card border-2 border-primary/50">
            <CardHeader className="pb-2 bg-primary/20">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Rentabilité Financière
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex justify-between items-center py-1">
                <span className="text-sm">Autoconsommation (€)</span>
                <span className="font-medium">{calculatedResults.autoconsommationEuros.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm">Revente Mensuelle Estimative (€)</span>
                <span className="font-medium">{calculatedResults.reventeMensuelleEstimee.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
              </div>
              <Separator />
              <div className={`rounded-lg p-4 text-center ${
                calculatedResults.resultatTransfertCharge > 0 ? "bg-status-signed/10" :
                calculatedResults.resultatTransfertCharge >= -30 ? "bg-status-reported/10" :
                "bg-status-negative/10"
              }`}>
                <p className="text-sm text-muted-foreground mb-2">Résultat Transfert de Charge</p>
                <div className="flex items-center justify-center gap-3">
                  {getVerdictDisplay()}
                  <span className={`font-bold text-2xl ${
                    calculatedResults.resultatTransfertCharge > 0 ? "text-status-signed" :
                    calculatedResults.resultatTransfertCharge >= -30 ? "text-status-reported" :
                    "text-status-negative"
                  }`}>
                    {calculatedResults.resultatTransfertCharge >= 0 ? "+" : ""}{calculatedResults.resultatTransfertCharge.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CLASSIFICATION DU DOSSIER */}
        {calculatedResults && (
          <Card className="shadow-card">
            <CardHeader className="pb-2 bg-muted/50">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                Classification du Dossier
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div>
                <Label className="text-xs">Statut du dossier</Label>
                <Select value={classification} onValueChange={setClassification}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Choisir une classification" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positif">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-status-signed" />
                        Positif - Vente signée
                      </div>
                    </SelectItem>
                    <SelectItem value="negatif">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-status-negative" />
                        Négatif - Projet abandonné
                      </div>
                    </SelectItem>
                    <SelectItem value="r2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-status-r2" />
                        R2 - Second rendez-vous
                      </div>
                    </SelectItem>
                    <SelectItem value="r2_prestudy">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-status-reported" />
                        R2 Pré-étude - En attente
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Date et heure du R2 */}
              {(classification === "r2" || classification === "r2_prestudy") && (
                <div className="p-3 bg-status-r2/10 rounded-lg border border-status-r2/30 space-y-3">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-status-r2" />
                    Date et heure du second RDV
                  </Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !r2DateHeure && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {r2DateHeure ? format(r2DateHeure, "PPP", { locale: fr }) : "Choisir une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={r2DateHeure}
                          onSelect={setR2DateHeure}
                          initialFocus
                          locale={fr}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={r2Time}
                      onChange={(e) => setR2Time(e.target.value)}
                      className="w-28"
                    />
                  </div>
                  {r2DateHeure && (
                    <p className="text-xs text-muted-foreground">
                      RDV prévu le {format(r2DateHeure, "EEEE d MMMM yyyy", { locale: fr })} à {r2Time}
                    </p>
                  )}
                </div>
              )}

              {/* Heure du CQ pour statut Positif */}
              {classification === "positif" && (
                <div className="p-3 bg-status-signed/10 rounded-lg border border-status-signed/30 space-y-3">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4 text-status-signed" />
                    Heure du CQ (lendemain)
                  </Label>
                  <Input
                    type="time"
                    value={cqTime}
                    onChange={(e) => setCqTime(e.target.value)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Contrôle Qualité prévu demain à {cqTime}
                  </p>
                </div>
              )}
              
              <div>
                <Label className="text-xs">Commentaire</Label>
                <Textarea
                  placeholder="Ajouter un commentaire sur le dossier..."
                  value={classificationComment}
                  onChange={(e) => setClassificationComment(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              
              {/* Historique des classifications */}
              {classificationHistory.length > 0 && (
                <div className="pt-2 border-t">
                  <Label className="text-xs flex items-center gap-1 mb-2">
                    <History className="h-3 w-3" />
                    Historique des changements
                  </Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {classificationHistory.map((entry) => (
                      <div key={entry.id} className="text-xs p-2 bg-muted rounded-md">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {getClassificationLabel(entry.classification)}
                          </span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(entry.created_at).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                        {entry.r2_date_heure && (
                          <p className="text-status-r2 mt-1 flex items-center gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            R2 prévu: {new Date(entry.r2_date_heure).toLocaleDateString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        )}
                        {entry.comment && (
                          <p className="text-muted-foreground mt-1 italic">"{entry.comment}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview PDF Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl h-[85vh] p-0">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Aperçu de l'étude
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden px-4 pb-4">
              {pdfDataUrl && (
                <iframe
                  src={pdfDataUrl}
                  className="w-full h-full rounded-lg border"
                  title="Aperçu PDF"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 pb-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
          >
            Annuler
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handlePreview}
            disabled={!calculatedResults}
          >
            <Eye className="h-4 w-4" />
            Aperçu
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleExportPdf}
            disabled={!calculatedResults || exporting}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleShare}
            disabled={!calculatedResults}
          >
            <Share2 className="h-4 w-4" />
            Partager
          </Button>
          <Button
            className="flex-1 bg-gradient-hero gap-2"
            onClick={handleSave}
            disabled={!calculatedResults || saving}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Sauvegarder
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
};

export default EtudeForm;
