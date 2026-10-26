import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Home, Thermometer, Sun, ArrowDown, ArrowRight, Zap, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface EnergyEvolutionCardProps {
  activeProducts: string[];
  // Données actuelles
  factureElecAnnuelle: number; // Facture électricité actuelle €/an
  factureChauffageAnnuelle: number; // Facture chauffage fossile actuelle €/an
  consoElecKwh: number; // Consommation électrique actuelle kWh/an
  // Données ITE
  iteEconomiePct: number; // % réduction chauffage grâce à ITE
  // Données PAC
  pacConsoElecKwh: number; // Conso élec supplémentaire PAC kWh/an
  pacSurcoutElecEuros: number; // Surcoût élec PAC €/an
  pacEconomieNetteEuros: number; // Économie nette PAC (fossile supprimé - surcoût élec)
  // Données PV
  pvAutoconsoEuros: number; // Économie autoconsommation €/mois
  pvReventeEuros: number; // Revente surplus €/mois
}

export const EnergyEvolutionCard = ({
  activeProducts,
  factureElecAnnuelle,
  factureChauffageAnnuelle,
  consoElecKwh,
  iteEconomiePct,
  pacConsoElecKwh,
  pacSurcoutElecEuros,
  pacEconomieNetteEuros,
  pvAutoconsoEuros,
  pvReventeEuros,
}: EnergyEvolutionCardProps) => {
  const hasITE = activeProducts.includes("ITE");
  const hasPAC = activeProducts.includes("PAC");
  const hasPV = activeProducts.includes("PV");

  if (activeProducts.length <= 1) return null;

  // Calculs intermédiaires
  const factureMensElecAvant = factureElecAnnuelle / 12;
  const factureMensChauffAvant = factureChauffageAnnuelle / 12;
  const totalMensuelAvant = factureMensElecAvant + factureMensChauffAvant;

  // Après ITE : chauffage réduit
  const factureChauffApresITE = hasITE 
    ? factureChauffageAnnuelle * (1 - iteEconomiePct / 100) 
    : factureChauffageAnnuelle;
  const factureMensChauffApresITE = factureChauffApresITE / 12;

  // Après PAC : fossile → 0, élec augmente
  const factureElecApresPAC = hasPAC
    ? factureElecAnnuelle + pacSurcoutElecEuros
    : factureElecAnnuelle;
  const factureChauffApresPAC = hasPAC ? 0 : factureChauffApresITE;
  const factureMensElecApresPAC = factureElecApresPAC / 12;
  const factureMensChauffApresPAC = factureChauffApresPAC / 12;
  const totalMensuelApresPAC = factureMensElecApresPAC + factureMensChauffApresPAC;

  // Après PV : réduction facture élec grâce à autoconsommation
  const gainPVMensuel = hasPV ? (pvAutoconsoEuros + pvReventeEuros) : 0;
  const factureMensElecApresPV = factureMensElecApresPAC - (hasPV ? pvAutoconsoEuros : 0);
  const totalMensuelFinal = Math.max(0, factureMensElecApresPV) + factureMensChauffApresPAC - (hasPV ? pvReventeEuros : 0);

  const economieGlobaleMensuelle = totalMensuelAvant - totalMensuelFinal;
  const economiePct = totalMensuelAvant > 0 ? Math.round((economieGlobaleMensuelle / totalMensuelAvant) * 100) : 0;

  return (
    <Card className="shadow-card border-2 border-primary/30 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-orange-50 via-blue-50 to-amber-50 px-3 sm:px-6 py-2 sm:py-3">
        <CardTitle className="text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 text-[#000091] dark:text-sky-300">
          <TrendingDown className="h-4 w-4" />
          Évolution de vos factures d'énergie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-3 px-3 sm:px-6">
        
        {/* SITUATION ACTUELLE */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
            📊 Situation actuelle
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-background rounded p-2 border">
              <Zap className="h-3.5 w-3.5 text-amber-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Électricité</p>
              <p className="font-bold">{factureMensElecAvant.toFixed(0)}€<span className="text-[9px] font-normal">/mois</span></p>
            </div>
            <div className="bg-background rounded p-2 border">
              <Flame className="h-3.5 w-3.5 text-orange-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Chauffage</p>
              <p className="font-bold">{factureMensChauffAvant.toFixed(0)}€<span className="text-[9px] font-normal">/mois</span></p>
            </div>
            <div className="bg-background rounded p-2 border border-red-200">
              <p className="text-[10px] text-muted-foreground">Total</p>
              <p className="font-bold text-red-600">{totalMensuelAvant.toFixed(0)}€<span className="text-[9px] font-normal">/mois</span></p>
            </div>
          </div>
        </div>

        {/* ÉTAPE ITE */}
        {hasITE && iteEconomiePct > 0 && (
          <>
            <div className="flex items-center justify-center gap-2">
              <ArrowDown className="h-4 w-4 text-orange-500" />
              <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-[10px]">
                <Home className="h-3 w-3 mr-1" />
                Après ITE (−{iteEconomiePct}% déperditions)
              </Badge>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50/50 p-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-background rounded p-2 border">
                  <p className="text-[10px] text-muted-foreground">Électricité</p>
                  <p className="font-bold">{factureMensElecAvant.toFixed(0)}€</p>
                  <p className="text-[9px] text-muted-foreground">inchangée</p>
                </div>
                <div className="bg-background rounded p-2 border">
                  <p className="text-[10px] text-muted-foreground">Chauffage</p>
                  <p className="font-bold">{factureMensChauffApresITE.toFixed(0)}€</p>
                  <p className="text-[9px] text-green-600 font-medium">−{(factureMensChauffAvant - factureMensChauffApresITE).toFixed(0)}€</p>
                </div>
                <div className="bg-background rounded p-2 border">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="font-bold">{(factureMensElecAvant + factureMensChauffApresITE).toFixed(0)}€</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE PAC */}
        {hasPAC && factureChauffageAnnuelle > 0 && (
          <>
            <div className="flex items-center justify-center gap-2">
              <ArrowDown className="h-4 w-4 text-blue-500" />
              <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[10px]">
                <Thermometer className="h-3 w-3 mr-1" />
                Après PAC (fossile → électrique)
              </Badge>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-background rounded p-2 border">
                  <p className="text-[10px] text-muted-foreground">Électricité</p>
                  <p className="font-bold">{factureMensElecApresPAC.toFixed(0)}€</p>
                  <p className="text-[9px] text-amber-600 font-medium">+{(pacSurcoutElecEuros / 12).toFixed(0)}€ (PAC)</p>
                </div>
                <div className="bg-background rounded p-2 border">
                  <p className="text-[10px] text-muted-foreground">Chauffage fossile</p>
                  <p className="font-bold text-green-600">0€</p>
                  <p className="text-[9px] text-green-600 font-medium">supprimé ✓</p>
                </div>
                <div className="bg-background rounded p-2 border">
                  <p className="text-[10px] text-muted-foreground">Total</p>
                  <p className="font-bold">{totalMensuelApresPAC.toFixed(0)}€</p>
                  <p className={cn(
                    "text-[9px] font-medium",
                    totalMensuelApresPAC < totalMensuelAvant ? "text-green-600" : "text-amber-600"
                  )}>
                    {totalMensuelApresPAC < totalMensuelAvant ? "−" : "+"}{Math.abs(totalMensuelAvant - totalMensuelApresPAC).toFixed(0)}€ vs avant
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ÉTAPE PV */}
        {hasPV && gainPVMensuel > 0 && (
          <>
            <div className="flex items-center justify-center gap-2">
              <ArrowDown className="h-4 w-4 text-amber-500" />
              <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px]">
                <Sun className="h-3 w-3 mr-1" />
                Après PV (production solaire)
              </Badge>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-background rounded p-2 border">
                  <p className="text-[10px] text-muted-foreground">Autoconsommation</p>
                  <p className="font-bold text-green-600">−{pvAutoconsoEuros.toFixed(0)}€</p>
                  <p className="text-[9px] text-muted-foreground">/mois</p>
                </div>
                <div className="bg-background rounded p-2 border">
                  <p className="text-[10px] text-muted-foreground">Revente surplus</p>
                  <p className="font-bold text-green-600">+{pvReventeEuros.toFixed(0)}€</p>
                  <p className="text-[9px] text-muted-foreground">/mois</p>
                </div>
                <div className="bg-background rounded p-2 border border-green-200">
                  <p className="text-[10px] text-muted-foreground">Facture nette</p>
                  <p className="font-bold text-green-600">{Math.max(0, totalMensuelFinal).toFixed(0)}€</p>
                  <p className="text-[9px] text-muted-foreground">/mois</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* BILAN FINAL */}
        <Separator />
        <div className={cn(
          "rounded-lg p-3 sm:p-4 text-center",
          economiePct >= 50 ? "bg-green-100 border border-green-300" : 
          economiePct >= 20 ? "bg-amber-100 border border-amber-300" : 
          "bg-muted/50 border"
        )}>
          <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Économie globale sur vos factures d'énergie</p>
          <div className="flex items-center justify-center gap-3">
            <span className="font-bold text-xl sm:text-2xl text-green-600">
              −{economieGlobaleMensuelle.toFixed(0)}€<span className="text-sm font-normal">/mois</span>
            </span>
            <Badge className="bg-green-600 text-white">{economiePct}%</Badge>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            De {totalMensuelAvant.toFixed(0)}€/mois à {Math.max(0, totalMensuelFinal).toFixed(0)}€/mois (soit −{(economieGlobaleMensuelle * 12).toFixed(0)}€/an)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
