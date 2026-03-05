import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Home, Droplets, Gauge, Flame, Zap, AlertCircle, TrendingDown, TrendingUp, Info, Shield, Link2 } from "lucide-react";
import { PAC_OPTIONS, PacSubtype } from "@/lib/productTypes";
import { supabase } from "@/integrations/supabase/client";

interface IsolationLevel {
  id: string;
  niveau_isolation: string;
  label: string;
  coefficient_deperdition: number;
  besoins_kwh_m2_an: number;
  description: string | null;
}

interface PACFieldsProps {
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
    // Nouveaux champs économies
    pacNiveauIsolation: string;
    pacPrixKwhElec: number | "";
  };
  onChange: (field: string, value: unknown) => void;
  calculatedCop?: number;
  /** Réduction des besoins chauffage grâce à l'ITE (0-100%) */
  iteReductionPct?: number;
  onEconomiesCalculated?: (economies: {
    besoinsChauffageKwh: number;
    consoElecPacKwh: number;
    surcoutElecEuros: number;
    economieNetteEuros: number;
    economieNetteMessage: number;
  }) => void;
  /** ITE est aussi active dans cette étude multi-produit */
  linkedIteActive?: boolean;
  /** % d'économie chauffage calculé par l'ITE */
  iteEconomiePct?: number;
  /** PV est aussi actif dans cette étude multi-produit */
  linkedPvActive?: boolean;
}

export const PACFields = ({ data, onChange, calculatedCop, iteReductionPct = 0, onEconomiesCalculated, linkedIteActive, iteEconomiePct, linkedPvActive }: PACFieldsProps) => {
  const [isolationLevels, setIsolationLevels] = useState<IsolationLevel[]>([]);
  
  // Load isolation levels
  useEffect(() => {
    const loadIsolation = async () => {
      const { data: levels } = await supabase
        .from("data_pac_isolation")
        .select("*")
        .eq("actif", true)
        .order("ordre");
      if (levels) setIsolationLevels(levels as IsolationLevel[]);
    };
    loadIsolation();
  }, []);

  const copValue = calculatedCop || Number(data.pacCop) || 3.5;
  const factureChauf = Number(data.pacFactureChauffageEuros) || 0;
  const factureElec = Number(data.pacFactureElecEuros) || 0;
  const surface = Number(data.pacSurfaceChauffee) || 0;
  const prixKwhElec = Number(data.pacPrixKwhElec) || 0.23; // Prix moyen électricité
  
  // Find selected isolation level
  const selectedIsolation = isolationLevels.find(i => i.niveau_isolation === data.pacNiveauIsolation);
  const besoinsKwhM2 = selectedIsolation?.besoins_kwh_m2_an || 120; // Défaut moyen
  
  // ═══════════════════════════════════════════════════════════════════════════
  // CALCULS D'ÉCONOMIES DÉTAILLÉS
  // ═══════════════════════════════════════════════════════════════════════════
  
  // 1. Besoins en chauffage annuels (kWh) basés sur surface et isolation
  const besoinsChauffageBrut = surface * besoinsKwhM2;
  // Réduction ITE : si ITE active, les besoins chauffage diminuent
  const besoinsChauffageKwh = besoinsChauffageBrut * (1 - (iteReductionPct / 100));
  
  // 2. Consommation électrique PAC = Besoins / COP
  const consoElecPacKwh = copValue > 0 ? besoinsChauffageKwh / copValue : 0;
  
  // 3. Surcoût électrique annuel (€)
  const surcoutElecEuros = consoElecPacKwh * prixKwhElec;
  
  // 4. Économie nette = Facture fossile supprimée - Surcoût élec
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
      });
    }
  }, [besoinsChauffageKwh, consoElecPacKwh, surcoutElecEuros, economieNetteEuros, economieNetteMensuelle]);

  const showEconomies = factureChauf > 0 && surface > 0 && copValue > 0;

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
                  {subtype === "air_air" 
                    ? "Climatisation réversible"
                    : "Chauffage central"
                  }
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Caractéristiques du logement avec ISOLATION */}
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
              <Select
                value={data.pacEnergieActuelle}
                onValueChange={(val) => onChange("pacEnergieActuelle", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {PAC_OPTIONS.energieActuelle.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* NOUVEAU: Niveau d'isolation */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Niveau d'isolation du logement
            </Label>
            <Select
              value={data.pacNiveauIsolation || ""}
              onValueChange={(val) => onChange("pacNiveauIsolation", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner le niveau d'isolation" />
              </SelectTrigger>
              <SelectContent>
                {isolationLevels.map((level) => (
                  <SelectItem key={level.id} value={level.niveau_isolation}>
                    <div className="flex flex-col">
                      <span>{level.label}</span>
                      <span className="text-xs text-muted-foreground">
                        ~{level.besoins_kwh_m2_an} kWh/m²/an
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedIsolation && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                {selectedIsolation.description}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Type d&apos;émetteurs</Label>
            <Select
              value={data.pacTypeEmetteurs}
              onValueChange={(val) => onChange("pacTypeEmetteurs", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {PAC_OPTIONS.emetteurs
                  .filter((opt) => 
                    data.pacSubtype === "air_air" 
                      ? ["splits", "gainable"].includes(opt.value)
                      : ["radiateurs", "plancher_chauffant", "ventilo_convecteurs"].includes(opt.value)
                  )
                  .map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {data.pacSubtype === "air_air" && (
            <div className="space-y-2">
              <Label>Nombre d&apos;unités intérieures</Label>
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

      {/* Factures énergétiques avec prix kWh élec */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Flame className="h-4 w-4 text-orange-600" />
            Factures énergétiques actuelles
            {linkedIteActive && (
              <Badge variant="outline" className="text-[10px] ml-auto border-orange-300 text-orange-600 bg-orange-50">
                <Link2 className="h-3 w-3 mr-1" />
                Synchronisé ITE
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkedIteActive && iteReductionPct > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs text-orange-700 flex items-center gap-2">
              <Home className="h-4 w-4 shrink-0" />
              <span>L'ITE réduit les besoins chauffage de <strong>{iteEconomiePct || iteReductionPct}%</strong> — calcul PAC ajusté automatiquement</span>
            </div>
          )}
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
              {linkedIteActive ? (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Partagé avec l'onglet ITE
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Gaz, fioul ou propane (sera supprimé)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Électricité actuelle (€/an)
                {linkedPvActive && <Link2 className="h-3 w-3 text-blue-500" />}
              </Label>
              <Input
                type="number"
                value={data.pacFactureElecEuros}
                onChange={(e) => onChange("pacFactureElecEuros", e.target.value ? Number(e.target.value) : "")}
                placeholder="1200"
              />
              {linkedPvActive ? (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Synchronisé avec la facture PV (×12)
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Hors chauffage actuel
                </p>
              )}
            </div>
          </div>

          {/* Prix du kWh électrique */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Prix du kWh électrique (€)
              {linkedPvActive && <Link2 className="h-3 w-3 text-blue-500" />}
            </Label>
            <Input
              type="number"
              step="0.01"
              value={data.pacPrixKwhElec}
              onChange={(e) => onChange("pacPrixKwhElec", e.target.value ? Number(e.target.value) : "")}
              placeholder="0.23"
            />
            {linkedPvActive ? (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Link2 className="h-3 w-3" />
                Calculé depuis conso & facture PV
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Prix moyen du kWh sur la facture du client
              </p>
            )}
          </div>

          {(factureChauf > 0 || factureElec > 0) && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total énergie actuel</span>
                <span className="font-medium">{(factureChauf + factureElec).toLocaleString("fr-FR")} €/an</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Consommation chauffage (kWh/an) - optionnel</Label>
            <Input
              type="number"
              value={data.pacConsoChaufffageKwh}
              onChange={(e) => onChange("pacConsoChaufffageKwh", e.target.value ? Number(e.target.value) : "")}
              placeholder="15000"
            />
            <p className="text-xs text-muted-foreground">
              Si connu, sinon calculé automatiquement
            </p>
          </div>
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
                placeholder="8"
                step={0.5}
              />
            </div>
            <div className="space-y-2">
              <Label>COP moyen</Label>
              <Input
                type="number"
                value={calculatedCop || data.pacCop}
                onChange={(e) => onChange("pacCop", e.target.value ? Number(e.target.value) : "")}
                placeholder="4.0"
                step={0.1}
                className={calculatedCop ? "bg-muted" : ""}
              />
              {calculatedCop && (
                <p className="text-xs text-muted-foreground">Calculé automatiquement</p>
              )}
            </div>
          </div>

          {data.pacSubtype === "air_eau" && (
            <>
              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>ECS intégré</Label>
                  <p className="text-xs text-muted-foreground">Eau chaude sanitaire</p>
                </div>
                <Switch
                  checked={data.pacEcsIntegre}
                  onCheckedChange={(checked) => onChange("pacEcsIntegre", checked)}
                />
              </div>

              {data.pacEcsIntegre && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Droplets className="h-4 w-4" />
                    Volume ballon ECS
                  </Label>
                  <Select
                    value={String(data.pacVolumeBallon)}
                    onValueChange={(val) => onChange("pacVolumeBallon", Number(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAC_OPTIONS.volumeBallon.filter(v => v.value > 0).map((opt) => (
                        <SelectItem key={opt.value} value={String(opt.value)}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════════════
          SECTION ÉCONOMIES DÉTAILLÉES
          ═══════════════════════════════════════════════════════════════════════════ */}
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
                </div>
                <div>
                  <span className="text-muted-foreground">Besoins annuels</span>
                  <p className="font-bold text-blue-600">{besoinsChauffageKwh.toLocaleString("fr-FR")} kWh/an</p>
                </div>
              </div>
            </div>

            {/* Consommation PAC */}
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
              <p className="text-xs text-amber-600 font-medium mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Augmentation électricité avec PAC
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Conso élec PAC</span>
                  <p className="font-medium">
                    {besoinsChauffageKwh.toLocaleString("fr-FR")} ÷ {copValue} COP
                  </p>
                  <p className="font-bold text-amber-600">= {Math.round(consoElecPacKwh).toLocaleString("fr-FR")} kWh/an</p>
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
