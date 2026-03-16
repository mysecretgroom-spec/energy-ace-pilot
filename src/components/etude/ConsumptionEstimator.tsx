import { useState, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calculator, ChevronDown, Zap, Flame, Droplets, Car, Waves, ThermometerSun, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductType } from "@/lib/productTypes";
import { useEstimateurData } from "@/hooks/useEstimateurData";

// ══════════════════════════════════════════════════════════════════════
// STATIC LABELS (not data-dependent)
// ══════════════════════════════════════════════════════════════════════

type EnergyType = "elec" | "gaz" | "fioul" | "bois" | "propane";

const HEATING_TYPES = [
  { value: "electrique", label: "Électrique (convecteurs)", energy: "elec" as EnergyType },
  { value: "gaz", label: "Gaz naturel", energy: "gaz" as EnergyType },
  { value: "fioul", label: "Fioul", energy: "fioul" as EnergyType },
  { value: "pac_air_air", label: "PAC Air/Air", energy: "elec" as EnergyType },
  { value: "pac_air_eau", label: "PAC Air/Eau", energy: "elec" as EnergyType },
  { value: "pac_eau_eau", label: "PAC Eau/Eau", energy: "elec" as EnergyType },
  { value: "bois", label: "Bois / Granulés", energy: "bois" as EnergyType },
  { value: "propane", label: "Propane / GPL", energy: "propane" as EnergyType },
];

const HEATING_ENERGY_MAP: Record<string, EnergyType> = Object.fromEntries(
  HEATING_TYPES.map(h => [h.value, h.energy])
) as Record<string, EnergyType>;

const HEATING_LABEL_MAP: Record<string, string> = Object.fromEntries(
  HEATING_TYPES.map(h => [h.value, h.label])
);

// Map DB energy type names to our internal key
const DB_ENERGY_TO_KEY: Record<string, EnergyType> = {
  electricite: "elec",
  gaz_naturel: "gaz",
  fioul: "fioul",
  bois_buche: "bois",
  granules: "bois",
  propane: "propane",
};

// ── Appliance definitions (icons & fields, calculation uses DB coefficients) ──
interface ApplianceDetailField {
  key: string;
  label: string;
  unit: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

interface ApplianceDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  detailFields: ApplianceDetailField[];
}

const PISCINE_MODES = [
  { value: "chauffee_filtree", label: "Chauffée + Filtrée" },
  { value: "filtree_seule", label: "Filtrée uniquement" },
];

const APPLIANCE_DEFS: ApplianceDef[] = [
  {
    id: "piscine",
    label: "Piscine",
    icon: <Waves className="h-3.5 w-3.5" />,
    detailFields: [
      { key: "count", label: "Nombre", unit: "", defaultValue: 1, min: 1, max: 3 },
      { key: "volume_m3", label: "Volume", unit: "m³", defaultValue: 50, min: 10, max: 200 },
    ],
  },
  {
    id: "jacuzzi",
    label: "Jacuzzi / Spa",
    icon: <Droplets className="h-3.5 w-3.5" />,
    detailFields: [
      { key: "count", label: "Nombre", unit: "", defaultValue: 1, min: 1, max: 3 },
      { key: "puissance_kw", label: "Puissance", unit: "kW", defaultValue: 3, min: 1, max: 10, step: 0.5 },
    ],
  },
  {
    id: "sauna",
    label: "Sauna",
    icon: <ThermometerSun className="h-3.5 w-3.5" />,
    detailFields: [
      { key: "count", label: "Nombre", unit: "", defaultValue: 1, min: 1, max: 2 },
      { key: "puissance_kw", label: "Puissance", unit: "kW", defaultValue: 6, min: 3, max: 12, step: 1 },
    ],
  },
  {
    id: "voiture_elec",
    label: "Voiture électrique",
    icon: <Car className="h-3.5 w-3.5" />,
    detailFields: [
      { key: "count", label: "Nombre", unit: "", defaultValue: 1, min: 1, max: 4 },
      { key: "km_an", label: "Distance/an", unit: "km", defaultValue: 15000, min: 1000, max: 60000, step: 1000 },
    ],
  },
  {
    id: "climatisation",
    label: "Climatisation",
    icon: <ThermometerSun className="h-3.5 w-3.5" />,
    detailFields: [
      { key: "count", label: "Nb unités", unit: "", defaultValue: 2, min: 1, max: 8 },
      { key: "puissance_kw", label: "Puissance", unit: "kW", defaultValue: 2.5, min: 1, max: 7, step: 0.5 },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════

interface HeatingZone {
  id: string;
  type: string;
  surface: number | "";
}

interface ApplianceConfig {
  id: string;
  details: Record<string, number>;
}

export interface EstimationDetails {
  isolation: string;
  occupants: number;
  heatingZones: { type: string; label: string; surface: number; kwh: number }[];
  ecsType: string;
  ecsKwh: number;
  baseElecKwh: number;
  appliances: { label: string; kwh: number }[];
  totalElecKwh: number;
  totalCombustibleKwh: number;
  factureElecMois: number;
  factureCombustibleMois: number;
}

interface ConsumptionEstimatorProps {
  productType: ProductType;
  onApply: (result: {
    consoElecKwh: number;
    factureMensuelleElec: number;
    consoChaufffageKwh?: number;
    factureChaufMensuelle?: number;
    estimationDetails?: EstimationDetails;
  }) => void;
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════

export const ConsumptionEstimator = ({ productType, onApply }: ConsumptionEstimatorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isLoading, isolationLevels, prixEnergies, copBySubtype, coefficients } = useEstimateurData();

  // State
  const [isolation, setIsolation] = useState("moyen");
  const [heatingZones, setHeatingZones] = useState<HeatingZone[]>([
    { id: "1", type: "electrique", surface: 100 },
  ]);
  const [ecsType, setEcsType] = useState("electrique");
  const [occupants, setOccupants] = useState<number | "">(3);
  const [appliances, setAppliances] = useState<ApplianceConfig[]>([]);
  const [customPrices, setCustomPrices] = useState<Record<string, number | "">>({});

  const zonesTotal = useMemo(
    () => heatingZones.reduce((sum, z) => sum + (Number(z.surface) || 0), 0),
    [heatingZones]
  );

  // ── Zone management ──
  const addZone = useCallback(() => {
    setHeatingZones(prev => [...prev, { id: String(Date.now()), type: "electrique", surface: "" }]);
  }, []);

  const removeZone = useCallback((id: string) => {
    setHeatingZones(prev => prev.length > 1 ? prev.filter(z => z.id !== id) : prev);
  }, []);

  const updateZone = useCallback((id: string, field: "type" | "surface", value: string | number) => {
    setHeatingZones(prev => prev.map(z => z.id === id ? { ...z, [field]: value } : z));
  }, []);

  // ── Appliance management ──
  const toggleAppliance = useCallback((defId: string) => {
    setAppliances(prev => {
      const exists = prev.find(a => a.id === defId);
      if (exists) return prev.filter(a => a.id !== defId);
      const def = APPLIANCE_DEFS.find(d => d.id === defId);
      if (!def) return prev;
      const details: Record<string, number> = {};
      def.detailFields.forEach(f => { details[f.key] = f.defaultValue; });
      return [...prev, { id: defId, details }];
    });
  }, []);

  const updateApplianceDetail = useCallback((defId: string, key: string, value: number) => {
    setAppliances(prev =>
      prev.map(a => a.id === defId ? { ...a, details: { ...a.details, [key]: value } } : a)
    );
  }, []);

  // ── Appliance kWh calculation using DB coefficients ──
  const calcApplianceKwh = useCallback((id: string, details: Record<string, number>): number => {
    const count = details.count || 1;
    switch (id) {
      case "piscine": {
        const mode = details.mode || 0; // 0 = chauffee_filtree, 1 = filtree_seule
        // Chauffée + filtrée : ~90 kWh/m³/an (chauffage + pompe filtration)
        // Filtrée uniquement : ~45 kWh/m³/an (pompe filtration seule)
        const kwhPerM3Heated = coefficients.piscine_kwh_m3 || 90;
        const kwhPerM3FilterOnly = coefficients.piscine_filtree_kwh_m3 || 45;
        const kwhPerM3 = mode === 1 ? kwhPerM3FilterOnly : kwhPerM3Heated;
        return Math.round((details.volume_m3 || 50) * kwhPerM3 * count);
      }
      case "jacuzzi": {
        const baseKwh = coefficients.jacuzzi_base_kwh || 2500;
        const pw = details.puissance_kw || 3;
        return Math.round(baseKwh * (pw / 3) * count);
      }
      case "sauna": {
        const sessions = coefficients.sauna_sessions_semaine || 3;
        const duree = coefficients.sauna_duree_h || 1;
        const pw = details.puissance_kw || 6;
        return Math.round(pw * sessions * duree * 52 * count);
      }
      case "voiture_elec": {
        const kwhPer100 = coefficients.ve_kwh_100km || 18;
        const pertePct = (coefficients.ve_perte_charge_pct || 10) / 100;
        const km = details.km_an || 15000;
        return Math.round(km * (kwhPer100 / 100) * (1 + pertePct) * count);
      }
      case "climatisation": {
        const heures = coefficients.clim_heures_an || 600;
        const seer = coefficients.clim_seer || 4;
        const pw = details.puissance_kw || 2.5;
        return Math.round((pw / seer) * heures * count);
      }
      default: return 0;
    }
  }, [coefficients]);

  // ══════════════════════════════════════════════════════════════════
  // CALCULATION (using DB data)
  // ══════════════════════════════════════════════════════════════════

  const estimation = useMemo(() => {
    const occ = Number(occupants) || 1;

    // Isolation: get besoins_kwh_m2 from DB
    const isoData = isolationLevels.find(l => l.value === isolation);
    const besoinsKwhM2 = isoData?.besoins_kwh_m2 || 120;

    // ECS from DB coefficients
    const ecsCodeMap: Record<string, string> = {
      electrique: "ecs_electrique",
      gaz: "ecs_gaz",
      fioul: "ecs_fioul",
      thermodynamique: "ecs_thermodynamique",
      propane: "ecs_propane",
    };
    const ecsPerPerson = coefficients[ecsCodeMap[ecsType] || "ecs_electrique"] || 800;

    // Base electricity from DB
    const baseElecPerPerson = coefficients.base_elec_personne || 1100;

    // Energy prices from DB
    const getPrix = (energy: EnergyType): number => {
      const dbKeyMap: Record<EnergyType, string> = {
        elec: "electricite",
        gaz: "gaz_naturel",
        fioul: "fioul",
        bois: "bois_buche",
        propane: "propane",
      };
      const dbKey = dbKeyMap[energy];
      // Use custom price if set, otherwise fall back to DB
      if (customPrices[energy] !== undefined && customPrices[energy] !== "") {
        return Number(customPrices[energy]);
      }
      return prixEnergies[dbKey] || 0.20;
    };

    // ── Heating by zone ──
    let totalElecChauffage = 0;
    let totalCombustibleChauffage = 0;
    const zoneDetails: { type: string; kwh: number; energy: EnergyType }[] = [];

    heatingZones.forEach(zone => {
      const s = Number(zone.surface) || 0;
      const energy = HEATING_ENERGY_MAP[zone.type] || "elec";

      // Base heating needs from isolation level
      let heatingKwh = besoinsKwhM2 * s;

      // For PAC: divide by COP (from DB) to get electrical consumption
      if (zone.type.startsWith("pac_")) {
        const pacSubtype = zone.type.replace("pac_", "") as "air_air" | "air_eau";
        const cop = copBySubtype[pacSubtype] || 3.5;
        heatingKwh = heatingKwh / cop;
      }

      const kwh = Math.round(heatingKwh);
      zoneDetails.push({ type: zone.type, kwh, energy });

      if (energy === "elec") totalElecChauffage += kwh;
      else totalCombustibleChauffage += kwh;
    });

    // ── ECS ──
    const ecsKwh = ecsPerPerson * occ;
    const ecsEnergy: EnergyType = ecsType === "thermodynamique" ? "elec" : (HEATING_ENERGY_MAP[ecsType] || "elec");

    // ── Base electricity ──
    const baseElecKwh = baseElecPerPerson * occ;

    // ── Appliances ──
    let appliancesKwh = 0;
    const applianceBreakdown: { label: string; kwh: number }[] = [];
    appliances.forEach(cfg => {
      const def = APPLIANCE_DEFS.find(d => d.id === cfg.id);
      if (!def) return;
      const kwh = calcApplianceKwh(cfg.id, cfg.details);
      appliancesKwh += kwh;
      applianceBreakdown.push({ label: def.label, kwh });
    });

    // ── Totals ──
    let elecKwh = baseElecKwh + appliancesKwh + totalElecChauffage;
    let combustibleKwh = totalCombustibleChauffage;
    if (ecsEnergy === "elec") elecKwh += ecsKwh;
    else combustibleKwh += ecsKwh;

    const mainCombustibleEnergy = zoneDetails.find(z => z.energy !== "elec")?.energy || "gaz";

    const factureElecAn = elecKwh * getPrix("elec");
    const factureCombustibleAn = combustibleKwh * getPrix(mainCombustibleEnergy);
    const totalChauffageKwh = totalElecChauffage + totalCombustibleChauffage;

    return {
      elecKwh: Math.round(elecKwh),
      combustibleKwh: Math.round(combustibleKwh),
      factureElecMois: Math.round(factureElecAn / 12),
      factureCombustibleMois: Math.round(factureCombustibleAn / 12),
      totalChauffageKwh: Math.round(totalChauffageKwh),
      ecsKwh: Math.round(ecsKwh),
      baseKwh: Math.round(baseElecKwh),
      appliancesKwh: Math.round(appliancesKwh),
      applianceBreakdown,
      zoneDetails,
      mainCombustibleEnergy,
      getPrix,
    };
  }, [heatingZones, occupants, isolation, ecsType, appliances, isolationLevels, prixEnergies, copBySubtype, coefficients, calcApplianceKwh, customPrices]);

  const handleApply = () => {
    if (productType === "PV") {
      onApply({
        consoElecKwh: estimation.elecKwh,
        factureMensuelleElec: estimation.factureElecMois,
      });
    } else if (productType === "PAC") {
      onApply({
        consoElecKwh: estimation.elecKwh,
        factureMensuelleElec: estimation.factureElecMois,
        consoChaufffageKwh: estimation.combustibleKwh || estimation.totalChauffageKwh,
        factureChaufMensuelle: estimation.factureCombustibleMois || estimation.factureElecMois,
      });
    } else {
      onApply({
        consoElecKwh: estimation.elecKwh,
        factureMensuelleElec: estimation.factureElecMois,
        consoChaufffageKwh: estimation.totalChauffageKwh,
        factureChaufMensuelle: estimation.factureCombustibleMois || Math.round((estimation.totalChauffageKwh * estimation.getPrix("elec")) / 12),
      });
    }
    setIsOpen(false);
  };

  const relevantLabel = productType === "PV" ? "électrique"
    : productType === "PAC" ? "chauffage"
    : "combinée";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-dashed transition-colors text-left",
            isOpen
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calculator className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground truncate">
              Estimer la consommation {relevantLabel}
            </span>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-xs text-muted-foreground">Chargement des données...</span>
          </div>
        ) : (
          <>
            {/* ── Isolation (from data_pac_isolation) ── */}
            <div>
              <Label className="text-[10px] sm:text-xs">Niveau d'isolation</Label>
              <Select value={isolation} onValueChange={setIsolation}>
                <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isolationLevels.map(l => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label} ({l.besoins_kwh_m2} kWh/m²)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Heating zones ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] sm:text-xs">Zones de chauffage</Label>
                <button type="button" onClick={addZone} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
                  <Plus className="h-3 w-3" /> Ajouter
                </button>
              </div>
              {heatingZones.map((zone, idx) => (
                <div key={zone.id} className="flex items-end gap-1.5 bg-muted/30 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <Label className="text-[9px] text-muted-foreground">Type {idx + 1}</Label>
                    <Select value={zone.type} onValueChange={v => updateZone(zone.id, "type", v)}>
                      <SelectTrigger className="h-7 sm:h-8 text-[10px] sm:text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {HEATING_TYPES.map(h => (
                          <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 shrink-0">
                    <Label className="text-[9px] text-muted-foreground">Surface</Label>
                    <div className="flex items-center gap-0.5">
                      <Input
                        type="number"
                        value={zone.surface}
                        onChange={e => updateZone(zone.id, "surface", e.target.value ? Number(e.target.value) : "")}
                        className="h-7 sm:h-8 text-[10px] sm:text-xs px-1.5"
                        placeholder="m²"
                      />
                      <span className="text-[9px] text-muted-foreground">m²</span>
                    </div>
                  </div>
                  {heatingZones.length > 1 && (
                    <button type="button" onClick={() => removeZone(zone.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {zonesTotal > 0 && (
                <p className="text-[9px] text-muted-foreground text-right">Total couvert: {zonesTotal} m²</p>
              )}
            </div>

            {/* ── ECS + Occupants ── */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] sm:text-xs">Eau chaude</Label>
                <Select value={ecsType} onValueChange={setEcsType}>
                  <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electrique">Électrique</SelectItem>
                    <SelectItem value="gaz">Gaz</SelectItem>
                    <SelectItem value="fioul">Fioul</SelectItem>
                    <SelectItem value="thermodynamique">Thermodynamique</SelectItem>
                    <SelectItem value="propane">Propane</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[10px] sm:text-xs">Nb occupants</Label>
                <Input
                  type="number" min={1} max={12}
                  value={occupants}
                  onChange={e => setOccupants(e.target.value ? Number(e.target.value) : "")}
                  className="h-8 sm:h-9 text-xs sm:text-sm" placeholder="3"
                />
              </div>
            </div>

            {/* ── Custom energy prices ── */}
            <div className="space-y-1.5">
              <Label className="text-[10px] sm:text-xs block">Prix de l'énergie du client <span className="text-muted-foreground font-normal">(laisser vide = prix par défaut)</span></Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {(() => {
                  // Determine which energy types are used
                  const usedEnergies = new Set<EnergyType>();
                  usedEnergies.add("elec"); // always show electricity
                  heatingZones.forEach(z => {
                    const e = HEATING_ENERGY_MAP[z.type];
                    if (e) usedEnergies.add(e);
                  });
                  const ecsEnergy: EnergyType = ecsType === "thermodynamique" ? "elec" : (HEATING_ENERGY_MAP[ecsType] || "elec");
                  usedEnergies.add(ecsEnergy);

                  const labels: Record<EnergyType, string> = {
                    elec: "Électricité",
                    gaz: "Gaz naturel",
                    fioul: "Fioul",
                    bois: "Bois",
                    propane: "Propane",
                  };
                  const dbKeyMap: Record<EnergyType, string> = {
                    elec: "electricite",
                    gaz: "gaz_naturel",
                    fioul: "fioul",
                    bois: "bois_buche",
                    propane: "propane",
                  };

                  return Array.from(usedEnergies).map(energy => {
                    const defaultPrice = prixEnergies[dbKeyMap[energy]] || 0;
                    return (
                      <div key={energy}>
                        <Label className="text-[9px] text-muted-foreground">{labels[energy]} (€/kWh)</Label>
                        <Input
                          type="number"
                          step="0.001"
                          min={0}
                          placeholder={defaultPrice ? `${defaultPrice.toFixed(4)}` : "0.2000"}
                          value={customPrices[energy] ?? ""}
                          onChange={e => setCustomPrices(prev => ({
                            ...prev,
                            [energy]: e.target.value ? parseFloat(e.target.value) : "",
                          }))}
                          className="h-7 sm:h-8 text-[10px] sm:text-xs"
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* ── Appliances ── */}
            <div className="space-y-2">
              <Label className="text-[10px] sm:text-xs block">Équipements énergivores</Label>
              <div className="flex flex-wrap gap-1.5">
                {APPLIANCE_DEFS.map(def => {
                  const active = appliances.some(a => a.id === def.id);
                  return (
                    <button
                      key={def.id} type="button" onClick={() => toggleAppliance(def.id)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] sm:text-xs transition-colors",
                        active
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "border-muted-foreground/20 text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {def.icon} {def.label}
                    </button>
                  );
                })}
              </div>

              {appliances.map(cfg => {
                const def = APPLIANCE_DEFS.find(d => d.id === cfg.id);
                if (!def) return null;
                const kwh = calcApplianceKwh(cfg.id, cfg.details);
                return (
                  <div key={cfg.id} className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs font-medium text-foreground flex items-center gap-1">
                        {def.icon} {def.label}
                      </span>
                      <span className="text-[10px] font-semibold text-primary">{kwh.toLocaleString("fr-FR")} kWh/an</span>
                    </div>
                    {/* Piscine mode selector */}
                    {cfg.id === "piscine" && (
                      <div>
                        <Label className="text-[9px] text-muted-foreground">Mode</Label>
                        <Select
                          value={cfg.details.mode === 1 ? "filtree_seule" : "chauffee_filtree"}
                          onValueChange={v => updateApplianceDetail(cfg.id, "mode", v === "filtree_seule" ? 1 : 0)}
                        >
                          <SelectTrigger className="h-6 sm:h-7 text-[10px] sm:text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PISCINE_MODES.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-1.5">
                      {def.detailFields.map(field => (
                        <div key={field.key}>
                          <Label className="text-[9px] text-muted-foreground">{field.label}</Label>
                          <div className="flex items-center gap-0.5">
                            <Input
                              type="number" min={field.min} max={field.max} step={field.step || 1}
                              value={cfg.details[field.key] ?? field.defaultValue}
                              onChange={e => updateApplianceDetail(cfg.id, field.key, Number(e.target.value) || 0)}
                              className="h-6 sm:h-7 text-[10px] px-1.5"
                            />
                            {field.unit && <span className="text-[9px] text-muted-foreground shrink-0">{field.unit}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Results ── */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <p className="text-[10px] sm:text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Estimation prévisionnelle
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] sm:text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Électricité</span>
                  <span className="font-semibold">{estimation.elecKwh.toLocaleString("fr-FR")} kWh/an</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Facture élec.</span>
                  <span className="font-semibold text-primary">{estimation.factureElecMois} €/mois</span>
                </div>
                {estimation.combustibleKwh > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Flame className="h-3 w-3" /> Combustible
                      </span>
                      <span className="font-semibold">{estimation.combustibleKwh.toLocaleString("fr-FR")} kWh/an</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Facture combust.</span>
                      <span className="font-semibold text-destructive">{estimation.factureCombustibleMois} €/mois</span>
                    </div>
                  </>
                )}
              </div>

              {/* Breakdown */}
              <div className="pt-1.5 border-t border-muted-foreground/10 space-y-0.5 text-[9px] sm:text-[10px] text-muted-foreground">
                <div className="grid grid-cols-2 gap-x-4">
                  <span>Chauffage: {estimation.totalChauffageKwh.toLocaleString("fr-FR")} kWh</span>
                  <span>ECS: {estimation.ecsKwh.toLocaleString("fr-FR")} kWh</span>
                  <span>Base élec: {estimation.baseKwh.toLocaleString("fr-FR")} kWh</span>
                  {estimation.appliancesKwh > 0 && (
                    <span>Équipements: {estimation.appliancesKwh.toLocaleString("fr-FR")} kWh</span>
                  )}
                </div>
                {estimation.zoneDetails.length > 1 && (
                  <div className="pt-1 mt-1 border-t border-muted-foreground/5">
                    {estimation.zoneDetails.map((z, i) => (
                      <span key={i} className="block">
                        Zone {i + 1} ({HEATING_LABEL_MAP[z.type] || z.type}): {z.kwh.toLocaleString("fr-FR")} kWh
                      </span>
                    ))}
                  </div>
                )}
                {estimation.applianceBreakdown.length > 0 && (
                  <div className="pt-1 mt-1 border-t border-muted-foreground/5">
                    {estimation.applianceBreakdown.map((a, i) => (
                      <span key={i} className="block">{a.label}: {a.kwh.toLocaleString("fr-FR")} kWh</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Apply */}
            <Button type="button" size="sm" className="w-full gap-2" onClick={handleApply}>
              <Check className="h-4 w-4" />
              Appliquer l'estimation
            </Button>
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};
