import { useState, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calculator, ChevronDown, Zap, Flame, Droplets, Car, Waves, ThermometerSun, Plus, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductType } from "@/lib/productTypes";

// ══════════════════════════════════════════════════════════════════════
// COEFFICIENTS & DATA
// ══════════════════════════════════════════════════════════════════════

type EnergyType = "elec" | "gaz" | "fioul" | "bois" | "propane";

interface HeatingDef {
  label: string;
  kwh_m2_by_isolation: Record<string, number>;
  energy: EnergyType;
}

const ISOLATION_LEVELS = [
  { value: "tres_mauvaise", label: "Très mauvaise (avant 1975)", factor: 1.4 },
  { value: "mauvaise", label: "Mauvaise (1975-1990)", factor: 1.2 },
  { value: "moyenne", label: "Moyenne (1990-2005)", factor: 1.0 },
  { value: "bonne", label: "Bonne (2005-2012)", factor: 0.8 },
  { value: "tres_bonne", label: "Très bonne (RT2012+)", factor: 0.6 },
];

const BASE_KWH_M2: Record<string, number> = {
  electrique: 110,
  gaz: 130,
  fioul: 150,
  pac_air_air: 40,
  pac_air_eau: 45,
  pac_eau_eau: 35,
  bois: 120,
  propane: 140,
};

const HEATING_ENERGY: Record<string, EnergyType> = {
  electrique: "elec",
  gaz: "gaz",
  fioul: "fioul",
  pac_air_air: "elec",
  pac_air_eau: "elec",
  pac_eau_eau: "elec",
  bois: "bois",
  propane: "propane",
};

const HEATING_LABELS: Record<string, string> = {
  electrique: "Électrique (convecteurs)",
  gaz: "Gaz naturel",
  fioul: "Fioul",
  pac_air_air: "PAC Air/Air",
  pac_air_eau: "PAC Air/Eau",
  pac_eau_eau: "PAC Eau/Eau",
  bois: "Bois / Granulés",
  propane: "Propane / GPL",
};

const ECS_PER_PERSON_KWH: Record<string, number> = {
  electrique: 800,
  gaz: 900,
  fioul: 950,
  thermodynamique: 400,
  bois: 0,
  propane: 900,
};

const BASE_ELEC_PER_PERSON_KWH = 1100;

const PRIX_ENERGIE: Record<EnergyType, number> = {
  elec: 0.2516,
  gaz: 0.1284,
  fioul: 0.118,
  bois: 0.065,
  propane: 0.178,
};

// ── Appliances with configurable details ──
interface ApplianceDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  unit: string;
  detailFields: ApplianceDetailField[];
  calcKwh: (details: Record<string, number>) => number;
}

interface ApplianceDetailField {
  key: string;
  label: string;
  unit: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

const APPLIANCE_DEFS: ApplianceDef[] = [
  {
    id: "piscine",
    label: "Piscine",
    icon: <Waves className="h-3.5 w-3.5" />,
    unit: "kWh/an",
    detailFields: [
      { key: "count", label: "Nombre", unit: "", defaultValue: 1, min: 1, max: 3 },
      { key: "volume_m3", label: "Volume", unit: "m³", defaultValue: 50, min: 10, max: 200 },
      { key: "puissance_kw", label: "Pompe", unit: "kW", defaultValue: 1.5, min: 0.5, max: 5, step: 0.5 },
    ],
    calcKwh: (d) => {
      // ~90 kWh/m³/an (filtration + chauffage) × volume × count
      const count = d.count || 1;
      const vol = d.volume_m3 || 50;
      return Math.round(vol * 90 * count);
    },
  },
  {
    id: "jacuzzi",
    label: "Jacuzzi / Spa",
    icon: <Droplets className="h-3.5 w-3.5" />,
    unit: "kWh/an",
    detailFields: [
      { key: "count", label: "Nombre", unit: "", defaultValue: 1, min: 1, max: 3 },
      { key: "puissance_kw", label: "Puissance", unit: "kW", defaultValue: 3, min: 1, max: 10, step: 0.5 },
    ],
    calcKwh: (d) => {
      // ~2500 kWh base, scaled by power relative to 3kW
      const count = d.count || 1;
      const pw = d.puissance_kw || 3;
      return Math.round(2500 * (pw / 3) * count);
    },
  },
  {
    id: "sauna",
    label: "Sauna",
    icon: <ThermometerSun className="h-3.5 w-3.5" />,
    unit: "kWh/an",
    detailFields: [
      { key: "count", label: "Nombre", unit: "", defaultValue: 1, min: 1, max: 2 },
      { key: "puissance_kw", label: "Puissance", unit: "kW", defaultValue: 6, min: 3, max: 12, step: 1 },
    ],
    calcKwh: (d) => {
      // ~3 sessions/semaine, 1h, × puissance
      const count = d.count || 1;
      const pw = d.puissance_kw || 6;
      return Math.round(pw * 3 * 52 * count);
    },
  },
  {
    id: "voiture_elec",
    label: "Voiture électrique",
    icon: <Car className="h-3.5 w-3.5" />,
    unit: "kWh/an",
    detailFields: [
      { key: "count", label: "Nombre", unit: "", defaultValue: 1, min: 1, max: 4 },
      { key: "km_an", label: "Distance/an", unit: "km", defaultValue: 15000, min: 1000, max: 60000, step: 1000 },
    ],
    calcKwh: (d) => {
      // ~18 kWh/100km (average EV) + 10% charging losses
      const count = d.count || 1;
      const km = d.km_an || 15000;
      return Math.round(km * 0.18 * 1.1 * count);
    },
  },
  {
    id: "climatisation",
    label: "Climatisation",
    icon: <ThermometerSun className="h-3.5 w-3.5" />,
    unit: "kWh/an",
    detailFields: [
      { key: "count", label: "Nb unités", unit: "", defaultValue: 2, min: 1, max: 8 },
      { key: "puissance_kw", label: "Puissance", unit: "kW", defaultValue: 2.5, min: 1, max: 7, step: 0.5 },
    ],
    calcKwh: (d) => {
      // ~600h/an de fonctionnement, SEER ~4
      const count = d.count || 2;
      const pw = d.puissance_kw || 2.5;
      return Math.round((pw / 4) * 600 * count);
    },
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
  id: string; // appliance def id
  details: Record<string, number>;
}

interface ConsumptionEstimatorProps {
  productType: ProductType;
  onApply: (result: {
    consoElecKwh: number;
    factureMensuelleElec: number;
    consoChaufffageKwh?: number;
    factureChaufMensuelle?: number;
  }) => void;
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════

export const ConsumptionEstimator = ({ productType, onApply }: ConsumptionEstimatorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Isolation
  const [isolation, setIsolation] = useState("moyenne");

  // Multiple heating zones
  const [heatingZones, setHeatingZones] = useState<HeatingZone[]>([
    { id: "1", type: "electrique", surface: 100 },
  ]);

  // ECS & occupants
  const [ecsType, setEcsType] = useState("electrique");
  const [totalSurface, setTotalSurface] = useState<number | "">(100);
  const [occupants, setOccupants] = useState<number | "">(3);

  // Appliances with details
  const [appliances, setAppliances] = useState<ApplianceConfig[]>([]);

  // Sync total surface when zones change
  const zonesTotal = useMemo(
    () => heatingZones.reduce((sum, z) => sum + (Number(z.surface) || 0), 0),
    [heatingZones]
  );

  // ── Zone management ──
  const addZone = useCallback(() => {
    setHeatingZones(prev => [
      ...prev,
      { id: String(Date.now()), type: "electrique", surface: "" },
    ]);
  }, []);

  const removeZone = useCallback((id: string) => {
    setHeatingZones(prev => prev.length > 1 ? prev.filter(z => z.id !== id) : prev);
  }, []);

  const updateZone = useCallback((id: string, field: "type" | "surface", value: string | number) => {
    setHeatingZones(prev =>
      prev.map(z => z.id === id ? { ...z, [field]: value } : z)
    );
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

  // ══════════════════════════════════════════════════════════════════
  // CALCULATION
  // ══════════════════════════════════════════════════════════════════

  const estimation = useMemo(() => {
    const occ = Number(occupants) || 1;
    const isoFactor = ISOLATION_LEVELS.find(l => l.value === isolation)?.factor || 1.0;
    const ecsPerPerson = ECS_PER_PERSON_KWH[ecsType] || 800;

    // ── Heating by zone ──
    let totalElecChauffage = 0;
    let totalCombustibleChauffage = 0;
    const zoneDetails: { type: string; kwh: number; energy: EnergyType }[] = [];

    heatingZones.forEach(zone => {
      const s = Number(zone.surface) || 0;
      const baseKwh = BASE_KWH_M2[zone.type] || 110;
      const energy = HEATING_ENERGY[zone.type] || "elec";
      const kwh = Math.round(baseKwh * s * isoFactor);

      zoneDetails.push({ type: zone.type, kwh, energy });
      if (energy === "elec") totalElecChauffage += kwh;
      else totalCombustibleChauffage += kwh;
    });

    // ── ECS ──
    const ecsKwh = ecsPerPerson * occ;
    const ecsEnergy: EnergyType = ecsType === "thermodynamique" ? "elec" : (HEATING_ENERGY[ecsType] || "elec");

    // ── Base electricity ──
    const baseElecKwh = BASE_ELEC_PER_PERSON_KWH * occ;

    // ── Appliances ──
    let appliancesKwh = 0;
    const applianceBreakdown: { label: string; kwh: number }[] = [];
    appliances.forEach(cfg => {
      const def = APPLIANCE_DEFS.find(d => d.id === cfg.id);
      if (!def) return;
      const kwh = def.calcKwh(cfg.details);
      appliancesKwh += kwh;
      applianceBreakdown.push({ label: def.label, kwh });
    });

    // ── Totals ──
    let elecKwh = baseElecKwh + appliancesKwh + totalElecChauffage;
    let combustibleKwh = totalCombustibleChauffage;
    if (ecsEnergy === "elec") elecKwh += ecsKwh;
    else combustibleKwh += ecsKwh;

    // Determine main combustible energy type for pricing
    const mainCombustibleEnergy = zoneDetails.find(z => z.energy !== "elec")?.energy || "gaz";

    const factureElecAn = elecKwh * PRIX_ENERGIE.elec;
    const factureCombustibleAn = combustibleKwh * PRIX_ENERGIE[mainCombustibleEnergy];

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
    };
  }, [heatingZones, occupants, isolation, ecsType, appliances]);

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
        factureChaufMensuelle: estimation.factureCombustibleMois || Math.round((estimation.totalChauffageKwh * PRIX_ENERGIE.elec) / 12),
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

        {/* ── Isolation ── */}
        <div>
          <Label className="text-[10px] sm:text-xs">Niveau d'isolation</Label>
          <Select value={isolation} onValueChange={setIsolation}>
            <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ISOLATION_LEVELS.map(l => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Heating zones (multi) ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] sm:text-xs">Zones de chauffage</Label>
            <button
              type="button"
              onClick={addZone}
              className="flex items-center gap-1 text-[10px] text-primary hover:underline"
            >
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
                    {Object.entries(HEATING_LABELS).map(([val, lab]) => (
                      <SelectItem key={val} value={val}>{lab}</SelectItem>
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
            <p className="text-[9px] text-muted-foreground text-right">
              Total couvert: {zonesTotal} m²
            </p>
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
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] sm:text-xs">Nb occupants</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={occupants}
              onChange={e => setOccupants(e.target.value ? Number(e.target.value) : "")}
              className="h-8 sm:h-9 text-xs sm:text-sm"
              placeholder="3"
            />
          </div>
        </div>

        {/* ── Appliances (toggle + detail fields) ── */}
        <div className="space-y-2">
          <Label className="text-[10px] sm:text-xs block">Équipements énergivores</Label>
          <div className="flex flex-wrap gap-1.5">
            {APPLIANCE_DEFS.map(def => {
              const active = appliances.some(a => a.id === def.id);
              return (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => toggleAppliance(def.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] sm:text-xs transition-colors",
                    active
                      ? "bg-primary/10 border-primary text-primary font-medium"
                      : "border-muted-foreground/20 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {def.icon}
                  {def.label}
                </button>
              );
            })}
          </div>

          {/* Detail fields for selected appliances */}
          {appliances.map(cfg => {
            const def = APPLIANCE_DEFS.find(d => d.id === cfg.id);
            if (!def) return null;
            const kwh = def.calcKwh(cfg.details);
            return (
              <div key={cfg.id} className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-medium text-foreground flex items-center gap-1">
                    {def.icon} {def.label}
                  </span>
                  <span className="text-[10px] font-semibold text-primary">{kwh.toLocaleString("fr-FR")} kWh/an</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {def.detailFields.map(field => (
                    <div key={field.key}>
                      <Label className="text-[9px] text-muted-foreground">{field.label}</Label>
                      <div className="flex items-center gap-0.5">
                        <Input
                          type="number"
                          min={field.min}
                          max={field.max}
                          step={field.step || 1}
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
                    <Flame className="h-3 w-3" />
                    Combustible
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
            {/* Per-zone breakdown */}
            {estimation.zoneDetails.length > 1 && (
              <div className="pt-1 mt-1 border-t border-muted-foreground/5">
                {estimation.zoneDetails.map((z, i) => (
                  <span key={i} className="block">
                    Zone {i + 1} ({HEATING_LABELS[z.type] || z.type}): {z.kwh.toLocaleString("fr-FR")} kWh
                  </span>
                ))}
              </div>
            )}
            {/* Per-appliance breakdown */}
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
      </CollapsibleContent>
    </Collapsible>
  );
};
