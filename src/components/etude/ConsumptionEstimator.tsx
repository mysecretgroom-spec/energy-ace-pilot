import { useState, useMemo, useCallback } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, ChevronDown, Zap, Flame, Droplets, Car, Waves, ThermometerSun } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProductType } from "@/lib/productTypes";

// ── Consumption coefficients (simplified EDF-equivalent model) ──────────
const HEATING_COEFFICIENTS: Record<string, { kwh_m2: number; energy: "elec" | "gaz" | "fioul" | "bois" | "propane" }> = {
  electrique: { kwh_m2: 110, energy: "elec" },
  gaz: { kwh_m2: 130, energy: "gaz" },
  fioul: { kwh_m2: 150, energy: "fioul" },
  pompe_chaleur: { kwh_m2: 50, energy: "elec" },
  bois: { kwh_m2: 120, energy: "bois" },
  propane: { kwh_m2: 140, energy: "propane" },
};

const ECS_PER_PERSON_KWH: Record<string, number> = {
  electrique: 800,
  gaz: 900,
  fioul: 950,
  pompe_chaleur: 400,
  bois: 0,
  propane: 900,
};

const BASE_ELEC_PER_PERSON_KWH = 1100; // Éclairage, électroménager, cuisson, etc.

interface EnergyAppliance {
  id: string;
  label: string;
  icon: React.ReactNode;
  kwh_an: number;
}

const ENERGY_APPLIANCES: EnergyAppliance[] = [
  { id: "piscine", label: "Piscine", icon: <Waves className="h-3.5 w-3.5" />, kwh_an: 4500 },
  { id: "jacuzzi", label: "Jacuzzi / Spa", icon: <Droplets className="h-3.5 w-3.5" />, kwh_an: 2500 },
  { id: "sauna", label: "Sauna", icon: <ThermometerSun className="h-3.5 w-3.5" />, kwh_an: 3000 },
  { id: "voiture_elec", label: "Voiture électrique", icon: <Car className="h-3.5 w-3.5" />, kwh_an: 3500 },
  { id: "climatisation", label: "Climatisation", icon: <ThermometerSun className="h-3.5 w-3.5" />, kwh_an: 2000 },
];

const PRIX_ENERGIE: Record<string, number> = {
  elec: 0.2516,
  gaz: 0.1284,
  fioul: 0.118,
  bois: 0.065,
  propane: 0.178,
};

interface ConsumptionEstimatorProps {
  productType: ProductType;
  onApply: (result: {
    consoElecKwh: number;
    factureMensuelleElec: number;
    consoChaufffageKwh?: number;
    factureChaufMensuelle?: number;
  }) => void;
}

export const ConsumptionEstimator = ({ productType, onApply }: ConsumptionEstimatorProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Form state
  const [chauffageType, setChauffageType] = useState("electrique");
  const [ecsType, setEcsType] = useState("electrique");
  const [surface, setSurface] = useState<number | "">(100);
  const [occupants, setOccupants] = useState<number | "">(3);
  const [selectedAppliances, setSelectedAppliances] = useState<string[]>([]);

  const toggleAppliance = useCallback((id: string) => {
    setSelectedAppliances(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  }, []);

  const estimation = useMemo(() => {
    const s = Number(surface) || 0;
    const occ = Number(occupants) || 1;

    const heating = HEATING_COEFFICIENTS[chauffageType];
    const ecsPerPerson = ECS_PER_PERSON_KWH[ecsType] || 800;

    // ── Heating consumption ──
    const chauffageKwh = heating.kwh_m2 * s;

    // ── Hot water ──
    const ecsKwh = ecsPerPerson * occ;

    // ── Base electricity (lighting, cooking, appliances) ──
    const baseElecKwh = BASE_ELEC_PER_PERSON_KWH * occ;

    // ── Energy-intensive appliances ──
    const appliancesKwh = ENERGY_APPLIANCES
      .filter(a => selectedAppliances.includes(a.id))
      .reduce((sum, a) => sum + a.kwh_an, 0);

    // Split by energy type
    const chauffageEnergy = heating.energy;
    const ecsEnergy = HEATING_COEFFICIENTS[ecsType]?.energy || "elec";

    // Electricity total
    let elecKwh = baseElecKwh + appliancesKwh;
    if (chauffageEnergy === "elec") elecKwh += chauffageKwh;
    if (ecsEnergy === "elec") elecKwh += ecsKwh;

    // Combustible total (gaz/fioul/propane/bois)
    let combustibleKwh = 0;
    if (chauffageEnergy !== "elec") combustibleKwh += chauffageKwh;
    if (ecsEnergy !== "elec") combustibleKwh += ecsKwh;

    const prixElec = PRIX_ENERGIE.elec;
    const prixCombustible = PRIX_ENERGIE[chauffageEnergy] || PRIX_ENERGIE.gaz;

    const factureElecAn = elecKwh * prixElec;
    const factureCombustibleAn = combustibleKwh * prixCombustible;

    return {
      elecKwh: Math.round(elecKwh),
      combustibleKwh: Math.round(combustibleKwh),
      factureElecMois: Math.round(factureElecAn / 12),
      factureCombustibleMois: Math.round(factureCombustibleAn / 12),
      chauffageKwh: Math.round(chauffageKwh),
      ecsKwh: Math.round(ecsKwh),
      baseKwh: Math.round(baseElecKwh),
      appliancesKwh: Math.round(appliancesKwh),
      chauffageEnergy,
    };
  }, [surface, occupants, chauffageType, ecsType, selectedAppliances]);

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
        consoChaufffageKwh: estimation.combustibleKwh || estimation.chauffageKwh,
        factureChaufMensuelle: estimation.factureCombustibleMois || estimation.factureElecMois,
      });
    } else {
      // ITE: combined
      const totalKwh = estimation.elecKwh + estimation.combustibleKwh;
      const totalMois = estimation.factureElecMois + estimation.factureCombustibleMois;
      onApply({
        consoElecKwh: estimation.elecKwh,
        factureMensuelleElec: estimation.factureElecMois,
        consoChaufffageKwh: estimation.chauffageKwh,
        factureChaufMensuelle: estimation.factureCombustibleMois || Math.round((estimation.chauffageKwh * PRIX_ENERGIE.elec) / 12),
      });
    }
    setIsOpen(false);
  };

  const relevantLabel = productType === "PV" ? "électrique"
    : productType === "PAC" ? "chauffage (gaz/fioul)"
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
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform shrink-0",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-3 animate-in fade-in-0 slide-in-from-top-2 duration-200">
        {/* Chauffage + ECS */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] sm:text-xs">Mode de chauffage</Label>
            <Select value={chauffageType} onValueChange={setChauffageType}>
              <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="electrique">Électrique</SelectItem>
                <SelectItem value="gaz">Gaz naturel</SelectItem>
                <SelectItem value="fioul">Fioul</SelectItem>
                <SelectItem value="pompe_chaleur">PAC existante</SelectItem>
                <SelectItem value="bois">Bois / Granulés</SelectItem>
                <SelectItem value="propane">Propane / GPL</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                <SelectItem value="pompe_chaleur">Thermodynamique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Surface + Occupants */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] sm:text-xs">Surface habitable</Label>
            <div className="flex gap-1">
              <Input
                type="number"
                value={surface}
                onChange={e => setSurface(e.target.value ? Number(e.target.value) : "")}
                className="h-8 sm:h-9 text-xs sm:text-sm"
                placeholder="100"
              />
              <span className="flex items-center text-[10px] text-muted-foreground">m²</span>
            </div>
          </div>
          <div>
            <Label className="text-[10px] sm:text-xs">Nb occupants</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={occupants}
              onChange={e => setOccupants(e.target.value ? Number(e.target.value) : "")}
              className="h-8 sm:h-9 text-xs sm:text-sm"
              placeholder="3"
            />
          </div>
        </div>

        {/* Appareils énergivores */}
        <div>
          <Label className="text-[10px] sm:text-xs mb-1.5 block">Équipements énergivores</Label>
          <div className="flex flex-wrap gap-1.5">
            {ENERGY_APPLIANCES.map(app => {
              const active = selectedAppliances.includes(app.id);
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => toggleAppliance(app.id)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] sm:text-xs transition-colors",
                    active
                      ? "bg-primary/10 border-primary text-primary font-medium"
                      : "border-muted-foreground/20 text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {app.icon}
                  {app.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Résultat estimation */}
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <p className="text-[10px] sm:text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            Estimation prévisionnelle
          </p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] sm:text-xs">
            {/* Electricity */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Électricité</span>
              <span className="font-semibold">{estimation.elecKwh.toLocaleString("fr-FR")} kWh/an</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Facture élec.</span>
              <span className="font-semibold text-primary">{estimation.factureElecMois} €/mois</span>
            </div>

            {/* Combustible (if any) */}
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
          <div className="pt-1.5 border-t border-muted-foreground/10 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] sm:text-[10px] text-muted-foreground">
            <span>Chauffage: {estimation.chauffageKwh.toLocaleString("fr-FR")} kWh</span>
            <span>ECS: {estimation.ecsKwh.toLocaleString("fr-FR")} kWh</span>
            <span>Base élec: {estimation.baseKwh.toLocaleString("fr-FR")} kWh</span>
            {estimation.appliancesKwh > 0 && (
              <span>Équipements: {estimation.appliancesKwh.toLocaleString("fr-FR")} kWh</span>
            )}
          </div>
        </div>

        {/* Apply button */}
        <Button
          type="button"
          size="sm"
          className="w-full gap-2"
          onClick={handleApply}
        >
          <Check className="h-4 w-4" />
          Appliquer l'estimation
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
};

// Re-export needed icon
import { Check } from "lucide-react";
