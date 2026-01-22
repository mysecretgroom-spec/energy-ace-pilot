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

const EtudeForm = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const clientId = searchParams.get("client");

  // Form state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Client info
  const [clientName, setClientName] = useState("");
  const [departement, setDepartement] = useState("");

  // Consommation
  const [consoAnnuelle, setConsoAnnuelle] = useState<number | "">("");
  const [factureAnnuelle, setFactureAnnuelle] = useState<number | "">("");

  // Installation
  const [bouquetId, setBouquetId] = useState("");
  const [puissanceKwc, setPuissanceKwc] = useState<number | "">("");
  const [typeRevente, setTypeRevente] = useState("surplus");

  // Technique
  const [orientation, setOrientation] = useState("Sud");
  const [inclinaison, setInclinaison] = useState(30);
  const [support, setSupport] = useState("toiture");

  // Mode de calcul production
  const [modeCalculProduction, setModeCalculProduction] = useState<"psh" | "heures">("psh");

  // Surcoûts
  const [selectedSurcouts, setSelectedSurcouts] = useState<string[]>([]);

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

  // Calculated values
  const [calculatedResults, setCalculatedResults] = useState<{
    productionAnnuelle: number;
    autoconsommation: number;
    autoconsPct: number;
    reventeKwh: number;
    gainAutoconso: number;
    reventeEuros: number;
    gainTotal: number;
    prixInstallation: number;
    prixSurcouts: number;
    prixTotal: number;
    mensualite: number;
    resultatMensuel: number;
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
    factureAnnuelle,
    orientation,
    inclinaison,
    typeRevente,
    selectedSurcouts,
    bouquetId,
    modeHejjaPsh,
    modeHejjaPrix,
    prixManuel,
    modeCalculProduction,
  ]);

  const loadReferenceData = async () => {
    setLoading(true);

    const [pshRes, orientRes, tarifsRes, bouquetsRes, surcoutsRes] = await Promise.all([
      supabase.from("data_psh").select("*").order("department_code"),
      supabase.from("data_orientation").select("*"),
      supabase.from("data_tarifs_revente").select("*").eq("actif", true),
      supabase.from("data_prix_bouquets").select("*").eq("actif", true).order("puissance_kwc"),
      supabase.from("data_surcouts").select("*").eq("actif", true),
    ]);

    if (pshRes.data) setDataPsh(pshRes.data);
    if (orientRes.data) setDataOrientation(orientRes.data);
    if (tarifsRes.data) setDataTarifs(tarifsRes.data);
    if (bouquetsRes.data) setDataBouquets(bouquetsRes.data);
    if (surcoutsRes.data) setDataSurcouts(surcoutsRes.data);

    setLoading(false);
  };

  const loadClientInfo = async () => {
    if (!clientId) return;

    const { data } = await supabase
      .from("clients")
      .select("nom, prenom, code_postal")
      .eq("id", clientId)
      .maybeSingle();

    if (data) {
      setClientName(data.prenom ? `${data.prenom} ${data.nom}` : data.nom);
      if (data.code_postal) {
        setDepartement(data.code_postal.substring(0, 2));
      }
    }
  };

  const calculateResults = () => {
    if (!puissanceKwc || !departement || !consoAnnuelle) return;

    // Get data for department
    const pshData = dataPsh.find((p) => p.department_code === departement);
    
    // Get orientation coefficient
    const orientData = dataOrientation.find(
      (o) => o.orientation === orientation && o.inclinaison === inclinaison
    );
    const coefficient = orientData?.coefficient || 1.0;

    // Production annuelle (kWh) - deux méthodes de calcul
    let productionAnnuelle: number;
    
    if (modeCalculProduction === "heures") {
      // Méthode heures d'ensoleillement : puissance * heures * rendement moyen * coefficient
      // Le rendement moyen d'un panneau est d'environ 15-20%, on prend 0.18
      const heuresAnnuelles = pshData?.heures_ensoleillement_annuel || 2800;
      const rendementPanneau = 0.18;
      productionAnnuelle = Number(puissanceKwc) * heuresAnnuelles * rendementPanneau * coefficient;
    } else {
      // Méthode PSH (kWh/m²/an) - formule classique
      const psh = pshData
        ? modeHejjaPsh
          ? pshData.max_psh_value
          : pshData.psh_value
        : 1200;
      // PSH est en kWh/m²/an, production = puissance * PSH * coefficient
      productionAnnuelle = Number(puissanceKwc) * psh * coefficient;
    }

    // Autoconsommation (estimation ~30% à 50% selon conso)
    const ratioAutoconso = Math.min(0.5, (Number(consoAnnuelle) / productionAnnuelle) * 0.6);
    const autoconsommation = productionAnnuelle * ratioAutoconso;
    const autoconsPct = ratioAutoconso * 100;
    const reventeKwh = productionAnnuelle - autoconsommation;

    // Prix du kWh acheté (estimation depuis facture)
    const prixKwhAchat = factureAnnuelle ? Number(factureAnnuelle) / Number(consoAnnuelle) : 0.22;

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
      : reventeKwh * prixKwhRevente;

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

    // Surcoûts
    const prixSurcouts = selectedSurcouts.reduce((total, code) => {
      const surcout = dataSurcouts.find((s) => s.code === code);
      return total + (surcout?.prix || 0);
    }, 0);

    const prixTotal = prixInstallation + prixSurcouts;

    // Mensualité (15 ans, taux ~4%)
    const dureeMois = 180;
    const tauxMensuel = 0.04 / 12;
    const mensualite = (prixTotal * tauxMensuel) / (1 - Math.pow(1 + tauxMensuel, -dureeMois));

    // Résultat mensuel
    const gainMensuel = gainTotal / 12;
    const resultatMensuel = gainMensuel - mensualite;

    // Verdict
    let verdict: "valide" | "a_etudier" | "invalide" | null = null;
    if (resultatMensuel >= 0) {
      verdict = "valide";
    } else if (resultatMensuel >= -30) {
      verdict = "a_etudier";
    } else {
      verdict = "invalide";
    }

    setCalculatedResults({
      productionAnnuelle: Math.round(productionAnnuelle),
      autoconsommation: Math.round(autoconsommation),
      autoconsPct: Math.round(autoconsPct),
      reventeKwh: Math.round(reventeKwh),
      gainAutoconso: Math.round(gainAutoconso),
      reventeEuros: Math.round(reventeEuros),
      gainTotal: Math.round(gainTotal),
      prixInstallation: Math.round(prixInstallation),
      prixSurcouts: Math.round(prixSurcouts),
      prixTotal: Math.round(prixTotal),
      mensualite: Math.round(mensualite),
      resultatMensuel: Math.round(resultatMensuel),
      verdict,
    });
  };

  const handleSave = async () => {
    if (!clientId || !user || !calculatedResults) return;

    setSaving(true);

    const { error } = await supabase.from("etudes").insert({
      user_id: user.id,
      client_id: clientId,
      consommation_annuelle_kwh: consoAnnuelle || null,
      facture_annuelle_euros: factureAnnuelle || null,
      puissance_kwc: puissanceKwc || null,
      type_revente: typeRevente,
      support,
      orientation,
      inclinaison,
      production_annuelle_kwh: calculatedResults.productionAnnuelle,
      autoconsommation_kwh: calculatedResults.autoconsommation,
      autoconsommation_pct: calculatedResults.autoconsPct,
      revente_kwh: calculatedResults.reventeKwh,
      gain_autoconso_euros: calculatedResults.gainAutoconso,
      revente_euros: calculatedResults.reventeEuros,
      gain_total_annuel: calculatedResults.gainTotal,
      prix_installation: calculatedResults.prixInstallation,
      surcouts: selectedSurcouts,
      prix_total: calculatedResults.prixTotal,
      mensualite_estimee: calculatedResults.mensualite,
      resultat_mensuel: calculatedResults.resultatMensuel,
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
              Nouvelle étude
            </h1>
            {clientName && (
              <p className="text-sm text-muted-foreground">{clientName}</p>
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

        {/* Consommation */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-secondary" />
              Consommation actuelle
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Conso annuelle (kWh)</Label>
                <Input
                  type="number"
                  placeholder="ex: 8000"
                  value={consoAnnuelle}
                  onChange={(e) => setConsoAnnuelle(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <div>
                <Label>Facture annuelle (€)</Label>
                <Input
                  type="number"
                  placeholder="ex: 1600"
                  value={factureAnnuelle}
                  onChange={(e) => setFactureAnnuelle(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
            </div>
            <div>
              <Label>Département</Label>
              <Select value={departement} onValueChange={setDepartement}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {dataPsh.map((d) => (
                    <SelectItem key={d.department_code} value={d.department_code}>
                      {d.department_code} - {d.department_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Installation */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sun className="h-4 w-4 text-primary" />
              Installation proposée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Bouquet</Label>
              <Select value={bouquetId} onValueChange={(v) => {
                setBouquetId(v);
                const b = dataBouquets.find((b) => b.id === v);
                if (b) setPuissanceKwc(b.puissance_kwc);
              }}>
                <SelectTrigger>
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
                <Label>Puissance (kWc)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={puissanceKwc}
                  onChange={(e) => setPuissanceKwc(e.target.value ? Number(e.target.value) : "")}
                />
              </div>
              <div>
                <Label>Type revente</Label>
                <Select value={typeRevente} onValueChange={setTypeRevente}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="surplus">Surplus</SelectItem>
                    <SelectItem value="totale">Totale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Technique */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Compass className="h-4 w-4 text-muted-foreground" />
              Données techniques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Mode de calcul production */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Mode de calcul production</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={modeCalculProduction === "psh" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setModeCalculProduction("psh")}
                >
                  <Sun className="h-3 w-3 mr-1" />
                  PSH (kWh/m²/an)
                </Button>
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
              </div>
              {departement && (
                <p className="text-xs text-muted-foreground mt-1">
                  {modeCalculProduction === "psh" ? (
                    <>PSH: {dataPsh.find(p => p.department_code === departement)?.[modeHejjaPsh ? "max_psh_value" : "psh_value"] || "N/A"} kWh/m²/an</>
                  ) : (
                    <>Heures: {dataPsh.find(p => p.department_code === departement)?.heures_ensoleillement_annuel?.toLocaleString() || "N/A"} h/an</>
                  )}
                </p>
              )}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Orientation</Label>
                <Select value={orientation} onValueChange={setOrientation}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Sud">Sud</SelectItem>
                    <SelectItem value="Sud-Est">Sud-Est</SelectItem>
                    <SelectItem value="Sud-Ouest">Sud-Ouest</SelectItem>
                    <SelectItem value="Est">Est</SelectItem>
                    <SelectItem value="Ouest">Ouest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Inclinaison (°)</Label>
                <Select value={String(inclinaison)} onValueChange={(v) => setInclinaison(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0° (plat)</SelectItem>
                    <SelectItem value="15">15°</SelectItem>
                    <SelectItem value="30">30° (optimal)</SelectItem>
                    <SelectItem value="45">45°</SelectItem>
                    <SelectItem value="60">60°</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Support</Label>
              <Select value={support} onValueChange={setSupport}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="toiture">Toiture tuiles</SelectItem>
                  <SelectItem value="bac_acier">Bac acier</SelectItem>
                  <SelectItem value="ardoise">Ardoise</SelectItem>
                  <SelectItem value="sol">Sol</SelectItem>
                  <SelectItem value="carport">Carport</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Surcoûts */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Euro className="h-4 w-4 text-secondary" />
              Options / Surcoûts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {dataSurcouts.map((s) => (
                <Badge
                  key={s.code}
                  variant={selectedSurcouts.includes(s.code) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedSurcouts((prev) =>
                      prev.includes(s.code)
                        ? prev.filter((c) => c !== s.code)
                        : [...prev, s.code]
                    );
                  }}
                >
                  {s.nom} (+{s.prix}€)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Résultats */}
        {calculatedResults && (
          <Card className="shadow-card border-2 border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                Résultats de l'étude
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Production */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Production annuelle</p>
                  <p className="font-bold text-lg">{calculatedResults.productionAnnuelle.toLocaleString("fr-FR")} kWh</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Autoconsommation</p>
                  <p className="font-bold">{calculatedResults.autoconsPct}%</p>
                </div>
              </div>

              <Separator />

              {/* Gains */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Gain autoconso</p>
                  <p className="font-semibold text-status-signed">+{calculatedResults.gainAutoconso}€/an</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revente</p>
                  <p className="font-semibold text-status-signed">+{calculatedResults.reventeEuros}€/an</p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">Gain total annuel</p>
                <p className="font-bold text-xl text-status-signed">+{calculatedResults.gainTotal}€/an</p>
              </div>

              <Separator />

              {/* Prix */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Installation</span>
                  <span>{calculatedResults.prixInstallation.toLocaleString("fr-FR")}€</span>
                </div>
                {calculatedResults.prixSurcouts > 0 && (
                  <div className="flex justify-between">
                    <span>Surcoûts</span>
                    <span>+{calculatedResults.prixSurcouts.toLocaleString("fr-FR")}€</span>
                  </div>
                )}
                <div className="flex justify-between font-bold pt-1 border-t">
                  <span>Prix total</span>
                  <span>{calculatedResults.prixTotal.toLocaleString("fr-FR")}€</span>
                </div>
              </div>

              <Separator />

              {/* Mensualité */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Mensualité (15 ans)</p>
                  <p className="font-semibold">{calculatedResults.mensualite}€/mois</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Résultat mensuel</p>
                  <p className={`font-bold text-lg ${calculatedResults.resultatMensuel >= 0 ? "text-status-signed" : "text-status-negative"}`}>
                    {calculatedResults.resultatMensuel >= 0 ? "+" : ""}{calculatedResults.resultatMensuel}€
                  </p>
                </div>
              </div>

              {/* Verdict */}
              <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-center">
                {getVerdictDisplay()}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
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
