import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Euro, PiggyBank, CreditCard, TrendingUp, Zap, AlertCircle, TrendingDown, Clock } from "lucide-react";
import { calculerMensualiteAvecReport } from "@/lib/financingCalculation";

interface AidesPAC {
  maPrimeRenov: number;
  cee: number;
  ecoTva: number;
  aideLocale: number;
  deposeChaudiere: number;
  ballonThermo: number;
}

interface FinancialSectionPACProps {
  pacSubtype: "air_air" | "air_eau" | "";
  pacPuissance: number;
  prixInstallation: number;
  prixInstallationManuel: number | "";
  onPrixChange: (value: number | "") => void;
  autreSurcout: number;
  onAutreSurcoutChange: (value: number) => void;
  // Aides
  aides: AidesPAC;
  onAidesChange: (aides: AidesPAC) => void;
  modeHejja: boolean;
  // Financement
  financements: Array<{ id: string; nom: string; taux_effectif: number; taeg: number }>;
  financementId: string;
  onFinancementChange: (id: string) => void;
  dureeMois: number | "";
  onDureeMoisChange: (mois: number | "") => void;
  mensualiteManuelle: number | "";
  onMensualiteChange: (value: number | "") => void;
  // Factures actuelles et économies
  factureChauf: number;
  factureElec: number;
  copMoyen: number;
  // Économies calculées depuis PACFields
  economiesCalculees?: {
    besoinsChauffageKwh: number;
    consoElecPacKwh: number;
    surcoutElecEuros: number;
    economieNetteEuros: number;
    economieNetteMessage: number;
  } | null;
}

export const FinancialSectionPAC = ({
  pacSubtype,
  pacPuissance,
  prixInstallation,
  prixInstallationManuel,
  onPrixChange,
  autreSurcout,
  onAutreSurcoutChange,
  aides,
  onAidesChange,
  modeHejja,
  financements,
  financementId,
  onFinancementChange,
  dureeMois,
  onDureeMoisChange,
  mensualiteManuelle,
  onMensualiteChange,
  factureChauf,
  factureElec,
  copMoyen,
  economiesCalculees,
}: FinancialSectionPACProps) => {
  const prixFinal = prixInstallationManuel || prixInstallation;
  // Montant TTC total hors aides (base de financement)
  const prixTotalTTC = Number(prixFinal) + autreSurcout;
  
  const totalAides = aides.maPrimeRenov + aides.cee + aides.ecoTva + aides.aideLocale + (aides.deposeChaudiere || 0) + (aides.ballonThermo || 0);
  const prixAidesDéduites = prixTotalTTC - totalAides;
  
  // Calcul mensualité avec report 6 mois
  const selectedFinancement = financements.find(f => f.id === financementId);
  const tauxEffectif = selectedFinancement?.taux_effectif || 0;
  const nbMois = Number(dureeMois) || 120;
  
  // Calcul avec report de 6 mois sur le montant TTC hors aides
  const resultatFinancement = calculerMensualiteAvecReport({
    montantTTC: prixTotalTTC,
    tauxEffectifAnnuel: tauxEffectif,
    dureeMois: nbMois,
    dureeReportMois: 6,
  });
  
  const mensualite = mensualiteManuelle || resultatFinancement.mensualiteAmortissement;
  
  // Utiliser les économies calculées depuis PACFields si disponibles
  const economieMensuelle = economiesCalculees?.economieNetteMessage ?? 0;
  const economieAnnuelle = economiesCalculees?.economieNetteEuros ?? 0;
  const surcoutElec = economiesCalculees?.surcoutElecEuros ?? 0;
  
  // Bilan mensuel (économie - mensualité)
  const bilanMensuel = economieMensuelle - Number(mensualite);

  return (
    <div className="space-y-4">
      {/* TITRE SECTION */}
      <div className="pt-4">
        <div className="flex items-center gap-2 justify-center mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
          <h2 className="text-sm font-bold text-[#000091] uppercase tracking-wider px-3">
            Pré-étude Financière PAC
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
        </div>
      </div>

      {/* PRIX & AIDES */}
      <div className="grid grid-cols-2 gap-3">
        {/* PRIX */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-primary/10">
            <CardTitle className="text-xs flex items-center gap-1">
              <Euro className="h-3 w-3" />
              PRIX
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-2 text-xs">
            <div>
              <label className="text-xs text-muted-foreground">Prix Installation TTC</label>
              <Input
                type="number"
                step="0.01"
                value={prixInstallationManuel || ""}
                onChange={(e) => onPrixChange(e.target.value ? Number(e.target.value) : "")}
                placeholder={modeHejja ? "Entrez le prix" : `Base: ${prixInstallation.toFixed(0)}€`}
                className="h-7 text-xs font-medium"
              />
            </div>
            <div className="flex justify-between pt-1">
              <span>Installation TTC</span>
              <span className="font-medium">{Number(prixFinal).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Autre Surcoût</span>
              <Input
                type="number"
                value={autreSurcout}
                onChange={(e) => onAutreSurcoutChange(Number(e.target.value) || 0)}
                className="h-6 w-16 text-right text-xs"
              />
            </div>
            <Separator className="my-1" />
            <div className="flex justify-between font-bold">
              <span>TOTAL Hors Aides</span>
              <span>{prixTotalTTC.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>TOTAL Aides</span>
              <span>{totalAides.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
            </div>
            <div className="flex justify-between font-bold text-primary bg-primary/10 rounded p-1 mt-1">
              <span>Aides Déduites</span>
              <span>{prixAidesDéduites.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
            </div>
          </CardContent>
        </Card>

        {/* AIDES */}
        <Card className="shadow-card">
          <CardHeader className="pb-2 bg-green-500/10">
            <CardTitle className="text-xs flex items-center gap-1">
              <PiggyBank className="h-3 w-3 text-green-600" />
              AIDES PAC
              {modeHejja && (
                <Badge variant="outline" className="text-[10px] h-4 bg-red-500/10 text-red-500 border-red-500/30 ml-auto">
                  HEJJA
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2 text-xs">
            {pacSubtype === "air_eau" ? (
              <>
                <div className="flex justify-between items-center">
                  <span>MaPrimeRénov'</span>
                  {modeHejja ? (
                    <Input
                      type="number"
                      value={aides.maPrimeRenov}
                      onChange={(e) => onAidesChange({ ...aides, maPrimeRenov: Number(e.target.value) || 0 })}
                      className="h-6 w-20 text-right text-xs"
                    />
                  ) : (
                    <span className="font-medium text-green-600">{aides.maPrimeRenov.toLocaleString("fr-FR")}€</span>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span>CEE</span>
                  {modeHejja ? (
                    <Input
                      type="number"
                      value={aides.cee}
                      onChange={(e) => onAidesChange({ ...aides, cee: Number(e.target.value) || 0 })}
                      className="h-6 w-20 text-right text-xs"
                    />
                  ) : (
                    <span className="font-medium text-green-600">{aides.cee.toLocaleString("fr-FR")}€</span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-[10px] text-amber-600 bg-amber-50 p-2 rounded">
                  ⚠️ PAC Air/Air : non éligible MaPrimeRénov'
                </div>
                <div className="flex justify-between items-center">
                  <span>CEE</span>
                  {modeHejja ? (
                    <Input
                      type="number"
                      value={aides.cee}
                      onChange={(e) => onAidesChange({ ...aides, cee: Number(e.target.value) || 0 })}
                      className="h-6 w-20 text-right text-xs"
                    />
                  ) : (
                    <span className="font-medium text-green-600">{aides.cee.toLocaleString("fr-FR")}€</span>
                  )}
                </div>
              </>
            )}
            {(aides.deposeChaudiere || 0) > 0 && (
              <div className="flex justify-between items-center">
                <span>Dépose chaudière</span>
                {modeHejja ? (
                  <Input
                    type="number"
                    value={aides.deposeChaudiere}
                    onChange={(e) => onAidesChange({ ...aides, deposeChaudiere: Number(e.target.value) || 0 })}
                    className="h-6 w-20 text-right text-xs"
                  />
                ) : (
                  <span className="font-medium text-green-600">{(aides.deposeChaudiere || 0).toLocaleString("fr-FR")}€</span>
                )}
              </div>
            )}
            <div className="flex justify-between items-center">
              <span>ECO TVA (5.5%)</span>
              {modeHejja ? (
                <Input
                  type="number"
                  value={aides.ecoTva}
                  onChange={(e) => onAidesChange({ ...aides, ecoTva: Number(e.target.value) || 0 })}
                  className="h-6 w-20 text-right text-xs"
                />
              ) : (
                <span className="font-medium text-green-600">{aides.ecoTva.toLocaleString("fr-FR")}€</span>
              )}
            </div>
            <div className="flex justify-between items-center">
              <span>Aide locale</span>
              <Input
                type="number"
                value={aides.aideLocale}
                onChange={(e) => onAidesChange({ ...aides, aideLocale: Number(e.target.value) || 0 })}
                className="h-6 w-20 text-right text-xs"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FINANCEMENT */}
      <Card className="shadow-card">
        <CardHeader className="pb-2 bg-blue-500/10">
          <CardTitle className="text-xs flex items-center gap-1">
            <CreditCard className="h-3 w-3 text-blue-600" />
            FINANCEMENT
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-3 text-xs">
          <div>
            <Label className="text-xs">Organisme de financement</Label>
            <Select value={financementId} onValueChange={onFinancementChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {financements.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nom} ({f.taux_effectif}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {financementId && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <div className="flex justify-between">
                <span>Taux effectif</span>
                <span>{selectedFinancement?.taux_effectif}%</span>
              </div>
              <div className="flex justify-between">
                <span>TAEG</span>
                <span>{selectedFinancement?.taeg}%</span>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Durée (mois)</Label>
              <Select value={String(dureeMois)} onValueChange={(v) => onDureeMoisChange(Number(v))}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Durée" />
                </SelectTrigger>
                <SelectContent>
                  {[60, 84, 96, 108, 120, 144, 168, 180].map((mois) => (
                    <SelectItem key={mois} value={String(mois)}>
                      {mois} mois ({(mois / 12).toFixed(0)} ans)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mensualité</Label>
              <Input
                type="number"
                step="0.01"
                value={mensualiteManuelle}
                onChange={(e) => onMensualiteChange(e.target.value ? Number(e.target.value) : "")}
                placeholder={`${resultatFinancement.mensualiteAmortissement.toFixed(2)}€`}
                className="h-8 text-xs"
              />
            </div>
          </div>
          
          {/* Info report 6 mois */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs">
            <div className="flex items-center gap-2 text-amber-700 font-medium mb-1">
              <Clock className="h-3 w-3" />
              Report 6 mois inclus
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div className="flex justify-between">
                <span>Pendant le report :</span>
                <span className="font-medium">{resultatFinancement.mensualiteReport.toFixed(0)}€/mois</span>
              </div>
              <div className="flex justify-between">
                <span>Intérêts intercalaires :</span>
                <span className="font-medium">{resultatFinancement.interetsIntercalaires.toFixed(0)}€</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-between font-bold bg-blue-100 rounded p-2">
            <span>Mensualité après report</span>
            <span className="text-blue-700">{Number(mensualite).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€/mois</span>
          </div>
          
          <div className="text-[10px] text-muted-foreground text-center">
            Durée totale : {resultatFinancement.dureeTotaleMois} mois ({(resultatFinancement.dureeTotaleMois / 12).toFixed(1)} ans)
          </div>
        </CardContent>
      </Card>

      {/* BILAN ÉCONOMIQUE FINAL */}
      <Card className="shadow-card border-2 border-primary/50">
        <CardHeader className="pb-2 bg-primary/20">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Rentabilité du Projet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {/* Résumé des flux */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="bg-red-50 rounded-lg p-2 border border-red-200 text-center">
              <TrendingDown className="h-4 w-4 text-red-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Fossile supprimé</p>
              <p className="font-bold text-red-600">-{(factureChauf / 12).toFixed(0)}€</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2 border border-amber-200 text-center">
              <Zap className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Élec PAC</p>
              <p className="font-bold text-amber-600">+{(surcoutElec / 12).toFixed(0)}€</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-2 border border-blue-200 text-center">
              <CreditCard className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground">Mensualité</p>
              <p className="font-bold text-blue-600">-{Number(mensualite).toFixed(0)}€</p>
            </div>
          </div>
          
          {/* Bilan mensuel */}
          <div className={`rounded-lg p-4 text-center ${
            bilanMensuel >= 0 ? "bg-green-100" :
            bilanMensuel >= -50 ? "bg-amber-100" :
            "bg-red-100"
          }`}>
            <p className="text-sm text-muted-foreground mb-2">
              Bilan Mensuel = Économie ({economieMensuelle >= 0 ? "+" : ""}{economieMensuelle.toFixed(0)}€) - Mensualité ({Number(mensualite).toFixed(0)}€)
            </p>
            <div className="flex items-center justify-center gap-3">
              {bilanMensuel >= 0 ? (
                <Badge className="bg-green-600 text-white">RENTABLE</Badge>
              ) : bilanMensuel >= -50 ? (
                <Badge className="bg-amber-500 text-white">QUASI-NEUTRE</Badge>
              ) : (
                <Badge className="bg-red-500 text-white">EFFORT FINANCIER</Badge>
              )}
              <span className={`font-bold text-2xl ${
                bilanMensuel >= 0 ? "text-green-600" :
                bilanMensuel >= -50 ? "text-amber-600" :
                "text-red-600"
              }`}>
                {bilanMensuel >= 0 ? "+" : ""}{bilanMensuel.toFixed(0)}€/mois
              </span>
            </div>
            
            {bilanMensuel < 0 && (
              <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Effort mensuel de {Math.abs(bilanMensuel).toFixed(0)}€ pendant {nbMois / 12} ans
              </p>
            )}
            
            {bilanMensuel >= 0 && (
              <p className="text-xs text-green-600 mt-3">
                ✓ Le projet s'autofinance grâce aux économies d'énergie
              </p>
            )}
          </div>
          
          {/* Économie totale sur durée financement */}
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Économie totale sur {nbMois / 12} ans</p>
            <p className={`font-bold text-lg ${economieAnnuelle * (nbMois / 12) - prixAidesDéduites >= 0 ? "text-green-600" : "text-red-600"}`}>
              {(economieAnnuelle * (nbMois / 12) - prixAidesDéduites).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              COP moyen utilisé : {copMoyen.toFixed(1)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
