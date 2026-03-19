import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Home, Droplets, Gauge, Flame, Zap, AlertCircle, TrendingDown, TrendingUp, Info, Shield, MapPin, Snowflake, ThermometerSun, PlugZap } from "lucide-react";
import { PacSubtype } from "@/lib/productTypes";
import { useEtudeReferenceData } from "@/hooks/useEtudeReferenceData";
import { supabase } from "@/integrations/supabase/client";

interface CompteurData {
  id: string;
  type_compteur: string;
  montant: number;
  actif: boolean;
}

interface CalibreData {
  id: string;
  calibre_amperes: number;
  puissance_kva: number;
  actif: boolean;
}

interface PACFieldsEnhancedProps {
  data: {
    pacSubtype: PacSubtype | "";
    pacSurfaceChauffee: number | "";
    pacTypeEmetteurs: string;
    pacNombreUnitesInt: number | "";
    pacPuissanceCalorifique: number | "";
    pacCop: number | "";
    pacEcsIntegre: boolean;
    pacVolumeBallon: number | "";
    pacEnergieActuelle: string;
    pacConsoChaufffageKwh: number | "";
    pacEconomieEstimee: number | "";
    pacFactureChauffageEuros: number | "";
    pacFactureElecEuros: number | "";
    pacNiveauIsolation: string;
    pacPrixKwhElec: number | "";
    typeCompteur?: string;
    calibreDisjoncteur?: number | "";
    puissanceSouscriteKva?: number | "";
  };
  departement?: string;
  onChange: (field: string, value: unknown) => void;
  /** Réduction des besoins chauffage grâce à l'ITE (0-100%) */
  iteReductionPct?: number;
  onEconomiesCalculated?: (economies: {
    besoinsChauffageKwh: number;
    consoElecPacKwh: number;
    surcoutElecEuros: number;
    economieNetteEuros: number;
    economieNetteMessage: number;
    copUtilise: number;
    puissanceRecommandee: number;
  }) => void;
}

const EMETTEURS_PAC = {
  air_air: [
    { value: "splits", label: "Splits muraux" },
    { value: "gainable", label: "Gainable" },
  ],
  air_eau: [
    { value: "radiateurs", label: "Radiateurs" },
    { value: "plancher_chauffant", label: "Plancher chauffant" },
    { value: "ventilo_convecteurs", label: "Ventilo-convecteurs" },
  ],
};

const VOLUME_BALLON_OPTIONS = [
  { value: 0, label: "Pas d'ECS" },
  { value: 100, label: "100L" },
  { value: 150, label: "150L" },
  { value: 200, label: "200L" },
  { value: 250, label: "250L" },
  { value: 300, label: "300L" },
];

export const PACFieldsEnhanced = ({ data, departement, onChange, iteReductionPct = 0, onEconomiesCalculated }: PACFieldsEnhancedProps) => {
  const {
    isolationLevels,
    energiesPrix,
    zonesClimatiques,
    getCopForTemperature,
    getRecommendedPuissance,
    getEnergiePrix,
    getZoneClimatique,
    loading,
  } = useEtudeReferenceData();

  // Compteurs et calibres depuis la DB
  const [compteurs, setCompteurs] = useState<CompteurData[]>([]);
  const [calibres, setCalibres] = useState<CalibreData[]>([]);

  useEffect(() => {
    const loadElecData = async () => {
      const [compteursRes, calibresRes] = await Promise.all([
        supabase.from("data_compteurs").select("*").eq("actif", true).order("type_compteur"),
        supabase.from("data_calibres").select("*").eq("actif", true).order("calibre_amperes"),
      ]);
      if (compteursRes.data) setCompteurs(compteursRes.data as CompteurData[]);
      if (calibresRes.data) setCalibres(calibresRes.data as CalibreData[]);
    };
    loadElecData();
  }, []);

  // Température extérieure moyenne de conception (basée sur zone climatique)
  const [temperatureBase, setTemperatureBase] = useState(7);

  // Auto-set puissance souscrite when calibre changes
  useEffect(() => {
    if (data.calibreDisjoncteur) {
      const calibre = calibres.find(c => c.calibre_amperes === Number(data.calibreDisjoncteur));
      if (calibre && !data.puissanceSouscriteKva) {
        onChange("puissanceSouscriteKva", calibre.puissance_kva);
      }
    }
  }, [data.calibreDisjoncteur, calibres]);

  // Get zone climatique from département
  const zoneClimatique = useMemo(() => {
    if (!departement) return null;
    return getZoneClimatique(departement);
  }, [departement, zonesClimatiques]);

  // Calculate temperature base from DJU
  useEffect(() => {
    if (zoneClimatique) {
      // Approximation : plus de DJU = climat plus froid = température base plus basse
      const dju = zoneClimatique.dju_base18;
      if (dju > 2500) setTemperatureBase(2); // Climat très froid (H1)
      else if (dju > 2000) setTemperatureBase(5); // Climat froid (H2)
      else setTemperatureBase(8); // Climat doux (H3)
    }
  }, [zoneClimatique]);

  // Get COP dynamique based on zone and subtype
  const calculatedCop = useMemo(() => {
    if (!data.pacSubtype) return 3.5;
    return getCopForTemperature(data.pacSubtype, temperatureBase);
  }, [data.pacSubtype, temperatureBase, getCopForTemperature]);

  // Get recommended puissance
  const recommendedPuissance = useMemo(() => {
    if (!data.pacSubtype || !data.pacSurfaceChauffee) return null;
    return getRecommendedPuissance(data.pacSubtype, Number(data.pacSurfaceChauffee));
  }, [data.pacSubtype, data.pacSurfaceChauffee, getRecommendedPuissance]);

  // Get prix kWh from énergie actuelle
  const prixEnergieActuelle = useMemo(() => {
    if (!data.pacEnergieActuelle) return 0;
    return getEnergiePrix(data.pacEnergieActuelle);
  }, [data.pacEnergieActuelle, getEnergiePrix]);

  // Values
  const copValue = Number(data.pacCop) || calculatedCop;
  const factureChauf = Number(data.pacFactureChauffageEuros) || 0;
  const factureElec = Number(data.pacFactureElecEuros) || 0;
  const surface = Number(data.pacSurfaceChauffee) || 0;
  const prixKwhElec = Number(data.pacPrixKwhElec) || 0.23;

  // Find selected isolation level
  const selectedIsolation = isolationLevels.find(i => i.niveau_isolation === data.pacNiveauIsolation);
  const besoinsKwhM2 = selectedIsolation?.besoins_kwh_m2_an || 120;

  // === CALCULS D'ÉCONOMIES ===
  const besoinsTotauxBrut = surface * besoinsKwhM2;
  // Réduction ITE : si ITE active, les besoins chauffage diminuent
  const besoinsTotauxApresIte = besoinsTotauxBrut * (1 - (iteReductionPct / 100));
  
  // Déduire l'ECS des besoins chauffage car le BTD la couvre séparément
  const BESOINS_ECS_KWH = 2000;
  const COP_BTD = 3;
  const besoinsChauffageKwh = Math.max(0, besoinsTotauxApresIte - BESOINS_ECS_KWH);
  
  // Conso élec PAC (chauffage seul) = Besoins chauffage / COP PAC
  const consoElecChauffageKwh = copValue > 0 ? besoinsChauffageKwh / copValue : 0;
  
  // Conso élec BTD (ECS) = Besoins ECS / COP BTD
  const consoElecBtdKwh = BESOINS_ECS_KWH / COP_BTD; // ~667 kWh/an
  
  // Total PAC + BTD
  const consoElecPacKwh = consoElecChauffageKwh + consoElecBtdKwh;
  const surcoutElecEuros = consoElecPacKwh * prixKwhElec;
  const economieNetteEuros = factureChauf - surcoutElecEuros;
  const economieNetteMensuelle = economieNetteEuros / 12;

  // Calcul économie en pourcentage
  const totalEnergieBefore = factureChauf + factureElec;
  const totalEnergieAfter = factureElec + surcoutElecEuros;
  const economiePct = totalEnergieBefore > 0 
    ? Math.round(((totalEnergieBefore - totalEnergieAfter) / totalEnergieBefore) * 100) 
    : 0;

  // Notify parent of calculated economies
  useEffect(() => {
    if (onEconomiesCalculated && surface > 0 && factureChauf > 0) {
      onEconomiesCalculated({
        besoinsChauffageKwh,
        consoElecPacKwh,
        surcoutElecEuros,
        economieNetteEuros,
        economieNetteMessage: economieNetteMensuelle,
        copUtilise: copValue,
        puissanceRecommandee: recommendedPuissance || 0,
      });
    }
  }, [besoinsChauffageKwh, consoElecPacKwh, surcoutElecEuros, economieNetteEuros, economieNetteMensuelle, copValue, recommendedPuissance]);

  // Auto-update COP when calculated changes
  useEffect(() => {
    if (calculatedCop && !data.pacCop) {
      onChange("pacCop", Number(calculatedCop.toFixed(2)));
    }
  }, [calculatedCop]);

  const showEconomies = factureChauf > 0 && surface > 0 && copValue > 0;

  if (loading) {
    return <div className="flex justify-center p-4"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Type de PAC */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Thermometer className="h-4 w-4 text-blue-600" />
            Type de Pompe à Chaleur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["air_air", "air_eau"] as PacSubtype[]).map((subtype) => (
              <button
                key={subtype}
                type="button"
                onClick={() => onChange("pacSubtype", subtype)}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  data.pacSubtype === subtype
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:border-primary/50"
                }`}
              >
                <div className="font-medium text-sm">
                  {subtype === "air_air" ? "Air / Air" : "Air / Eau"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {subtype === "air_air" ? "Climatisation réversible" : "Chauffage central"}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Zone Climatique Info */}
      {zoneClimatique && (
        <Card className="shadow-card border-blue-200 bg-blue-50/50">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Zone {zoneClimatique.zone_climatique}</span>
                <span className="text-xs text-muted-foreground">• {zoneClimatique.department_name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <Snowflake className="h-3 w-3 text-blue-500" />
                  <span>DJU: {zoneClimatique.dju_base18}</span>
                </div>
                <div className="flex items-center gap-1">
                  <ThermometerSun className="h-3 w-3 text-amber-500" />
                  <span>T° base: {temperatureBase}°C</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Caractéristiques du logement */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Home className="h-4 w-4 text-primary" />
            Caractéristiques du logement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Surface à chauffer (m²)</Label>
              <Input
                type="number"
                value={data.pacSurfaceChauffee}
                onChange={(e) => onChange("pacSurfaceChauffee", e.target.value ? Number(e.target.value) : "")}
                placeholder="120"
              />
            </div>
            <div className="space-y-2">
              <Label>Énergie actuelle</Label>
              <Select value={data.pacEnergieActuelle} onValueChange={(val) => onChange("pacEnergieActuelle", val)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {energiesPrix.map((e) => (
                    <SelectItem key={e.id} value={e.type_energie}>
                      {e.description || e.type_energie} ({e.prix_kwh.toFixed(3)}€/kWh)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {prixEnergieActuelle > 0 && (
                <p className="text-xs text-muted-foreground">
                  Prix: {prixEnergieActuelle.toFixed(3)} €/kWh
                </p>
              )}
            </div>
          </div>

          {/* Niveau d'isolation */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Niveau d'isolation
            </Label>
            <Select value={data.pacNiveauIsolation || ""} onValueChange={(val) => onChange("pacNiveauIsolation", val)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner le niveau d'isolation" /></SelectTrigger>
              <SelectContent>
                {isolationLevels.map((level) => (
                  <SelectItem key={level.id} value={level.niveau_isolation}>
                    <div className="flex flex-col">
                      <span>{level.label}</span>
                      <span className="text-xs text-muted-foreground">~{level.besoins_kwh_m2_an} kWh/m²/an</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedIsolation?.description && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {selectedIsolation.description}
              </p>
            )}
          </div>

          {/* Type d'émetteurs */}
          <div className="space-y-2">
            <Label>Type d'émetteurs</Label>
            <Select value={data.pacTypeEmetteurs} onValueChange={(val) => onChange("pacTypeEmetteurs", val)}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
              <SelectContent>
                {(data.pacSubtype === "air_air" ? EMETTEURS_PAC.air_air : EMETTEURS_PAC.air_eau).map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {data.pacSubtype === "air_air" && (
            <div className="space-y-2">
              <Label>Nombre d'unités intérieures</Label>
              <Input
                type="number"
                value={data.pacNombreUnitesInt}
                onChange={(e) => onChange("pacNombreUnitesInt", e.target.value ? Number(e.target.value) : "")}
                placeholder="3"
                min={1}
                max={8}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Factures énergétiques */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-600" />
            Factures énergétiques actuelles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Chauffage fossile (€/an)
              </Label>
              <Input
                type="number"
                value={data.pacFactureChauffageEuros}
                onChange={(e) => onChange("pacFactureChauffageEuros", e.target.value ? Number(e.target.value) : "")}
                placeholder="1800"
              />
              <p className="text-xs text-muted-foreground">Gaz, fioul ou propane (sera supprimé)</p>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Électricité actuelle (€/an)
              </Label>
              <Input
                type="number"
                value={data.pacFactureElecEuros}
                onChange={(e) => onChange("pacFactureElecEuros", e.target.value ? Number(e.target.value) : "")}
                placeholder="1200"
              />
              <p className="text-xs text-muted-foreground">Hors chauffage actuel</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Prix du kWh électrique (€)
            </Label>
            <Input
              type="number"
              step="0.01"
              value={data.pacPrixKwhElec}
              onChange={(e) => onChange("pacPrixKwhElec", e.target.value ? Number(e.target.value) : "")}
              placeholder="0.23"
            />
          </div>

          {(factureChauf > 0 || factureElec > 0) && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total énergie actuel</span>
                <span className="font-medium">{(factureChauf + factureElec).toLocaleString("fr-FR")} €/an</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Installation électrique */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PlugZap className="h-4 w-4 text-amber-600" />
            Installation électrique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Type compteur</Label>
              <Select value={data.typeCompteur || ""} onValueChange={(val) => onChange("typeCompteur", val)}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  {compteurs.map((c) => (
                    <SelectItem key={c.id} value={c.type_compteur}>
                      {c.type_compteur}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Calibre (A)</Label>
              <Select 
                value={data.calibreDisjoncteur ? String(data.calibreDisjoncteur) : ""} 
                onValueChange={(val) => onChange("calibreDisjoncteur", Number(val))}
              >
                <SelectTrigger><SelectValue placeholder="A" /></SelectTrigger>
                <SelectContent>
                  {calibres.map((c) => (
                    <SelectItem key={c.id} value={String(c.calibre_amperes)}>
                      {c.calibre_amperes}A
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Puissance (kVA)</Label>
              <Input
                type="number"
                step="0.5"
                value={data.puissanceSouscriteKva || ""}
                onChange={(e) => onChange("puissanceSouscriteKva", e.target.value ? Number(e.target.value) : "")}
                placeholder="6"
              />
            </div>
          </div>
          {Number(data.puissanceSouscriteKva) > 0 && Number(data.pacPuissanceCalorifique) > 0 && (
            <div className={`p-3 rounded-lg border ${
              Number(data.puissanceSouscriteKva) >= Number(data.pacPuissanceCalorifique) * 0.4
                ? "bg-green-50 border-green-200"
                : "bg-amber-50 border-amber-200"
            }`}>
              <p className="text-xs">
                {Number(data.puissanceSouscriteKva) >= Number(data.pacPuissanceCalorifique) * 0.4 ? (
                  <span className="text-green-700 font-medium">✓ Puissance souscrite adaptée à la PAC</span>
                ) : (
                  <span className="text-amber-700 font-medium">⚠️ Prévoir augmentation puissance souscrite</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Préconisation technique */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gauge className="h-4 w-4 text-primary" />
            Préconisation technique
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Puissance calorifique (kW)</Label>
              <Input
                type="number"
                value={data.pacPuissanceCalorifique}
                onChange={(e) => onChange("pacPuissanceCalorifique", e.target.value ? Number(e.target.value) : "")}
                placeholder={recommendedPuissance ? `Recommandé: ${recommendedPuissance}` : "8"}
                step={0.5}
              />
              {recommendedPuissance && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Recommandé: {recommendedPuissance} kW pour {surface} m²
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>COP moyen</Label>
              <Input
                type="number"
                value={data.pacCop}
                onChange={(e) => onChange("pacCop", e.target.value ? Number(e.target.value) : "")}
                placeholder={`Auto: ${calculatedCop.toFixed(2)}`}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ThermometerSun className="h-3 w-3" />
                Calculé pour T° base {temperatureBase}°C
              </p>
            </div>
          </div>

          {data.pacSubtype === "air_eau" && (
            <>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>ECS intégré</Label>
                  <p className="text-xs text-muted-foreground">Eau chaude sanitaire</p>
                </div>
                <Switch checked={data.pacEcsIntegre} onCheckedChange={(checked) => onChange("pacEcsIntegre", checked)} />
              </div>

              {data.pacEcsIntegre && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Droplets className="h-4 w-4" />
                    Volume ballon ECS
                  </Label>
                  <Select value={String(data.pacVolumeBallon)} onValueChange={(val) => onChange("pacVolumeBallon", Number(val))}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {VOLUME_BALLON_OPTIONS.filter(v => v.value > 0).map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Section Économies */}
      {showEconomies && (
        <Card className="shadow-card border-2 border-green-500/30">
          <CardHeader className="pb-3 bg-green-50/50">
            <CardTitle className="flex items-center gap-2 text-base text-green-700">
              <TrendingUp className="h-4 w-4" />
              Bilan Économique PAC
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {/* Besoins calculés */}
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-blue-600 font-medium mb-2 flex items-center gap-1">
                <Info className="h-3 w-3" />
                Besoins énergétiques calculés
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Surface × Isolation</span>
                  <p className="font-medium">{surface} m² × {besoinsKwhM2} kWh/m²</p>
                  {iteReductionPct > 0 && (
                    <p className="text-[10px] text-orange-600 font-medium mt-0.5">
                      ITE appliquée: -{iteReductionPct}%
                    </p>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground">Besoins annuels</span>
                  <p className="font-bold text-blue-600">{besoinsChauffageKwh.toLocaleString("fr-FR")} kWh/an</p>
                  {iteReductionPct > 0 && (
                    <p className="text-[10px] text-muted-foreground line-through">
                      {besoinsChauffageBrut.toLocaleString("fr-FR")} kWh/an
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Consommation PAC + BTD */}
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-xs text-amber-600 font-medium mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Augmentation électricité avec PAC + BTD
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Conso élec chauffage</span>
                  <p className="font-medium">{besoinsChauffageKwh.toLocaleString("fr-FR")} ÷ {copValue.toFixed(1)} COP</p>
                  <p className="font-bold text-amber-600">= {Math.round(consoElecChauffageKwh).toLocaleString("fr-FR")} kWh/an</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Conso élec BTD (ECS)</span>
                  <p className="font-medium">{BESOINS_ECS_KWH} kWh ÷ {COP_BTD} COP</p>
                  <p className="font-bold text-amber-600">= {Math.round(consoElecBtdKwh).toLocaleString("fr-FR")} kWh/an</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total PAC + BTD</span>
                  <p className="font-bold text-amber-600">{Math.round(consoElecPacKwh).toLocaleString("fr-FR")} kWh/an</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Surcoût électrique</span>
                  <p className="font-medium">{Math.round(consoElecPacKwh).toLocaleString("fr-FR")} × {prixKwhElec}€</p>
                  <p className="font-bold text-amber-600">= {surcoutElecEuros.toFixed(0)} €/an</p>
                </div>
              </div>
            </div>

            {/* Bilan */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
                <TrendingDown className="h-5 w-5 text-red-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Facture fossile supprimée</p>
                <p className="font-bold text-lg text-red-600">- {factureChauf.toLocaleString("fr-FR")} €</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-center">
                <Zap className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground">Surcoût électricité</p>
                <p className="font-bold text-lg text-amber-600">+ {surcoutElecEuros.toFixed(0)} €</p>
              </div>
            </div>

            {/* Économie nette */}
            <div className={`rounded-lg p-4 text-center ${
              economieNetteEuros >= 0 ? "bg-green-100 border-2 border-green-400" :
              economieNetteEuros >= -200 ? "bg-amber-100 border-2 border-amber-400" :
              "bg-red-100 border-2 border-red-400"
            }`}>
              <p className="text-sm text-muted-foreground mb-2">Économie nette annuelle</p>
              <div className="text-3xl font-bold mb-1 flex items-center justify-center gap-2">
                {economieNetteEuros >= 0 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-500" />
                )}
                <span className={economieNetteEuros >= 0 ? "text-green-600" : "text-red-600"}>
                  {economieNetteEuros >= 0 ? "+" : ""}{economieNetteEuros.toFixed(0)} €/an
                </span>
              </div>
              <p className="text-sm font-medium">
                Soit <span className={economieNetteEuros >= 0 ? "text-green-600" : "text-red-600"}>
                  {economieNetteEuros >= 0 ? "+" : ""}{economieNetteMensuelle.toFixed(0)} €/mois
                </span>
              </p>
              {economiePct > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Réduction de {economiePct}% sur les dépenses énergétiques
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
