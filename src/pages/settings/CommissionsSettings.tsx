import { useEffect, useMemo, useRef, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Brain,
  Check,
  Sparkles,
  Mic,
  Square,
  Upload,
  Trash2,
  Plus,
  Loader2,
  Percent,
  Save,
} from "lucide-react";
import {
  CommissionRule,
  RuleBase,
  RuleConditionBase,
  RuleEffet,
  RULE_BASE_LABELS,
  RULE_CONDITION_BASE_LABELS,
  RULE_EFFET_LABELS,
} from "@/lib/commissionRules";

interface Regie {
  id: string;
  nom: string;
}

type DraftRule = Omit<CommissionRule, "id" | "user_id">;

const emptyDraft = (): DraftRule => ({
  regie_id: null,
  product_type: null,
  gamme: null,
  nom: "",
  description: null,
  effet: "deduction",
  base: "fixe",
  mode_valeur: "fixe",
  valeur: 0,
  part_appliquee_pct: 100,
  condition_base: "montant_ht",
  condition_min: null,
  condition_max: null,
  ordre: 0,
  actif: true,
  schema_nom: null,
  raisonnement: null,
  source: "manuel",
  source_prompt: null,
});

/** Proposition de modèle complet renvoyée par l'IA */
interface SchemaProposal {
  schema_nom: string;
  raisonnement: string;
  rules: Partial<DraftRule>[];
}

/** Version historisée d'un modèle de commissionnement */
interface SchemaVersion {
  id: string;
  schema_nom: string;
  version: number;
  statut: "brouillon" | "actif" | "archive";
  raisonnement: string | null;
  source_prompt: string | null;
  rules: Partial<DraftRule>[];
  activated_at: string | null;
  created_at: string;
}

const CommissionsSettings = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [regies, setRegies] = useState<Regie[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftRule | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // IA
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiEditId, setAiEditId] = useState<string | null>(null);
  const [aiEditText, setAiEditText] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modèle de commissionnement (raisonnement complet)
  const [schemaText, setSchemaText] = useState("");
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [proposal, setProposal] = useState<SchemaProposal | null>(null);
  const [schemaRecording, setSchemaRecording] = useState(false);
  const schemaRecorderRef = useRef<MediaRecorder | null>(null);
  const schemaChunksRef = useRef<Blob[]>([]);
  const [versions, setVersions] = useState<SchemaVersion[]>([]);


  useEffect(() => {
    if (user) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    setLoading(true);
    const [rulesRes, regiesRes, versionsRes] = await Promise.all([
      supabase.from("commission_rules").select("*").order("ordre", { ascending: true }),
      supabase.from("regies").select("id, nom").order("nom"),
      supabase
        .from("commission_schema_versions")
        .select("*")
        .order("version", { ascending: false })
        .limit(20),
    ]);
    setRules(((rulesRes.data as unknown as CommissionRule[]) || []));
    setRegies(((regiesRes.data as Regie[]) || []));
    setVersions(((versionsRes.data as unknown as SchemaVersion[]) || []));
    setLoading(false);
  };

  const regieName = useMemo(
    () => (id: string | null) => (id ? regies.find((r) => r.id === id)?.nom || "Régie" : "Toutes les régies"),
    [regies]
  );

  const saveDraft = async () => {
    if (!user || !draft) return;
    if (!draft.nom.trim()) {
      toast.error("Donne un nom à la règle");
      return;
    }
    const payload = { ...draft, nom: draft.nom.trim(), user_id: user.id };
    const { error } = editingId
      ? await supabase.from("commission_rules").update(payload).eq("id", editingId)
      : await supabase.from("commission_rules").insert(payload);
    if (error) {
      toast.error("Enregistrement impossible");
      return;
    }
    toast.success(editingId ? "Règle mise à jour" : "Règle ajoutée");
    setDraft(null);
    setEditingId(null);
    load();
  };

  const toggleRule = async (rule: CommissionRule) => {
    await supabase.from("commission_rules").update({ actif: !rule.actif }).eq("id", rule.id);
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, actif: !r.actif } : r)));
  };

  const deleteRule = async (id: string) => {
    await supabase.from("commission_rules").delete().eq("id", id);
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast.success("Règle supprimée");
  };

  // ── IA ────────────────────────────────────────────────────────────────────
  /** Correction d'une règle existante via une consigne en langage naturel */
  const adjustRuleWithAI = async (rule: CommissionRule) => {
    const instruction = aiEditText.trim();
    if (!instruction) return;
    setAiLoading(true);
    try {
      const { id, user_id, ...rest } = rule;
      const { data, error } = await supabase.functions.invoke("commission-rule-assistant", {
        body: { texte: instruction, rule: rest },
      });
      if (error) throw error;
      const proposed = (data?.rules || []) as Partial<DraftRule>[];
      if (proposed.length === 0) {
        toast.error("L'IA n'a pas compris la correction");
        return;
      }
      const updated = { ...rest, ...proposed[0], source_prompt: instruction };
      const { error: updateError } = await supabase
        .from("commission_rules")
        .update(updated)
        .eq("id", rule.id);
      if (updateError) throw updateError;
      toast.success("Règle corrigée");
      setAiEditId(null);
      setAiEditText("");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Correction impossible");
    } finally {
      setAiLoading(false);
    }
  };

  const callAssistant = async (payload: Record<string, unknown>, source: CommissionRule["source"]) => {
    if (!user) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("commission-rule-assistant", {
        body: {
          ...payload,
          existingRules: rules.map(({ id, user_id, ...rest }) => rest),
        },
      });
      if (error) throw error;
      const proposed = (data?.rules || []) as Partial<DraftRule>[];
      if (proposed.length === 0) {
        toast.error("L'IA n'a pas trouvé de règle exploitable");
        return;
      }
      const rows = proposed.map((r) => ({
        ...emptyDraft(),
        ...r,
        source,
        source_prompt: typeof payload.texte === "string" ? payload.texte : null,
        user_id: user.id,
      }));
      const { error: insertError } = await supabase.from("commission_rules").insert(rows);
      if (insertError) throw insertError;
      toast.success(`${rows.length} règle(s) créée(s) par l'IA`);
      setAiText("");
      load();
    } catch (e) {
      console.error(e);
      toast.error("L'assistant IA n'a pas pu créer la règle");
    } finally {
      setAiLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const base64 = await blobToBase64(blob);
        const format = (recorder.mimeType || "").includes("mp4") ? "m4a" : "webm";
        callAssistant({ audioBase64: base64, audioFormat: format }, "ia_vocal");
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Micro indisponible");
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  };

  const onFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop lourd (10 Mo max)");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    callAssistant({ fileDataUrl: dataUrl, fileName: file.name, texte: aiText }, "ia_document");
  };

  // ── Modèle de commissionnement complet ────────────────────────────────────
  /** Demande à l'IA de raisonner un nouveau style de commissionnement complet */
  const askSchema = async (payload: Record<string, unknown>) => {
    setSchemaLoading(true);
    setProposal(null);
    try {
      const { data, error } = await supabase.functions.invoke("commission-rule-assistant", {
        body: {
          ...payload,
          mode: "schema",
          existingRules: rules
            .filter((r) => r.actif)
            .map(({ id, user_id, ...rest }) => rest),
        },
      });
      if (error) throw error;
      const proposed = (data?.rules || []) as Partial<DraftRule>[];
      if (proposed.length === 0) {
        toast.error("L'IA n'a pas su traduire ce modèle");
        return;
      }
      setProposal({
        schema_nom: data?.schema_nom || "Nouveau modèle",
        raisonnement: data?.raisonnement || "",
        rules: proposed,
      });
    } catch (e) {
      console.error(e);
      toast.error("Analyse du modèle impossible");
    } finally {
      setSchemaLoading(false);
    }
  };

  /** Archive les règles actuellement actives (conservées, mais plus utilisées) */
  const archiveActiveRules = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("commission_rules")
      .update({ actif: false, statut: "archive" } as never)
      .eq("user_id", user.id)
      .eq("actif", true);
    if (error) throw error;
  };

  /**
   * Enregistre un modèle : en brouillon (aucun impact sur les calculs)
   * ou en actif (les règles précédentes sont archivées).
   */
  const applyProposal = async (statut: "brouillon" | "actif") => {
    if (!user || !proposal) return;
    setSchemaLoading(true);
    try {
      const nextVersion = (versions[0]?.version ?? 0) + 1;
      const rows = proposal.rules.map((r, i) => ({
        ...emptyDraft(),
        ...r,
        ordre: r.ordre ?? i * 10,
        actif: statut === "actif",
        statut,
        version: nextVersion,
        schema_nom: proposal.schema_nom,
        raisonnement: proposal.raisonnement,
        source: "ia_texte" as const,
        source_prompt: schemaText || null,
        user_id: user.id,
      }));

      if (statut === "actif") await archiveActiveRules();

      const { error } = await supabase.from("commission_rules").insert(rows as never);
      if (error) throw error;

      // Snapshot dans l'historique des versions
      await supabase.from("commission_schema_versions").insert({
        user_id: user.id,
        schema_nom: proposal.schema_nom,
        version: nextVersion,
        statut,
        raisonnement: proposal.raisonnement,
        source_prompt: schemaText || null,
        rules: rows.map(({ user_id: _u, ...r }) => r) as never,
        activated_at: statut === "actif" ? new Date().toISOString() : null,
      } as never);

      toast.success(
        statut === "actif"
          ? `Modèle « ${proposal.schema_nom} » activé (v${nextVersion})`
          : `Brouillon « ${proposal.schema_nom} » enregistré (v${nextVersion})`
      );
      setProposal(null);
      setSchemaText("");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Impossible d'enregistrer ce modèle");
    } finally {
      setSchemaLoading(false);
    }
  };

  /** Réactive une version passée : les règles actuelles sont archivées */
  const restoreVersion = async (v: SchemaVersion) => {
    if (!user) return;
    setSchemaLoading(true);
    try {
      await archiveActiveRules();
      const nextVersion = (versions[0]?.version ?? 0) + 1;
      const rows = (v.rules || []).map((r, i) => ({
        ...emptyDraft(),
        ...r,
        ordre: r.ordre ?? i * 10,
        actif: true,
        statut: "actif",
        version: nextVersion,
        schema_nom: v.schema_nom,
        raisonnement: v.raisonnement,
        user_id: user.id,
      }));
      const { error } = await supabase.from("commission_rules").insert(rows as never);
      if (error) throw error;
      await supabase.from("commission_schema_versions").insert({
        user_id: user.id,
        schema_nom: v.schema_nom,
        version: nextVersion,
        statut: "actif",
        raisonnement: v.raisonnement,
        source_prompt: v.source_prompt,
        rules: rows.map(({ user_id: _u, ...r }) => r) as never,
        activated_at: new Date().toISOString(),
      } as never);
      toast.success(`Version « ${v.schema_nom} » restaurée`);
      load();
    } catch (e) {
      console.error(e);
      toast.error("Restauration impossible");
    } finally {
      setSchemaLoading(false);
    }
  };

  /** Bascule une règle entre brouillon et actif */
  const toggleStatut = async (rule: CommissionRule) => {
    const next = (rule.statut ?? "actif") === "actif" ? "brouillon" : "actif";
    const { error } = await supabase
      .from("commission_rules")
      .update({ statut: next, actif: next === "actif" } as never)
      .eq("id", rule.id);
    if (error) {
      toast.error("Modification impossible");
      return;
    }
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, statut: next, actif: next === "actif" } : r))
    );
  };

  const startSchemaRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      schemaChunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size > 0 && schemaChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(schemaChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const base64 = await blobToBase64(blob);
        const format = (recorder.mimeType || "").includes("mp4") ? "m4a" : "webm";
        askSchema({ audioBase64: base64, audioFormat: format, texte: schemaText });
      };
      recorder.start();
      schemaRecorderRef.current = recorder;
      setSchemaRecording(true);
    } catch {
      toast.error("Micro indisponible");
    }
  };

  const stopSchemaRecording = () => {
    schemaRecorderRef.current?.stop();
    schemaRecorderRef.current = null;
    setSchemaRecording(false);
  };

  return (
    <MobileLayout title="Calcul des commissions" showBackButton>
      <div className="p-4 space-y-4 pb-28">
        {/* Changer de modèle de commissionnement */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              Changer de modèle de commissionnement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={schemaText}
              onChange={(e) => setSchemaText(e.target.value)}
              placeholder="Ex : je passe à 120 € par kWc au-delà de 3 kWc, moins la moitié des surcoûts et de la prime coup de pouce ; au-dessus de 25 000 € HT j'ajoute 2% de bonus."
              rows={4}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => askSchema({ texte: schemaText })}
                disabled={schemaLoading || !schemaText.trim()}
              >
                {schemaLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                <span className="ml-1">Analyser le raisonnement</span>
              </Button>
              <Button
                size="sm"
                variant={schemaRecording ? "destructive" : "outline"}
                onClick={schemaRecording ? stopSchemaRecording : startSchemaRecording}
                disabled={schemaLoading}
              >
                {schemaRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span className="ml-1">{schemaRecording ? "Arrêter" : "Expliquer à l'oral"}</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Explique ton mode de rémunération comme tu le dirais à un collègue : l'IA en déduit le raisonnement
              complet (base, tranches, partages, bonus) et te le montre avant de l'appliquer.
            </p>

            {proposal && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{proposal.schema_nom}</p>
                  {proposal.raisonnement && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line mt-1">
                      {proposal.raisonnement}
                    </p>
                  )}
                </div>
                <Separator />
                <div className="space-y-1">
                  {proposal.rules.map((r, i) => (
                    <div key={i} className="text-xs">
                      <span className="font-medium">{r.nom}</span>
                      {" — "}
                      {RULE_EFFET_LABELS[(r.effet || "deduction") as RuleEffet]} ·{" "}
                      {RULE_BASE_LABELS[(r.base || "fixe") as RuleBase]} ·{" "}
                      {r.mode_valeur === "pourcentage" ? `${r.valeur}%` : `${r.valeur}`}
                      {r.part_appliquee_pct != null && r.part_appliquee_pct !== 100 && (
                        <> · part {r.part_appliquee_pct}%</>
                      )}
                      {(r.condition_min != null || r.condition_max != null) && (
                        <>
                          {" "}
                          · de {r.condition_min ?? 0} à {r.condition_max ?? "∞"}{" "}
                          {r.condition_base === "puissance_kwc" ? "kWc" : "€"}
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => applyProposal("brouillon")}
                    disabled={schemaLoading}
                  >
                    {schemaLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span className="ml-1">Enregistrer en brouillon</span>
                  </Button>
                  <Button size="sm" onClick={() => applyProposal("actif")} disabled={schemaLoading}>
                    {schemaLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span className="ml-1">Activer ce modèle</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                    Annuler
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Un brouillon n'a aucun effet sur les commissions tant qu'il n'est pas activé. À l'activation,
                  le modèle actuel est archivé et reste restaurable depuis l'historique.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assistant IA */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Créer une règle avec l'IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder="Ex : la prime coup de pouce est partagée à 50% avec la régie, et je déduis 150€ de frais de dossier par vente."
              rows={3}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => callAssistant({ texte: aiText }, "ia_texte")}
                disabled={aiLoading || !aiText.trim()}
                size="sm"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                <span className="ml-1">Générer</span>
              </Button>
              <Button
                variant={recording ? "destructive" : "outline"}
                size="sm"
                onClick={recording ? stopRecording : startRecording}
                disabled={aiLoading}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                <span className="ml-1">{recording ? "Arrêter" : "Dicter"}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={aiLoading}
              >
                <Upload className="h-4 w-4" />
                <span className="ml-1">Document</span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Décris ta règle à l'écrit, à l'oral, ou envoie le barème de la régie : l'IA la transforme en règle
              appliquée automatiquement à tes commissions.
            </p>
          </CardContent>
        </Card>

        {/* Liste des règles */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              Mes règles ({rules.length})
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setDraft(emptyDraft());
                setEditingId(null);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Chargement…</p>}
            {!loading && rules.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Aucune règle : le calcul standard (bouquet, pourcentage, pose externe) s'applique.
              </p>
            )}
            {rules.map((rule) => (
              <div key={rule.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{rule.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      {RULE_EFFET_LABELS[rule.effet]} · {RULE_BASE_LABELS[rule.base]} ·{" "}
                      {rule.mode_valeur === "pourcentage" ? `${rule.valeur}%` : `${rule.valeur}`}
                      {rule.part_appliquee_pct !== 100 && ` · part ${rule.part_appliquee_pct}%`}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px]">{regieName(rule.regie_id)}</Badge>
                      {rule.product_type && (
                        <Badge variant="outline" className="text-[10px]">{rule.product_type}</Badge>
                      )}
                      {rule.gamme && <Badge variant="outline" className="text-[10px]">{rule.gamme}</Badge>}
                      {rule.source !== "manuel" && (
                        <Badge variant="secondary" className="text-[10px]">IA</Badge>
                      )}
                      {rule.schema_nom && (
                        <Badge variant="secondary" className="text-[10px]">{rule.schema_nom}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={rule.actif} onCheckedChange={() => toggleRule(rule)} />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => {
                        const { id, user_id, ...rest } = rule;
                        setDraft(rest as DraftRule);
                        setEditingId(rule.id);
                      }}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-primary"
                      title="Ajuster avec l'IA"
                      onClick={() => {
                        setAiEditId(aiEditId === rule.id ? null : rule.id);
                        setAiEditText("");
                      }}
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteRule(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {aiEditId === rule.id && (
                  <div className="pt-2 space-y-2 border-t mt-2">
                    <Input
                      value={aiEditText}
                      onChange={(e) => setAiEditText(e.target.value)}
                      placeholder="Ex : passe la part à 30% et applique-la seulement au PV"
                      className="text-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => adjustRuleWithAI(rule)}
                        disabled={aiLoading || !aiEditText.trim()}
                      >
                        {aiLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        <span className="ml-1">Corriger</span>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setAiEditId(null)}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Éditeur manuel */}
        {draft && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {editingId ? "Modifier la règle" : "Nouvelle règle"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input value={draft.nom} onChange={(e) => setDraft({ ...draft, nom: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Effet</Label>
                  <Select
                    value={draft.effet}
                    onValueChange={(v) => setDraft({ ...draft, effet: v as RuleEffet })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RULE_EFFET_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Base de calcul</Label>
                  <Select
                    value={draft.base}
                    onValueChange={(v) => setDraft({ ...draft, base: v as RuleBase })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RULE_BASE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={draft.mode_valeur}
                    onValueChange={(v) => setDraft({ ...draft, mode_valeur: v as "fixe" | "pourcentage" })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixe">Fixe</SelectItem>
                      <SelectItem value="pourcentage">%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valeur</Label>
                  <Input
                    type="number"
                    value={draft.valeur}
                    onChange={(e) => setDraft({ ...draft, valeur: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Part appliquée %</Label>
                  <Input
                    type="number"
                    value={draft.part_appliquee_pct}
                    onChange={(e) => setDraft({ ...draft, part_appliquee_pct: Number(e.target.value) })}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Régie</Label>
                  <Select
                    value={draft.regie_id ?? "all"}
                    onValueChange={(v) => setDraft({ ...draft, regie_id: v === "all" ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les régies</SelectItem>
                      {regies.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.nom}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Produit</Label>
                  <Select
                    value={draft.product_type ?? "all"}
                    onValueChange={(v) => setDraft({ ...draft, product_type: v === "all" ? null : v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="PV">PV</SelectItem>
                      <SelectItem value="PAC">PAC</SelectItem>
                      <SelectItem value="ITE">ITE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Gamme</Label>
                  <Input
                    value={draft.gamme ?? ""}
                    onChange={(e) => setDraft({ ...draft, gamme: e.target.value || null })}
                    placeholder="Toutes"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Condition portant sur</Label>
                  <Select
                    value={draft.condition_base}
                    onValueChange={(v) => setDraft({ ...draft, condition_base: v as RuleConditionBase })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(RULE_CONDITION_BASE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Min</Label>
                  <Input
                    type="number"
                    value={draft.condition_min ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, condition_min: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max</Label>
                  <Input
                    type="number"
                    value={draft.condition_max ?? ""}
                    onChange={(e) =>
                      setDraft({ ...draft, condition_max: e.target.value === "" ? null : Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={saveDraft} className="flex-1">Enregistrer</Button>
                <Button variant="outline" onClick={() => { setDraft(null); setEditingId(null); }}>
                  Annuler
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MobileLayout>
  );
};

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return dataUrl.split(",")[1] || "";
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default CommissionsSettings;
