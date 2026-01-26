import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Home, Layers, Paintbrush, TrendingDown } from "lucide-react";
import { ITE_OPTIONS, calculateR } from "@/lib/productTypes";

interface ITEFieldsProps {
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
  };
  onChange: (field: string, value: any) => void;
  isolantLambda?: number;
}

export const ITEFields = ({ data, onChange, isolantLambda = 0.038 }: ITEFieldsProps) => {
  // Calculer le R cible basé sur l'épaisseur et le lambda
  const calculatedR = data.iteEpaisseurIsolant 
    ? calculateR(isolantLambda, Number(data.iteEpaisseurIsolant))
    : 0;

  return (
    <div className="space-y-4">
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
              <Label>Type de façade</Label>
              <Select
                value={data.iteTypeFacade}
                onValueChange={(val) => onChange("iteTypeFacade", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {ITE_OPTIONS.typeFacade.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
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

          <div className="space-y-2">
            <Label>Résistance thermique actuelle (R)</Label>
            <Input
              type="number"
              value={data.iteRActuel}
              onChange={(e) => onChange("iteRActuel", e.target.value ? Number(e.target.value) : "")}
              placeholder="0.5"
              step={0.1}
            />
            <p className="text-xs text-muted-foreground">
              R typique mur non isolé : 0.3 à 0.8 m².K/W
            </p>
          </div>
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
            <Select
              value={data.iteTypeIsolant}
              onValueChange={(val) => onChange("iteTypeIsolant", val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {ITE_OPTIONS.typeIsolant.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Épaisseur isolant</Label>
            <Select
              value={String(data.iteEpaisseurIsolant)}
              onValueChange={(val) => onChange("iteEpaisseurIsolant", Number(val))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {ITE_OPTIONS.epaisseurIsolant.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {calculatedR > 0 && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Résistance thermique cible</span>
                <span className="text-lg font-bold text-primary">
                  R = {calculatedR.toFixed(2)} m².K/W
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Objectif RT 2012 : R ≥ 3.7 | RE 2020 : R ≥ 4.0
              </p>
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
            {ITE_OPTIONS.finition.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange("iteFinition", opt.value)}
                className={`p-3 rounded-xl border-2 transition-all text-left ${
                  data.iteFinition === opt.value
                    ? "border-primary bg-primary/10"
                    : "border-muted hover:border-primary/50"
                }`}
              >
                <div className="font-medium text-sm">{opt.label}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Économies estimées */}
      {data.iteSurfaceIsoler && data.iteRActuel && calculatedR > 0 && (
        <Card className="shadow-card border-green-500/30 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-green-700">
              <TrendingDown className="h-4 w-4" />
              Économies estimées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {Math.round((1 - Number(data.iteRActuel) / (Number(data.iteRActuel) + calculatedR)) * 100)}%
              </div>
              <p className="text-sm text-muted-foreground">
                Réduction des déperditions murales
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Les murs représentent ~25% des pertes de chaleur
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
