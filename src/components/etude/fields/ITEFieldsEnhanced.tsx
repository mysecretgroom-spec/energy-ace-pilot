import { useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Home, Layers, Paintbrush, TrendingDown, Info, MapPin, ThermometerSun, Flame, Calculator, Shield } from "lucide-react";
import { useEtudeReferenceData } from "@/hooks/useEtudeReferenceData";

interface ITEFieldsEnhancedProps {
  data: {
    iteSurfaceIsoler: number | "";
    iteTypeFacade: string;
    iteEpaisseurIsolant: number | "";
    iteTypeIsolant: string;
    iteRActuel: number | "";
    iteRCible: number | "";
    iteNombreFacades: number | "";
    iteSurfaceOuvertures: number | "";
    iteFinition: string;
    iteEconomieChauffagePct: number | "";
    iteFactureChaufActuelle?: number | "";
  };
  departement?: string;
  onChange: (field: string, value: unknown) => void;
  onCalculationsReady?: (calcs: {
    rInitial: number;
    rCible: number;
    gainR: number;
    economiePct: number;
    economieAnnuelle: number;
    prixEstime: number;
  }) => void;
}

// Options d'épaisseur avec R calculé
const EPAISSEUR_OPTIONS = [
  { value: 80, label: "80 mm" },
  { value: 100, label: "100 mm" },
  { value: 120, label: "120 mm" },
  { value: 140, label: "140 mm" },
  { value: 160, label: "160 mm" },
  { value: 180, label: "180 mm" },
  { value: 200, label: "200 mm" },
];

export const ITEFieldsEnhanced = ({ data, departement, onChange, onCalculationsReady }: ITEFieldsEnhancedProps) => {
  const {
    mursIte,
    isolantsIte,
    finitionsIte,
    economiesIte,
    zonesClimatiques,
    getMurRInitial,
    getIsolantLambda,
    getFinitionPrix,
    getEconomieChaufPct,
    getZoneClimatique,
    loading,
  } = useEtudeReferenceData();

  // Get zone climatique
  const zoneClimatique = useMemo(() => {
    if (!departement) return null;
    return getZoneClimatique(departement);
  }, [departement, zonesClimatiques]);

  // Auto-set R initial when facade type changes
  useEffect(() => {
    if (data.iteTypeFacade) {
      const mur = mursIte.find(m => m.type_mur === data.iteTypeFacade);
      if (mur) {
        onChange("iteRActuel", mur.r_initial);
      }
    }
  }, [data.iteTypeFacade, mursIte]);

  // Calculate R cible from isolant and epaisseur
  const calculatedRIsolant = useMemo(() => {
    if (!data.iteTypeIsolant || !data.iteEpaisseurIsolant) return 0;
    const lambda = getIsolantLambda(data.iteTypeIsolant);
    // R = épaisseur (m) / lambda
    return (Number(data.iteEpaisseurIsolant) / 1000) / lambda;
  }, [data.iteTypeIsolant, data.iteEpaisseurIsolant, getIsolantLambda]);

  // Total R = R initial mur + R isolant
  const rTotal = useMemo(() => {
    const rActuel = Number(data.iteRActuel) || 0;
    return rActuel + calculatedRIsolant;
  }, [data.iteRActuel, calculatedRIsolant]);

  // Gain de R
  const gainR = calculatedRIsolant;

  // Get économie chauffage % from reference data
  const economiePctCalculee = useMemo(() => {
    if (gainR <= 0) return 0;
    const zone = zoneClimatique?.zone_climatique?.substring(0, 2); // H1, H2, H3
    return getEconomieChaufPct(gainR, zone);
  }, [gainR, zoneClimatique, getEconomieChaufPct]);

  // Update parent with économie
  useEffect(() => {
    if (economiePctCalculee > 0 && Number(data.iteEconomieChauffagePct) !== economiePctCalculee) {
      onChange("iteEconomieChauffagePct", economiePctCalculee);
    }
  }, [economiePctCalculee]);

  // Calculate price estimate
  const prixEstime = useMemo(() => {
    const surface = Number(data.iteSurfaceIsoler) || 0;
    if (surface === 0) return 0;
    
    // Prix = (prix isolant + prix finition) × surface
    const isolant = isolantsIte.find(i => i.type_isolant === data.iteTypeIsolant);
    const finition = finitionsIte.find(f => f.type_finition === data.iteFinition);
    
    const prixIsolant = isolant?.prix_m2 || 40;
    const prixFinition = finition?.prix_m2 || 50;
    const prixPose = 60; // Main d'œuvre moyenne
    
    return surface * (prixIsolant + prixFinition + prixPose);
  }, [data.iteSurfaceIsoler, data.iteTypeIsolant, data.iteFinition, isolantsIte, finitionsIte]);

  // Économie annuelle
  const economieAnnuelle = useMemo(() => {
    const facture = Number(data.iteFactureChaufActuelle) || 0;
    const pct = economiePctCalculee || Number(data.iteEconomieChauffagePct) || 0;
    return facture * (pct / 100);
  }, [data.iteFactureChaufActuelle, data.iteEconomieChauffagePct, economiePctCalculee]);

  // Notify parent
  useEffect(() => {
    if (onCalculationsReady && Number(data.iteSurfaceIsoler) > 0) {
      onCalculationsReady({
        rInitial: Number(data.iteRActuel) || 0,
        rCible: rTotal,
        gainR,
        economiePct: economiePctCalculee,
        economieAnnuelle,
        prixEstime,
      });
    }
  }, [rTotal, gainR, economiePctCalculee, economieAnnuelle, prixEstime]);

  if (loading) {
    return <div className="flex justify-center p-4"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Zone Climatique Info */}
      {zoneClimatique && (
        <Card className="shadow-card border-orange-200 bg-orange-50/50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium">Zone {zoneClimatique.zone_climatique}</span>
                <span className="text-xs text-muted-foreground">• {zoneClimatique.department_name}</span>
              </div>
              <div className="flex items-center gap-1 text-xs">
                <ThermometerSun className="h-3 w-3 text-orange-500" />
                <span>DJU: {zoneClimatique.dju_base18}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* État des façades */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="h-4 w-4 text-orange-600" />
            État des façades
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type de mur existant</Label>
              <Select value={data.iteTypeFacade} onValueChange={(val) => onChange("iteTypeFacade", val)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {mursIte.map((mur) => (
                    <SelectItem key={mur.id} value={mur.type_mur}>
                      <div className="flex flex-col">
                        <span>{mur.description || mur.type_mur}</span>
                        <span className="text-xs text-muted-foreground">R = {mur.r_initial} m².K/W</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nombre de façades</Label>
              <Input
                type="number"
                value={data.iteNombreFacades}
                onChange={(e) => onChange("iteNombreFacades", e.target.value ? Number(e.target.value) : "")}
                placeholder="4"
                min={1}
                max={4}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Surface à isoler (m²)</Label>
              <Input
                type="number"
                value={data.iteSurfaceIsoler}
                onChange={(e) => onChange("iteSurfaceIsoler", e.target.value ? Number(e.target.value) : "")}
                placeholder="150"
              />
            </div>
            <div className="space-y-2">
              <Label>Surface ouvertures (m²)</Label>
              <Input
                type="number"
                value={data.iteSurfaceOuvertures}
                onChange={(e) => onChange("iteSurfaceOuvertures", e.target.value ? Number(e.target.value) : "")}
                placeholder="25"
              />
              <p className="text-xs text-muted-foreground">Fenêtres, portes, baies</p>
            </div>
          </div>

          {/* R actuel calculé */}
          {Number(data.iteRActuel) > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  Résistance thermique actuelle
                </span>
                <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                  R = {Number(data.iteRActuel).toFixed(2)} m².K/W
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Préconisation isolation */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" />
            Préconisation isolation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Type d'isolant</Label>
            <Select value={data.iteTypeIsolant} onValueChange={(val) => onChange("iteTypeIsolant", val)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {isolantsIte.map((isolant) => (
                  <SelectItem key={isolant.id} value={isolant.type_isolant}>
                    <div className="flex flex-col">
                      <span>{isolant.description || isolant.type_isolant}</span>
                      <span className="text-xs text-muted-foreground">λ = {isolant.lambda} • ~{isolant.prix_m2}€/m²</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Épaisseur isolant</Label>
            <Select value={String(data.iteEpaisseurIsolant)} onValueChange={(val) => onChange("iteEpaisseurIsolant", Number(val))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {EPAISSEUR_OPTIONS.map((opt) => {
                  const lambda = data.iteTypeIsolant ? getIsolantLambda(data.iteTypeIsolant) : 0.038;
                  const rCalcule = (opt.value / 1000) / lambda;
                  return (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label} (R ≈ {rCalcule.toFixed(1)})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Performance thermique */}
          {calculatedRIsolant > 0 && (
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">R isolant</p>
                  <p className="font-bold text-primary">+{calculatedRIsolant.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">R total cible</p>
                  <p className="font-bold text-lg text-primary">{rTotal.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gain</p>
                  <p className="font-bold text-green-600">×{(rTotal / (Number(data.iteRActuel) || 0.3)).toFixed(1)}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-primary/20">
                <p className="text-xs text-center text-muted-foreground">
                  {rTotal >= 4.0 ? "✓ Conforme RE 2020 (R ≥ 4.0)" : 
                   rTotal >= 3.7 ? "✓ Conforme RT 2012 (R ≥ 3.7)" :
                   "⚠️ Recommandé : R ≥ 3.7 pour les aides"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Finition */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paintbrush className="h-4 w-4 text-primary" />
            Finition extérieure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {finitionsIte.map((finition) => (
              <button
                key={finition.id}
                type="button"
                onClick={() => onChange("iteFinition", finition.type_finition)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  data.iteFinition === finition.type_finition
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:border-primary/50"
                }`}
              >
                <div className="font-medium text-sm">{finition.description || finition.type_finition}</div>
                <div className="text-xs text-muted-foreground mt-1">~{finition.prix_m2}€/m²</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Facture chauffage actuelle */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-600" />
            Facture de chauffage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Facture chauffage annuelle (€/an)</Label>
            <Input
              type="number"
              value={data.iteFactureChaufActuelle || ""}
              onChange={(e) => onChange("iteFactureChaufActuelle", e.target.value ? Number(e.target.value) : "")}
              placeholder="1800"
            />
            <p className="text-xs text-muted-foreground">Gaz, fioul, électricité ou bois pour le chauffage</p>
          </div>
        </CardContent>
      </Card>

      {/* Économies estimées */}
      {Number(data.iteSurfaceIsoler) > 0 && gainR > 0 && (
        <Card className="shadow-card border-green-500/30 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-green-700">
              <TrendingDown className="h-4 w-4" />
              Économies & Estimation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Économie chauffage */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-3 border">
                <p className="text-xs text-muted-foreground">Réduction déperditions</p>
                <p className="text-2xl font-bold text-green-600">{economiePctCalculee}%</p>
                <p className="text-xs text-muted-foreground">
                  Pour un gain R de {gainR.toFixed(1)} m².K/W
                </p>
              </div>
              {Number(data.iteFactureChaufActuelle) > 0 && (
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">Économie annuelle</p>
                  <p className="text-2xl font-bold text-green-600">{economieAnnuelle.toFixed(0)} €</p>
                  <p className="text-xs text-muted-foreground">
                    Soit {(economieAnnuelle / 12).toFixed(0)} €/mois
                  </p>
                </div>
              )}
            </div>

            {/* Prix estimé */}
            {prixEstime > 0 && (
              <div className="bg-white rounded-lg p-3 border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Estimation travaux</span>
                  </div>
                  <span className="font-bold text-lg">{prixEstime.toLocaleString("fr-FR")} €</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ~{(prixEstime / Number(data.iteSurfaceIsoler)).toFixed(0)} €/m² (isolant + finition + pose)
                </p>
              </div>
            )}

            {/* Retour sur investissement */}
            {economieAnnuelle > 0 && prixEstime > 0 && (
              <div className="p-3 rounded-lg bg-green-100 border border-green-300 text-center">
                <p className="text-sm text-muted-foreground">Retour sur investissement estimé</p>
                <p className="text-xl font-bold text-green-700">
                  ~{Math.round(prixEstime / economieAnnuelle)} ans
                </p>
                <p className="text-xs text-muted-foreground">
                  Sans compter les aides (MaPrimeRénov', CEE)
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
