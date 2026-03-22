import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Upload,
  FileImage,
  FileText,
  Loader2,
  Sparkles,
  Check,
  X,
  Euro,
  Zap,
  Wrench,
  CreditCard,
  AlertCircle,
} from "lucide-react";

interface ExtractedBouquet {
  product_type: string;
  nom_bouquet: string;
  puissance_kwc: number;
  prix_recommande: number;
  commission_fixe: number;
  description: string | null;
  selected?: boolean;
}

interface ExtractedSurcout {
  product_type: string;
  categorie: string;
  nom: string;
  code: string;
  prix: number;
  type_calcul: string;
  selected?: boolean;
}

interface ExtractedFinancement {
  nom: string;
  duree_mois: number;
  taux_effectif: number;
  taeg: number;
  selected?: boolean;
}

interface RegieAIConfigImportProps {
  regieId: string;
  userId: string;
  onComplete: () => void;
}

export function RegieAIConfigImport({ regieId, userId, onComplete }: RegieAIConfigImportProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bouquets, setBouquets] = useState<ExtractedBouquet[]>([]);
  const [surcouts, setSurcouts] = useState<ExtractedSurcout[]>([]);
  const [financements, setFinancements] = useState<ExtractedFinancement[]>([]);
  const [hasResults, setHasResults] = useState(false);
  const [activeTab, setActiveTab] = useState("bouquets");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Format non supporté. Utilisez JPG, PNG, WEBP ou PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo)");
      return;
    }

    setIsExtracting(true);
    setBouquets([]);
    setSurcouts([]);
    setFinancements([]);
    setHasResults(false);

    try {
      const base64 = await fileToBase64(file);

      const { data, error } = await supabase.functions.invoke("extract-regie-config", {
        body: { imageBase64: base64, mimeType: file.type },
      });

      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        return;
      }

      const b = (data.bouquets || []).map((x: any) => ({ ...x, selected: true }));
      const s = (data.surcouts || []).map((x: any) => ({ ...x, selected: true }));
      const f = (data.financements || []).map((x: any) => ({ ...x, selected: true }));

      setBouquets(b);
      setSurcouts(s);
      setFinancements(f);
      setHasResults(true);

      const total = b.length + s.length + f.length;
      if (total === 0) {
        toast.warning("Aucune donnée détectée dans ce document");
      } else {
        toast.success(`${b.length} bouquets, ${s.length} surcoûts, ${f.length} financements détectés`);
        // Auto-select first non-empty tab
        if (b.length > 0) setActiveTab("bouquets");
        else if (s.length > 0) setActiveTab("surcouts");
        else setActiveTab("financements");
      }
    } catch (error) {
      console.error("Extraction error:", error);
      toast.error("Erreur lors de l'extraction IA");
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const handleSave = async () => {
    const selBouquets = bouquets.filter((b) => b.selected);
    const selSurcouts = surcouts.filter((s) => s.selected);
    const selFinancements = financements.filter((f) => f.selected);

    if (selBouquets.length + selSurcouts.length + selFinancements.length === 0) {
      toast.error("Sélectionnez au moins un élément");
      return;
    }

    setIsSaving(true);
    try {
      const promises: Promise<any>[] = [];

      if (selBouquets.length > 0) {
        promises.push(
          supabase.from("bouquets").insert(
            selBouquets.map((b) => ({
              user_id: userId,
              regie_ids: [regieId],
              nom_bouquet: b.nom_bouquet,
              puissance_kwc: b.puissance_kwc,
              prix_recommande: b.prix_recommande,
              prix_max: b.prix_recommande,
              commission_fixe: b.commission_fixe,
              product_type: b.product_type as "PV" | "PAC" | "ITE",
              description: b.description,
              actif: true,
            }))
          ).then()
        );
      }

      if (selSurcouts.length > 0) {
        promises.push(
          supabase.from("regies_surcouts").insert(
            selSurcouts.map((s) => ({
              user_id: userId,
              regie_id: regieId,
              categorie: s.categorie,
              code: s.code,
              nom: s.nom,
              prix: s.prix,
              type_calcul: s.type_calcul,
              actif: true,
            }))
          )
        );
      }

      if (selFinancements.length > 0) {
        promises.push(
          supabase.from("regies_financements").insert(
            selFinancements.map((f) => ({
              user_id: userId,
              regie_id: regieId,
              nom: f.nom,
              duree_mois: f.duree_mois,
              taux_effectif: f.taux_effectif,
              taeg: f.taeg,
              actif: true,
            }))
          )
        );
      }

      const results = await Promise.all(promises);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error("Save errors:", errors);
        toast.error("Certaines données n'ont pas pu être sauvegardées");
      } else {
        const parts: string[] = [];
        if (selBouquets.length) parts.push(`${selBouquets.length} bouquets`);
        if (selSurcouts.length) parts.push(`${selSurcouts.length} surcoûts`);
        if (selFinancements.length) parts.push(`${selFinancements.length} financements`);
        toast.success(`${parts.join(", ")} créés ✓`);
      }

      handleReset();
      onComplete();
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setBouquets([]);
    setSurcouts([]);
    setFinancements([]);
    setHasResults(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(amount);

  const totalSelected = bouquets.filter((b) => b.selected).length +
    surcouts.filter((s) => s.selected).length +
    financements.filter((f) => f.selected).length;

  if (!hasResults) {
    return (
      <Card className="border-dashed border-2 hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />

          {isExtracting ? (
            <div className="flex flex-col items-center justify-center py-6 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analyse IA en cours...</p>
              <p className="text-xs text-muted-foreground">Extraction des bouquets, surcoûts et financements</p>
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center py-6 gap-3 cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="p-3 rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium text-sm">Importer les conditions de la régie</p>
                <p className="text-xs text-muted-foreground mt-1">
                  L'IA extraira automatiquement les bouquets, surcoûts et financements
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs gap-1">
                  <FileImage className="h-3 w-3" />
                  Image
                </Badge>
                <Badge variant="secondary" className="text-xs gap-1">
                  <FileText className="h-3 w-3" />
                  PDF
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{totalSelected} sélectionné(s)</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <X className="h-4 w-4 mr-1" />
            Annuler
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSaving || totalSelected === 0}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
            Créer
          </Button>
        </div>
      </div>

      <Card className="bg-amber-500/10 border-amber-500/30">
        <CardContent className="p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Vérifiez et corrigez les valeurs si nécessaire avant de créer.
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="bouquets" className="gap-1 text-xs">
            <Euro className="h-3.5 w-3.5" />
            Bouquets
            {bouquets.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{bouquets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="surcouts" className="gap-1 text-xs">
            <Wrench className="h-3.5 w-3.5" />
            Surcoûts
            {surcouts.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{surcouts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="financements" className="gap-1 text-xs">
            <CreditCard className="h-3.5 w-3.5" />
            Financement
            {financements.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{financements.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Bouquets tab */}
        <TabsContent value="bouquets" className="space-y-2 mt-3">
          {bouquets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun bouquet détecté</p>
          ) : (
            bouquets.map((b, i) => (
              <Card key={i} className={`transition-all ${b.selected ? "ring-1 ring-primary/50 bg-primary/5" : "opacity-50"}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={b.selected} onCheckedChange={() => setBouquets(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{b.product_type}</Badge>
                        <Input value={b.nom_bouquet} onChange={(e) => setBouquets(prev => prev.map((x, j) => j === i ? { ...x, nom_bouquet: e.target.value } : x))} className="h-7 text-sm font-medium" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Zap className="h-3 w-3" />{b.product_type === "ITE" ? "m²" : "kWc"}</label>
                          <Input type="number" step="0.5" value={b.puissance_kwc} onChange={(e) => setBouquets(prev => prev.map((x, j) => j === i ? { ...x, puissance_kwc: parseFloat(e.target.value) || 0 } : x))} className="h-7 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Euro className="h-3 w-3" />Prix reco.</label>
                          <Input type="number" value={b.prix_recommande} onChange={(e) => setBouquets(prev => prev.map((x, j) => j === i ? { ...x, prix_recommande: parseFloat(e.target.value) || 0 } : x))} className="h-7 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-green-600 flex items-center gap-1"><Euro className="h-3 w-3" />Commission</label>
                          <Input type="number" value={b.commission_fixe} onChange={(e) => setBouquets(prev => prev.map((x, j) => j === i ? { ...x, commission_fixe: parseFloat(e.target.value) || 0 } : x))} className="h-7 text-xs border-green-500/30" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Surcoûts tab */}
        <TabsContent value="surcouts" className="space-y-2 mt-3">
          {surcouts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun surcoût détecté</p>
          ) : (
            surcouts.map((s, i) => (
              <Card key={i} className={`transition-all ${s.selected ? "ring-1 ring-primary/50 bg-primary/5" : "opacity-50"}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={s.selected} onCheckedChange={() => setSurcouts(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} className="mt-1" />
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{s.product_type}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{s.categorie}</Badge>
                        <Badge className="text-[10px] bg-muted text-muted-foreground">{s.type_calcul}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Input value={s.nom} onChange={(e) => setSurcouts(prev => prev.map((x, j) => j === i ? { ...x, nom: e.target.value } : x))} className="h-7 text-xs" placeholder="Nom" />
                        </div>
                        <div>
                          <Input value={s.code} onChange={(e) => setSurcouts(prev => prev.map((x, j) => j === i ? { ...x, code: e.target.value } : x))} className="h-7 text-xs" placeholder="Code" />
                        </div>
                        <div>
                          <Input type="number" value={s.prix} onChange={(e) => setSurcouts(prev => prev.map((x, j) => j === i ? { ...x, prix: parseFloat(e.target.value) || 0 } : x))} className="h-7 text-xs font-semibold text-green-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Financements tab */}
        <TabsContent value="financements" className="space-y-2 mt-3">
          {financements.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun financement détecté</p>
          ) : (
            financements.map((f, i) => (
              <Card key={i} className={`transition-all ${f.selected ? "ring-1 ring-primary/50 bg-primary/5" : "opacity-50"}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={f.selected} onCheckedChange={() => setFinancements(prev => prev.map((x, j) => j === i ? { ...x, selected: !x.selected } : x))} className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <Input value={f.nom} onChange={(e) => setFinancements(prev => prev.map((x, j) => j === i ? { ...x, nom: e.target.value } : x))} className="h-7 text-sm font-medium" placeholder="Nom" />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-muted-foreground">Durée (mois)</label>
                          <Input type="number" value={f.duree_mois} onChange={(e) => setFinancements(prev => prev.map((x, j) => j === i ? { ...x, duree_mois: parseInt(e.target.value) || 1 } : x))} className="h-7 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">Taux eff. %</label>
                          <Input type="number" step="0.01" value={f.taux_effectif} onChange={(e) => setFinancements(prev => prev.map((x, j) => j === i ? { ...x, taux_effectif: parseFloat(e.target.value) || 0 } : x))} className="h-7 text-xs" />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground">TAEG %</label>
                          <Input type="number" step="0.01" value={f.taeg} onChange={(e) => setFinancements(prev => prev.map((x, j) => j === i ? { ...x, taeg: parseFloat(e.target.value) || 0 } : x))} className="h-7 text-xs" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
