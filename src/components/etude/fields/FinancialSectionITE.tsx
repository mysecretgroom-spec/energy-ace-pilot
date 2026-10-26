import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Euro, PiggyBank, TrendingUp, Flame, TrendingDown, Clock } from "lucide-react";
import { calculerMensualiteAvecReport } from "@/lib/financingCalculation";

interface AidesITE {
  maPrimeRenov: number;
  cee: number;
  ecoTva: number;
  aideLocale: number;
}

interface FinancialSectionITEProps {
  surfaceIsoler: number;
  prixInstallation: number;
  prixInstallationManuel: number | "";
  onPrixChange: (value: number | "") => void;
  autreSurcout: number;
  onAutreSurcoutChange: (value: number) => void;
  // Aides
  aides: AidesITE;
  onAidesChange: (aides: AidesITE) => void;
  modeHejja: boolean;
  // Financement
  financements: Array<{ id: string; nom: string; taux_effectif: number; taeg: number }>;
  financementId: string;
  onFinancementChange: (id: string) => void;
  dureeMois: number | "";
  onDureeMoisChange: (mois: number | "") => void;
  mensualiteManuelle: number | "";
  onMensualiteChange: (value: number | "") => void;
  // Économies estimées
  economieChauffagePct: number;
  factureChaufActuelle: number; // Facture annuelle de chauffage
}

export const FinancialSectionITE = ({
  surfaceIsoler,
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
  economieChauffagePct,
  factureChaufActuelle,
}: FinancialSectionITEProps) => {
  const prixFinal = prixInstallationManuel || prixInstallation;
  // Montant TTC total hors aides (base de financement)
  const prixTotalTTC = Number(prixFinal) + autreSurcout;
  
  const totalAides = aides.maPrimeRenov + aides.cee + aides.ecoTva + aides.aideLocale;
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
  
  // Calcul des économies
  const economieAnnuelle = factureChaufActuelle * (economieChauffagePct / 100);
  const economieMensuelle = economieAnnuelle / 12;
  
  // Bilan mensuel
  const bilanMensuel = economieMensuelle - Number(mensualite);
  
  // Prix au m²
  const prixM2 = surfaceIsoler > 0 ? prixTotalTTC / surfaceIsoler : 0;

  return (
    <div className="space-y-4">
      {/* TITRE SECTION */}
      <div className="pt-4">
        <div className="flex items-center gap-2 justify-center mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#000091]/30 to-transparent" />
          <h2 className="text-sm font-bold text-[#000091] dark:text-sky-300 uppercase tracking-wider px-3">
            Pré-étude Financière ITE
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
            {surfaceIsoler > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Prix au m²</span>
                <span className="font-medium">{prixM2.toFixed(0)}€/m²</span>
              </div>
            )}
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
              AIDES ITE
              {modeHejja && (
                <Badge variant="outline" className="text-xs h-4 bg-red-500/10 text-red-500 border-red-500/30 ml-auto">
                  HEJJA
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-2 text-xs">
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
            
            {surfaceIsoler > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded mt-2">
                <p>Surface isolée : {surfaceIsoler} m²</p>
                <p>Aides estimées selon barèmes 2024-2025</p>
              </div>
            )}
            
            <Separator className="my-2" />
            
            {/* FINANCEMENT */}
            <div className="pt-2">
              <p className="text-xs font-bold mb-1">FINANCEMENT</p>
              <Select value={financementId} onValueChange={onFinancementChange}>
                <SelectTrigger className="h-7 text-xs">
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
              <div className="text-xs text-muted-foreground mt-1">
                <div className="flex justify-between">
                  <span>Taux débiteur fixe</span>
                  <span>{selectedFinancement?.taux_effectif}%</span>
                </div>
                <div className="flex justify-between">
                  <span>TAEG</span>
                  <span>{selectedFinancement?.taeg}%</span>
                </div>
              </div>
            )}
            
            <div className="mt-2">
              <label className="text-xs text-muted-foreground">Durée (mois)</label>
              <Select value={String(dureeMois)} onValueChange={(v) => onDureeMoisChange(Number(v))}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Durée" />
                </SelectTrigger>
                <SelectContent>
                  {[60, 84, 96, 108, 120, 144, 168, 180, 240].map((mois) => (
                    <SelectItem key={mois} value={String(mois)}>
                      {mois} mois ({(mois / 12).toFixed(0)} ans)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="mt-2">
              <label className="text-xs text-muted-foreground">Mensualité manuelle</label>
              <Input
                type="number"
                step="0.01"
                value={mensualiteManuelle}
                onChange={(e) => onMensualiteChange(e.target.value ? Number(e.target.value) : "")}
                placeholder={`Calculée: ${resultatFinancement.mensualiteAmortissement.toFixed(2)}€`}
                className="h-7 text-xs"
              />
            </div>
            
            {/* Info report 6 mois */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs mt-2">
              <div className="flex items-center gap-1 text-amber-700 font-medium mb-1">
                <Clock className="h-3 w-3" />
                Report 6 mois
              </div>
              <div className="space-y-0.5 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Pendant report :</span>
                  <span>{resultatFinancement.mensualiteReport.toFixed(0)}€/mois</span>
                </div>
                <div className="flex justify-between">
                  <span>Intérêts intercalaires :</span>
                  <span>{resultatFinancement.interetsIntercalaires.toFixed(0)}€</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between font-bold bg-muted/50 rounded p-1 mt-1">
              <span>Mensualité</span>
              <span>{Number(mensualite).toLocaleString("fr-FR", { minimumFractionDigits: 2 })}€</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Économies chauffage INPUT */}
      <Card className="shadow-card">
        <CardHeader className="pb-2 bg-orange-500/10">
          <CardTitle className="text-sm flex items-center gap-2">
            <Flame className="h-4 w-4 text-orange-500" />
            Économies de Chauffage
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Facture chauffage actuelle (€/an)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={factureChaufActuelle}
                  readOnly
                  className="h-9 bg-muted/30"
                />
                <span className="text-xs text-muted-foreground">€/an</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">% réduction estimé</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={economieChauffagePct}
                  readOnly
                  className="h-9 bg-muted/30"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* BILAN ÉCONOMIQUE */}
      {factureChaufActuelle > 0 && (
        <Card className="shadow-card border-2 border-primary/50">
          <CardHeader className="pb-2 bg-primary/20">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Bilan Économique ITE
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <p className="text-xs text-muted-foreground">Facture actuelle</p>
                </div>
                <p className="font-bold text-lg">{(factureChaufActuelle / 12).toFixed(0)} €<span className="text-xs font-normal">/mois</span></p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-green-600" />
                  <p className="text-xs text-muted-foreground">Économie estimée</p>
                </div>
                <p className="font-bold text-lg text-green-600">+{economieMensuelle.toFixed(0)} €<span className="text-xs font-normal">/mois</span></p>
              </div>
            </div>
            
            <div className={`rounded-lg p-4 text-center ${
              bilanMensuel >= 0 ? "bg-green-100" :
              bilanMensuel >= -50 ? "bg-amber-100" :
              "bg-red-100"
            }`}>
              <p className="text-sm text-muted-foreground mb-2">Bilan Mensuel (Économie - Mensualité)</p>
              <div className="flex items-center justify-center gap-3">
                <Badge className={`${
                  bilanMensuel >= 0 ? "bg-green-600" :
                  bilanMensuel >= -50 ? "bg-amber-500" :
                  "bg-red-500"
                } text-white`}>
                  {bilanMensuel >= 0 ? "RENTABLE" : bilanMensuel >= -50 ? "QUASI-NEUTRE" : "À FINANCER"}
                </Badge>
                <span className={`font-bold text-2xl ${
                  bilanMensuel >= 0 ? "text-green-600" :
                  bilanMensuel >= -50 ? "text-amber-600" :
                  "text-red-600"
                }`}>
                  {bilanMensuel >= 0 ? "+" : ""}{bilanMensuel.toFixed(0)}€
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Réduction des déperditions murales : ~{economieChauffagePct}%
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
