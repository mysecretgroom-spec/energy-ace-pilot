import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Thermometer, Home, Droplets, Gauge, Flame } from "lucide-react";
import { PAC_OPTIONS, PacSubtype } from "@/lib/productTypes";

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
  };
  onChange: (field: string, value: unknown) => void;
  calculatedCop?: number;
}

export const PACFields = ({ data, onChange, calculatedCop }: PACFieldsProps) => {
  const copValue = calculatedCop || Number(data.pacCop) || 3;
  const consoValue = Number(data.pacConsoChaufffageKwh) || 0;
  const showEconomies = consoValue > 0 && copValue > 0;
  const economyPct = Math.round((1 - 1 / copValue) * 100);
  const economyEuros = Math.round(consoValue * (1 - 1 / copValue) * 0.15);

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

          <div className="space-y-2">
            <Label>Consommation chauffage actuelle (kWh/an)</Label>
            <Input
              type="number"
              value={data.pacConsoChaufffageKwh}
              onChange={(e) => onChange("pacConsoChaufffageKwh", e.target.value ? Number(e.target.value) : "")}
              placeholder="15000"
            />
            <p className="text-xs text-muted-foreground">
              Pour fioul/gaz : consulter les factures annuelles
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

      {/* Économies estimées */}
      {showEconomies && (
        <Card className="shadow-card border-green-500/30 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-green-700">
              <Flame className="h-4 w-4" />
              Économies estimées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {economyPct}%
              </div>
              <p className="text-sm text-muted-foreground">
                Réduction consommation chauffage
              </p>
              <div className="mt-2 text-lg font-semibold text-foreground">
                ≈ {economyEuros} €/an
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
