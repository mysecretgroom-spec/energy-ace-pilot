import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import franceRenovLogo from "@/assets/logos/france-renov.png";
import ministereTransitionLogo from "@/assets/logos/ministere-transition-energetique.png";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  MessageCircle,
  Tag,
  History,
  Clock,
  Camera,
  ShieldOff,
  Cloud,
  ChevronDown,
  Link2,
  Thermometer,
} from "lucide-react";
import { QuickPhotoButton } from "@/components/scanner/QuickPhotoButton";
import { HejjaAidesEditor, AideManuelle } from "@/components/etude/HejjaAidesEditor";
import { calculerMensualiteAvecReport } from "@/lib/financingCalculation";
import { ProductTypeSelector, PACFields, ITEFields, FinancialSectionPAC, FinancialSectionITE } from "@/components/etude";
import { EnergyEvolutionCard } from "@/components/etude/EnergyEvolutionCard";
import { ConsumptionEstimator } from "@/components/etude/ConsumptionEstimator";
import { ProductType } from "@/lib/productTypes";
import { exportEtudePdf, getEtudePdfBlob, getEtudePdfDataUrl, EtudeData } from "@/lib/exportEtudePdf";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { PinDialog } from "@/components/auth/PinDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHejjaMode } from "@/hooks/useHejjaMode";
import { useToast } from "@/hooks/use-toast";

import { WhatsAppSendButton } from "@/components/crm/WhatsAppSendButton";
import { AutoSaveIndicator } from "@/components/ui/auto-save-indicator";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useOfflineData } from "@/hooks/useOfflineData";
import { useEtudePdfAutoSave } from "@/hooks/useEtudePdfAutoSave";
import { useEtudeFormPersistence } from "@/hooks/useEtudeFormPersistence";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { findOrInterpolateBouquet, getInterpolationExplanation } from "@/lib/bouquetInterpolation";

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
}

interface DataSurcout {
  id: string;
  code: string;
  nom: string;
  prix: number;
}

interface RegieSurcout {
  id: string;
  code: string;
  nom: string;
  prix: number;
  categorie: string;
  type_calcul: 'fixe' | 'par_panneau';
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
  actif: boolean;
}

const EtudeForm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const clientId = searchParams.get("clientId") || searchParams.get("client");
  const rdvIdFromUrl = searchParams.get("rdvId") || searchParams.get("rdv");
  const [resolvedRdvId, setResolvedRdvId] = useState<string | null>(rdvIdFromUrl);
  const rdvId = resolvedRdvId;
  const etudeId = searchParams.get("etudeId") || searchParams.get("etude");
  const isEditMode = !!etudeId;

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentEtudeId, setCurrentEtudeId] = useState<string | null>(etudeId);
  const [originalClassification, setOriginalClassification] = useState<string>("");
  const [localEtudeId, setLocalEtudeId] = useState<string | null>(null);
  const [existingEtudePrompt, setExistingEtudePrompt] = useState<{ etudeId: string; productType: string } | null>(null);
  const forceSyncRef = useRef(false);
  const isInsertingRef = useRef(false);
  
  // Offline data support
  const { isOnline, saveEtudeOffline, queueWhatsAppMessage } = useOfflineData();
  
  // Form persistence (sessionStorage + beforeunload protection)
  const { saveDraft, loadDraft, clearDraft, markRestorationComplete, isRestoring, setHasUnsavedChanges } = useEtudeFormPersistence({
    clientId,
    rdvId,
    etudeId,
    enabled: true,
  });
  
  // Track if form has been initialized (to avoid auto-save on first load)
  const isInitializedRef = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasRestoredDraftRef = useRef(false);
  const hasManualOverridesRef = useRef(false);
  const estimationDetailsRef = useRef<any>(null);
  const [estimationDetailsDisplay, setEstimationDetailsDisplay] = useState<any>(null);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-PRODUCT STATE - PV / PAC / ITE
  // ═══════════════════════════════════════════════════════════════════════════
  const [activeProducts, setActiveProducts] = useState<ProductType[]>(["PV"]);
  const [currentTab, setCurrentTab] = useState<ProductType>("PV");
  // productType is derived from currentTab for backward compatibility in calculations
  const productType = currentTab;
  
  // Client info
  const [clientName, setClientName] = useState("");
  const [clientPrenom, setClientPrenom] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientVille, setClientVille] = useState("");
  const [clientCodePostal, setClientCodePostal] = useState("");
  const [clientTelephone, setClientTelephone] = useState("");
  const [departement, setDepartement] = useState("");
  
  // Régie associée au RDV
  const [regieId, setRegieId] = useState<string | null>(null);
  const [regieNom, setRegieNom] = useState<string>("");

  // === VISITE TECHNIQUE - TOITURE ===
  const [ombreToiture, setOmbreToiture] = useState("");
  const [surfaceToiture, setSurfaceToiture] = useState("");
  const [typeToiture, setTypeToiture] = useState("");
  const [etatToiture, setEtatToiture] = useState("");

  // === COMPTEUR ÉLECTRIQUE ===
  const [typeCompteurElectrique, setTypeCompteurElectrique] = useState("");
  const [numeroPdl, setNumeroPdl] = useState("");
  const [typeRaccordement, setTypeRaccordement] = useState("");

  // === TABLEAU ÉLECTRIQUE ===
  const [amperageDisjoncteur, setAmperageDisjoncteur] = useState<number | "">("");
  const [emplacementBoitier, setEmplacementBoitier] = useState("");

  // === RÉSULTAT VISITE TECHNIQUE ===
  const [potentielFaisabilite, setPotentielFaisabilite] = useState("");

  // === CONSOMMATIONS ===
  const [consoAnnuelle, setConsoAnnuelle] = useState<number | "">("");
  const [factureMensuelle, setFactureMensuelle] = useState<number | "">("");
  const [consoIsEstimated, setConsoIsEstimated] = useState(false);

  // === PRÉCONISATION ===
  const [bouquetId, setBouquetId] = useState("");
  const [puissanceKwc, setPuissanceKwc] = useState<number | "">("");
  const [typeRevente, setTypeRevente] = useState("");
  const [supportInstallation, setSupportInstallation] = useState("");

  // === DONNÉES TECHNIQUES ===
  const [orientation, setOrientation] = useState("");
  const [inclinaison, setInclinaison] = useState<number | "">("");
  const [surfaceInstallation, setSurfaceInstallation] = useState<number | "">("");
  const [rendementProductivite, setRendementProductivite] = useState<number | "">(100);

  // === FINANCEMENT ===
  const [financementId, setFinancementId] = useState("");
  const [dureeMoisManuelle, setDureeMoisManuelle] = useState<number | "">("");
  const [mensualiteManuelle, setMensualiteManuelle] = useState<number | "">("");

  // === PRIX MANUEL ===
  const [prixInstallationManuel, setPrixInstallationManuel] = useState<number | "">("");
  const [isInterpolated, setIsInterpolated] = useState(false);
  const [interpolationExplanation, setInterpolationExplanation] = useState("");

  // Surcoûts
  const [selectedSurcouts, setSelectedSurcouts] = useState<string[]>([]);
  const [surcoutSupport, setSurcoutSupport] = useState(0);
  const [surcoutCompteur, setSurcoutCompteur] = useState(0);
  const [surcoutEmplacement, setSurcoutEmplacement] = useState(0);
  const [autreSurcout, setAutreSurcout] = useState(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAMPS SPÉCIFIQUES PAC
  // ═══════════════════════════════════════════════════════════════════════════
  const [pacSubtype, setPacSubtype] = useState<"air_air" | "air_eau">("air_eau");
  const [pacSurfaceChauffee, setPacSurfaceChauffee] = useState<number | "">("");
  const [pacTypeEmetteurs, setPacTypeEmetteurs] = useState("");
  const [pacNombreUnitesInt, setPacNombreUnitesInt] = useState<number | "">(1);
  const [pacPuissanceCalorifique, setPacPuissanceCalorifique] = useState<number | "">("");
  const [pacCop, setPacCop] = useState<number | "">(3.5);
  const [pacEcsIntegre, setPacEcsIntegre] = useState(false);
  const [pacVolumeBallon, setPacVolumeBallon] = useState<number | "">(0);
  const [pacEnergieActuelle, setPacEnergieActuelle] = useState("");
  const [pacConsoChaufffageKwh, setPacConsoChaufffageKwh] = useState<number | "">("");
  const [pacEconomieEstimee, setPacEconomieEstimee] = useState<number | "">(0);
  const [pacFactureChauffageEuros, setPacFactureChauffageEuros] = useState<number | "">("");
  const [pacFactureElecEuros, setPacFactureElecEuros] = useState<number | "">("");
  const [pacNiveauIsolation, setPacNiveauIsolation] = useState<string>("moyen");
  const [pacPrixKwhElec, setPacPrixKwhElec] = useState<number | "">(0.23);
  const [pacProfilMpr, setPacProfilMpr] = useState<string>("");
  const [pacEconomiesCalculees, setPacEconomiesCalculees] = useState<{
    besoinsChauffageKwh: number;
    consoElecPacKwh: number;
    surcoutElecEuros: number;
    economieNetteEuros: number;
    economieNetteMessage: number;
  } | null>(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAMPS SPÉCIFIQUES ITE
  // ═══════════════════════════════════════════════════════════════════════════
  const [iteSurfaceIsoler, setIteSurfaceIsoler] = useState<number | "">("");
  const [iteTypeFacade, setIteTypeFacade] = useState("");
  const [iteEpaisseurIsolant, setIteEpaisseurIsolant] = useState<number | "">(120);
  const [iteTypeIsolant, setIteTypeIsolant] = useState("");
  const [iteRActuel, setIteRActuel] = useState<number | "">(0);
  const [iteRCible, setIteRCible] = useState<number | "">(3.7);
  const [iteNombreFacades, setIteNombreFacades] = useState<number | "">(1);
  const [iteSurfaceOuvertures, setIteSurfaceOuvertures] = useState<number | "">(0);
  const [iteFinition, setIteFinition] = useState("");
  const [iteEconomieChauffagePct, setIteEconomieChauffagePct] = useState<number | "">(0);
  const [iteFactureChaufActuelle, setIteFactureChaufActuelle] = useState<number | "">(0);

  // ═══════════════════════════════════════════════════════════════════════════
  // AIDES PAC & ITE (état local pour section financière)
  // ═══════════════════════════════════════════════════════════════════════════
  const [aidesPAC, setAidesPAC] = useState({
    maPrimeRenov: 0,
    cee: 4000,
    ecoTva: 0,
    aideLocale: 0,
    deposeChaudiere: 0,
  });
  const [aidesITE, setAidesITE] = useState({
    maPrimeRenov: 0,
    cee: 0,
    ecoTva: 0,
    aideLocale: 0,
  });
  const [pacPrixManuel, setPacPrixManuel] = useState<number | "">("");
  const [itePrixManuel, setItePrixManuel] = useState<number | "">("");

  // Mode HEJJA - use global context
  const { 
    isActive: modeHejjaActive, 
    pshEnabled: modeHejjaPsh, 
    prixEnabled: modeHejjaPrix, 
    prixManuel, 
    activate: activateHejja,
    deactivate: deactivateHejja,
    setPshEnabled: setModeHejjaPsh,
    setPrixEnabled: setModeHejjaPrix,
    setPrixManuel
  } = useHejjaMode();
  const [showPinDialog, setShowPinDialog] = useState(false);

  // Animation de succès
  const [showSuccess, setShowSuccess] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfDataUrl, setPdfDataUrl] = useState<string>("");

  // Force light mode on Etude page - restore previous theme on unmount
  useLayoutEffect(() => {
    const previousTheme = localStorage.getItem("theme") || "light";
    const wasDark = document.documentElement.classList.contains("dark");
    
    // Force light mode
    document.documentElement.classList.remove("dark");
    
    return () => {
      // Restore previous theme when leaving
      if (wasDark || previousTheme === "dark") {
        document.documentElement.classList.add("dark");
      }
    };
  }, []);

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

  // Aides manuelles HEJJA
  const [aidesManuelles, setAidesManuelles] = useState<AideManuelle[]>([]);


  // Data tables
  const [dataPsh, setDataPsh] = useState<DataPsh[]>([]);
  const [dataOrientation, setDataOrientation] = useState<DataOrientation[]>([]);
  const [dataTarifs, setDataTarifs] = useState<DataTarif[]>([]);
  const [dataBouquets, setDataBouquets] = useState<DataBouquet[]>([]);
  const [dataSurcouts, setDataSurcouts] = useState<DataSurcout[]>([]);
  const [regieSurcouts, setRegieSurcouts] = useState<RegieSurcout[]>([]);
  const [dataCalibres, setDataCalibres] = useState<DataCalibre[]>([]);
  const [dataCompteurs, setDataCompteurs] = useState<DataCompteur[]>([]);
  const [dataAides, setDataAides] = useState<DataAide[]>([]);
  const [dataFinancements, setDataFinancements] = useState<DataFinancement[]>([]);
  const [tauxAugmentationEnergie, setTauxAugmentationEnergie] = useState(4); // % annuel par défaut
  // Heures d'ensoleillement affichées
  const [heuresEnsoleillement, setHeuresEnsoleillement] = useState<number>(2890);
  const [usePshCalculation, setUsePshCalculation] = useState(false); // true = PSH, false = Heures

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
      // === Identifier la régie ===
      // Priorité : RDV > Client > null
      let currentRegieId: string | null = null;
      
      // 1. Depuis le RDV
      if (rdvId) {
        const { data: rdvData } = await supabase
          .from("rdv")
          .select("regie_id, regies(nom)")
          .eq("id", rdvId)
          .maybeSingle();
        if (rdvData?.regie_id) {
          currentRegieId = rdvData.regie_id;
          setRegieId(rdvData.regie_id);
          setRegieNom((rdvData.regies as any)?.nom || "");
        }
      }
      
      // 2. Si pas de régie depuis le RDV, chercher depuis le client
      if (!currentRegieId && clientId) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("regie_id, regies(nom)")
          .eq("id", clientId)
          .maybeSingle();
        if (clientData?.regie_id) {
          currentRegieId = clientData.regie_id;
          setRegieId(clientData.regie_id);
          setRegieNom((clientData.regies as any)?.nom || "");
          console.log("[EtudeForm] Régie identifiée depuis le client:", (clientData.regies as any)?.nom);
        }
      }
      
      const financements = await loadReferenceData(currentRegieId);
      await loadDefaultCqTime();
      if (clientId) {
        await loadClientInfo();
      }
      if (etudeId) {
        await loadExistingEtude(financements);
      } else if (clientId && user) {
        // Check if existing études already exist for this client
        const { data: existingEtudes } = await supabase
          .from("etudes")
          .select("id, product_type, active_products, numero_pdl")
          .eq("client_id", clientId)
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });
        
        if (existingEtudes && existingEtudes.length > 0) {
          const latestEtude = existingEtudes[0];
          // Show prompt: is this a different house or the same?
          setExistingEtudePrompt({
            etudeId: latestEtude.id,
            productType: latestEtude.product_type || "PV",
          });
        }
      }
      
      // Try to restore draft from sessionStorage (only if not editing existing etude)
      if (!etudeId && !hasRestoredDraftRef.current) {
        const draft = loadDraft();
        if (draft) {
          hasRestoredDraftRef.current = true;
          restoreFormFromDraft(draft);
        }
      }
    };
    init();
  }, [clientId, etudeId, rdvId]);

  // Restore form from sessionStorage draft
  const restoreFormFromDraft = (draft: Record<string, any>) => {
    console.log("[EtudeForm] Restoring draft from sessionStorage");
    
    // Product type
    if (draft.productType) {
      setCurrentTab(draft.productType);
      setActiveProducts(draft.activeProducts || [draft.productType]);
    }
    
    // Common fields
    if (draft.consoAnnuelle !== undefined) setConsoAnnuelle(draft.consoAnnuelle);
    if (draft.factureMensuelle !== undefined) setFactureMensuelle(draft.factureMensuelle);
    if (draft.potentielFaisabilite) setPotentielFaisabilite(draft.potentielFaisabilite);
    if (draft.financementId) setFinancementId(draft.financementId);
    if (draft.dureeMoisManuelle !== undefined) setDureeMoisManuelle(draft.dureeMoisManuelle);
    if (draft.mensualiteManuelle !== undefined) setMensualiteManuelle(draft.mensualiteManuelle);
    if (draft.selectedSurcouts) setSelectedSurcouts(draft.selectedSurcouts);
    if (draft.autreSurcout !== undefined) setAutreSurcout(draft.autreSurcout);
    if (draft.classification) setClassification(draft.classification);
    if (draft.classificationComment) setClassificationComment(draft.classificationComment);
    if (draft.r2DateHeure) setR2DateHeure(new Date(draft.r2DateHeure));
    if (draft.r2Time) setR2Time(draft.r2Time);
    if (draft.aidesManuelles) setAidesManuelles(draft.aidesManuelles);
    
    // PV fields
    if (draft.ombreToiture) setOmbreToiture(draft.ombreToiture);
    if (draft.surfaceToiture) setSurfaceToiture(draft.surfaceToiture);
    if (draft.typeToiture) setTypeToiture(draft.typeToiture);
    if (draft.etatToiture) setEtatToiture(draft.etatToiture);
    if (draft.typeCompteurElectrique) setTypeCompteurElectrique(draft.typeCompteurElectrique);
    if (draft.numeroPdl) setNumeroPdl(draft.numeroPdl);
    if (draft.typeRaccordement) setTypeRaccordement(draft.typeRaccordement);
    if (draft.amperageDisjoncteur !== undefined) setAmperageDisjoncteur(draft.amperageDisjoncteur);
    if (draft.emplacementBoitier) setEmplacementBoitier(draft.emplacementBoitier);
    if (draft.puissanceKwc !== undefined) setPuissanceKwc(draft.puissanceKwc);
    if (draft.bouquetId) setBouquetId(draft.bouquetId);
    if (draft.typeRevente) setTypeRevente(draft.typeRevente);
    if (draft.supportInstallation) setSupportInstallation(draft.supportInstallation);
    if (draft.orientation) setOrientation(draft.orientation);
    if (draft.inclinaison !== undefined) setInclinaison(draft.inclinaison);
    if (draft.surfaceInstallation !== undefined) setSurfaceInstallation(draft.surfaceInstallation);
    if (draft.rendementProductivite !== undefined) setRendementProductivite(draft.rendementProductivite);
    if (draft.prixInstallationManuel !== undefined) setPrixInstallationManuel(draft.prixInstallationManuel);
    
    // PAC fields
    if (draft.pacSubtype) setPacSubtype(draft.pacSubtype);
    if (draft.pacSurfaceChauffee !== undefined) setPacSurfaceChauffee(draft.pacSurfaceChauffee);
    if (draft.pacTypeEmetteurs) setPacTypeEmetteurs(draft.pacTypeEmetteurs);
    if (draft.pacNombreUnitesInt !== undefined) setPacNombreUnitesInt(draft.pacNombreUnitesInt);
    if (draft.pacPuissanceCalorifique !== undefined) setPacPuissanceCalorifique(draft.pacPuissanceCalorifique);
    if (draft.pacCop !== undefined) setPacCop(draft.pacCop);
    if (draft.pacEcsIntegre !== undefined) setPacEcsIntegre(draft.pacEcsIntegre);
    if (draft.pacVolumeBallon !== undefined) setPacVolumeBallon(draft.pacVolumeBallon);
    if (draft.pacEnergieActuelle) setPacEnergieActuelle(draft.pacEnergieActuelle);
    if (draft.pacConsoChaufffageKwh !== undefined) setPacConsoChaufffageKwh(draft.pacConsoChaufffageKwh);
    if (draft.pacEconomieEstimee !== undefined) setPacEconomieEstimee(draft.pacEconomieEstimee);
    if (draft.pacFactureChauffageEuros !== undefined) setPacFactureChauffageEuros(draft.pacFactureChauffageEuros);
    if (draft.pacFactureElecEuros !== undefined) setPacFactureElecEuros(draft.pacFactureElecEuros);
    if (draft.pacNiveauIsolation) setPacNiveauIsolation(draft.pacNiveauIsolation);
    if (draft.pacPrixKwhElec !== undefined) setPacPrixKwhElec(draft.pacPrixKwhElec);
    if (draft.pacProfilMpr) setPacProfilMpr(draft.pacProfilMpr);
    if (draft.pacPrixManuel !== undefined) setPacPrixManuel(draft.pacPrixManuel);
    if (draft.aidesPAC) setAidesPAC(draft.aidesPAC);
    
    // ITE fields
    if (draft.iteSurfaceIsoler !== undefined) setIteSurfaceIsoler(draft.iteSurfaceIsoler);
    if (draft.iteTypeFacade) setIteTypeFacade(draft.iteTypeFacade);
    if (draft.iteEpaisseurIsolant !== undefined) setIteEpaisseurIsolant(draft.iteEpaisseurIsolant);
    if (draft.iteTypeIsolant) setIteTypeIsolant(draft.iteTypeIsolant);
    if (draft.iteRActuel !== undefined) setIteRActuel(draft.iteRActuel);
    if (draft.iteRCible !== undefined) setIteRCible(draft.iteRCible);
    if (draft.iteNombreFacades !== undefined) setIteNombreFacades(draft.iteNombreFacades);
    if (draft.iteSurfaceOuvertures !== undefined) setIteSurfaceOuvertures(draft.iteSurfaceOuvertures);
    if (draft.iteFinition) setIteFinition(draft.iteFinition);
    if (draft.iteEconomieChauffagePct !== undefined) setIteEconomieChauffagePct(draft.iteEconomieChauffagePct);
    if (draft.iteFactureChaufActuelle !== undefined) setIteFactureChaufActuelle(draft.iteFactureChaufActuelle);
    if (draft.itePrixManuel !== undefined) setItePrixManuel(draft.itePrixManuel);
    if (draft.aidesITE) setAidesITE(draft.aidesITE);
    
    // Mark restoration complete after a delay
    markRestorationComplete();
    
    // Silent restoration - no toast needed
  };

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

  // Recalculate when inputs change (including cross-product dependencies)
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
    modeHejjaPsh,
    prixManuel,
    prixInstallationManuel,
    rendementProductivite,
    financementId,
    dureeMoisManuelle,
    mensualiteManuelle,
    surcoutSupport,
    surcoutCompteur,
    surcoutEmplacement,
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
    // Cross-product: recalc PV when PAC economics change
    activeProducts,
    pacEconomiesCalculees,
    // Cross-product: recalc PV when ITE economy changes
    iteEconomieChauffagePct,
  ]);

  // Reload bouquets when productType changes (to filter by product)
  useEffect(() => {
    if (!loading && regieId !== undefined) {
      loadReferenceData(regieId || null);
    }
  }, [productType]);

  const loadReferenceData = async (currentRegieId: string | null = null): Promise<DataFinancement[]> => {
    setLoading(true);

    // Load common reference data
    const [pshRes, orientRes, tarifsRes, surcoutsRes, calibresRes, compteursRes, aidesRes, evolutionRes] = await Promise.all([
      supabase.from("data_psh").select("*").order("department_code"),
      supabase.from("data_orientation").select("*"),
      supabase.from("data_tarifs_revente").select("*").eq("actif", true),
      supabase.from("data_surcouts").select("*").eq("actif", true),
      supabase.from("data_calibres").select("*").eq("actif", true).order("calibre_amperes"),
      supabase.from("data_compteurs").select("*").eq("actif", true),
      supabase.from("data_aides").select("*").eq("actif", true),
      supabase.from("data_evolution_prix_energie").select("*").eq("actif", true),
    ]);

    if (pshRes.data) setDataPsh(pshRes.data);
    if (orientRes.data) setDataOrientation(orientRes.data);
    if (tarifsRes.data) setDataTarifs(tarifsRes.data);
    if (surcoutsRes.data) setDataSurcouts(surcoutsRes.data);
    if (calibresRes.data) setDataCalibres(calibresRes.data);
    if (compteursRes.data) setDataCompteurs(compteursRes.data);
    if (aidesRes.data) setDataAides(aidesRes.data);
    if (evolutionRes.data && evolutionRes.data.length > 0) {
      const elecMatch = evolutionRes.data.find((e: any) => 
        e.type_energie?.toLowerCase().includes("electr") || e.type_energie === "electricite"
      );
      if (elecMatch) setTauxAugmentationEnergie(elecMatch.taux_augmentation_annuel);
    }

    // Load regie-specific bouquets and financements if regie is set
    let bouquetsData: DataBouquet[] = [];
    let financementsData: DataFinancement[] = [];

    if (currentRegieId) {
      const [bouquetsRes, financementsRes, surcoutsRegieRes] = await Promise.all([
        supabase.from("bouquets").select("id, nom_bouquet, puissance_kwc, prix_recommande, regie_ids, product_type").eq("actif", true),
        supabase.from("regies_financements").select("id, nom, taux_effectif, taeg, actif, duree_mois").eq("regie_id", currentRegieId).eq("actif", true).order("nom"),
        supabase.from("regies_surcouts").select("id, code, nom, prix, categorie, type_calcul").eq("regie_id", currentRegieId).eq("actif", true),
      ]);
      
      if (bouquetsRes.data) {
        const matchesProductType = (b: any) => !b.product_type || b.product_type === productType;
        
        bouquetsData = bouquetsRes.data
          .filter((b: any) => b.regie_ids && b.regie_ids.includes(currentRegieId) && matchesProductType(b))
          .map((b: any) => ({
            id: b.id,
            nom_bouquet: b.nom_bouquet,
            puissance_kwc: b.puissance_kwc,
            prix_recommande: b.prix_recommande,
          }));
        
        if (bouquetsData.length === 0) {
          bouquetsData = bouquetsRes.data
            .filter((b: any) => (!b.regie_ids || b.regie_ids.length === 0) && matchesProductType(b))
            .map((b: any) => ({
              id: b.id,
              nom_bouquet: b.nom_bouquet,
              puissance_kwc: b.puissance_kwc,
              prix_recommande: b.prix_recommande,
            }));
        }
      }
      if (financementsRes.data) {
        financementsData = financementsRes.data.map(f => ({
          id: f.id,
          nom: f.nom,
          taux_effectif: Number(f.taux_effectif),
          taeg: Number(f.taeg),
          actif: f.actif,
        }));
      }
      if (surcoutsRegieRes.data) {
        setRegieSurcouts(surcoutsRegieRes.data.map(s => ({
          id: s.id,
          code: s.code,
          nom: s.nom,
          prix: Number(s.prix),
          categorie: s.categorie,
          type_calcul: (s.type_calcul as 'fixe' | 'par_panneau') || 'fixe',
        })));
      }
    } else {
      // Fallback to global tables if no regie
      const [bouquetsRes, financementsRes] = await Promise.all([
        supabase.from("bouquets").select("id, nom_bouquet, puissance_kwc, prix_recommande, regie_ids, product_type").eq("actif", true).order("puissance_kwc"),
        supabase.from("data_financements").select("*").eq("actif", true).order("nom"),
      ]);
      
      if (bouquetsRes.data) {
        // Use only global bouquets filtered by product_type
        const matchesProductType = (b: any) => !b.product_type || b.product_type === productType;
        bouquetsData = bouquetsRes.data
          .filter((b: any) => (!b.regie_ids || b.regie_ids.length === 0) && matchesProductType(b))
          .map((b: any) => ({
            id: b.id,
            nom_bouquet: b.nom_bouquet,
            puissance_kwc: b.puissance_kwc,
            prix_recommande: b.prix_recommande,
          }));
      }
      if (financementsRes.data) financementsData = financementsRes.data;
      setRegieSurcouts([]); // No regie-specific surcharges
    }

    setDataBouquets(bouquetsData);
    setDataFinancements(financementsData);

    setLoading(false);
    return financementsData;
  };

  const loadClientInfo = async () => {
    if (!clientId) return;

    console.log("[DEBUG] Loading client info for clientId:", clientId);

    const { data } = await supabase
      .from("clients")
      .select("nom, prenom, adresse, ville, code_postal, telephone")
      .eq("id", clientId)
      .maybeSingle();

    console.log("[DEBUG] Client data loaded:", data);

    if (data) {
      setClientName(data.nom || "");
      setClientPrenom(data.prenom || "");
      setClientAdresse(data.adresse || "");
      setClientVille(data.ville || "");
      setClientCodePostal(data.code_postal || "");
      setClientTelephone(data.telephone || "");
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
  const loadExistingEtude = async (financements: DataFinancement[]) => {
    if (!etudeId) return;

    const { data: etude } = await supabase
      .from("etudes")
      .select("*")
      .eq("id", etudeId)
      .maybeSingle();

    if (etude) {
      setCurrentEtudeId(etude.id);
      // Resolve rdvId from étude if not in URL
      if (!rdvIdFromUrl && etude.rdv_id) {
        setResolvedRdvId(etude.rdv_id);
      }
      // ═══════════════════════════════════════════════════════════════════════════
      // TYPE DE PRODUIT
      // ═══════════════════════════════════════════════════════════════════════════
      const loadedProductType = (etude.product_type as ProductType) || "PV";
      const loadedActiveProducts = (etude as any).active_products as ProductType[] || [loadedProductType];
      setActiveProducts(loadedActiveProducts);
      setCurrentTab(loadedActiveProducts[0]);
      
      // Consommation
      setConsoAnnuelle(etude.consommation_annuelle_kwh || 0);
      setFactureMensuelle(etude.facture_annuelle_euros ? etude.facture_annuelle_euros / 12 : 0);
      // Visite technique - Toiture (PV)
      setOmbreToiture(etude.ombre_toiture || "0 à 5%");
      setSurfaceToiture(etude.surface_toiture || "OK");
      setTypeToiture(etude.type_toiture || "TUILE");
      setEtatToiture(etude.etat_toiture || "OK");
      // Compteur électrique (PV)
      setTypeCompteurElectrique(etude.type_compteur_electrique || "Linky");
      setNumeroPdl(etude.numero_pdl || "");
      setTypeRaccordement(etude.type_raccordement || "MONOPHASÉ");
      // Tableau électrique (PV)
      setAmperageDisjoncteur(etude.amperage_disjoncteur || 45);
      setEmplacementBoitier(etude.emplacement_boitier || "À côté");
      // Résultat visite
      setPotentielFaisabilite(etude.potentiel_faisabilite || "Faisable");
      // Préconisation PV
      setPuissanceKwc(etude.puissance_kwc || 0);
      setTypeRevente(etude.type_revente || "surplus");
      setSupportInstallation(etude.support || "TOITURE SURIMPOSITION");
      setOrientation(etude.orientation || "SUD");
      setInclinaison(etude.inclinaison || 30);
      // Données techniques PV
      setSurfaceInstallation(etude.surface_installation_m2 || 0);
      setRendementProductivite(etude.rendement_productivite || 100);
      // Surcoûts
      setSelectedSurcouts(etude.surcouts as string[] || []);
      setSurcoutSupport(etude.surcout_support || 0);
      setSurcoutCompteur(etude.surcout_compteur || 0);
      setAutreSurcout(etude.autre_surcout || 0);
      // Prix manuel - only restore if it was explicitly set by user (tracked in param_overrides)
      const loadedOverrides = (etude as any).param_overrides;
      if (loadedOverrides?.hasPrixInstallationManuel && etude.prix_installation) {
        setPrixInstallationManuel(etude.prix_installation);
      }
      // Mensualité manuelle
      if (etude.mensualite_estimee) {
        setMensualiteManuelle(etude.mensualite_estimee);
      }
      // Modes
      setModeHejjaPsh(etude.mode_hejja_psh ?? true);
      setModeHejjaPrix(etude.mode_hejja_prix || false);
      // Restore manual parameter overrides
      const overrides = (etude as any).param_overrides;
      if (overrides) {
        if (typeof overrides.heuresEnsoleillement === "number") {
          setHeuresEnsoleillement(overrides.heuresEnsoleillement);
          hasManualOverridesRef.current = true;
        }
        if (typeof overrides.usePshCalculation === "boolean") {
          setUsePshCalculation(overrides.usePshCalculation);
        }
        if (overrides.estimationDetails) {
          estimationDetailsRef.current = overrides.estimationDetails;
          setEstimationDetailsDisplay(overrides.estimationDetails);
        }
      }
      // Financement - restaurer l'ID basé sur le nom
      if (etude.mode_financement && financements.length > 0) {
        const financement = financements.find(f => f.nom === etude.mode_financement);
        if (financement) {
          setFinancementId(financement.id);
        }
      }
      // Durée du financement
      if (etude.duree_financement_mois) {
        setDureeMoisManuelle(etude.duree_financement_mois);
      }
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
      
      // Aides manuelles HEJJA
      if (etude.aides_manuelles && Array.isArray(etude.aides_manuelles)) {
        setAidesManuelles(etude.aides_manuelles as unknown as AideManuelle[]);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // CHAMPS PAC - Always load if data exists (multi-product support)
      // ═══════════════════════════════════════════════════════════════════════════
      if (etude.pac_subtype || loadedActiveProducts.includes("PAC")) {
        setPacSubtype((etude.pac_subtype as "air_air" | "air_eau") || "air_eau");
        setPacSurfaceChauffee(etude.pac_surface_chauffee || "");
        setPacTypeEmetteurs(etude.pac_type_emetteurs || "");
        setPacNombreUnitesInt(etude.pac_nombre_unites_int || 1);
        setPacPuissanceCalorifique(etude.pac_puissance_calorifique || "");
        setPacCop(etude.pac_cop || 3.5);
        setPacEcsIntegre(etude.pac_ecs_integre || false);
        setPacVolumeBallon(etude.pac_volume_ballon || 0);
        setPacEnergieActuelle(etude.pac_energie_actuelle || "");
        setPacConsoChaufffageKwh(etude.pac_conso_chauffage_kwh || "");
        setPacEconomieEstimee(etude.pac_economie_estimee || 0);
        setPacFactureChauffageEuros(etude.pac_facture_chauffage_euros || "");
        setPacFactureElecEuros(etude.pac_facture_elec_euros || "");
        setPacNiveauIsolation(etude.pac_niveau_isolation || "moyen");
        setPacPrixKwhElec(etude.pac_prix_kwh_elec || 0.23);
        if ((etude as any).pac_profil_mpr) setPacProfilMpr((etude as any).pac_profil_mpr);
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // CHAMPS ITE - Always load if data exists (multi-product support)
      // ═══════════════════════════════════════════════════════════════════════════
      if (etude.ite_surface_isoler || loadedActiveProducts.includes("ITE")) {
        setIteSurfaceIsoler(etude.ite_surface_isoler || "");
        setIteTypeFacade(etude.ite_type_facade || "");
        setIteEpaisseurIsolant(etude.ite_epaisseur_isolant || 120);
        setIteTypeIsolant(etude.ite_type_isolant || "");
        setIteRActuel(etude.ite_r_actuel || 0);
        setIteRCible(etude.ite_r_cible || 3.7);
        setIteNombreFacades(etude.ite_nombre_facades || 1);
        setIteSurfaceOuvertures(etude.ite_surface_ouvertures || 0);
        setIteFinition(etude.ite_finition || "");
        setIteEconomieChauffagePct(etude.ite_economie_chauffage_pct || 0);
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
  // Skip if manual overrides were loaded from a saved etude
  useEffect(() => {
    console.log("[DEBUG] useEffect département:", departement, "| dataPsh.length:", dataPsh.length);
    if (departement && dataPsh.length > 0) {
      const pshData = dataPsh.find((p) => p.department_code === departement);
      console.log("[DEBUG] PSH trouvé pour", departement, ":", pshData);
      if (pshData && !hasManualOverridesRef.current) {
        setHeuresEnsoleillement(pshData.heures_ensoleillement_annuel || 2890);
      } else if (!pshData) {
        console.log("[DEBUG] Aucun PSH trouvé! Codes disponibles:", dataPsh.map(p => p.department_code).slice(0, 10));
      }
      // Reset the flag after first load so future department changes still auto-update
      if (hasManualOverridesRef.current) {
        hasManualOverridesRef.current = false;
      }
    }
  }, [departement, dataPsh]);

  // Normalize helper for robust surcharge matching
  // Strips accents, special chars, converts to lowercase tokens
  const normalizeSurcout = (str: string) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .toLowerCase()
      .replace(/[/_\-().<>]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const getEmplacementRange = (value: string): "a_cote" | "lt_10m" | "gt_10m" | null => {
    const raw = value.toLowerCase();
    if (!raw) return null;
    if (raw.includes("a côté") || raw.includes("a cote")) return "a_cote";
    if (raw.includes("<")) return "lt_10m";
    if (raw.includes(">")) return "gt_10m";
    return null;
  };

  const isEmplacementMatch = (surcout: RegieSurcout, emplacementValue: string) => {
    const nNom = normalizeSurcout(surcout.nom);
    const nCode = normalizeSurcout(surcout.code);
    const normalizedEmpl = normalizeSurcout(emplacementValue);
    const range = getEmplacementRange(emplacementValue);

    if (range === "a_cote") {
      return nCode.includes("a cote") || nNom.includes("a cote");
    }

    if (range === "lt_10m") {
      return (
        nCode.includes("inf 10") ||
        nCode.includes("0 10") ||
        nNom.includes("inf 10") ||
        nNom.includes("moins de 10") ||
        nNom.includes("0 a 10")
      );
    }

    if (range === "gt_10m") {
      return (
        nCode.includes("10 20") ||
        nCode.includes("sup 10") ||
        nNom.includes("10 a 20") ||
        nNom.includes("plus de 10") ||
        nNom.includes("sup 10")
      );
    }

    return (
      normalizedEmpl.includes(nNom) ||
      nNom.includes(normalizedEmpl) ||
      normalizedEmpl.includes(nCode) ||
      nCode.includes(normalizedEmpl) ||
      nNom.split(" ").filter((t) => t.length > 2).every((t) => normalizedEmpl.includes(t))
    );
  };

  // Mise à jour du surcoût compteur selon le type de raccordement
  useEffect(() => {
    if (regieSurcouts.length > 0) {
      const normalizedType = normalizeSurcout(typeRaccordement);
      const regieCompteur = regieSurcouts.find((s) => {
        if (s.categorie !== "compteur") return false;
        const nNom = normalizeSurcout(s.nom);
        const nCode = normalizeSurcout(s.code);
        return (
          normalizedType.includes(nNom) ||
          nNom.includes(normalizedType) ||
          normalizedType.includes(nCode) ||
          nCode.includes(normalizedType)
        );
      });
      if (regieCompteur) {
        setSurcoutCompteur(regieCompteur.prix);
        return;
      }
    }
    // Fallback aux surcoûts globaux
    const compteur = dataCompteurs.find((c) => c.type_compteur === typeRaccordement);
    if (compteur) {
      setSurcoutCompteur(compteur.montant);
    } else {
      setSurcoutCompteur(0);
    }
  }, [typeRaccordement, dataCompteurs, regieSurcouts]);

  // Mise à jour du surcoût support selon le type de support
  useEffect(() => {
    if (regieSurcouts.length > 0) {
      const normalizedSupport = normalizeSurcout(supportInstallation);

      const regieSupport = regieSurcouts.find((s) => {
        if (s.categorie !== "support") return false;
        const nNom = normalizeSurcout(s.nom);
        const nCode = normalizeSurcout(s.code);
        // Check if key words overlap (e.g. "pergola", "surimposition", "sol", "bac gse")
        return (
          normalizedSupport.includes(nNom) ||
          nNom.includes(normalizedSupport) ||
          normalizedSupport.includes(nCode) ||
          nCode.includes(normalizedSupport) ||
          // Token-based: check if all tokens of DB entry exist in the UI value
          nNom.split(" ").filter((t) => t.length > 2).every((t) => normalizedSupport.includes(t)) ||
          nCode.split(" ").filter((t) => t.length > 2).every((t) => normalizedSupport.includes(t))
        );
      });
      if (regieSupport) {
        if (regieSupport.type_calcul === "par_panneau") {
          const nbPanneaux = Math.round((puissanceKwc || 0) * 2);
          setSurcoutSupport(regieSupport.prix * nbPanneaux);
        } else {
          setSurcoutSupport(regieSupport.prix);
        }
        return;
      }
    }
    setSurcoutSupport(0);
  }, [supportInstallation, regieSurcouts, puissanceKwc]);

  // Mise à jour du surcoût emplacement boîtier
  useEffect(() => {
    if (regieSurcouts.length > 0) {
      const regieEmpl = regieSurcouts.find(
        (s) => s.categorie === "emplacement_boitier" && isEmplacementMatch(s, emplacementBoitier)
      );

      if (regieEmpl) {
        setSurcoutEmplacement(regieEmpl.prix);
        return;
      }
    }
    setSurcoutEmplacement(0);
  }, [emplacementBoitier, regieSurcouts]);

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

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC CHAMPS PARTAGÉS MULTI-PRODUITS
  // ═══════════════════════════════════════════════════════════════════════════
  // Sync PAC facture chauffage → ITE facture chauffage (et inversement)
  useEffect(() => {
    if (activeProducts.includes("PAC") && activeProducts.includes("ITE")) {
      if (pacFactureChauffageEuros && !iteFactureChaufActuelle) {
        setIteFactureChaufActuelle(pacFactureChauffageEuros);
      } else if (iteFactureChaufActuelle && !pacFactureChauffageEuros) {
        setPacFactureChauffageEuros(iteFactureChaufActuelle);
      }
    }
  }, [activeProducts.length]); // Only on product activation change

  // Keep them in sync when one changes (PAC → ITE)
  useEffect(() => {
    if (activeProducts.includes("PAC") && activeProducts.includes("ITE") && pacFactureChauffageEuros) {
      setIteFactureChaufActuelle(pacFactureChauffageEuros);
    }
  }, [pacFactureChauffageEuros]);

  // Keep them in sync when one changes (ITE → PAC)
  useEffect(() => {
    if (activeProducts.includes("PAC") && activeProducts.includes("ITE") && iteFactureChaufActuelle) {
      setPacFactureChauffageEuros(iteFactureChaufActuelle);
    }
  }, [iteFactureChaufActuelle]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SYNC PV ↔ PAC : Facture élec & prix kWh
  // ═══════════════════════════════════════════════════════════════════════════
  // Initial propagation when activating PV+PAC
  useEffect(() => {
    if (activeProducts.includes("PV") && activeProducts.includes("PAC")) {
      const factureAnnuelle = Number(factureMensuelle || 0) * 12;
      if (factureMensuelle && !pacFactureElecEuros) {
        setPacFactureElecEuros(factureAnnuelle);
      } else if (pacFactureElecEuros && !factureMensuelle) {
        setFactureMensuelle(Math.round(Number(pacFactureElecEuros) / 12));
      }
    }
  }, [activeProducts.length]);

  // PV facture → PAC facture élec
  useEffect(() => {
    if (activeProducts.includes("PV") && activeProducts.includes("PAC") && factureMensuelle) {
      const annuel = Number(factureMensuelle) * 12;
      setPacFactureElecEuros(annuel);
      // Also sync prix kWh if we can compute it
      if (consoAnnuelle && Number(consoAnnuelle) > 0) {
        const prixKwh = Math.round((annuel / Number(consoAnnuelle)) * 10000) / 10000;
        setPacPrixKwhElec(prixKwh);
      }
    }
  }, [factureMensuelle, consoAnnuelle]);

  // PAC facture élec → PV facture mensuelle
  useEffect(() => {
    if (activeProducts.includes("PV") && activeProducts.includes("PAC") && pacFactureElecEuros && !factureMensuelle) {
      setFactureMensuelle(Math.round(Number(pacFactureElecEuros) / 12));
    }
  }, [pacFactureElecEuros]);

  const calculateResults = () => {
    if (!puissanceKwc || !consoAnnuelle) return;

    const puissance = Number(puissanceKwc);
    // ═══════════════════════════════════════════════════════════════════════════
    // CALCULS CROISÉS MULTI-PRODUITS
    // ═══════════════════════════════════════════════════════════════════════════
    let conso = Number(consoAnnuelle);
    
    // Si PAC active → ajouter sa consommation électrique (déjà réduite par ITE si applicable)
    if (activeProducts.includes("PAC") && pacEconomiesCalculees?.consoElecPacKwh) {
      conso += pacEconomiesCalculees.consoElecPacKwh;
    }
    
    // Si ITE active → réduction directe de la consommation chauffage électrique
    // (uniquement si pas de PAC, car avec PAC le calcul croisé ITE→PAC→PV est déjà fait)
    if (activeProducts.includes("ITE") && !activeProducts.includes("PAC") && iteEconomieChauffagePct) {
      const reductionPct = Number(iteEconomieChauffagePct) / 100;
      // On estime que ~60% de la conso totale est liée au chauffage
      const partChauffage = conso * 0.6;
      conso -= partChauffage * reductionPct;
    }
    const facture = Number(factureMensuelle || 0);

    // Get orientation coefficient (maintenant stocké dans rendementProductivite en %)
    const rendementCoeff = (Number(rendementProductivite) || 100) / 100;

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
    // Priorité : prixInstallationManuel > prixManuel (mode HEJJA) > interpolation bouquets régie
    let prixInstallation = 0;
    let interpolated = false;
    let interpExplanation = "";
    
    if (prixInstallationManuel) {
      prixInstallation = Number(prixInstallationManuel);
    } else if (dataBouquets.length > 0) {
      // Toujours utiliser l'interpolation basée sur la puissance
      const interpolatedBouquet = findOrInterpolateBouquet(dataBouquets, puissance);
      prixInstallation = modeHejjaPrix 
        ? (prixManuel ? Number(prixManuel) : 0)
        : interpolatedBouquet.prixRecommande;
      interpolated = interpolatedBouquet.isInterpolated;
      if (interpolated) {
        interpExplanation = getInterpolationExplanation(puissance, interpolatedBouquet.basedOnBouquet);
      }
    } else {
      prixInstallation = puissance * 4500; // Prix par défaut si pas de bouquet
    }
    
    setIsInterpolated(interpolated);
    setInterpolationExplanation(interpExplanation);

    // === SURCOÛTS ===
    const prixSurcoûtsOptions = selectedSurcouts.reduce((total, code) => {
      const surcout = dataSurcouts.find((s) => s.code === code);
      return total + (surcout?.prix || 0);
    }, 0);
    const prixSurcouts = prixSurcoûtsOptions + surcoutSupport + surcoutCompteur + surcoutEmplacement + autreSurcout;

    const prixTotalHorsAides = prixInstallation + prixSurcouts;

    // === PRIME AUTOCONSOMMATION (depuis data_aides) ===
    // Pas de prime pour ≤ 3 kWc, prime par tranche au-dessus
    let primeAutoconsommation = 0;
    if (puissance > 3) {
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

    // === ECO TVA ===
    // TVA à 20% : prix total TTC (surcoûts inclus) / 6
    const ecoTva = prixTotalHorsAides / 6;

    // Calculate aides manuelles HEJJA total
    const aidesManuellesTotal = modeHejjaActive 
      ? aidesManuelles.reduce((sum, aide) => {
          switch (aide.type_calcul) {
            case "fixe": return sum + aide.valeur;
            case "par_kwc": return sum + aide.valeur * puissance;
            case "pourcentage": return sum + (aide.valeur / 100) * prixTotalHorsAides;
            default: return sum + aide.valeur;
          }
        }, 0)
      : 0;

    const totalAides = primeAutoconsommation + ecoTva + aidesManuellesTotal;
    const totalAidesDeduites = prixTotalHorsAides - totalAides;

    // === MENSUALITÉ AVEC REPORT 6 MOIS ===
    // Financement basé sur le montant TTC total hors aides
    let mensualite = 0;
    const selectedFinancement = dataFinancements.find(f => f.id === financementId);
    const dureeMois = dureeMoisManuelle || 120;
    const tauxEffectif = selectedFinancement?.taux_effectif || 0;
    
    if (mensualiteManuelle) {
      mensualite = Number(mensualiteManuelle);
    } else {
      // Calcul avec report de 6 mois sur le montant TTC hors aides
      const resultatFinancement = calculerMensualiteAvecReport({
        montantTTC: prixTotalHorsAides, // Montant TTC complet
        tauxEffectifAnnuel: tauxEffectif,
        dureeMois: dureeMois,
        dureeReportMois: 6,
      });
      mensualite = resultatFinancement.mensualiteAmortissement;
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
    // Pour PV, calculatedResults est requis. Pour PAC/ITE, on sauvegarde directement
    if (!clientId || !user) return;
    const hasPV = activeProducts.includes("PV");
    if (hasPV && !calculatedResults) return;

    // Cancel any pending auto-save to avoid contention
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }
    setSaving(true);

    const hasPAC = activeProducts.includes("PAC");
    const hasITE = activeProducts.includes("ITE");

    const etudeData = {
      user_id: user.id,
      client_id: clientId,
      rdv_id: rdvId || null,
      active_products: activeProducts,
      // ═══════════════════════════════════════════════════════════════════════════
      // TYPE DE PRODUIT
      // ═══════════════════════════════════════════════════════════════════════════
      product_type: activeProducts[0], // Primary product for backward compatibility
      // Consommation
      consommation_annuelle_kwh: consoAnnuelle || null,
      facture_annuelle_euros: Number(factureMensuelle || 0) * 12,
      // Visite technique - Toiture (PV)
      ombre_toiture: hasPV ? ombreToiture : null,
      surface_toiture: hasPV ? surfaceToiture : null,
      type_toiture: hasPV ? typeToiture : null,
      etat_toiture: hasPV ? etatToiture : null,
      // Compteur électrique (PV)
      type_compteur_electrique: hasPV ? typeCompteurElectrique : null,
      numero_pdl: hasPV ? (numeroPdl || null) : null,
      type_raccordement: hasPV ? typeRaccordement : null,
      // Tableau électrique (PV)
      amperage_disjoncteur: hasPV && amperageDisjoncteur ? Number(amperageDisjoncteur) : null,
      emplacement_boitier: hasPV ? (emplacementBoitier || null) : null,
      // Résultat visite
      potentiel_faisabilite: potentielFaisabilite || null,
      // Préconisation PV
      puissance_kwc: hasPV && puissanceKwc ? Number(puissanceKwc) : null,
      type_revente: hasPV ? (typeRevente || null) : null,
      support: hasPV ? (supportInstallation || null) : null,
      orientation: hasPV ? (orientation || null) : null,
      inclinaison: hasPV && inclinaison ? Number(inclinaison) : null,
      // Données techniques PV
      surface_installation_m2: hasPV && surfaceInstallation ? Number(surfaceInstallation) : null,
      rendement_productivite: hasPV && rendementProductivite ? Number(rendementProductivite) : null,
      // Résultats calculs PV
      production_annuelle_kwh: hasPV && calculatedResults ? calculatedResults.productionAnnuelle : null,
      autoconsommation_pct: hasPV && calculatedResults ? calculatedResults.autoconsoPct : null,
      surplus_production_kwh: hasPV && calculatedResults ? calculatedResults.surplusProduction : null,
      revente_kwh: hasPV && calculatedResults ? calculatedResults.surplusProduction : null,
      // ═══════════════════════════════════════════════════════════════════════════
      // CHAMPS PAC
      // ═══════════════════════════════════════════════════════════════════════════
      pac_subtype: hasPAC ? pacSubtype : null,
      pac_surface_chauffee: hasPAC && pacSurfaceChauffee ? Number(pacSurfaceChauffee) : null,
      pac_type_emetteurs: hasPAC ? pacTypeEmetteurs : null,
      pac_nombre_unites_int: hasPAC && pacNombreUnitesInt ? Number(pacNombreUnitesInt) : null,
      pac_puissance_calorifique: hasPAC && pacPuissanceCalorifique ? Number(pacPuissanceCalorifique) : null,
      pac_cop: hasPAC && pacCop ? Number(pacCop) : null,
      pac_ecs_integre: hasPAC ? pacEcsIntegre : null,
      pac_volume_ballon: hasPAC && pacVolumeBallon ? Number(pacVolumeBallon) : null,
      pac_energie_actuelle: hasPAC ? pacEnergieActuelle : null,
      pac_conso_chauffage_kwh: hasPAC && pacConsoChaufffageKwh ? Number(pacConsoChaufffageKwh) : null,
      pac_economie_estimee: hasPAC && pacEconomieEstimee ? Number(pacEconomieEstimee) : null,
      pac_facture_chauffage_euros: hasPAC && pacFactureChauffageEuros ? Number(pacFactureChauffageEuros) : null,
      pac_facture_elec_euros: hasPAC && pacFactureElecEuros ? Number(pacFactureElecEuros) : null,
      pac_niveau_isolation: hasPAC ? pacNiveauIsolation : null,
      pac_prix_kwh_elec: hasPAC && pacPrixKwhElec ? Number(pacPrixKwhElec) : null,
      pac_profil_mpr: hasPAC ? (pacProfilMpr || null) : null,
      pac_besoins_chauffage_kwh: hasPAC && pacEconomiesCalculees ? pacEconomiesCalculees.besoinsChauffageKwh : null,
      pac_conso_elec_pac_kwh: hasPAC && pacEconomiesCalculees ? pacEconomiesCalculees.consoElecPacKwh : null,
      pac_surcout_elec_euros: hasPAC && pacEconomiesCalculees ? pacEconomiesCalculees.surcoutElecEuros : null,
      pac_economie_nette_euros: hasPAC && pacEconomiesCalculees ? pacEconomiesCalculees.economieNetteEuros : null,
      // ═══════════════════════════════════════════════════════════════════════════
      // CHAMPS ITE
      // ═══════════════════════════════════════════════════════════════════════════
      ite_surface_isoler: hasITE && iteSurfaceIsoler ? Number(iteSurfaceIsoler) : null,
      ite_type_facade: hasITE ? iteTypeFacade : null,
      ite_epaisseur_isolant: hasITE && iteEpaisseurIsolant ? Number(iteEpaisseurIsolant) : null,
      ite_type_isolant: hasITE ? iteTypeIsolant : null,
      ite_r_actuel: hasITE && iteRActuel ? Number(iteRActuel) : null,
      ite_r_cible: hasITE && iteRCible ? Number(iteRCible) : null,
      ite_nombre_facades: hasITE && iteNombreFacades ? Number(iteNombreFacades) : null,
      ite_surface_ouvertures: hasITE && iteSurfaceOuvertures ? Number(iteSurfaceOuvertures) : null,
      ite_finition: hasITE ? iteFinition : null,
      ite_economie_chauffage_pct: hasITE && iteEconomieChauffagePct ? Number(iteEconomieChauffagePct) : null,
      // ═══════════════════════════════════════════════════════════════════════════
      // PRIX COMBINÉ - Somme de tous les produits actifs
      // ═══════════════════════════════════════════════════════════════════════════
      prix_installation: (() => {
        let total = 0;
        if (hasPV && calculatedResults) total += calculatedResults.prixInstallation;
        if (hasPAC && pacPrixManuel) total += Number(pacPrixManuel);
        if (hasITE && itePrixManuel) total += Number(itePrixManuel);
        return total || null;
      })(),
      surcouts: selectedSurcouts,
      surcout_support: surcoutSupport,
      surcout_compteur: surcoutCompteur,
      autre_surcout: autreSurcout,
      prix_total: (() => {
        let total = 0;
        if (hasPV && calculatedResults) total += calculatedResults.prixTotalHorsAides;
        if (hasPAC) total += (Number(pacPrixManuel) || 0);
        if (hasITE) total += (Number(itePrixManuel) || 0);
        return total + autreSurcout;
      })(),
      // Aides combinées
      prime_autoconsommation: hasPV && calculatedResults ? calculatedResults.primeAutoconsommation : null,
      eco_tva: (() => {
        let total = 0;
        if (hasPV && calculatedResults) total += calculatedResults.ecoTva;
        if (hasPAC) total += aidesPAC.ecoTva;
        if (hasITE) total += aidesITE.ecoTva;
        return total;
      })(),
      total_aides: (() => {
        let total = 0;
        if (hasPV && calculatedResults) total += calculatedResults.totalAides;
        if (hasPAC) total += (aidesPAC.maPrimeRenov + aidesPAC.cee + aidesPAC.ecoTva + aidesPAC.aideLocale + (aidesPAC.deposeChaudiere || 0));
        if (hasITE) total += (aidesITE.maPrimeRenov + aidesITE.cee + aidesITE.ecoTva + aidesITE.aideLocale);
        return total;
      })(),
      total_aides_deduites: hasPV && calculatedResults ? calculatedResults.totalAidesDeduites : null,
      aides_manuelles: modeHejjaActive && aidesManuelles.length > 0 
        ? JSON.parse(JSON.stringify(aidesManuelles)) 
        : (hasPAC ? aidesPAC : hasITE ? aidesITE : null),
      // Financement
      mode_financement: dataFinancements.find(f => f.id === financementId)?.nom || null,
      duree_financement_mois: dureeMoisManuelle ? Number(dureeMoisManuelle) : 120,
      taux_financement: dataFinancements.find(f => f.id === financementId)?.taux_effectif || null,
      mensualite_estimee: hasPV && calculatedResults ? calculatedResults.mensualite : (mensualiteManuelle || null),
      // Rentabilité
      economie_autoconso_mensuelle: hasPV && calculatedResults ? calculatedResults.autoconsommationEuros : null,
      revente_mensuelle_estimee: hasPV && calculatedResults ? calculatedResults.reventeMensuelleEstimee : null,
      resultat_transfert_charge: hasPV && calculatedResults ? calculatedResults.resultatTransfertCharge : null,
      resultat_mensuel: hasPV && calculatedResults ? calculatedResults.resultatTransfertCharge : null,
      verdict: hasPV && calculatedResults ? calculatedResults.verdict : null,
      mode_hejja_psh: modeHejjaPsh,
      mode_hejja_prix: modeHejjaPrix,
      // Manual parameter overrides (per-etude)
      param_overrides: {
        heuresEnsoleillement,
        usePshCalculation,
        estimationDetails: estimationDetailsRef.current || undefined,
        hasPrixInstallationManuel: !!prixInstallationManuel,
      } as any,
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
        .eq("id", currentEtudeId);
      
      error = result.error;
      savedEtudeId = currentEtudeId;
    } else if (currentEtudeId) {
      // Auto-save already created it, just update
      const result = await supabase
        .from("etudes")
        .update(etudeData)
        .eq("id", currentEtudeId);
      
      error = result.error;
      savedEtudeId = currentEtudeId;
    } else {
      // INSERT new étude with guard
      isInsertingRef.current = true;
      try {
        const result = await supabase
          .from("etudes")
          .insert(etudeData)
          .select("id")
          .single();
        
        error = result.error;
        savedEtudeId = result.data?.id || null;
      } finally {
        isInsertingRef.current = false;
      }
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
      // === Post-save: run all side-effects in parallel (non-blocking) ===
      const wasForceSync = forceSyncRef.current;
      const classificationChanged = wasForceSync || classification !== originalClassification;
      forceSyncRef.current = false;
      const r2DateTime = (classification === "r2" || classification === "r2_prestudy") && r2DateHeure
        ? new Date(`${format(r2DateHeure, "yyyy-MM-dd")}T${r2Time}:00`).toISOString()
        : null;

      // Show success immediately — don't wait for side-effects
      const shouldGeneratePdf = wasForceSync || 
        (classification && classificationChanged && (classification === "r2_prestudy" || classification === "positif"));
      
      // Clear draft & update state right away
      clearDraft();
      setHasUnsavedChanges(false);
      setOriginalClassification(classification);
      if (savedEtudeId && !currentEtudeId) {
        setCurrentEtudeId(savedEtudeId);
      }
      setSaving(false);
      // Silent save confirmation - the AutoSaveIndicator already shows status

      // Fire-and-forget: all post-save operations run in parallel
      const postSaveOps: Promise<void>[] = [];

      // 1. Classification history + RDV status sync
      if (classification && savedEtudeId && classificationChanged) {
        postSaveOps.push(
          Promise.resolve(supabase.from("etudes_classification_history").insert({
            etude_id: savedEtudeId,
            user_id: user.id,
            classification: classification,
            comment: classificationComment || null,
            r2_date_heure: r2DateTime,
          })).then(() => {})
        );

        const classificationToRdvStatus: Record<string, string> = {
          positif: "signe", negatif: "negatif", r2: "r2", r2_prestudy: "r2_prestudy",
          annule: "annule", reporte: "reporte", porte: "porte",
        };
        const rdvStatus = classificationToRdvStatus[classification] as "signe" | "negatif" | "r2" | "r2_prestudy" | "annule" | "reporte" | "porte" | undefined;
        if (rdvStatus) {
          postSaveOps.push((async () => {
            let targetRdvId = rdvId;
            // Fallback: if rdvId is null, find the RDV linked to this étude or the most recent for this client
            if (!targetRdvId && savedEtudeId) {
              const { data: linkedRdv } = await supabase
                .from("rdv")
                .select("id")
                .eq("etude_id", savedEtudeId)
                .maybeSingle();
              if (linkedRdv) {
                targetRdvId = linkedRdv.id;
              } else if (clientId) {
                // Last resort: find the most recent non-terminal RDV for this client
                const { data: recentRdv } = await supabase
                  .from("rdv")
                  .select("id")
                  .eq("client_id", clientId)
                  .eq("user_id", user.id)
                  .not("status", "in", '("annule","reporte")')
                  .order("date_heure", { ascending: false })
                  .limit(1)
                  .maybeSingle();
                if (recentRdv) {
                  targetRdvId = recentRdv.id;
                }
              }
            }
            if (targetRdvId) {
              await supabase.from("rdv").update({ 
                status: rdvStatus,
                etude_id: savedEtudeId, // Also link the étude to the RDV
              }).eq("id", targetRdvId);
              // Update local rdvId for subsequent operations
              if (!rdvId) {
                setResolvedRdvId(targetRdvId);
              }
            }
          })());
        }
      }

      // 2. R2 RDV creation/update
      if ((classification === "r2" || classification === "r2_prestudy") && r2DateTime && savedEtudeId) {
        postSaveOps.push((async () => {
          const { data: existingR2Rdv } = await supabase
            .from("rdv").select("id").eq("etude_id", savedEtudeId).eq("is_r2", true).maybeSingle();
          
          if (existingR2Rdv) {
            await supabase.from("rdv").update({
              date_heure: r2DateTime, r2_type: classification, status: "nouveau",
            }).eq("id", existingR2Rdv.id);
          } else {
            await supabase.from("rdv").insert({
              user_id: user.id, client_id: clientId, etude_id: savedEtudeId,
              date_heure: r2DateTime, duree_minutes: 90, type_projet: "photovoltaique",
              status: "nouveau", source: "r2_etude", is_r2: true, r2_type: classification,
              commentaire: `R2 ${classification === "r2_prestudy" ? "Pré-étude" : ""} - ${classificationComment || "Suivi étude"}`,
            });
          }
          // R2 RDV created silently
        })());
      }

      // 3. Auto-create vente if positif
      if (classification === "positif" && classificationChanged && savedEtudeId && clientId) {
        postSaveOps.push((async () => {
          const { data: existingVente } = await supabase
            .from("ventes").select("id").eq("etude_id", savedEtudeId).maybeSingle();
          if (!existingVente) {
            const { error: venteError } = await supabase.from("ventes").insert({
              user_id: user.id, client_id: clientId, etude_id: savedEtudeId,
              montant_ht: calculatedResults?.prixTotalHorsAides || 0,
              montant_ttc: calculatedResults?.prixTotalHorsAides || 0,
              puissance_kwc: Number(puissanceKwc) || null,
              nombre_panneaux: Math.ceil((Number(puissanceKwc) || 0) / 0.5),
              type_installation: supportInstallation, status: "signe",
              date_signature: new Date().toISOString(),
              notes: classificationComment || "Vente créée automatiquement depuis étude positive",
            });
            if (!venteError) {
              // Vente created silently
            }
          }
        })());
      }

      // 4. PDF generation (fire-and-forget)
      if (shouldGeneratePdf) {
        postSaveOps.push(generateAndStorePdf().catch(err => console.error("PDF generation error:", err)).then(() => {}));
        // 5. Generate Résultat d'étude PDF when "Terminé" is used
        if (wasForceSync) {
          postSaveOps.push(generateAndStoreResultatPdf().catch(err => console.error("Résultat PDF generation error:", err)).then(() => {}));
        }
      }

      // Run all in parallel, log errors but don't block
      Promise.allSettled(postSaveOps).catch(err => console.error("Post-save side-effects error:", err));
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTO-SAVE LOGIC
  // ═══════════════════════════════════════════════════════════════════════════
  const [autoSaveStatus, setAutoSaveStatus] = useState<{
    isSaving: boolean;
    lastSaved: Date | null;
    hasUnsavedChanges: boolean;
  }>({ isSaving: false, lastSaved: null, hasUnsavedChanges: false });

  // Build étude data for auto-save (reuse from handleSave)
  const buildEtudeData = useCallback(() => {
    if (!clientId || !user) return null;
    
    // For PV, require calculated results
    if (productType === "PV" && !calculatedResults) return null;
    
    return {
      user_id: user.id,
      client_id: clientId,
      rdv_id: rdvId || null,
      product_type: productType,
      consommation_annuelle_kwh: consoAnnuelle || null,
      facture_annuelle_euros: Number(factureMensuelle || 0) * 12,
      ombre_toiture: productType === "PV" ? ombreToiture : null,
      surface_toiture: productType === "PV" ? surfaceToiture : null,
      type_toiture: productType === "PV" ? typeToiture : null,
      etat_toiture: productType === "PV" ? etatToiture : null,
      type_compteur_electrique: productType === "PV" ? typeCompteurElectrique : null,
      numero_pdl: productType === "PV" ? (numeroPdl || null) : null,
      type_raccordement: productType === "PV" ? typeRaccordement : null,
      amperage_disjoncteur: productType === "PV" && amperageDisjoncteur ? Number(amperageDisjoncteur) : null,
      emplacement_boitier: productType === "PV" ? (emplacementBoitier || null) : null,
      potentiel_faisabilite: potentielFaisabilite || null,
      puissance_kwc: productType === "PV" && puissanceKwc ? Number(puissanceKwc) : null,
      type_revente: productType === "PV" ? (typeRevente || null) : null,
      support: productType === "PV" ? (supportInstallation || null) : null,
      orientation: productType === "PV" ? (orientation || null) : null,
      inclinaison: productType === "PV" && inclinaison ? Number(inclinaison) : null,
      surface_installation_m2: productType === "PV" && surfaceInstallation ? Number(surfaceInstallation) : null,
      rendement_productivite: productType === "PV" && rendementProductivite ? Number(rendementProductivite) : null,
      production_annuelle_kwh: productType === "PV" ? calculatedResults?.productionAnnuelle : null,
      autoconsommation_pct: productType === "PV" ? calculatedResults?.autoconsoPct : null,
      surplus_production_kwh: productType === "PV" ? calculatedResults?.surplusProduction : null,
      pac_subtype: productType === "PAC" ? pacSubtype : null,
      pac_surface_chauffee: productType === "PAC" && pacSurfaceChauffee ? Number(pacSurfaceChauffee) : null,
      pac_niveau_isolation: productType === "PAC" ? pacNiveauIsolation : null,
      ite_surface_isoler: productType === "ITE" && iteSurfaceIsoler ? Number(iteSurfaceIsoler) : null,
      ite_type_facade: productType === "ITE" ? iteTypeFacade : null,
      prix_installation: productType === "PV" ? calculatedResults?.prixInstallation : (pacPrixManuel || itePrixManuel || null),
      surcouts: selectedSurcouts,
      autre_surcout: autreSurcout,
      mode_financement: dataFinancements.find(f => f.id === financementId)?.nom || null,
      duree_financement_mois: dureeMoisManuelle ? Number(dureeMoisManuelle) : 120,
      notes: classificationComment || null,
      classification: classification || null,
      classification_comment: classificationComment || null,
      surcout_support: surcoutSupport,
      surcout_compteur: surcoutCompteur,
      prime_autoconsommation: productType === "PV" ? calculatedResults?.primeAutoconsommation : null,
      eco_tva: productType === "PV" ? calculatedResults?.ecoTva : null,
      total_aides: productType === "PV" ? calculatedResults?.totalAides : null,
      total_aides_deduites: productType === "PV" ? calculatedResults?.totalAidesDeduites : null,
      mensualite_estimee: productType === "PV" ? calculatedResults?.mensualite : null,
      economie_autoconso_mensuelle: productType === "PV" ? calculatedResults?.autoconsommationEuros : null,
      revente_mensuelle_estimee: productType === "PV" ? calculatedResults?.reventeMensuelleEstimee : null,
      resultat_transfert_charge: productType === "PV" ? calculatedResults?.resultatTransfertCharge : null,
      verdict: productType === "PV" ? calculatedResults?.verdict : null,
    };
  }, [
    clientId, user, productType, calculatedResults, consoAnnuelle, factureMensuelle,
    ombreToiture, surfaceToiture, typeToiture, etatToiture, typeCompteurElectrique,
    numeroPdl, typeRaccordement, amperageDisjoncteur, emplacementBoitier, potentielFaisabilite,
    puissanceKwc, typeRevente, supportInstallation, orientation, inclinaison,
    surfaceInstallation, rendementProductivite, pacSubtype, pacSurfaceChauffee,
    pacNiveauIsolation, iteSurfaceIsoler, iteTypeFacade, pacPrixManuel, itePrixManuel,
    selectedSurcouts, autreSurcout, dataFinancements, financementId, dureeMoisManuelle,
    classificationComment, rdvId, classification, surcoutSupport, surcoutCompteur, surcoutEmplacement
  ]);

  // Perform auto-save
  const performAutoSave = useCallback(async () => {
    const etudeData = buildEtudeData();
    if (!etudeData) return;

    // Prevent concurrent inserts that create duplicate études
    if (!currentEtudeId && isInsertingRef.current) return;

    // Don't auto-save while the "existing study" prompt is showing — wait for user choice
    if (existingEtudePrompt) return;

    setAutoSaveStatus(prev => ({ ...prev, isSaving: true }));

    try {
      if (isOnline) {
        // Online: save directly to Supabase
        if (currentEtudeId) {
          await supabase.from("etudes").update(etudeData).eq("id", currentEtudeId);
        } else {
          isInsertingRef.current = true;
          try {
            const { data } = await supabase.from("etudes").insert(etudeData).select("id").single();
            if (data) {
              setCurrentEtudeId(data.id);
            }
          } finally {
            isInsertingRef.current = false;
          }
        }
      } else {
        // Offline: save to IndexedDB
        const newLocalId = await saveEtudeOffline(clientId!, etudeData, localEtudeId || undefined);
        if (!localEtudeId) {
          setLocalEtudeId(newLocalId);
        }
      }

      setAutoSaveStatus({
        isSaving: false,
        lastSaved: new Date(),
        hasUnsavedChanges: false,
      });
      
      // Clear sessionStorage draft after successful DB save
      clearDraft();
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Auto-save error:", error);
      isInsertingRef.current = false;
      setAutoSaveStatus(prev => ({ ...prev, isSaving: false }));
    }
  }, [buildEtudeData, isOnline, currentEtudeId, clientId, localEtudeId, saveEtudeOffline, clearDraft, setHasUnsavedChanges, existingEtudePrompt]);

  // Debounced auto-save trigger
  const triggerAutoSave = useCallback(() => {
    if (!isInitializedRef.current || isRestoring()) return;
    
    setAutoSaveStatus(prev => ({ ...prev, hasUnsavedChanges: true }));
    setHasUnsavedChanges(true);
    
    // Save to sessionStorage immediately for persistence
    const formData = buildFormDataForDraft();
    if (formData) {
      saveDraft(formData);
    }
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      performAutoSave();
    }, 2000); // 2 seconds debounce
  }, [performAutoSave, isRestoring, setHasUnsavedChanges, saveDraft]);

  // Build form data for sessionStorage draft
  const buildFormDataForDraft = useCallback(() => {
    return {
      productType,
      consoAnnuelle,
      factureMensuelle,
      ombreToiture,
      surfaceToiture,
      typeToiture,
      etatToiture,
      typeCompteurElectrique,
      numeroPdl,
      typeRaccordement,
      amperageDisjoncteur,
      emplacementBoitier,
      potentielFaisabilite,
      puissanceKwc,
      bouquetId,
      typeRevente,
      supportInstallation,
      orientation,
      inclinaison,
      surfaceInstallation,
      rendementProductivite,
      financementId,
      dureeMoisManuelle,
      mensualiteManuelle,
      prixInstallationManuel,
      selectedSurcouts,
      autreSurcout,
      pacSubtype,
      pacSurfaceChauffee,
      pacTypeEmetteurs,
      pacNombreUnitesInt,
      pacPuissanceCalorifique,
      pacCop,
      pacEcsIntegre,
      pacVolumeBallon,
      pacEnergieActuelle,
      pacConsoChaufffageKwh,
      pacEconomieEstimee,
      pacFactureChauffageEuros,
      pacFactureElecEuros,
      pacNiveauIsolation,
      pacPrixKwhElec,
      pacPrixManuel,
      iteSurfaceIsoler,
      iteTypeFacade,
      iteEpaisseurIsolant,
      iteTypeIsolant,
      iteRActuel,
      iteRCible,
      iteNombreFacades,
      iteSurfaceOuvertures,
      iteFinition,
      iteEconomieChauffagePct,
      iteFactureChaufActuelle,
      itePrixManuel,
      aidesPAC,
      aidesITE,
      aidesManuelles,
      classification,
      classificationComment,
      r2DateHeure: r2DateHeure?.toISOString(),
      r2Time,
    };
  }, [
    productType, consoAnnuelle, factureMensuelle, ombreToiture, surfaceToiture,
    typeToiture, etatToiture, typeCompteurElectrique, numeroPdl, typeRaccordement,
    amperageDisjoncteur, emplacementBoitier, potentielFaisabilite, puissanceKwc,
    bouquetId, typeRevente, supportInstallation, orientation, inclinaison,
    surfaceInstallation, rendementProductivite, financementId, dureeMoisManuelle,
    mensualiteManuelle, prixInstallationManuel, selectedSurcouts, autreSurcout,
    pacSubtype, pacSurfaceChauffee, pacTypeEmetteurs, pacNombreUnitesInt,
    pacPuissanceCalorifique, pacCop, pacEcsIntegre, pacVolumeBallon, pacEnergieActuelle,
    pacConsoChaufffageKwh, pacEconomieEstimee, pacFactureChauffageEuros, pacFactureElecEuros,
    pacNiveauIsolation, pacPrixKwhElec, pacPrixManuel, iteSurfaceIsoler, iteTypeFacade,
    iteEpaisseurIsolant, iteTypeIsolant, iteRActuel, iteRCible, iteNombreFacades,
    iteSurfaceOuvertures, iteFinition, iteEconomieChauffagePct, iteFactureChaufActuelle,
    itePrixManuel, aidesPAC, aidesITE, aidesManuelles, classification, classificationComment,
    r2DateHeure, r2Time,
  ]);

  // Immediate save for important actions (photo upload, status change)
  const triggerImmediateSave = useCallback(() => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    performAutoSave();
  }, [performAutoSave]);

  // Mark form as initialized after first data load
  useEffect(() => {
    if (clientName && !loading) {
      // Wait a bit to ensure all initial data is loaded
      const timer = setTimeout(() => {
        isInitializedRef.current = true;
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [clientName, loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save on key field changes
  useEffect(() => {
    if (isInitializedRef.current) {
      triggerAutoSave();
    }
  }, [
    consoAnnuelle, factureMensuelle, puissanceKwc, orientation, inclinaison,
    typeRevente, supportInstallation, selectedSurcouts, autreSurcout,
    ombreToiture, surfaceToiture, typeToiture, etatToiture,
    amperageDisjoncteur, potentielFaisabilite, pacSurfaceChauffee,
    pacNiveauIsolation, iteSurfaceIsoler, iteTypeFacade, financementId,
    classification, classificationComment, typeRaccordement, typeCompteurElectrique,
    numeroPdl, emplacementBoitier, rendementProductivite, surfaceInstallation
  ]);


  // Build PDF data (must be defined before hooks that use it)
  const buildPdfData = useCallback((): EtudeData | null => {
    // For multi-product, we can generate even without PV calculatedResults
    const hasPV = activeProducts.includes("PV");
    const hasPAC = activeProducts.includes("PAC");
    const hasITE = activeProducts.includes("ITE");
    
    if (hasPV && !calculatedResults) return null;
    
    const selectedFinancement = dataFinancements.find(f => f.id === financementId);
    
    const refId = (currentEtudeId || etudeId || localEtudeId || "").substring(0, 8).toUpperCase();
    return {
      // Multi-product
      activeProducts,
      referenceEtude: refId ? `PE-${refId}` : undefined,
      
      clientNom: clientName,
      clientPrenom: clientPrenom,
      clientAdresse: clientAdresse,
      clientVille: clientVille,
      clientCodePostal: clientCodePostal,
      clientTelephone: clientTelephone || undefined,
      departement: departement,
      dateEtude: new Date().toLocaleDateString("fr-FR"),
      ombreToiture: ombreToiture,
      surfaceToiture: surfaceToiture,
      typeToiture: typeToiture,
      etatToiture: etatToiture,
      orientation: orientation || "Non défini",
      inclinaison: Number(inclinaison) || 0,
      typeCompteurElectrique: typeCompteurElectrique || "Non défini",
      numeroPdl: numeroPdl,
      typeRaccordement: typeRaccordement || "Non défini",
      amperageDisjoncteur: Number(amperageDisjoncteur) || 0,
      emplacementBoitier: emplacementBoitier || "Non défini",
      potentielFaisabilite: potentielFaisabilite || "Non défini",
      consoAnnuelle: Number(consoAnnuelle) || 0,
      factureMensuelle: Number(factureMensuelle) || 0,
      consoIsEstimated,
      bouquetNom: `${puissanceKwc} kWc`,
      puissanceKwc: Number(puissanceKwc) || 0,
      typeRevente: typeRevente || "Non défini",
      supportInstallation: supportInstallation || "Non défini",
      surfaceInstallation: Number(surfaceInstallation) || 0,
      heuresEnsoleillement: heuresEnsoleillement,
      rendementProductivite: Number(rendementProductivite) || 100,
      productionAnnuelle: calculatedResults?.productionAnnuelle || 0,
      surplusProduction: calculatedResults?.surplusProduction || 0,
      autoconsoPct: calculatedResults?.autoconsoPct || 0,
      prixInstallation: calculatedResults?.prixInstallation || 0,
      surcoutSupport: surcoutSupport,
      surcoutCompteur: surcoutCompteur,
      surcoutEmplacement: surcoutEmplacement,
      autreSurcout: autreSurcout,
      prixTotalHorsAides: calculatedResults?.prixTotalHorsAides || 0,
      primeAutoconsommation: calculatedResults?.primeAutoconsommation || 0,
      ecoTva: calculatedResults?.ecoTva || 0,
      totalAides: calculatedResults?.totalAides || 0,
      totalAidesDeduites: calculatedResults?.totalAidesDeduites || 0,
      financementNom: selectedFinancement?.nom || "Non défini",
      tauxFinancement: selectedFinancement?.taux_effectif || 0,
      dureeMois: dureeMoisManuelle || 120,
      mensualite: calculatedResults?.mensualite || 0,
      autoconsommationEuros: calculatedResults?.autoconsommationEuros || 0,
      reventeMensuelleEstimee: calculatedResults?.reventeMensuelleEstimee || 0,
      resultatTransfertCharge: calculatedResults?.resultatTransfertCharge || 0,
      verdict: calculatedResults?.verdict || "invalide",
      classification: classification || undefined,
      classificationComment: classificationComment || undefined,
      
      // ═══════════════════════════════════════════════════════════════════════════
      // DONNÉES PAC
      // ═══════════════════════════════════════════════════════════════════════════
      pac: hasPAC ? {
        subtype: pacSubtype,
        surfaceChauffee: Number(pacSurfaceChauffee) || 0,
        typeEmetteurs: pacTypeEmetteurs || "Non défini",
        puissanceCalorifique: Number(pacPuissanceCalorifique) || 0,
        cop: Number(pacCop) || 3.5,
        ecsIntegre: pacEcsIntegre,
        volumeBallon: Number(pacVolumeBallon) || 0,
        energieActuelle: pacEnergieActuelle || "Non défini",
        niveauIsolation: pacNiveauIsolation || "moyen",
        prixInstallation: Number(pacPrixManuel) || 0,
        aides: aidesPAC,
        economies: pacEconomiesCalculees,
        factureChauffage: Number(pacFactureChauffageEuros) || 0,
        factureElec: Number(pacFactureElecEuros) || 0,
        prixKwhElec: Number(pacPrixKwhElec) || 0.23,
      } : undefined,
      
      // ═══════════════════════════════════════════════════════════════════════════
      // DONNÉES ITE
      // ═══════════════════════════════════════════════════════════════════════════
      ite: hasITE ? {
        surfaceIsoler: Number(iteSurfaceIsoler) || 0,
        typeFacade: iteTypeFacade || "Non défini",
        epaisseurIsolant: Number(iteEpaisseurIsolant) || 120,
        typeIsolant: iteTypeIsolant || "Non défini",
        rActuel: Number(iteRActuel) || 0,
        rCible: Number(iteRCible) || 3.7,
        nombreFacades: Number(iteNombreFacades) || 1,
        surfaceOuvertures: Number(iteSurfaceOuvertures) || 0,
        finition: iteFinition || "Non défini",
        economieChauffagePct: Number(iteEconomieChauffagePct) || 0,
        factureChaufActuelle: Number(iteFactureChaufActuelle) || 0,
        prixInstallation: Number(itePrixManuel) || 0,
        aides: aidesITE,
      } : undefined,
    };
  }, [
    calculatedResults, clientName, clientPrenom, clientAdresse, clientVille,
    clientCodePostal, clientTelephone, departement, ombreToiture, surfaceToiture,
    typeToiture, etatToiture, orientation, inclinaison, typeCompteurElectrique,
    numeroPdl, typeRaccordement, amperageDisjoncteur, emplacementBoitier,
    potentielFaisabilite, consoAnnuelle, factureMensuelle, puissanceKwc,
    typeRevente, supportInstallation, surfaceInstallation, heuresEnsoleillement,
    rendementProductivite, surcoutSupport, surcoutCompteur, surcoutEmplacement, autreSurcout,
    dataFinancements, financementId, dureeMoisManuelle, classification, classificationComment,
    activeProducts, pacSubtype, pacSurfaceChauffee, pacTypeEmetteurs, pacPuissanceCalorifique,
    pacCop, pacEcsIntegre, pacVolumeBallon, pacEnergieActuelle, pacNiveauIsolation,
    pacPrixManuel, aidesPAC, pacEconomiesCalculees, pacFactureChauffageEuros, pacFactureElecEuros,
    pacPrixKwhElec, iteSurfaceIsoler, iteTypeFacade, iteEpaisseurIsolant, iteTypeIsolant,
    iteRActuel, iteRCible, iteNombreFacades, iteSurfaceOuvertures, iteFinition,
    iteEconomieChauffagePct, iteFactureChaufActuelle, itePrixManuel, aidesITE,
  ]);

  // PDF Auto-save hook (generates and stores PDF every 5 minutes + on r2_prestudy)
  const { generateAndStorePdf, generateAndStoreResultatPdf } = useEtudePdfAutoSave({
    etudeId: currentEtudeId,
    clientName,
    clientPrenom,
    userId: user?.id || null,
    isInitialized: isInitializedRef.current,
    buildPdfData,
  });

  const handleExportPdf = async () => {
    if (!calculatedResults) return;
    
    setExporting(true);
    
    try {
      const pdfData = buildPdfData();
      if (!pdfData) throw new Error("Données PDF manquantes");
      
      // Export and download
      await exportEtudePdf(pdfData);
      
      // Also store in cloud for future access
      await generateAndStorePdf();
      
      toast({
        title: "PDF exporté",
        description: "L'étude a été téléchargée et sauvegardée",
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

  const handlePreview = async () => {
    const pdfData = buildPdfData();
    if (!pdfData) return;
    
    const dataUrl = await getEtudePdfDataUrl(pdfData);
    setPdfDataUrl(dataUrl);
    setShowPreview(true);
  };

  const handleShare = async () => {
    const pdfData = buildPdfData();
    if (!pdfData) return;
    
    try {
      const blob = await getEtudePdfBlob(pdfData);
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
        await exportEtudePdf(pdfData);
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

  // Partage WhatsApp avec PDF pour r2_prestudy
  const handleWhatsAppShare = async () => {
    const pdfData = buildPdfData();
    if (!pdfData || !user) return;
    
    try {
      const blob = await getEtudePdfBlob(pdfData);
      const fileName = `Etude_${clientName}_${clientPrenom}_${new Date().toISOString().split("T")[0]}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });
      
      // Construire le message avec date R2 et commentaire
      const fullName = [clientPrenom, clientName].filter(Boolean).join(" ");
      let r2DateStr = "";
      if (r2DateHeure && r2Time) {
        const r2DateTime = new Date(`${format(r2DateHeure, "yyyy-MM-dd")}T${r2Time}:00`);
        r2DateStr = format(r2DateTime, "EEEE dd MMMM yyyy 'à' HH:mm", { locale: fr });
      }
      
      const message = `*ÉTUDE PRÉ-INSTALLATION*

Client: *${fullName}*
Date: ${new Date().toLocaleDateString("fr-FR")}

*RDV R2 prévu:*
${r2DateStr || "À définir"}

${classificationComment ? `*Commentaire:*\n${classificationComment}` : ""}

*Document PDF joint*

---
_Envoyé depuis DébalePro_`;
      
      // Essayer de partager avec le PDF via Web Share API
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Étude ${clientPrenom} ${clientName}`,
          text: message,
        });
        setShowPreview(false);
        toast({
          title: "Partage réussi",
          description: "L'étude a été partagée via WhatsApp",
        });
      } else {
        // Fallback: Télécharger le PDF puis ouvrir WhatsApp avec le message
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Récupérer le numéro du confirmateur pour WhatsApp
        const { data: settings } = await supabase
          .from("settings_notifications")
          .select("confirmateur_phone")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (settings?.confirmateur_phone) {
          const cleanPhone = settings.confirmateur_phone.replace(/[+\s-]/g, "");
          const encodedMessage = encodeURIComponent(message);
          window.open(`https://wa.me/${cleanPhone}?text=${encodedMessage}`, "_blank");
        } else {
          // Ouvrir WhatsApp sans numéro pré-rempli
          const encodedMessage = encodeURIComponent(message);
          window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
        }
        
        toast({
          title: "PDF téléchargé",
          description: "Joignez le PDF dans WhatsApp",
        });
      }
    } catch (error) {
      console.error("Erreur partage WhatsApp:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de partager via WhatsApp",
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
      {/* Dialog: étude existante détectée */}
      <AlertDialog open={!!existingEtudePrompt} onOpenChange={(open) => { if (!open) setExistingEtudePrompt(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              Étude existante détectée
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Une étude existe déjà pour ce client. Souhaitez-vous la continuer ou créer une nouvelle étude pour une autre maison ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={() => {
                if (existingEtudePrompt) {
                  navigate(`/etude?clientId=${clientId}${rdvId ? `&rdvId=${rdvId}` : ""}&etudeId=${existingEtudePrompt.etudeId}`, { replace: true });
                }
                setExistingEtudePrompt(null);
              }}
            >
              Continuer l'étude existante
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setExistingEtudePrompt(null);
                // Allow creating a new study — form stays empty
              }}
            >
              <Home className="h-4 w-4 mr-2" />
              Nouvelle maison (autre étude)
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <div className="space-y-3 sm:space-y-4">
        {/* Official Header with logos - Sticky - Compact on mobile */}
        <div className="bg-white border-b-2 sm:border-b-4 border-[#000091] px-3 sm:px-4 py-2 sm:py-3 sticky top-0 z-40 shadow-md">
          {/* Tricolor band - thinner on mobile */}
          <div className="flex h-0.5 sm:h-1 mb-2 sm:mb-3 rounded-full overflow-hidden">
            <div className="flex-1 bg-[#000091]" />
            <div className="flex-1 bg-white border-y border-gray-200" />
            <div className="flex-1 bg-[#E1000F]" />
          </div>
          
          {/* Logos row - smaller on mobile */}
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <img 
              src={franceRenovLogo} 
              alt="France Rénov'" 
              className="h-10 sm:h-16 object-contain"
            />
            <div className="flex-1 text-center min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-[#000091] tracking-tight truncate">
                ÉTUDE ÉNERGÉTIQUE
              </h1>
              <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wider truncate">
                {activeProducts.length > 1 
                  ? activeProducts.map(p => p === "PV" ? "Photovoltaïque" : p === "PAC" ? "PAC" : "ITE").join(" + ")
                  : currentTab === "PV" ? "Photovoltaïque" : currentTab === "PAC" ? "Pompe à Chaleur" : "Isolation Thermique"
                }
              </p>
            </div>
            <img 
              src={ministereTransitionLogo} 
              alt="Ministère" 
              className="h-10 sm:h-16 object-contain"
            />
          </div>
          
          {/* Back button and client info - more compact on mobile */}
          <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-7 w-7 sm:h-8 sm:w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {clientName && (
                  <span className="text-xs sm:text-sm font-semibold text-gray-800 truncate max-w-[120px] sm:max-w-none">
                    {clientPrenom} {clientName}
                  </span>
                )}
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[9px] sm:text-[10px] font-medium shrink-0 px-1.5 py-0.5",
                    isEditMode 
                      ? "bg-amber-500/10 text-amber-600 border-amber-300" 
                      : "bg-emerald-500/10 text-emerald-600 border-emerald-300"
                  )}
                >
                  {isEditMode ? "Modif." : "Nouv."}
                </Badge>
                {regieNom && (
                  <Badge 
                    variant="outline" 
                    className="text-[9px] sm:text-[10px] font-medium shrink-0 bg-primary/10 text-primary border-primary/30 px-1.5 py-0.5 hidden sm:inline-flex"
                  >
                    {regieNom}
                  </Badge>
                )}
              </div>
              {clientVille && (
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                  {clientCodePostal} {clientVille}
                </p>
              )}
            </div>
            {/* Auto-save indicator and HEJJA Mode Switch */}
            <div className="flex items-center gap-2 shrink-0">
              <AutoSaveIndicator
                isSaving={autoSaveStatus.isSaving}
                lastSaved={autoSaveStatus.lastSaved}
                hasUnsavedChanges={autoSaveStatus.hasUnsavedChanges}
                isOnline={isOnline}
              />
              <Switch
                checked={modeHejjaActive}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setShowPinDialog(true);
                  } else {
                    deactivateHejja();
                  }
                }}
                className={cn(
                  "data-[state=checked]:bg-emerald-500 h-4 w-8 sm:h-5 sm:w-9",
                  modeHejjaActive && "shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                )}
              />
              {modeHejjaActive && (
                <span className="text-[9px] sm:text-[10px] font-bold text-red-500 uppercase">H</span>
              )}
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-4 space-y-3 sm:space-y-4 pb-24">
          {/* PIN Dialog for HEJJA Mode - Hidden activation via long press elsewhere */}

          {/* PIN Dialog */}
          <PinDialog
            open={showPinDialog}
            onOpenChange={setShowPinDialog}
            onSuccess={activateHejja}
            title="Mode HEJJA"
            description="Entrez le code PIN interne pour activer le mode HEJJA"
          />

          {/* ═══════════════════════════════════════════════════════════════════════════ */}
          {/* SÉLECTEUR TYPE DE PRODUIT */}
          {/* ═══════════════════════════════════════════════════════════════════════════ */}
          <Card className="shadow-card border-2 border-primary/30">
            <CardContent className="pt-3 sm:pt-4 pb-3 sm:pb-4">
              <ProductTypeSelector
                activeProducts={activeProducts}
                currentTab={currentTab}
                onActiveProductsChange={setActiveProducts}
                onTabChange={setCurrentTab}
                disabled={isEditMode}
              />
            </CardContent>
          </Card>

          {/* ═══════════════════════════════════════════════════════════════════════════ */}
          {/* SITUATION ÉNERGÉTIQUE ACTUELLE — visible uniquement en multi-produit */}
          {/* ═══════════════════════════════════════════════════════════════════════════ */}
          {activeProducts.length > 1 && (
            <>
              <div className="pt-1 sm:pt-2">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center mb-3 sm:mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
                  <h2 className="text-xs sm:text-sm font-bold text-[#000091] uppercase tracking-wider px-2 sm:px-3 whitespace-nowrap">
                    Situation énergétique actuelle
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
                </div>
              </div>

              <Card className="shadow-card border-2 border-amber-200">
                <CardHeader className="pb-2 bg-amber-50 px-3 sm:px-6 py-2 sm:py-3">
                  <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 text-amber-800">
                    <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
                    Consommations actuelles du foyer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <Label className="text-[10px] sm:text-xs">Conso. élec annuelle</Label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="11600"
                          value={consoAnnuelle}
                          onChange={(e) => { setConsoAnnuelle(e.target.value ? Number(e.target.value) : ""); }}
                          className="h-8 sm:h-9 text-xs sm:text-sm"
                        />
                        <span className="flex items-center text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">kWh</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] sm:text-xs">Facture élec/mois</Label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="230"
                          value={factureMensuelle}
                          onChange={(e) => { setFactureMensuelle(e.target.value ? Number(e.target.value) : ""); }}
                          className="h-8 sm:h-9 text-xs sm:text-sm"
                        />
                        <span className="flex items-center text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">€</span>
                      </div>
                    </div>
                  </div>

                  {/* Prix unitaire calculé */}
                  {consoAnnuelle && factureMensuelle && Number(consoAnnuelle) > 0 && (
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] sm:text-xs text-muted-foreground">Prix kWh</p>
                      <p className="font-bold text-sm sm:text-base text-primary">
                        {((Number(factureMensuelle) * 12) / Number(consoAnnuelle)).toFixed(4)} €/kWh
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        Annuel: {(Number(factureMensuelle) * 12).toLocaleString("fr-FR")}€
                      </p>
                    </div>
                  )}

                  {/* Facture chauffage fossile si PAC ou ITE */}
                  {(activeProducts.includes("PAC") || activeProducts.includes("ITE")) && (
                    <div>
                      <Label className="text-[10px] sm:text-xs">Facture chauffage fossile/an (gaz, fioul…)</Label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          placeholder="1800"
                          value={pacFactureChauffageEuros || iteFactureChaufActuelle || ""}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : "";
                            if (activeProducts.includes("PAC")) setPacFactureChauffageEuros(val);
                            if (activeProducts.includes("ITE")) setIteFactureChaufActuelle(val);
                          }}
                          className="h-8 sm:h-9 text-xs sm:text-sm"
                        />
                        <span className="flex items-center text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">€/an</span>
                      </div>
                    </div>
                  )}

                  {/* Estimateur */}
                  <ConsumptionEstimator
                    productType={productType}
                    onApply={(result) => {
                      setConsoAnnuelle(result.consoElecKwh);
                      setFactureMensuelle(result.factureMensuelleElec);
                      setConsoIsEstimated(true);
                      if (activeProducts.includes("PAC")) {
                        if (result.consoChaufffageKwh) setPacConsoChaufffageKwh(result.consoChaufffageKwh);
                        if (result.factureChaufMensuelle) setPacFactureChauffageEuros(result.factureChaufMensuelle);
                      }
                      if (activeProducts.includes("ITE")) {
                        if (result.factureChaufMensuelle) setIteFactureChaufActuelle(result.factureChaufMensuelle);
                      }
                      if (result.estimationDetails) {
                        estimationDetailsRef.current = result.estimationDetails;
                        setEstimationDetailsDisplay(result.estimationDetails);
                      }
                    }}
                  />

                  {/* En multi-produit : tout est affiché à la suite, plus besoin de navigation */}
                  <div className="bg-muted/40 border border-border rounded-lg p-2.5 text-[10px] sm:text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">📋 Études techniques : {activeProducts.includes("ITE") ? "ITE" : ""}{activeProducts.includes("ITE") && activeProducts.includes("PAC") ? " → " : ""}{activeProducts.includes("PAC") ? "PAC" : ""}{(activeProducts.includes("PAC") || activeProducts.includes("ITE")) && activeProducts.includes("PV") ? " → " : ""}{activeProducts.includes("PV") ? "PV" : ""} → Bilan financier global</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* =============== ÉTUDES TECHNIQUES — séquentielles en multi-produit =============== */}

          {/* =============== ÉTUDES TECHNIQUES — séquentielles en multi-produit =============== */}

          {/* ─── SECTION ITE ─── */}
          {activeProducts.includes("ITE") && (activeProducts.length <= 1 ? currentTab === "ITE" : true) && (
            <>
            {activeProducts.length > 1 ? (
              <div className="pt-3 sm:pt-4">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center mb-3 sm:mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-400/50 to-transparent" />
                  <h2 className="text-xs sm:text-sm font-bold text-orange-600 uppercase tracking-wider px-2 sm:px-3 whitespace-nowrap">
                    🧱 Isolation Thermique Extérieure
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-400/50 to-transparent" />
                </div>
              </div>
            ) : (
              <div className="pt-1 sm:pt-2">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center mb-3 sm:mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
                  <h2 className="text-xs sm:text-sm font-bold text-[#000091] uppercase tracking-wider px-2 sm:px-3 whitespace-nowrap">Diagnostic</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
                </div>
              </div>
            )}
            <ITEFields
              data={{
                iteSurfaceIsoler, iteTypeFacade, iteEpaisseurIsolant, iteTypeIsolant,
                iteRActuel, iteRCible, iteNombreFacades, iteSurfaceOuvertures,
                iteFinition, iteEconomieChauffagePct, iteFactureChaufActuelle,
              }}
              onChange={(field, value) => {
                switch (field) {
                  case "iteSurfaceIsoler": setIteSurfaceIsoler(value as number | ""); break;
                  case "iteTypeFacade": setIteTypeFacade(value as string); break;
                  case "iteEpaisseurIsolant": setIteEpaisseurIsolant(value as number | ""); break;
                  case "iteTypeIsolant": setIteTypeIsolant(value as string); break;
                  case "iteRActuel": setIteRActuel(value as number | ""); break;
                  case "iteRCible": setIteRCible(value as number | ""); break;
                  case "iteNombreFacades": setIteNombreFacades(value as number | ""); break;
                  case "iteSurfaceOuvertures": setIteSurfaceOuvertures(value as number | ""); break;
                  case "iteFinition": setIteFinition(value as string); break;
                  case "iteEconomieChauffagePct": setIteEconomieChauffagePct(value as number | ""); break;
                  case "iteFactureChaufActuelle": setIteFactureChaufActuelle(value as number | ""); break;
                }
              }}
              linkedPacActive={activeProducts.includes("PAC")}
              linkedPacFactureChauffage={activeProducts.includes("PAC") ? Number(pacFactureChauffageEuros) || 0 : undefined}
            />
            </>
          )}

          {/* ─── SECTION PAC ─── */}
          {activeProducts.includes("PAC") && (activeProducts.length <= 1 ? currentTab === "PAC" : true) && (
            <>
            {activeProducts.length > 1 ? (
              <div className="pt-3 sm:pt-4">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center mb-3 sm:mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
                  <h2 className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-wider px-2 sm:px-3 whitespace-nowrap">
                    ❄️ Pompe à Chaleur
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-blue-400/50 to-transparent" />
                </div>
              </div>
            ) : (
              <div className="pt-1 sm:pt-2">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center mb-3 sm:mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
                  <h2 className="text-xs sm:text-sm font-bold text-[#000091] uppercase tracking-wider px-2 sm:px-3 whitespace-nowrap">Diagnostic</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
                </div>
              </div>
            )}
            <PACFields
              data={{
                pacSubtype, pacSurfaceChauffee, pacTypeEmetteurs, pacNombreUnitesInt,
                pacPuissanceCalorifique, pacCop, pacEcsIntegre, pacVolumeBallon,
                pacEnergieActuelle, pacConsoChaufffageKwh, pacEconomieEstimee,
                pacFactureChauffageEuros, pacFactureElecEuros, pacNiveauIsolation, pacPrixKwhElec,
                pacProfilMpr,
              }}
              onChange={(field, value) => {
                switch (field) {
                  case "pacSubtype": {
                    const newSubtype = value as "air_air" | "air_eau";
                    setPacSubtype(newSubtype);
                    // Recalculate MPR when subtype changes
                    if (pacProfilMpr) {
                      const MPR_MONTANTS: Record<string, Record<string, number>> = {
                        air_eau: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 },
                        air_air: { bleu: 0, jaune: 0, violet: 0, rose: 0 },
                      };
                      setAidesPAC(prev => ({ ...prev, maPrimeRenov: MPR_MONTANTS[newSubtype]?.[pacProfilMpr] ?? 0 }));
                    }
                    break;
                  }
                  case "pacSurfaceChauffee": setPacSurfaceChauffee(value as number | ""); break;
                  case "pacTypeEmetteurs": setPacTypeEmetteurs(value as string); break;
                  case "pacNombreUnitesInt": setPacNombreUnitesInt(value as number | ""); break;
                  case "pacPuissanceCalorifique": setPacPuissanceCalorifique(value as number | ""); break;
                  case "pacCop": setPacCop(value as number | ""); break;
                  case "pacEcsIntegre": setPacEcsIntegre(value as boolean); break;
                  case "pacVolumeBallon": setPacVolumeBallon(value as number | ""); break;
                  case "pacEnergieActuelle": setPacEnergieActuelle(value as string); break;
                  case "pacConsoChaufffageKwh": setPacConsoChaufffageKwh(value as number | ""); break;
                  case "pacEconomieEstimee": setPacEconomieEstimee(value as number | ""); break;
                  case "pacFactureChauffageEuros": setPacFactureChauffageEuros(value as number | ""); break;
                  case "pacFactureElecEuros": setPacFactureElecEuros(value as number | ""); break;
                  case "pacNiveauIsolation": setPacNiveauIsolation(value as string); break;
                  case "pacPrixKwhElec": setPacPrixKwhElec(value as number | ""); break;
                  case "pacProfilMpr": {
                    const profil = value as string;
                    setPacProfilMpr(profil);
                    // Auto-calculate MPR aid based on profile
                    const MPR_MONTANTS: Record<string, Record<string, number>> = {
                      air_eau: { bleu: 5000, jaune: 4000, violet: 3000, rose: 0 },
                      air_air: { bleu: 0, jaune: 0, violet: 0, rose: 0 }, // Non éligible
                    };
                    const montant = MPR_MONTANTS[pacSubtype]?.[profil] ?? 0;
                    setAidesPAC(prev => ({ ...prev, maPrimeRenov: montant }));
                    break;
                  }
                }
              }}
              iteReductionPct={activeProducts.includes("ITE") ? Number(iteEconomieChauffagePct) || 0 : 0}
              onEconomiesCalculated={setPacEconomiesCalculees}
              linkedIteActive={activeProducts.includes("ITE")}
              iteEconomiePct={Number(iteEconomieChauffagePct) || 0}
              linkedPvActive={activeProducts.includes("PV")}
            />
            </>
          )}

          {/* ─── SECTION PV ─── */}
          {activeProducts.includes("PV") && (activeProducts.length <= 1 ? currentTab === "PV" : true) && (
            <>
            {activeProducts.length > 1 && (
              <div className="pt-3 sm:pt-4">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center mb-3 sm:mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                  <h2 className="text-xs sm:text-sm font-bold text-amber-600 uppercase tracking-wider px-2 sm:px-3 whitespace-nowrap">
                    ☀️ Photovoltaïque
                  </h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                </div>
              </div>
            )}
            {activeProducts.length <= 1 && (
              <div className="pt-1 sm:pt-2">
                <div className="flex items-center gap-1.5 sm:gap-2 justify-center mb-3 sm:mb-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
                  <h2 className="text-xs sm:text-sm font-bold text-[#000091] uppercase tracking-wider px-2 sm:px-3 whitespace-nowrap">Diagnostic</h2>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
                </div>
              </div>
            )}

        {/* VISITE TECHNIQUE - TOITURE */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10 px-3 sm:px-6 py-2 sm:py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <Home className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                Toiture
              </CardTitle>
              {clientId && (
                <QuickPhotoButton
                  clientId={clientId}
                  category="photo_toiture"
                  label="Photo"
                  etudeId={currentEtudeId}
                  onPhotoSaved={triggerImmediateSave}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs">Ombre</Label>
                <Select value={ombreToiture} onValueChange={setOmbreToiture}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0 à 5%">0-5%</SelectItem>
                    <SelectItem value="5 à 15%">5-15%</SelectItem>
                    <SelectItem value="15 à 30%">15-30%</SelectItem>
                    <SelectItem value="> 30%">&gt;30%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs">Surface</Label>
                <Select value={surfaceToiture} onValueChange={setSurfaceToiture}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="LIMITE">Limite</SelectItem>
                    <SelectItem value="NON CONFORME">Non conforme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs">Type</Label>
                <Select value={typeToiture} onValueChange={setTypeToiture}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TUILE">Tuile</SelectItem>
                    <SelectItem value="ARDOISE">Ardoise</SelectItem>
                    <SelectItem value="BAC ACIER">Bac acier</SelectItem>
                    <SelectItem value="FIBROCIMENT">Fibrociment</SelectItem>
                    <SelectItem value="TOIT PLAT">Toit plat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs">État</Label>
                <Select value={etatToiture} onValueChange={setEtatToiture}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OK">OK</SelectItem>
                    <SelectItem value="À RÉNOVER">À rénover</SelectItem>
                    <SelectItem value="NON CONFORME">Non conforme</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs">Orientation</Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUD">Sud</SelectItem>
                    <SelectItem value="SUD-EST">Sud-Est</SelectItem>
                    <SelectItem value="SUD-OUEST">Sud-Ouest</SelectItem>
                    <SelectItem value="EST">Est</SelectItem>
                    <SelectItem value="OUEST">Ouest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs">Inclinaison</Label>
                <Select value={String(inclinaison)} onValueChange={(v) => setInclinaison(Number(v))}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
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
          <CardHeader className="pb-2 bg-primary/10 px-3 sm:px-6 py-2 sm:py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <Plug className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                Compteur
              </CardTitle>
              {clientId && (
                <QuickPhotoButton
                  clientId={clientId}
                  category="photo_compteur"
                  label="Photo"
                  etudeId={currentEtudeId}
                  onPhotoSaved={triggerImmediateSave}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs">Type</Label>
                <Select value={typeCompteurElectrique} onValueChange={setTypeCompteurElectrique}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
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
                <Label className="text-[10px] sm:text-xs">Raccordement</Label>
                <Select value={typeRaccordement} onValueChange={setTypeRaccordement}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONOPHASÉ">Mono</SelectItem>
                    <SelectItem value="TRIPHASÉ">Tri</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-[10px] sm:text-xs">N° PDL</Label>
              <Input
                type="text"
                placeholder="ex: 16271345864078"
                value={numeroPdl}
                onChange={(e) => setNumeroPdl(e.target.value)}
                className="h-8 sm:h-9 text-xs sm:text-sm"
              />
            </div>
          </CardContent>
        </Card>

        {/* TABLEAU ÉLECTRIQUE */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10 px-3 sm:px-6 py-2 sm:py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                Tableau
              </CardTitle>
              {clientId && (
                <QuickPhotoButton
                  clientId={clientId}
                  category="photo_tableau"
                  label="Photo"
                  etudeId={currentEtudeId}
                  onPhotoSaved={triggerImmediateSave}
                />
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs">Ampérage</Label>
                <Select value={String(amperageDisjoncteur)} onValueChange={(v) => setAmperageDisjoncteur(Number(v))}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dataCalibres.map((c) => (
                      <SelectItem key={c.id} value={String(c.calibre_amperes)}>
                        {c.calibre_amperes}A ({c.puissance_kva}kVA)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs">Emplacement</Label>
                <Select value={emplacementBoitier} onValueChange={setEmplacementBoitier}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="À côté">À côté</SelectItem>
                    <SelectItem value="Distant (&lt; 10m)">&lt;10m</SelectItem>
                    <SelectItem value="Distant (&gt; 10m)">&gt;10m</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RÉSULTAT VISITE TECHNIQUE */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-secondary/20 px-3 sm:px-6 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-secondary" />
              Résultat Visite
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-3 sm:pt-4 px-3 sm:px-6">
            <div>
              <Label className="text-[10px] sm:text-xs">Potentiel (PFT)</Label>
              <Select value={potentielFaisabilite} onValueChange={setPotentielFaisabilite}>
                <SelectTrigger className={cn(
                  "h-9 sm:h-10 text-xs sm:text-sm",
                  potentielFaisabilite === "Faisable" && "bg-status-signed/10 border-status-signed text-status-signed",
                  potentielFaisabilite === "À étudier" && "bg-status-reported/10 border-status-reported text-status-reported",
                  potentielFaisabilite === "Non faisable" && "bg-status-negative/10 border-status-negative text-status-negative"
                )}>
                  <SelectValue placeholder="Choisir" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Faisable">✓ Faisable</SelectItem>
                  <SelectItem value="À étudier">⚠ À étudier</SelectItem>
                  <SelectItem value="Non faisable">✗ Non faisable</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* =============== PRÉCONISATION TECHNIQUE =============== */}
        <div className="pt-2 sm:pt-4">
          <h2 className="text-sm sm:text-lg font-display font-bold text-center text-primary mb-3 sm:mb-4">
            PRÉCONISATION
          </h2>
        </div>

        {/* CONSOMMATIONS — masquées en multi-produit car déjà affichées dans "Situation actuelle" */}
        <Card className="shadow-card" style={activeProducts.length > 1 ? { display: 'none' } : undefined}>
          <CardHeader className="pb-2 bg-primary/10 px-3 sm:px-6 py-2 sm:py-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <Zap className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-secondary" />
                Consommations
              </CardTitle>
              {(activeProducts.includes("PAC") || activeProducts.includes("ITE")) && (
                <Badge variant="outline" className="text-[10px] h-5 border-blue-300 text-blue-600 bg-blue-50">
                  <Link2 className="h-3 w-3 mr-1" />
                  Partagé {activeProducts.filter(p => p !== "PV").join(" + ")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
            {/* Sync info banner */}
            {activeProducts.includes("PAC") && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-[10px] sm:text-xs text-blue-700 flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span>La facture électrique et le prix du kWh sont synchronisés avec l'onglet PAC</span>
              </div>
            )}
            {activeProducts.includes("ITE") && !activeProducts.includes("PAC") && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-[10px] sm:text-xs text-orange-700 flex items-center gap-2">
                <Home className="h-3.5 w-3.5 shrink-0" />
                <span>L'ITE réduit les besoins en chauffage, impactant le dimensionnement PV</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs">Conso. annuelle</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="11600"
                    value={consoAnnuelle}
                    onChange={(e) => { setConsoAnnuelle(e.target.value ? Number(e.target.value) : ""); }}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  />
                  <span className="flex items-center text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">kWh</span>
                </div>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs flex items-center gap-1">
                  Facture/mois
                  {activeProducts.includes("PAC") && <Link2 className="h-2.5 w-2.5 text-blue-500" />}
                </Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="230"
                    value={factureMensuelle}
                    onChange={(e) => { setFactureMensuelle(e.target.value ? Number(e.target.value) : ""); }}
                    className="h-8 sm:h-9 text-xs sm:text-sm"
                  />
                  <span className="flex items-center text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">€</span>
                </div>
              </div>
            </div>
            {/* Prix unitaire calculé */}
            {consoAnnuelle && factureMensuelle && Number(consoAnnuelle) > 0 && (
              <div className="bg-muted/50 rounded-lg p-2 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground">
                  Prix kWh
                  {activeProducts.includes("PAC") && (
                    <span className="text-blue-500 ml-1">→ PAC</span>
                  )}
                </p>
                <p className="font-bold text-sm sm:text-base text-primary">
                  {((Number(factureMensuelle) * 12) / Number(consoAnnuelle)).toFixed(4)} €/kWh
                </p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                  Annuel: {(Number(factureMensuelle) * 12).toLocaleString("fr-FR")}€
                </p>
              </div>
            )}

            {/* Impact multi-produit sur le dimensionnement */}
            {(activeProducts.includes("PAC") || activeProducts.includes("ITE")) && consoAnnuelle && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 space-y-1">
                <p className="text-[10px] sm:text-xs font-medium text-primary flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Impact sur le dimensionnement PV
                </p>
                {activeProducts.includes("PAC") && pacEconomiesCalculees?.consoElecPacKwh ? (
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    + {Math.round(pacEconomiesCalculees.consoElecPacKwh).toLocaleString("fr-FR")} kWh/an (conso PAC ajoutée)
                  </p>
                ) : null}
                {activeProducts.includes("ITE") && !activeProducts.includes("PAC") && iteEconomieChauffagePct ? (
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    − {Math.round(Number(consoAnnuelle) * 0.6 * (Number(iteEconomieChauffagePct) / 100)).toLocaleString("fr-FR")} kWh/an (économies ITE sur chauffage)
                  </p>
                ) : null}
              </div>
            )}

            {/* Estimateur de consommation simplifié */}
            <ConsumptionEstimator
              productType={productType}
              onApply={(result) => {
                setConsoAnnuelle(result.consoElecKwh);
                setFactureMensuelle(result.factureMensuelleElec);
                setConsoIsEstimated(true);
                if (activeProducts.includes("PAC")) {
                  if (result.consoChaufffageKwh) setPacConsoChaufffageKwh(result.consoChaufffageKwh);
                  if (result.factureChaufMensuelle) setPacFactureChauffageEuros(result.factureChaufMensuelle);
                }
                if (activeProducts.includes("ITE")) {
                  if (result.factureChaufMensuelle) setIteFactureChaufActuelle(result.factureChaufMensuelle);
                }
                // Save estimation details in param_overrides
                if (result.estimationDetails) {
                  estimationDetailsRef.current = result.estimationDetails;
                  setEstimationDetailsDisplay(result.estimationDetails);
                }
              }}
            />

            {/* Détail estimation sauvegardé */}
            {estimationDetailsDisplay && (
              <div className="bg-muted/40 border border-border rounded-lg p-2.5 space-y-1.5">
                <p className="text-[10px] sm:text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Calculator className="h-3 w-3 text-primary" />
                  Détail de l'estimation
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                  <span>Isolation : <strong className="text-foreground">{
                    ({ faible: "Faible", moyen: "Moyen", bon: "Bon", tres_bon: "Très bon", passif: "Passif/RT2012+" } as Record<string, string>)[estimationDetailsDisplay.isolation] || estimationDetailsDisplay.isolation
                  }</strong></span>
                  <span>Occupants : <strong className="text-foreground">{estimationDetailsDisplay.occupants}</strong></span>
                </div>
                {estimationDetailsDisplay.heatingZones?.map((z: any, i: number) => (
                  <div key={i} className="text-[10px] text-muted-foreground flex justify-between">
                    <span>🔥 {z.label} ({z.surface} m²)</span>
                    <span className="font-medium text-foreground">{z.kwh?.toLocaleString("fr-FR")} kWh</span>
                  </div>
                ))}
                <div className="text-[10px] text-muted-foreground flex justify-between">
                  <span>💧 ECS ({
                    ({ electrique: "Élec.", gaz: "Gaz", fioul: "Fioul", thermodynamique: "Thermo.", propane: "Propane" } as Record<string, string>)[estimationDetailsDisplay.ecsType] || estimationDetailsDisplay.ecsType
                  })</span>
                  <span className="font-medium text-foreground">{estimationDetailsDisplay.ecsKwh?.toLocaleString("fr-FR")} kWh</span>
                </div>
                <div className="text-[10px] text-muted-foreground flex justify-between">
                  <span>⚡ Base électrique</span>
                  <span className="font-medium text-foreground">{estimationDetailsDisplay.baseElecKwh?.toLocaleString("fr-FR")} kWh</span>
                </div>
                {estimationDetailsDisplay.appliances?.map((app: any, i: number) => (
                  <div key={i} className="text-[10px] text-muted-foreground flex justify-between">
                    <span>⚙️ {app.label}</span>
                    <span className="font-medium text-foreground">{app.kwh?.toLocaleString("fr-FR")} kWh</span>
                  </div>
                ))}
                <Separator className="my-1" />
                <div className="flex justify-between text-[10px] font-semibold">
                  <span className="text-foreground">Total élec.</span>
                  <span className="text-primary">{estimationDetailsDisplay.totalElecKwh?.toLocaleString("fr-FR")} kWh/an</span>
                </div>
                {estimationDetailsDisplay.totalCombustibleKwh > 0 && (
                  <div className="flex justify-between text-[10px] font-semibold">
                    <span className="text-foreground">Total combustible</span>
                    <span className="text-orange-500">{estimationDetailsDisplay.totalCombustibleKwh?.toLocaleString("fr-FR")} kWh/an</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PROJECTION ÉVOLUTION PRIX ÉNERGIE — sous les infos conso */}
        {factureMensuelle && Number(factureMensuelle) > 0 && (
          <Collapsible>
            <Card className="shadow-card">
              <CollapsibleTrigger asChild>
                <CardHeader className="pb-2 bg-destructive/10 px-3 sm:px-6 py-2 sm:py-3 cursor-pointer hover:bg-destructive/15 transition-colors">
                  <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                    <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                    Évolution future de la facture
                    <Badge variant="outline" className="ml-auto text-[10px] h-4 border-destructive/30 text-destructive">
                      +{tauxAugmentationEnergie}%/an
                    </Badge>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-3 px-3 sm:px-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1.5 font-medium text-muted-foreground">Année</th>
                          <th className="text-right py-1.5 font-medium text-muted-foreground">Facture/an</th>
                          <th className="text-right py-1.5 font-medium text-muted-foreground">Surcoût vs auj.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const factureAnnuelle = Number(factureMensuelle) * 12;
                          const taux = tauxAugmentationEnergie / 100;

                          return [1, 2, 3, 5, 7, 10, 15, 20].map((annee) => {
                            const factureProjetee = factureAnnuelle * Math.pow(1 + taux, annee);
                            const surcout = factureProjetee - factureAnnuelle;

                            return (
                              <tr key={annee} className={cn("border-b border-dashed last:border-0", (annee === 10 || annee === 20) && "font-semibold")}>
                                <td className="py-1.5 text-muted-foreground">
                                  An {annee}
                                  <span className="text-[10px] text-muted-foreground/60 ml-1">({new Date().getFullYear() + annee})</span>
                                </td>
                                <td className="text-right py-1.5">
                                  {factureProjetee.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€
                                </td>
                                <td className="text-right py-1.5 text-destructive">
                                  +{surcout.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 text-center italic">
                    Source : Commission de Régulation de l'Énergie (CRE) — Projection indicative à +{tauxAugmentationEnergie}%/an composé
                  </p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* PRÉCONISATION */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10 px-3 sm:px-6 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
              <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
              Installation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs">Puissance (kWc)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={puissanceKwc}
                  onChange={(e) => {
                    setPuissanceKwc(e.target.value ? Number(e.target.value) : "");
                  }}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs">Revente</Label>
                <Select value={typeRevente} onValueChange={setTypeRevente}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...new Set(dataTarifs.map(t => t.type_revente))].map((type) => {
                      const label = type === "autoconsommation" ? "Autoconso" :
                                    type === "revente_totale" ? "Revente" :
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
              <Label className="text-[10px] sm:text-xs">Support</Label>
              <Select value={supportInstallation} onValueChange={setSupportInstallation}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TOITURE SURIMPOSITION">Surimposition</SelectItem>
                  <SelectItem value="TOITURE INTEGRATION">Intégration</SelectItem>
                  <SelectItem value="BAC GSE (SOL)">Sol</SelectItem>
                  <SelectItem value="PERGOLA / CARPORT">Pergola</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* DONNÉES TECHNIQUES */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10 px-3 sm:px-6 py-2 sm:py-3">
            <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
              <Ruler className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground" />
              Données Techniques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
            {/* Switch mode de calcul */}
            <div className="flex items-center justify-between p-1.5 sm:p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Sun className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                <span className="text-[10px] sm:text-xs font-medium">Calcul</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className={`text-[10px] sm:text-xs ${!usePshCalculation ? "font-bold text-primary" : "text-muted-foreground"}`}>H</span>
                <Switch
                  checked={usePshCalculation}
                  onCheckedChange={setUsePshCalculation}
                  className="h-4 w-7 sm:h-5 sm:w-9"
                />
                <span className={`text-[10px] sm:text-xs ${usePshCalculation ? "font-bold text-primary" : "text-muted-foreground"}`}>PSH</span>
              </div>
            </div>
            
            {/* Affichage conditionnel selon le mode */}
            {usePshCalculation ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 sm:p-3">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] sm:text-xs text-muted-foreground">PSH</span>
                    <span className="text-[10px] sm:text-xs text-amber-600/70 truncate max-w-[100px]">
                      {dataPsh.find(p => p.department_code === departement)?.department_name ?? "—"}
                    </span>
                  </div>
                  <span className="font-bold text-amber-600 text-base sm:text-lg">
                    {dataPsh.find(p => p.department_code === departement)?.psh_value ?? "N/A"}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <Label className="text-[10px] sm:text-xs">Heures ensoleillement</Label>
                <Input
                  type="number"
                  value={heuresEnsoleillement}
                  onChange={(e) => setHeuresEnsoleillement(Number(e.target.value) || 2890)}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <Label className="text-[10px] sm:text-xs">Surface (m²)</Label>
                <Input
                  type="number"
                  value={surfaceInstallation}
                  onChange={(e) => setSurfaceInstallation(e.target.value ? Number(e.target.value) : "")}
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                />
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs">Rendement</Label>
                <Input
                  type="number"
                  value={rendementProductivite}
                  onChange={(e) => setRendementProductivite(Number(e.target.value) || 100)}
                  className="h-8 sm:h-9 text-xs sm:text-sm bg-muted/30"
                  readOnly
                />
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-0.5">
                  {orientation}/{inclinaison}°
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RÉSULTAT DE LA PRÉCONISATION */}
        {calculatedResults && (
          <Card className="shadow-card border-2 border-secondary/50">
            <CardHeader className="pb-2 bg-secondary/20 px-3 sm:px-6 py-2 sm:py-3">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-secondary" />
                Résultat
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
                <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Production</p>
                  <p className="font-bold text-sm sm:text-lg">{calculatedResults.productionAnnuelle.toLocaleString("fr-FR")} <span className="text-[10px] sm:text-xs font-normal">kWh</span></p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 sm:p-3">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Surplus</p>
                  <p className="font-bold text-sm sm:text-lg">{calculatedResults.surplusProduction.toLocaleString("fr-FR")} <span className="text-[10px] sm:text-xs font-normal">kWh</span></p>
                </div>
              </div>
              <div className={cn(
                "rounded-lg p-2 sm:p-3 text-center",
                calculatedResults.autoconsoPct >= 100 && "bg-status-signed/10",
                calculatedResults.autoconsoPct >= 80 && calculatedResults.autoconsoPct < 100 && "bg-status-reported/10",
                calculatedResults.autoconsoPct < 80 && "bg-muted/50"
              )}>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Autoconsommation</p>
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  <span className="font-bold text-lg sm:text-xl">{calculatedResults.autoconsoPct.toFixed(1)}%</span>
                  {calculatedResults.autoconsoPct >= 100 && (
                    <Badge className="bg-status-signed text-white text-[10px] sm:text-xs px-1.5 py-0.5">OK</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fin des champs spécifiques PV */}
        </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* PRÉ-ÉTUDE FINANCIÈRE - Conditionnel selon productType */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}

        {/* Section Financière PAC — masquée en multi-produit (intégrée dans le bilan global) */}
        {activeProducts.includes("PAC") && currentTab === "PAC" && activeProducts.length <= 1 && (
          <FinancialSectionPAC
            pacSubtype={pacSubtype}
            pacPuissance={Number(pacPuissanceCalorifique) || 0}
            prixInstallation={(() => {
              // Chercher bouquet PAC correspondant
              const pacBouquets = dataBouquets.filter((b: any) => b.nom_bouquet?.includes("PAC"));
              const puissance = Number(pacPuissanceCalorifique) || 8;
              const bouquet = pacBouquets.find((b: any) => Math.abs(b.puissance_kwc - puissance) < 2);
              return bouquet?.prix_recommande || puissance * 1500;
            })()}
            prixInstallationManuel={pacPrixManuel}
            onPrixChange={setPacPrixManuel}
            autreSurcout={autreSurcout}
            onAutreSurcoutChange={setAutreSurcout}
            aides={aidesPAC}
            onAidesChange={setAidesPAC}
            modeHejja={modeHejjaActive}
            financements={dataFinancements}
            financementId={financementId}
            onFinancementChange={setFinancementId}
            dureeMois={dureeMoisManuelle}
            onDureeMoisChange={setDureeMoisManuelle}
            mensualiteManuelle={mensualiteManuelle}
            onMensualiteChange={setMensualiteManuelle}
            factureChauf={Number(pacFactureChauffageEuros) || 0}
            factureElec={Number(pacFactureElecEuros) || 0}
            copMoyen={Number(pacCop) || 3.5}
            economiesCalculees={pacEconomiesCalculees}
          />
        )}

        {/* Section Financière ITE — masquée en multi-produit (intégrée dans le bilan global) */}
        {activeProducts.includes("ITE") && currentTab === "ITE" && activeProducts.length <= 1 && (
          <FinancialSectionITE
            surfaceIsoler={Number(iteSurfaceIsoler) || 0}
            prixInstallation={(() => {
              // Chercher bouquet ITE correspondant
              const iteBouquets = dataBouquets.filter((b: any) => b.nom_bouquet?.includes("ITE"));
              const surface = Number(iteSurfaceIsoler) || 100;
              const bouquet = iteBouquets.find((b: any) => Math.abs(b.puissance_kwc - surface) < 30);
              return bouquet?.prix_recommande || surface * 150;
            })()}
            prixInstallationManuel={itePrixManuel}
            onPrixChange={setItePrixManuel}
            autreSurcout={autreSurcout}
            onAutreSurcoutChange={setAutreSurcout}
            aides={aidesITE}
            onAidesChange={setAidesITE}
            modeHejja={modeHejjaActive}
            financements={dataFinancements}
            financementId={financementId}
            onFinancementChange={setFinancementId}
            dureeMois={dureeMoisManuelle}
            onDureeMoisChange={setDureeMoisManuelle}
            mensualiteManuelle={mensualiteManuelle}
            onMensualiteChange={setMensualiteManuelle}
            economieChauffagePct={Number(iteEconomieChauffagePct) || 25}
            factureChaufActuelle={Number(iteFactureChaufActuelle) || Number(pacFactureChauffageEuros) || 1800}
          />
        )}

        {/* =============== PRÉ-ÉTUDE FINANCIÈRE — Globale en multi-produit, PV seul sinon =============== */}
        {((activeProducts.includes("PV") && currentTab === "PV") || (activeProducts.length > 1)) && (
          <div className="pt-4">
            <h2 className="text-lg font-display font-bold text-center text-primary mb-4">
              {activeProducts.length > 1 ? "PRÉ-ÉTUDE FINANCIÈRE GLOBALE" : "PRÉ-ÉTUDE FINANCIÈRE"}
            </h2>
          </div>
        )}

        {/* PRIX & AIDES — Unifié en multi-produit */}
        {((activeProducts.includes("PV") && currentTab === "PV" && activeProducts.length <= 1 && calculatedResults) || (activeProducts.length > 1)) && (() => {
          // Calcul prix PAC
          const pacBouquets = dataBouquets.filter((b: any) => b.nom_bouquet?.includes("PAC"));
          const pacPuissance = Number(pacPuissanceCalorifique) || 8;
          const pacBouquet = pacBouquets.find((b: any) => Math.abs(b.puissance_kwc - pacPuissance) < 2);
          const prixPACBase = pacBouquet?.prix_recommande || pacPuissance * 1500;
          const prixPACFinal = Number(pacPrixManuel || prixPACBase);

          // Calcul prix ITE
          const iteBouquets = dataBouquets.filter((b: any) => b.nom_bouquet?.includes("ITE"));
          const iteSurface = Number(iteSurfaceIsoler) || 100;
          const iteBouquet = iteBouquets.find((b: any) => Math.abs(b.puissance_kwc - iteSurface) < 30);
          const prixITEBase = iteBouquet?.prix_recommande || iteSurface * 150;
          const prixITEFinal = Number(itePrixManuel || prixITEBase);

          // Prix PV
          const prixPVFinal = calculatedResults ? calculatedResults.prixInstallation : 0;
          const prixPVHorsAides = calculatedResults ? calculatedResults.prixTotalHorsAides : 0;

          // Totaux globaux
          const isMulti = activeProducts.length > 1;
          const prixGlobalHorsAides = (activeProducts.includes("PV") ? prixPVHorsAides : 0)
            + (activeProducts.includes("PAC") ? prixPACFinal : 0)
            + (activeProducts.includes("ITE") ? prixITEFinal : 0)
            + (isMulti ? 0 : 0); // autreSurcout déjà inclus dans prixPVHorsAides

          const totalAidesPAC = aidesPAC.maPrimeRenov + aidesPAC.cee + aidesPAC.ecoTva + aidesPAC.aideLocale;
          const totalAidesITE = aidesITE.maPrimeRenov + aidesITE.cee + aidesITE.ecoTva + aidesITE.aideLocale;
          const totalAidesPV = calculatedResults?.totalAides || 0;
          const totalAidesGlobal = (activeProducts.includes("PV") ? totalAidesPV : 0)
            + (activeProducts.includes("PAC") ? totalAidesPAC : 0)
            + (activeProducts.includes("ITE") ? totalAidesITE : 0);

          const prixGlobalAidesDeduites = prixGlobalHorsAides - totalAidesGlobal;

          // Financement global
          const selectedFin = dataFinancements.find(f => f.id === financementId);
          const tauxEff = selectedFin?.taux_effectif || 0;
          const nbMois = Number(dureeMoisManuelle) || 120;
          const montantFinancement = isMulti ? prixGlobalHorsAides : (calculatedResults?.prixTotalHorsAides || 0);
          const resultatFinGlobal = calculerMensualiteAvecReport({
            montantTTC: montantFinancement,
            tauxEffectifAnnuel: tauxEff,
            dureeMois: nbMois,
            dureeReportMois: 6,
          });
          const mensualiteGlobale = mensualiteManuelle || resultatFinGlobal.mensualiteAmortissement;

          return (
          <>
          {/* PRIX & AIDES en grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* PRIX */}
            <Card className="shadow-card">
              <CardHeader className="pb-2 bg-primary/10">
                <CardTitle className="text-xs flex items-center gap-1">
                  <Euro className="h-3 w-3" />
                  {isMulti ? "PRIX GLOBAL" : "PRIX"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-2 text-xs">
                {/* Détail par produit en multi */}
                {isMulti ? (
                  <>
                    {activeProducts.includes("ITE") && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-orange-600 uppercase">ITE</p>
                        <div className="flex justify-between items-center">
                          <span>Prix ITE TTC</span>
                          <Input
                            type="number"
                            value={itePrixManuel || ""}
                            onChange={(e) => setItePrixManuel(e.target.value ? Number(e.target.value) : "")}
                            placeholder={`${prixITEBase.toFixed(0)}€`}
                            className="h-6 w-24 text-right text-xs"
                          />
                        </div>
                      </div>
                    )}
                    {activeProducts.includes("PAC") && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-blue-600 uppercase">PAC</p>
                        <div className="flex justify-between items-center">
                          <span>Prix PAC TTC</span>
                          <Input
                            type="number"
                            value={pacPrixManuel || ""}
                            onChange={(e) => setPacPrixManuel(e.target.value ? Number(e.target.value) : "")}
                            placeholder={`${prixPACBase.toFixed(0)}€`}
                            className="h-6 w-24 text-right text-xs"
                          />
                        </div>
                      </div>
                    )}
                    {activeProducts.includes("PV") && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-amber-600 uppercase">PV</p>
                        <div className="flex justify-between items-center">
                          <span>Prix PV TTC</span>
                          <Input
                            type="number"
                            value={prixInstallationManuel || ""}
                            onChange={(e) => setPrixInstallationManuel(e.target.value ? Number(e.target.value) : "")}
                            placeholder={`${prixPVFinal.toFixed(0)}€`}
                            className="h-6 w-24 text-right text-xs"
                          />
                        </div>
                        {(surcoutSupport > 0 || surcoutCompteur > 0 || surcoutEmplacement > 0) && (
                          <div className="text-[10px] text-muted-foreground pl-2">
                            {surcoutSupport > 0 && <p>+ Support: {surcoutSupport.toFixed(0)}€</p>}
                            {surcoutCompteur > 0 && <p>+ Compteur: {surcoutCompteur.toFixed(0)}€</p>}
                            {surcoutEmplacement > 0 && <p>+ Empl.: {surcoutEmplacement.toFixed(0)}€</p>}
                          </div>
                        )}
                      </div>
                    )}
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
                      <span>{(prixGlobalHorsAides + autreSurcout).toLocaleString("fr-FR", { minimumFractionDigits: 0 })}€</span>
                    </div>
                    <div className="flex justify-between text-status-signed">
                      <span>TOTAL Aides</span>
                      <span>{totalAidesGlobal.toLocaleString("fr-FR", { minimumFractionDigits: 0 })}€</span>
                    </div>
                    <div className="flex justify-between font-bold text-primary bg-primary/10 rounded p-1 mt-1">
                      <span>Reste à Charge</span>
                      <span>{(prixGlobalAidesDeduites + autreSurcout).toLocaleString("fr-FR", { minimumFractionDigits: 0 })}€</span>
                    </div>
                  </>
                ) : (
                  /* Mode PV seul — existant */
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Prix Installation TTC</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={prixInstallationManuel || ""}
                        onChange={(e) => setPrixInstallationManuel(e.target.value ? Number(e.target.value) : "")}
                        placeholder={`Base: ${calculatedResults!.prixInstallation.toFixed(0)}€`}
                        className="h-7 text-xs font-medium"
                      />
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Installation TTC</span>
                      <span className="font-medium">{calculatedResults!.prixInstallation.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Surcoût Support</span>
                      <span className={surcoutSupport > 0 ? "text-amber-600 font-medium" : ""}>{surcoutSupport.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Surcoût Compteur</span>
                      <span className={surcoutCompteur > 0 ? "text-amber-600 font-medium" : ""}>{surcoutCompteur.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Surcoût Emplacement</span>
                      <span className={surcoutEmplacement > 0 ? "text-amber-600 font-medium" : ""}>{surcoutEmplacement.toFixed(2)}€</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Autre Surcoût</span>
                      <Input type="number" value={autreSurcout} onChange={(e) => setAutreSurcout(Number(e.target.value) || 0)} className="h-6 w-16 text-right text-xs" />
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold">
                      <span>TOTAL Hors Aides</span>
                      <span>{calculatedResults!.prixTotalHorsAides.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                    </div>
                    <div className="flex justify-between text-status-signed">
                      <span>TOTAL Aides</span>
                      <span>{calculatedResults!.totalAides.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                    </div>
                    <div className="flex justify-between font-bold text-primary bg-primary/10 rounded p-1 mt-1">
                      <span>Aides Déduites</span>
                      <span>{calculatedResults!.totalAidesDeduites.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* AIDES */}
            <Card className="shadow-card">
              <CardHeader className="pb-2 bg-status-signed/10">
                <CardTitle className="text-xs flex items-center gap-1">
                  <PiggyBank className="h-3 w-3 text-status-signed" />
                  {isMulti ? "AIDES GLOBALES" : "AIDES"}
                  {modeHejjaActive && (
                    <Badge variant="outline" className="text-[10px] h-4 bg-red-500/10 text-red-500 border-red-500/30 ml-auto">
                      HEJJA
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-2 text-xs">
                {isMulti ? (
                  <>
                    {/* Aides ITE */}
                    {activeProducts.includes("ITE") && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-orange-600">ITE</p>
                        <div className="flex justify-between items-center">
                          <span>MaPrimeRénov'</span>
                          <Input type="number" value={aidesITE.maPrimeRenov} onChange={(e) => setAidesITE({ ...aidesITE, maPrimeRenov: Number(e.target.value) || 0 })} className="h-5 w-16 text-right text-[10px]" />
                        </div>
                        <div className="flex justify-between items-center">
                          <span>CEE</span>
                          <Input type="number" value={aidesITE.cee} onChange={(e) => setAidesITE({ ...aidesITE, cee: Number(e.target.value) || 0 })} className="h-5 w-16 text-right text-[10px]" />
                        </div>
                        <div className="flex justify-between items-center">
                          <span>ECO TVA</span>
                          <Input type="number" value={aidesITE.ecoTva} onChange={(e) => setAidesITE({ ...aidesITE, ecoTva: Number(e.target.value) || 0 })} className="h-5 w-16 text-right text-[10px]" />
                        </div>
                        <div className="flex justify-between text-[10px] font-medium text-orange-600">
                          <span>Sous-total ITE</span>
                          <span>{totalAidesITE.toLocaleString("fr-FR")}€</span>
                        </div>
                      </div>
                    )}
                    {/* Aides PAC */}
                    {activeProducts.includes("PAC") && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-blue-600">PAC</p>
                        {pacSubtype === "air_eau" && (
                          <div className="flex justify-between items-center">
                            <span>MaPrimeRénov'</span>
                            <Input type="number" value={aidesPAC.maPrimeRenov} onChange={(e) => setAidesPAC({ ...aidesPAC, maPrimeRenov: Number(e.target.value) || 0 })} className="h-5 w-16 text-right text-[10px]" />
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span>CEE</span>
                          <Input type="number" value={aidesPAC.cee} onChange={(e) => setAidesPAC({ ...aidesPAC, cee: Number(e.target.value) || 0 })} className="h-5 w-16 text-right text-[10px]" />
                        </div>
                        <div className="flex justify-between items-center">
                          <span>ECO TVA</span>
                          <Input type="number" value={aidesPAC.ecoTva} onChange={(e) => setAidesPAC({ ...aidesPAC, ecoTva: Number(e.target.value) || 0 })} className="h-5 w-16 text-right text-[10px]" />
                        </div>
                        <div className="flex justify-between text-[10px] font-medium text-blue-600">
                          <span>Sous-total PAC</span>
                          <span>{totalAidesPAC.toLocaleString("fr-FR")}€</span>
                        </div>
                      </div>
                    )}
                    {/* Aides PV */}
                    {activeProducts.includes("PV") && calculatedResults && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-amber-600">PV</p>
                        {modeHejjaActive ? (
                          <HejjaAidesEditor
                            aides={aidesManuelles}
                            onAidesChange={setAidesManuelles}
                            puissanceKwc={Number(puissanceKwc) || 0}
                            prixTotal={calculatedResults.prixTotalHorsAides}
                            primeAutoconso={calculatedResults.primeAutoconsommation}
                            ecoTva={calculatedResults.ecoTva}
                          />
                        ) : (
                          <>
                            <div className="flex justify-between">
                              <span>Prime Autoconso</span>
                              <span className="font-medium text-status-signed">{calculatedResults.primeAutoconsommation.toLocaleString("fr-FR")}€</span>
                            </div>
                            <div className="flex justify-between">
                              <span>ECO TVA</span>
                              <span className="font-medium text-status-signed">{calculatedResults.ecoTva.toLocaleString("fr-FR")}€</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between text-[10px] font-medium text-amber-600">
                          <span>Sous-total PV</span>
                          <span>{totalAidesPV.toLocaleString("fr-FR")}€</span>
                        </div>
                      </div>
                    )}
                    {/* Aide locale commune */}
                    <div className="flex justify-between items-center">
                      <span>Aide locale</span>
                      <Input type="number" value={aidesPAC.aideLocale || aidesITE.aideLocale || 0} onChange={(e) => {
                        const v = Number(e.target.value) || 0;
                        setAidesPAC(prev => ({ ...prev, aideLocale: v }));
                        setAidesITE(prev => ({ ...prev, aideLocale: 0 }));
                      }} className="h-5 w-16 text-right text-[10px]" />
                    </div>
                    <Separator className="my-1" />
                    <div className="flex justify-between font-bold text-status-signed bg-status-signed/10 rounded p-1">
                      <span>TOTAL AIDES</span>
                      <span>{totalAidesGlobal.toLocaleString("fr-FR")}€</span>
                    </div>
                  </>
                ) : (
                  /* Mode PV seul */
                  <>
                    {modeHejjaActive ? (
                      <HejjaAidesEditor
                        aides={aidesManuelles}
                        onAidesChange={setAidesManuelles}
                        puissanceKwc={Number(puissanceKwc) || 0}
                        prixTotal={calculatedResults!.prixTotalHorsAides}
                        primeAutoconso={calculatedResults!.primeAutoconsommation}
                        ecoTva={calculatedResults!.ecoTva}
                      />
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span>Prime Autoconso</span>
                          <span className="font-medium text-status-signed">{calculatedResults!.primeAutoconsommation.toLocaleString("fr-FR")}€</span>
                        </div>
                        <div className="flex justify-between">
                          <span>ECO TVA</span>
                          <span className="font-medium text-status-signed">{calculatedResults!.ecoTva.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                        </div>
                      </>
                    )}
                  </>
                )}
                <Separator className="my-2" />
                {/* FINANCEMENT — unique */}
                <div className="pt-2">
                  <p className="text-xs font-bold mb-1">{isMulti ? "FINANCEMENT GLOBAL" : "FINANCEMENT"}</p>
                  <Select value={financementId} onValueChange={setFinancementId}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {dataFinancements.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nom} ({f.taux_effectif}%)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {financementId && (
                  <div className="text-xs text-muted-foreground mt-1">
                    <div className="flex justify-between">
                      <span>Taux effectif</span>
                      <span>{selectedFin?.taux_effectif}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>TAEG</span>
                      <span>{selectedFin?.taeg}%</span>
                    </div>
                    {isMulti && (
                      <div className="flex justify-between font-medium text-foreground mt-1">
                        <span>Montant financé</span>
                        <span>{(montantFinancement + autreSurcout).toLocaleString("fr-FR")}€</span>
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-2">
                  <label className="text-xs text-muted-foreground">Durée (mois)</label>
                  <Select value={String(dureeMoisManuelle)} onValueChange={(v) => setDureeMoisManuelle(Number(v))}>
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Durée" />
                    </SelectTrigger>
                    <SelectContent>
                      {[60, 84, 96, 108, 120, 144, 168, 180, 240].map((mois) => (
                        <SelectItem key={mois} value={String(mois)}>
                          {mois} mois ({(mois / 12).toFixed(0)} ans)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2">
                  <label className="text-xs text-muted-foreground">Mensualité manuelle</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={mensualiteManuelle}
                    onChange={(e) => setMensualiteManuelle(e.target.value ? Number(e.target.value) : "")}
                    placeholder={`Calculée: ${resultatFinGlobal.mensualiteAmortissement.toFixed(2)}€`}
                    className="h-7 text-xs"
                  />
                </div>
                {/* Report 6 mois */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-[10px] mt-1">
                  <div className="flex items-center gap-1 text-amber-700 font-medium">
                    Report 6 mois: {resultatFinGlobal.mensualiteReport.toFixed(0)}€/mois
                  </div>
                </div>
                <div className="flex justify-between font-bold bg-muted/50 rounded p-1 mt-1">
                  <span>{isMulti ? "Mensualité unique" : "Mensualité"}</span>
                  <span>{Number(mensualiteGlobale).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
              </CardContent>
            </Card>
          </div>
          </>
          );
        })()}

        {/* ÉVOLUTION ÉNERGÉTIQUE MULTI-PRODUIT — visible quelle que soit l'onglet */}
        {activeProducts.length > 1 && (
          <EnergyEvolutionCard
            activeProducts={activeProducts}
            factureElecAnnuelle={Number(factureMensuelle) * 12 || 0}
            factureChauffageAnnuelle={Number(pacFactureChauffageEuros) || Number(iteFactureChaufActuelle) || 0}
            consoElecKwh={Number(consoAnnuelle) || 0}
            iteEconomiePct={activeProducts.includes("ITE") ? (Number(iteEconomieChauffagePct) || 0) : 0}
            pacConsoElecKwh={pacEconomiesCalculees?.consoElecPacKwh || 0}
            pacSurcoutElecEuros={pacEconomiesCalculees?.surcoutElecEuros || 0}
            pacEconomieNetteEuros={pacEconomiesCalculees?.economieNetteEuros || 0}
            pvAutoconsoEuros={calculatedResults?.autoconsommationEuros || 0}
            pvReventeEuros={calculatedResults?.reventeMensuelleEstimee || 0}
          />
        )}

        {/* RENTABILITÉ FINANCIÈRE — Bilan global en multi-produit OU PV seul */}
        {((activeProducts.includes("PV") && currentTab === "PV" && activeProducts.length <= 1 && calculatedResults) || (activeProducts.length > 1 && calculatedResults)) && (
          <Card className="shadow-card border-2 border-primary/50">
            <CardHeader className="pb-2 bg-primary/20 px-3 sm:px-6 py-2 sm:py-3">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                {activeProducts.length > 1 ? "Rentabilité Globale du Projet" : "Rentabilité"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
              {/* Gains PV */}
              <div className="flex justify-between items-center py-0.5 sm:py-1 text-xs sm:text-sm">
                <span className="flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-500" />
                  Autoconso. PV
                </span>
                <span className="font-medium whitespace-nowrap">{calculatedResults.autoconsommationEuros.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€/mois</span>
              </div>
              <div className="flex justify-between items-center py-0.5 sm:py-1 text-xs sm:text-sm">
                <span className="flex items-center gap-1">
                  <Sun className="h-3 w-3 text-amber-500" />
                  Revente surplus
                </span>
                <span className="font-medium whitespace-nowrap">{calculatedResults.reventeMensuelleEstimee.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€/mois</span>
              </div>
              
              {/* Gains PAC en multi-produit */}
              {activeProducts.includes("PAC") && pacEconomiesCalculees && (
                <div className="flex justify-between items-center py-0.5 sm:py-1 text-xs sm:text-sm">
                  <span className="flex items-center gap-1">
                    <Thermometer className="h-3 w-3 text-blue-500" />
                    Économie PAC (fossile supprimé)
                  </span>
                  <span className="font-medium whitespace-nowrap text-green-600">
                    +{(pacEconomiesCalculees.economieNetteEuros / 12).toLocaleString("fr-FR", { minimumFractionDigits: 0 })}€/mois
                  </span>
                </div>
              )}
              
              {/* Gains ITE en multi-produit (uniquement si pas PAC, sinon c'est déjà inclus) */}
              {activeProducts.includes("ITE") && !activeProducts.includes("PAC") && Number(iteEconomieChauffagePct) > 0 && Number(iteFactureChaufActuelle) > 0 && (
                <div className="flex justify-between items-center py-0.5 sm:py-1 text-xs sm:text-sm">
                  <span className="flex items-center gap-1">
                    <Home className="h-3 w-3 text-orange-500" />
                    Économie ITE (−{Number(iteEconomieChauffagePct)}% chauffage)
                  </span>
                  <span className="font-medium whitespace-nowrap text-green-600">
                    +{Math.round(Number(iteFactureChaufActuelle) * Number(iteEconomieChauffagePct) / 100 / 12)}€/mois
                  </span>
                </div>
              )}
              
              <Separator />
              
              {/* Total gains mensuels combinés */}
              {activeProducts.length > 1 && (
                <div className="flex justify-between items-center py-1 text-xs sm:text-sm bg-green-50 rounded-lg px-2">
                  <span className="font-bold text-green-700">Total gains mensuels</span>
                  <span className="font-bold text-green-700">
                    +{(() => {
                      let total = calculatedResults.autoconsommationEuros + calculatedResults.reventeMensuelleEstimee;
                      if (activeProducts.includes("PAC") && pacEconomiesCalculees) {
                        total += pacEconomiesCalculees.economieNetteEuros / 12;
                      }
                      if (activeProducts.includes("ITE") && !activeProducts.includes("PAC") && Number(iteEconomieChauffagePct) > 0 && Number(iteFactureChaufActuelle) > 0) {
                        total += Number(iteFactureChaufActuelle) * Number(iteEconomieChauffagePct) / 100 / 12;
                      }
                      return total.toLocaleString("fr-FR", { minimumFractionDigits: 0 });
                    })()}€/mois
                  </span>
                </div>
              )}
              
              {/* Mensualité globale unique en multi-produit */}
              {activeProducts.length > 1 && (
                <div className="bg-blue-50 rounded-lg p-2 text-xs sm:text-sm space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-700">Mensualité unique du projet</span>
                    <span className="font-bold text-blue-700">
                      −{(() => {
                        // Mensualité PV
                        let totalMensualite = calculatedResults.mensualite;
                        return totalMensualite.toLocaleString("fr-FR", { minimumFractionDigits: 2 });
                      })()}€/mois
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Financement global incluant {activeProducts.map(p => p === "PV" ? "PV" : p === "PAC" ? "PAC" : "ITE").join(" + ")}
                  </p>
                </div>
              )}
              
              {/* Transfert de charge / Bilan final */}
              <div className={cn(
                "rounded-lg p-2.5 sm:p-4 text-center",
                (() => {
                  let gains = calculatedResults.autoconsommationEuros + calculatedResults.reventeMensuelleEstimee;
                  if (activeProducts.length > 1) {
                    if (activeProducts.includes("PAC") && pacEconomiesCalculees) {
                      gains += pacEconomiesCalculees.economieNetteEuros / 12;
                    }
                    if (activeProducts.includes("ITE") && !activeProducts.includes("PAC") && Number(iteEconomieChauffagePct) > 0 && Number(iteFactureChaufActuelle) > 0) {
                      gains += Number(iteFactureChaufActuelle) * Number(iteEconomieChauffagePct) / 100 / 12;
                    }
                  }
                  const bilan = gains - calculatedResults.mensualite;
                  return bilan > 0 ? "bg-status-signed/10" :
                    bilan >= -30 ? "bg-status-reported/10" :
                    "bg-status-negative/10";
                })()
              )}>
                <p className="text-[10px] sm:text-sm text-muted-foreground mb-1.5 sm:mb-2">
                  {activeProducts.length > 1 ? "Bilan Mensuel Global" : "Transfert de Charge"}
                </p>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  {(() => {
                    let gains = calculatedResults.autoconsommationEuros + calculatedResults.reventeMensuelleEstimee;
                    if (activeProducts.length > 1) {
                      if (activeProducts.includes("PAC") && pacEconomiesCalculees) {
                        gains += pacEconomiesCalculees.economieNetteEuros / 12;
                      }
                      if (activeProducts.includes("ITE") && !activeProducts.includes("PAC") && Number(iteEconomieChauffagePct) > 0 && Number(iteFactureChaufActuelle) > 0) {
                        gains += Number(iteFactureChaufActuelle) * Number(iteEconomieChauffagePct) / 100 / 12;
                      }
                    }
                    const bilan = activeProducts.length > 1 
                      ? gains - calculatedResults.mensualite 
                      : calculatedResults.resultatTransfertCharge;
                    return (
                      <>
                        {bilan > 0 ? (
                          <Badge className="bg-status-signed text-white text-sm px-3 py-1">RENTABLE</Badge>
                        ) : bilan >= -30 ? (
                          <Badge className="bg-status-reported text-white text-sm px-3 py-1">QUASI-NEUTRE</Badge>
                        ) : (
                          <Badge className="bg-status-negative text-white text-sm px-3 py-1">EFFORT</Badge>
                        )}
                        <span className={cn(
                          "font-bold text-xl sm:text-2xl whitespace-nowrap",
                          bilan > 0 && "text-status-signed",
                          bilan >= -30 && bilan <= 0 && "text-status-reported",
                          bilan < -30 && "text-status-negative"
                        )}>
                          {bilan >= 0 ? "+" : ""}{bilan.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Aides globales en multi-produit */}
              {activeProducts.length > 1 && (
                <div className="bg-emerald-50 rounded-lg p-2 text-xs space-y-1">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase">Aides globales du projet</p>
                  {activeProducts.includes("PV") && (
                    <div className="flex justify-between text-emerald-600">
                      <span>PV</span>
                      <span>{calculatedResults.totalAides.toLocaleString("fr-FR")}€</span>
                    </div>
                  )}
                  {activeProducts.includes("PAC") && (
                    <div className="flex justify-between text-emerald-600">
                      <span>PAC</span>
                      <span>{(aidesPAC.maPrimeRenov + aidesPAC.cee + aidesPAC.ecoTva + aidesPAC.aideLocale).toLocaleString("fr-FR")}€</span>
                    </div>
                  )}
                  {activeProducts.includes("ITE") && (
                    <div className="flex justify-between text-emerald-600">
                      <span>ITE</span>
                      <span>{(aidesITE.maPrimeRenov + aidesITE.cee + aidesITE.ecoTva + aidesITE.aideLocale).toLocaleString("fr-FR")}€</span>
                    </div>
                  )}
                  <Separator className="bg-emerald-200" />
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>TOTAL</span>
                    <span>
                      {(() => {
                        let total = calculatedResults.totalAides;
                        if (activeProducts.includes("PAC")) total += aidesPAC.maPrimeRenov + aidesPAC.cee + aidesPAC.ecoTva + aidesPAC.aideLocale;
                        if (activeProducts.includes("ITE")) total += aidesITE.maPrimeRenov + aidesITE.cee + aidesITE.ecoTva + aidesITE.aideLocale;
                        return total.toLocaleString("fr-FR");
                      })()}€
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* SYNERGIES MULTI-PRODUITS — Visualisation détaillée des dépendances */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {activeProducts.length > 1 && (
          <Card className="shadow-card border-2 border-dashed border-primary/30 overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-primary/10 via-blue-50 to-orange-50 px-3 sm:px-6 py-2 sm:py-3">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                Synergies entre produits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 px-3 sm:px-6">
              {/* ITE → PAC : réduction des besoins de chauffage */}
              {activeProducts.includes("ITE") && activeProducts.includes("PAC") && (
                <div className="rounded-lg border border-orange-200 bg-orange-50/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <Home className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-bold text-orange-700">ITE</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1 px-1 min-w-0">
                      <div className="h-px flex-1 bg-orange-300" />
                      <span className="text-[10px] font-semibold text-orange-500 whitespace-nowrap px-1">alimente</span>
                      <div className="h-px flex-1 bg-orange-300" />
                      <span className="text-orange-400">→</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Gauge className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-700">PAC</span>
                    </div>
                  </div>
                  <div className="bg-white/80 rounded p-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Réduction déperditions (ITE)</span>
                      <span className="font-bold text-orange-600">-{Number(iteEconomieChauffagePct) || 0}%</span>
                    </div>
                    {pacEconomiesCalculees && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Besoins chauffage après ITE</span>
                          <span className="font-medium">{Math.round(pacEconomiesCalculees.besoinsChauffageKwh).toLocaleString("fr-FR")} kWh/an</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                          <span>→ Conso PAC réduite</span>
                          <span className="font-bold">{Math.round(pacEconomiesCalculees.consoElecPacKwh).toLocaleString("fr-FR")} kWh/an</span>
                        </div>
                      </>
                    )}
                    <p className="text-[10px] text-muted-foreground/80 pt-1 border-t border-orange-100">
                      L'isolation diminue les pertes thermiques, réduisant la puissance et la consommation électrique de la PAC.
                    </p>
                  </div>
                </div>
              )}

              {/* PAC → PV : injection de la conso PAC dans le dimensionnement PV */}
              {activeProducts.includes("PAC") && activeProducts.includes("PV") && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <Gauge className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-bold text-blue-700">PAC</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1 px-1 min-w-0">
                      <div className="h-px flex-1 bg-blue-300" />
                      <span className="text-[10px] font-semibold text-blue-500 whitespace-nowrap px-1">alimente</span>
                      <div className="h-px flex-1 bg-blue-300" />
                      <span className="text-blue-400">→</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-600">PV</span>
                    </div>
                  </div>
                  <div className="bg-white/80 rounded p-2 text-xs space-y-1">
                    {pacEconomiesCalculees && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Conso élec PAC</span>
                          <span className="font-bold text-blue-600">+{Math.round(pacEconomiesCalculees.consoElecPacKwh).toLocaleString("fr-FR")} kWh/an</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Conso foyer initiale</span>
                          <span className="font-medium">{Number(consoAnnuelle).toLocaleString("fr-FR")} kWh/an</span>
                        </div>
                        <div className="flex justify-between text-primary font-bold border-t border-blue-100 pt-1">
                          <span>= Conso totale pour PV</span>
                          <span>{Math.round(Number(consoAnnuelle) + pacEconomiesCalculees.consoElecPacKwh).toLocaleString("fr-FR")} kWh/an</span>
                        </div>
                      </>
                    )}
                    <p className="text-[10px] text-muted-foreground/80 pt-1 border-t border-blue-100">
                      La conso électrique de la PAC est ajoutée au besoin du foyer pour dimensionner le PV et maximiser l'autoconsommation.
                    </p>
                  </div>
                </div>
              )}

              {/* ITE → PV (sans PAC) */}
              {activeProducts.includes("ITE") && activeProducts.includes("PV") && !activeProducts.includes("PAC") && Number(iteEconomieChauffagePct) > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 shrink-0">
                      <Home className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-bold text-orange-700">ITE</span>
                    </div>
                    <div className="flex-1 flex items-center gap-1 px-1 min-w-0">
                      <div className="h-px flex-1 bg-emerald-300" />
                      <span className="text-[10px] font-semibold text-emerald-500 whitespace-nowrap px-1">optimise</span>
                      <div className="h-px flex-1 bg-emerald-300" />
                      <span className="text-emerald-400">→</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-600">PV</span>
                    </div>
                  </div>
                  <div className="bg-white/80 rounded p-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Réduction chauffage (ITE)</span>
                      <span className="font-bold text-orange-600">-{Number(iteEconomieChauffagePct)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Part chauffage estimée</span>
                      <span className="font-medium">~60% de la conso</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>→ Conso réduite pour PV</span>
                      <span className="font-bold">-{Math.round(Number(consoAnnuelle) * 0.6 * Number(iteEconomieChauffagePct) / 100).toLocaleString("fr-FR")} kWh/an</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/80 pt-1 border-t border-emerald-100">
                      L'isolation réduit la consommation de chauffage, permettant un dimensionnement PV plus adapté au besoin réel.
                    </p>
                  </div>
                </div>
              )}

              {/* Résumé chaîne de dépendance triple */}
              {activeProducts.includes("ITE") && activeProducts.includes("PAC") && activeProducts.includes("PV") && (
                <div className="bg-primary/5 rounded-lg p-2.5 border border-primary/20">
                  <p className="text-[10px] sm:text-xs text-center text-primary font-medium">
                    <strong>Chaîne complète :</strong> ITE réduit déperditions (-{Number(iteEconomieChauffagePct) || 0}%) → PAC consomme moins
                    {pacEconomiesCalculees ? ` (${Math.round(pacEconomiesCalculees.consoElecPacKwh).toLocaleString("fr-FR")} kWh)` : ""} → PV dimensionné sur conso réelle
                    {pacEconomiesCalculees ? ` (${Math.round(Number(consoAnnuelle) + pacEconomiesCalculees.consoElecPacKwh).toLocaleString("fr-FR")} kWh)` : ""}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {/* RÉCAPITULATIF GLOBAL MULTI-PRODUIT */}
        {/* ═══════════════════════════════════════════════════════════════════════════ */}
        {activeProducts.length > 1 && (
          <Card className="shadow-card border-2 border-[#000091]/30">
            <CardHeader className="pb-2 bg-[#000091]/10 px-3 sm:px-6 py-2 sm:py-3">
              <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 text-[#000091]">
                <Calculator className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Récapitulatif Global ({activeProducts.join(" + ")})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
              {/* Prix par produit */}
              <div className="space-y-1.5 text-xs sm:text-sm">
                {activeProducts.includes("PV") && calculatedResults && (
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Sun className="h-3.5 w-3.5 text-amber-500" /> PV
                    </span>
                    <span className="font-medium">{calculatedResults.prixTotalHorsAides.toLocaleString("fr-FR")}€</span>
                  </div>
                )}
                {activeProducts.includes("PAC") && (
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 text-blue-500" /> PAC
                    </span>
                    <span className="font-medium">{(Number(pacPrixManuel) || 0).toLocaleString("fr-FR")}€</span>
                  </div>
                )}
                {activeProducts.includes("ITE") && (
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5 text-purple-500" /> ITE
                    </span>
                    <span className="font-medium">{(Number(itePrixManuel) || 0).toLocaleString("fr-FR")}€</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between items-center font-bold">
                  <span>TOTAL PROJET</span>
                  <span className="text-sm sm:text-base">
                    {(() => {
                      let total = 0;
                      if (activeProducts.includes("PV") && calculatedResults) total += calculatedResults.prixTotalHorsAides;
                      if (activeProducts.includes("PAC")) total += Number(pacPrixManuel) || 0;
                      if (activeProducts.includes("ITE")) total += Number(itePrixManuel) || 0;
                      return total.toLocaleString("fr-FR");
                    })()}€
                  </span>
                </div>
              </div>
              
              {/* Aides combinées */}
              <div className="bg-emerald-50 rounded-lg p-2.5 sm:p-3">
                <p className="text-[10px] sm:text-xs font-bold text-emerald-700 mb-1.5">AIDES CUMULÉES</p>
                <div className="space-y-1 text-xs">
                  {activeProducts.includes("PV") && calculatedResults && (
                    <div className="flex justify-between text-emerald-600">
                      <span>PV</span>
                      <span>{calculatedResults.totalAides.toLocaleString("fr-FR")}€</span>
                    </div>
                  )}
                  {activeProducts.includes("PAC") && (
                    <div className="flex justify-between text-emerald-600">
                      <span>PAC</span>
                      <span>{(aidesPAC.maPrimeRenov + aidesPAC.cee + aidesPAC.ecoTva + aidesPAC.aideLocale).toLocaleString("fr-FR")}€</span>
                    </div>
                  )}
                  {activeProducts.includes("ITE") && (
                    <div className="flex justify-between text-emerald-600">
                      <span>ITE</span>
                      <span>{(aidesITE.maPrimeRenov + aidesITE.cee + aidesITE.ecoTva + aidesITE.aideLocale).toLocaleString("fr-FR")}€</span>
                    </div>
                  )}
                  <Separator className="bg-emerald-200" />
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>TOTAL AIDES</span>
                    <span>
                      {(() => {
                        let total = 0;
                        if (activeProducts.includes("PV") && calculatedResults) total += calculatedResults.totalAides;
                        if (activeProducts.includes("PAC")) total += aidesPAC.maPrimeRenov + aidesPAC.cee + aidesPAC.ecoTva + aidesPAC.aideLocale;
                        if (activeProducts.includes("ITE")) total += aidesITE.maPrimeRenov + aidesITE.cee + aidesITE.ecoTva + aidesITE.aideLocale;
                        return total.toLocaleString("fr-FR");
                      })()}€
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Économies annuelles combinées */}
              <div className="bg-amber-50 rounded-lg p-2.5 sm:p-3">
                <p className="text-[10px] sm:text-xs font-bold text-amber-700 mb-1.5">ÉCONOMIES ANNUELLES COMBINÉES</p>
                <div className="space-y-1 text-xs">
                  {activeProducts.includes("PV") && calculatedResults && (
                    <div className="flex justify-between text-amber-600">
                      <span>PV (gains autoconso + revente)</span>
                      <span>{Math.round((calculatedResults.autoconsommationEuros + calculatedResults.reventeMensuelleEstimee) * 12).toLocaleString("fr-FR")}€/an</span>
                    </div>
                  )}
                  {activeProducts.includes("PAC") && pacEconomiesCalculees && (
                    <div className="flex justify-between text-amber-600">
                      <span>PAC (économie nette chauffage)</span>
                      <span>{Math.round(pacEconomiesCalculees.economieNetteEuros).toLocaleString("fr-FR")}€/an</span>
                    </div>
                  )}
                  {activeProducts.includes("ITE") && Number(iteEconomieChauffagePct) > 0 && Number(iteFactureChaufActuelle) > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>ITE (réduction chauffage {Number(iteEconomieChauffagePct)}%)</span>
                      <span>{Math.round(Number(iteFactureChaufActuelle) * Number(iteEconomieChauffagePct) / 100).toLocaleString("fr-FR")}€/an</span>
                    </div>
                  )}
                  <Separator className="bg-amber-200" />
                  <div className="flex justify-between font-bold text-amber-700">
                    <span>TOTAL ÉCONOMIES</span>
                    <span>
                      {(() => {
                        let total = 0;
                        if (activeProducts.includes("PV") && calculatedResults) total += (calculatedResults.autoconsommationEuros + calculatedResults.reventeMensuelleEstimee) * 12;
                        if (activeProducts.includes("PAC") && pacEconomiesCalculees) total += pacEconomiesCalculees.economieNetteEuros;
                        if (activeProducts.includes("ITE") && Number(iteEconomieChauffagePct) > 0 && Number(iteFactureChaufActuelle) > 0) {
                          // Ne pas doubler si PAC+ITE (l'économie ITE est déjà dans le calcul PAC)
                          if (!activeProducts.includes("PAC")) {
                            total += Number(iteFactureChaufActuelle) * Number(iteEconomieChauffagePct) / 100;
                          }
                        }
                        return Math.round(total).toLocaleString("fr-FR");
                      })()}€/an
                    </span>
                  </div>
                </div>
              </div>

              {/* Coût net global */}
              <div className="bg-primary/10 rounded-lg p-2.5 sm:p-3 text-center">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Coût net après aides</p>
                <p className="font-bold text-lg sm:text-xl text-primary">
                  {(() => {
                    let totalPrix = 0;
                    let totalAides = 0;
                    if (activeProducts.includes("PV") && calculatedResults) {
                      totalPrix += calculatedResults.prixTotalHorsAides;
                      totalAides += calculatedResults.totalAides;
                    }
                    if (activeProducts.includes("PAC")) {
                      totalPrix += Number(pacPrixManuel) || 0;
                      totalAides += aidesPAC.maPrimeRenov + aidesPAC.cee + aidesPAC.ecoTva + aidesPAC.aideLocale;
                    }
                    if (activeProducts.includes("ITE")) {
                      totalPrix += Number(itePrixManuel) || 0;
                      totalAides += aidesITE.maPrimeRenov + aidesITE.cee + aidesITE.ecoTva + aidesITE.aideLocale;
                    }
                    return (totalPrix - totalAides).toLocaleString("fr-FR");
                  })()}€
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CLASSIFICATION DU DOSSIER - Toujours disponible en collapse */}
        <Collapsible>
          <Card className="shadow-card">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-2 bg-muted/50 px-3 sm:px-6 py-2 sm:py-3 cursor-pointer hover:bg-muted/70 transition-colors">
                <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2">
                  <Tag className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  Classification
                  <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-auto text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
            <CardContent className="space-y-2 sm:space-y-3 pt-3 sm:pt-4 px-3 sm:px-6">
              <div>
                <Label className="text-[10px] sm:text-xs">Statut</Label>
                <Select value={classification} onValueChange={setClassification}>
                  <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positif">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-status-signed" />
                        <span className="text-xs sm:text-sm">Positif</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="negatif">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-status-negative" />
                        <span className="text-xs sm:text-sm">Négatif</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="r2">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-status-r2" />
                        <span className="text-xs sm:text-sm">R2</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="r2_prestudy">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-status-reported" />
                        <span className="text-xs sm:text-sm">R2 Pré-étude</span>
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

              {/* Bouton WhatsApp inline */}
              {classification && (
                <WhatsAppSendButton
                  clientName={clientName}
                  clientPrenom={clientPrenom || ""}
                  classification={classification}
                  comment={classificationComment}
                  r2DateTime={
                    (classification === "r2" || classification === "r2_prestudy") && r2DateHeure
                      ? new Date(`${format(r2DateHeure, "yyyy-MM-dd")}T${r2Time}:00`).toISOString()
                      : null
                  }
                  cqTime={classification === "positif" ? cqTime : undefined}
                  regieId={regieId}
                  pdfData={(classification === "positif" || classification === "r2_prestudy") ? (buildPdfData() || undefined) : undefined}
                  venteDetails={classification === "positif" && calculatedResults ? {
                    telephone: clientTelephone || undefined,
                    adresse: clientAdresse || undefined,
                    codePostal: clientCodePostal || undefined,
                    ville: clientVille || undefined,
                    puissanceKwc: Number(puissanceKwc) || undefined,
                    prixTTC: calculatedResults.prixTotalHorsAides || undefined,
                    totalAides: calculatedResults.totalAides || undefined,
                    primeAutoconsommation: calculatedResults.primeAutoconsommation || undefined,
                    ecoTva: calculatedResults.ecoTva || undefined,
                    productType: productType || undefined,
                  } : undefined}
                  className="w-full"
                />
              )}
              
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
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Preview PDF Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl h-[85vh] p-0 flex flex-col">
            <DialogHeader className="p-4 pb-2">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Aperçu de l'étude
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden px-4">
              {pdfDataUrl && (
                <iframe
                  src={pdfDataUrl}
                  className="w-full h-full rounded-lg border"
                  title="Aperçu PDF"
                />
              )}
            </div>
            {/* Actions dans la preview */}
            <div className="p-4 pt-2 border-t flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleExportPdf}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Télécharger
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
                Partager
              </Button>
              {classification === "r2_prestudy" && (
                <Button
                  size="sm"
                  className="gap-1 bg-[#25D366] hover:bg-[#20BD5A] text-white"
                  onClick={handleWhatsAppShare}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Actions secondaires - optimisées mobile */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-2 pb-24">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
          >
            Annuler
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
            onClick={handlePreview}
            disabled={!calculatedResults}
          >
            <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Aperçu</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 sm:h-9 text-xs sm:text-sm px-2.5 sm:px-3"
            onClick={handleExportPdf}
            disabled={!calculatedResults || exporting}
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 h-8 sm:h-9 px-2.5 sm:px-3"
            onClick={handleShare}
            disabled={!calculatedResults}
          >
            <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          </div>
        </div>
      </div>
      
      {/* Overlay de chargement pendant la sauvegarde */}
      {saving && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg font-medium text-foreground">Enregistrement en cours...</p>
          <p className="text-sm text-muted-foreground">Veuillez patienter</p>
        </div>
      )}

      {/* Floating Buttons - Terminé + Save */}
      <div className="fixed bottom-20 sm:bottom-24 right-3 sm:right-4 z-40 flex flex-col gap-2 items-end">
        {/* Bouton Terminé - force la propagation du statut */}
        {classification && (
          <Button
            onClick={() => {
              forceSyncRef.current = true;
              handleSave();
            }}
            disabled={saving || (activeProducts.includes("PV") && !calculatedResults)}
            className="h-12 px-4 sm:h-14 sm:px-5 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl active:scale-95 bg-emerald-600 hover:bg-emerald-700"
            aria-label="Terminer et propager le statut"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
            ) : (
              <>
                <Check className="h-5 w-5 sm:h-6 sm:w-6" />
                <span className="text-sm font-medium">Terminé</span>
              </>
            )}
          </Button>
        )}
        {/* Bouton Save */}
        <Button
          onClick={handleSave}
          disabled={saving || (productType === "PV" && !calculatedResults)}
          className="h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg transition-all duration-200 hover:shadow-xl active:scale-95"
          size="icon"
          aria-label="Sauvegarder l'étude"
        >
          {saving ? (
            <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
          ) : (
            <Save className="h-5 w-5 sm:h-6 sm:w-6" />
          )}
        </Button>
      </div>
      
      {/* WhatsApp dialog removed - replaced by inline button */}
    </MobileLayout>
  );
};

export default EtudeForm;
