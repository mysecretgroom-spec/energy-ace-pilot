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
} from "lucide-react";
import { PinDialog } from "@/components/auth/PinDialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

const EtudeForm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const clientId = searchParams.get("clientId");
  const rdvId = searchParams.get("rdvId");

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Client info
  const [clientName, setClientName] = useState("");
  const [clientPrenom, setClientPrenom] = useState("");
  const [clientAdresse, setClientAdresse] = useState("");
  const [clientVille, setClientVille] = useState("");
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
  const [typeRevente, setTypeRevente] = useState("surplus");
  const [supportInstallation, setSupportInstallation] = useState("TOITURE SURIMPOSITION");

  // === DONNÉES TECHNIQUES ===
  const [orientation, setOrientation] = useState("SUD");
  const [inclinaison, setInclinaison] = useState(30);
  const [surfaceInstallation, setSurfaceInstallation] = useState<number | "">("");
  const [rendementProductivite, setRendementProductivite] = useState(100);

  // Mode de calcul production
  const [modeCalculProduction, setModeCalculProduction] = useState<"psh" | "heures">("heures");

  // === FINANCEMENT ===
  const [modeFinancement, setModeFinancement] = useState("SOFINCO");
  const [dureeFinancement, setDureeFinancement] = useState(180);
  const [tauxFinancement, setTauxFinancement] = useState(4.0);

  // Surcoûts
  const [selectedSurcouts, setSelectedSurcouts] = useState<string[]>([]);
  const [surcoutSupport, setSurcoutSupport] = useState(0);
  const [surcoutCompteur, setSurcoutCompteur] = useState(0);
  const [autreSurcout, setAutreSurcout] = useState(0);

  // Mode HEJJA
  const [modeHejjaActive, setModeHejjaActive] = useState(false);
  const [modeHejjaPsh, setModeHejjaPsh] = useState(false);
  const [modeHejjaPrix, setModeHejjaPrix] = useState(false);
  const [prixManuel, setPrixManuel] = useState<number | "">("");
  const [showPinDialog, setShowPinDialog] = useState(false);

  // Data tables
  const [dataPsh, setDataPsh] = useState<DataPsh[]>([]);
  const [dataOrientation, setDataOrientation] = useState<DataOrientation[]>([]);
  const [dataTarifs, setDataTarifs] = useState<DataTarif[]>([]);
  const [dataBouquets, setDataBouquets] = useState<DataBouquet[]>([]);
  const [dataSurcouts, setDataSurcouts] = useState<DataSurcout[]>([]);
  const [dataCalibres, setDataCalibres] = useState<DataCalibre[]>([]);
  const [dataCompteurs, setDataCompteurs] = useState<DataCompteur[]>([]);

  // Calculated values
  const [calculatedResults, setCalculatedResults] = useState<{
    productionAnnuelle: number;
    autoconsommation: number;
    autoconsPct: number;
    surplusProduction: number;
    gainAutoconso: number;
    reventeEuros: number;
    gainTotal: number;
    prixInstallation: number;
    prixSurcouts: number;
    prixTotal: number;
    primeAutoconsommation: number;
    ecoTva: number;
    totalAides: number;
    totalAidesDeduites: number;
    mensualite: number;
    economieAutoconsoMensuelle: number;
    reventeMensuelleEstimee: number;
    resultatTransfertCharge: number;
    verdict: "valide" | "a_etudier" | "invalide" | null;
  } | null>(null);

  // Load data on mount
  useEffect(() => {
    loadReferenceData();
    if (clientId) {
      loadClientInfo();
    }
  }, [clientId]);

  // Recalculate when inputs change
  useEffect(() => {
    if (puissanceKwc && departement && consoAnnuelle) {
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
    modeHejjaPrix,
    prixManuel,
    modeCalculProduction,
    rendementProductivite,
    dureeFinancement,
    tauxFinancement,
    surcoutSupport,
    surcoutCompteur,
    autreSurcout,
    typeRaccordement,
  ]);

  const loadReferenceData = async () => {
    setLoading(true);

    const [pshRes, orientRes, tarifsRes, bouquetsRes, surcoutsRes, calibresRes, compteursRes] = await Promise.all([
      supabase.from("data_psh").select("*").order("department_code"),
      supabase.from("data_orientation").select("*"),
      supabase.from("data_tarifs_revente").select("*").eq("actif", true),
      supabase.from("data_prix_bouquets").select("*").eq("actif", true).order("puissance_kwc"),
      supabase.from("data_surcouts").select("*").eq("actif", true),
      supabase.from("data_calibres").select("*").eq("actif", true).order("calibre_amperes"),
      supabase.from("data_compteurs").select("*").eq("actif", true),
    ]);

    if (pshRes.data) setDataPsh(pshRes.data);
    if (orientRes.data) setDataOrientation(orientRes.data);
    if (tarifsRes.data) setDataTarifs(tarifsRes.data);
    if (bouquetsRes.data) setDataBouquets(bouquetsRes.data);
    if (surcoutsRes.data) setDataSurcouts(surcoutsRes.data);
    if (calibresRes.data) setDataCalibres(calibresRes.data);
    if (compteursRes.data) setDataCompteurs(compteursRes.data);

    setLoading(false);
  };

  const loadClientInfo = async () => {
    if (!clientId) return;

    const { data } = await supabase
      .from("clients")
      .select("nom, prenom, adresse, ville, code_postal")
      .eq("id", clientId)
      .maybeSingle();

    if (data) {
      setClientName(data.nom || "");
      setClientPrenom(data.prenom || "");
      setClientAdresse(data.adresse || "");
      setClientVille(data.ville || "");
      if (data.code_postal) {
        setDepartement(data.code_postal.substring(0, 2));
      }
    }
  };

  // Mise à jour du surcoût compteur selon le type de raccordement
  useEffect(() => {
    const compteur = dataCompteurs.find(c => c.type_compteur === typeRaccordement);
    if (compteur) {
      setSurcoutCompteur(compteur.montant);
    }
  }, [typeRaccordement, dataCompteurs]);

  const calculateResults = () => {
    if (!puissanceKwc || !departement || !consoAnnuelle) return;

    // Get data for department
    const pshData = dataPsh.find((p) => p.department_code === departement);
    
    // Get orientation coefficient
    const orientData = dataOrientation.find(
      (o) => o.orientation.toLowerCase() === orientation.toLowerCase() && o.inclinaison === inclinaison
    );
    const coefficient = orientData?.coefficient || 1.0;

    // Production annuelle (kWh) - deux méthodes de calcul
    let productionAnnuelle: number;
    const rendementCoeff = rendementProductivite / 100;
    
    if (modeCalculProduction === "heures") {
      // Méthode heures d'ensoleillement : puissance * heures * rendement moyen * coefficient
      const heuresAnnuelles = pshData?.heures_ensoleillement_annuel || 2890;
      const rendementPanneau = 0.18;
      productionAnnuelle = Number(puissanceKwc) * heuresAnnuelles * rendementPanneau * coefficient * rendementCoeff;
    } else {
      // Méthode PSH (kWh/kWc/an)
      const psh = pshData
        ? modeHejjaPsh
          ? pshData.max_psh_value
          : pshData.psh_value
        : 1200;
      productionAnnuelle = Number(puissanceKwc) * psh * coefficient * rendementCoeff;
    }

    // Autoconsommation - limité à la conso annuelle
    const autoconsommation = Math.min(productionAnnuelle, Number(consoAnnuelle));
    const autoconsPct = (autoconsommation / productionAnnuelle) * 100;
    const surplusProduction = productionAnnuelle - autoconsommation;

    // Prix du kWh acheté (estimation depuis facture mensuelle)
    const factureAnnuelle = Number(factureMensuelle || 0) * 12;
    const prixKwhAchat = factureAnnuelle ? factureAnnuelle / Number(consoAnnuelle) : 0.22;

    // Gain autoconsommation
    const gainAutoconso = autoconsommation * prixKwhAchat;

    // Tarif revente
    const tarifRevente = dataTarifs.find(
      (t) =>
        t.type_revente === typeRevente &&
        Number(puissanceKwc) >= t.puissance_min &&
        Number(puissanceKwc) < t.puissance_max
    );
    const prixKwhRevente = tarifRevente?.prix_kwh || 0.1;

    // Gain revente
    const reventeEuros = typeRevente === "totale" 
      ? productionAnnuelle * prixKwhRevente 
      : surplusProduction * prixKwhRevente;

    // Gain total annuel
    const gainTotal = typeRevente === "totale" ? reventeEuros : gainAutoconso + reventeEuros;

    // Prix installation
    const bouquet = dataBouquets.find((b) => b.id === bouquetId);
    let prixInstallation = bouquet
      ? modeHejjaPrix && prixManuel
        ? Number(prixManuel)
        : modeHejjaPrix
        ? bouquet.prix_max
        : bouquet.prix_recommande
      : Number(puissanceKwc) * 2500;

    // Surcoûts totaux
    const prixSurcoûtsOptions = selectedSurcouts.reduce((total, code) => {
      const surcout = dataSurcouts.find((s) => s.code === code);
      return total + (surcout?.prix || 0);
    }, 0);
    const prixSurcouts = prixSurcoûtsOptions + surcoutSupport + surcoutCompteur + autreSurcout;

    const prixTotalHorsAides = prixInstallation + prixSurcouts;

    // Calcul des aides
    // Prime autoconsommation (barème simplifié)
    let primeAutoconsommation = 0;
    if (typeRevente === "surplus") {
      if (Number(puissanceKwc) <= 3) primeAutoconsommation = Number(puissanceKwc) * 500;
      else if (Number(puissanceKwc) <= 9) primeAutoconsommation = Number(puissanceKwc) * 370;
      else primeAutoconsommation = Number(puissanceKwc) * 210;
    }

    // Eco TVA (récupération partielle si <= 3kWc)
    const ecoTva = Number(puissanceKwc) <= 3 ? prixTotalHorsAides * 0.10 : 0;

    const totalAides = primeAutoconsommation + ecoTva;
    const totalAidesDeduites = prixTotalHorsAides - totalAides;

    // Mensualité
    const dureeMois = dureeFinancement;
    const tauxMensuel = tauxFinancement / 100 / 12;
    const mensualite = tauxMensuel > 0 
      ? (totalAidesDeduites * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -dureeMois))
      : totalAidesDeduites / dureeMois;

    // Rentabilité financière mensuelle
    const economieAutoconsoMensuelle = gainAutoconso / 12;
    const reventeMensuelleEstimee = reventeEuros / 12;
    const resultatTransfertCharge = economieAutoconsoMensuelle + reventeMensuelleEstimee - mensualite;

    // Verdict
    let verdict: "valide" | "a_etudier" | "invalide" | null = null;
    if (resultatTransfertCharge >= 0) {
      verdict = "valide";
    } else if (resultatTransfertCharge >= -30) {
      verdict = "a_etudier";
    } else {
      verdict = "invalide";
    }

    // Calcul surface installation (environ 1.7m² par panneau, ~400Wc)
    const surfaceCalc = (Number(puissanceKwc) / 0.4) * 1.7;
    setSurfaceInstallation(Math.round(surfaceCalc * 10) / 10);

    setCalculatedResults({
      productionAnnuelle: Math.round(productionAnnuelle),
      autoconsommation: Math.round(autoconsommation),
      autoconsPct: Math.round(autoconsPct * 100) / 100,
      surplusProduction: Math.round(surplusProduction),
      gainAutoconso: Math.round(gainAutoconso * 100) / 100,
      reventeEuros: Math.round(reventeEuros * 100) / 100,
      gainTotal: Math.round(gainTotal * 100) / 100,
      prixInstallation: Math.round(prixInstallation * 100) / 100,
      prixSurcouts: Math.round(prixSurcouts * 100) / 100,
      prixTotal: Math.round(prixTotalHorsAides * 100) / 100,
      primeAutoconsommation: Math.round(primeAutoconsommation * 100) / 100,
      ecoTva: Math.round(ecoTva * 100) / 100,
      totalAides: Math.round(totalAides * 100) / 100,
      totalAidesDeduites: Math.round(totalAidesDeduites * 100) / 100,
      mensualite: Math.round(mensualite * 100) / 100,
      economieAutoconsoMensuelle: Math.round(economieAutoconsoMensuelle * 100) / 100,
      reventeMensuelleEstimee: Math.round(reventeMensuelleEstimee * 100) / 100,
      resultatTransfertCharge: Math.round(resultatTransfertCharge * 100) / 100,
      verdict,
    });
  };

  const handleSave = async () => {
    if (!clientId || !user || !calculatedResults) return;

    setSaving(true);

    const { error } = await supabase.from("etudes").insert({
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
      autoconsommation_kwh: calculatedResults.autoconsommation,
      autoconsommation_pct: calculatedResults.autoconsPct,
      surplus_production_kwh: calculatedResults.surplusProduction,
      revente_kwh: calculatedResults.surplusProduction,
      gain_autoconso_euros: calculatedResults.gainAutoconso,
      revente_euros: calculatedResults.reventeEuros,
      gain_total_annuel: calculatedResults.gainTotal,
      // Prix
      prix_installation: calculatedResults.prixInstallation,
      surcouts: selectedSurcouts,
      surcout_support: surcoutSupport,
      surcout_compteur: surcoutCompteur,
      autre_surcout: autreSurcout,
      prix_total: calculatedResults.prixTotal,
      // Aides
      prime_autoconsommation: calculatedResults.primeAutoconsommation,
      eco_tva: calculatedResults.ecoTva,
      total_aides: calculatedResults.totalAides,
      total_aides_deduites: calculatedResults.totalAidesDeduites,
      // Financement
      mode_financement: modeFinancement,
      duree_financement_mois: dureeFinancement,
      taux_financement: tauxFinancement,
      mensualite_estimee: calculatedResults.mensualite,
      // Rentabilité
      economie_autoconso_mensuelle: calculatedResults.economieAutoconsoMensuelle,
      revente_mensuelle_estimee: calculatedResults.reventeMensuelleEstimee,
      resultat_transfert_charge: calculatedResults.resultatTransfertCharge,
      resultat_mensuel: calculatedResults.resultatTransfertCharge,
      verdict: calculatedResults.verdict,
      mode_hejja_psh: modeHejjaPsh,
      mode_hejja_prix: modeHejjaPrix,
    });

    if (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder l'étude",
      });
    } else {
      toast({
        title: "Étude sauvegardée",
        description: "L'étude a été enregistrée avec succès",
      });
      navigate(`/clients/${clientId}`);
    }

    setSaving(false);
  };

  const getVerdictDisplay = () => {
    if (!calculatedResults?.verdict) return null;

    switch (calculatedResults.verdict) {
      case "valide":
        return (
          <div className="flex items-center gap-2 text-status-signed">
            <CheckCircle2 className="h-6 w-6" />
            <span className="text-lg font-bold">VALIDE</span>
          </div>
        );
      case "a_etudier":
        return (
          <div className="flex items-center gap-2 text-status-reported">
            <AlertTriangle className="h-6 w-6" />
            <span className="text-lg font-bold">À ÉTUDIER</span>
          </div>
        );
      case "invalide":
        return (
          <div className="flex items-center gap-2 text-status-negative">
            <XCircle className="h-6 w-6" />
            <span className="text-lg font-bold">INVALIDE</span>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <MobileLayout title="Nouvelle étude">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
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
                    <p className="text-sm font-medium">Ensoleillement max</p>
                    <p className="text-xs text-muted-foreground">PSH valeur haute</p>
                  </div>
                  <Switch
                    checked={modeHejjaPsh}
                    onCheckedChange={setModeHejjaPsh}
                  />
                </div>
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
                    <SelectItem value="15">15°</SelectItem>
                    <SelectItem value="30">30°</SelectItem>
                    <SelectItem value="45">45°</SelectItem>
                    <SelectItem value="60">60°</SelectItem>
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
                    <SelectItem value="TRIPHASÉ">TRIPHASÉ</SelectItem>
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
                        {c.calibre_amperes} A
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
                <Label className="text-xs">Consommation (kWh)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="ex: 11600"
                    value={consoAnnuelle}
                    onChange={(e) => setConsoAnnuelle(e.target.value ? Number(e.target.value) : "")}
                    className="h-9"
                  />
                  <span className="flex items-center text-xs text-muted-foreground">kWh</span>
                </div>
              </div>
              <div>
                <Label className="text-xs">Facture Mensuelle (€)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="ex: 230"
                    value={factureMensuelle}
                    onChange={(e) => setFactureMensuelle(e.target.value ? Number(e.target.value) : "")}
                    className="h-9"
                  />
                  <span className="flex items-center text-xs text-muted-foreground">€</span>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs">Département</Label>
              <Select value={departement} onValueChange={setDepartement}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {dataPsh.map((d) => (
                    <SelectItem key={d.department_code} value={d.department_code}>
                      {d.department_name} - {d.department_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                      {b.nom_bouquet} - {b.prix_recommande.toLocaleString("fr-FR")}€
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
                  step="0.5"
                  value={puissanceKwc}
                  onChange={(e) => setPuissanceKwc(e.target.value ? Number(e.target.value) : "")}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-xs">Type de Revente</Label>
                <Select value={typeRevente} onValueChange={setTypeRevente}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surplus">STANDARD (Surplus)</SelectItem>
                    <SelectItem value="totale">TOTALE</SelectItem>
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
                  <SelectItem value="TOITURE SURIMPOSITION">TOITURE SURIMPOSITION</SelectItem>
                  <SelectItem value="TOITURE INTEGRATION">TOITURE INTÉGRATION</SelectItem>
                  <SelectItem value="SOL">SOL</SelectItem>
                  <SelectItem value="CARPORT">CARPORT</SelectItem>
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
                <Label className="text-xs">Rendement (%)</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    value={rendementProductivite}
                    onChange={(e) => setRendementProductivite(Number(e.target.value) || 100)}
                    className="h-9"
                  />
                  <span className="flex items-center text-xs text-muted-foreground">%</span>
                </div>
              </div>
            </div>

            {/* Mode de calcul production */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Ensoleillement Annuel - PSH</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={modeCalculProduction === "heures" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setModeCalculProduction("heures")}
                >
                  <Gauge className="h-3 w-3 mr-1" />
                  Heures/an
                </Button>
                <Button
                  type="button"
                  variant={modeCalculProduction === "psh" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setModeCalculProduction("psh")}
                >
                  <Sun className="h-3 w-3 mr-1" />
                  PSH (kWh/kWc/an)
                </Button>
              </div>
              {departement && (
                <p className="text-xs text-muted-foreground mt-1 text-center">
                  {modeCalculProduction === "psh" ? (
                    <>{dataPsh.find(p => p.department_code === departement)?.[modeHejjaPsh ? "max_psh_value" : "psh_value"] || "N/A"} kWh/kWc/an</>
                  ) : (
                    <>{dataPsh.find(p => p.department_code === departement)?.heures_ensoleillement_annuel?.toLocaleString() || "N/A"} h/an</>
                  )}
                </p>
              )}
            </div>
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
                calculatedResults.autoconsPct >= 100 ? "bg-status-signed/10" :
                calculatedResults.autoconsPct >= 50 ? "bg-status-reported/10" :
                "bg-muted/50"
              }`}>
                <p className="text-xs text-muted-foreground">Autoconsommation</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-bold text-xl">{calculatedResults.autoconsPct.toFixed(2)}%</span>
                  {calculatedResults.autoconsPct >= 100 && (
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

        {/* PRIX */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <Euro className="h-4 w-4 text-secondary" />
              Prix
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {calculatedResults && (
              <>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm">Prix de l'Installation TTC (€)</span>
                  <span className="font-semibold">{calculatedResults.prixInstallation.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground">Surcoût Support (€)</span>
                  <Input
                    type="number"
                    value={surcoutSupport}
                    onChange={(e) => setSurcoutSupport(Number(e.target.value) || 0)}
                    className="h-8 w-24 text-right"
                  />
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground">Surcoût Compteur (€)</span>
                  <span className="font-medium">{surcoutCompteur.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm text-muted-foreground">Autre Surcoût (€)</span>
                  <Input
                    type="number"
                    value={autreSurcout}
                    onChange={(e) => setAutreSurcout(Number(e.target.value) || 0)}
                    className="h-8 w-24 text-right"
                  />
                </div>
                <Separator />
                <div className="flex justify-between items-center py-1 font-bold">
                  <span>TOTAL Hors Aides (€)</span>
                  <span>{calculatedResults.prixTotal.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
                <div className="flex justify-between items-center py-1 text-status-signed">
                  <span className="font-medium">TOTAL Aides (€)</span>
                  <span className="font-medium">{calculatedResults.totalAides.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-primary/10 rounded-lg px-3 font-bold text-lg">
                  <span>TOTAL Aides Déduites (€)</span>
                  <span className="text-primary">{calculatedResults.totalAidesDeduites.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* AIDES */}
        {calculatedResults && (
          <Card className="shadow-card">
            <CardHeader className="pb-2 bg-status-signed/10">
              <CardTitle className="text-sm flex items-center gap-2">
                <PiggyBank className="h-4 w-4 text-status-signed" />
                Aides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              <div className="flex justify-between items-center py-1">
                <span className="text-sm">Prime à l'Autoconsommation (€)</span>
                <span className="font-medium text-status-signed">{calculatedResults.primeAutoconsommation.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm">ECO TVA</span>
                <span className="font-medium text-status-signed">{calculatedResults.ecoTva.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* FINANCEMENT */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Financement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Mode de Financement</Label>
                <Select value={modeFinancement} onValueChange={setModeFinancement}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOFINCO">SOFINCO</SelectItem>
                    <SelectItem value="CETELEM">CETELEM</SelectItem>
                    <SelectItem value="COFIDIS">COFIDIS</SelectItem>
                    <SelectItem value="COMPTANT">COMPTANT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Durée (Mois)</Label>
                <Select value={String(dureeFinancement)} onValueChange={(v) => setDureeFinancement(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 mois (5 ans)</SelectItem>
                    <SelectItem value="120">120 mois (10 ans)</SelectItem>
                    <SelectItem value="180">180 mois (15 ans)</SelectItem>
                    <SelectItem value="240">240 mois (20 ans)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {calculatedResults && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">Mensualité / Amortissement mensuel (€)</p>
                <p className="font-bold text-xl">{calculatedResults.mensualite.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</p>
              </div>
            )}
          </CardContent>
        </Card>

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
                <span className="font-medium">{calculatedResults.economieAutoconsoMensuelle.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-sm">Revente Mensuelle Estimative (€)</span>
                <span className="font-medium">{calculatedResults.reventeMensuelleEstimee.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
              </div>
              <Separator />
              <div className={`rounded-lg p-4 text-center ${
                calculatedResults.resultatTransfertCharge >= 0 ? "bg-status-signed/10" :
                calculatedResults.resultatTransfertCharge >= -30 ? "bg-status-reported/10" :
                "bg-status-negative/10"
              }`}>
                <p className="text-sm text-muted-foreground mb-1">Résultat Transfert de Charge</p>
                <div className="flex items-center justify-center gap-3">
                  {getVerdictDisplay()}
                  <span className={`font-bold text-2xl ${
                    calculatedResults.resultatTransfertCharge >= 0 ? "text-status-signed" :
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

        {/* Actions */}
        <div className="flex gap-3 pt-2 pb-8">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate(-1)}
          >
            Annuler
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
