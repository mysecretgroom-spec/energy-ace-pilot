import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  FileUp,
  History,
  Loader2,
  Mic,
  Plus,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { CONFIG_DOMAINS, formatChangeValues, getConfigDomain } from "@/lib/configDomains";
import { useConfigAssistant, ConfigHistoryEntry } from "@/hooks/useConfigAssistant";
import { useRegieModel, ModelHistoryEntry } from "@/hooks/useRegieModel";

interface RegieOption {
  id: string;
  nom: string;
}

/** Mode « tout la régie d'un coup » : gammes, prix, surcoûts, financements, aides */
const MODEL_KEY = "regie_modele";

const MODEL_EXAMPLES = [
  "Régie ISH : gammes Full Black et Standard. Full Black 3 kWc 18 900 €, 6 kWc 26 900 €, 9 kWc 34 900 €, commission fixe 3 000 €. Triphasé 1 500 €, pergola 750 € par panneau. Financement 180 mois à 5,9 % de TAEG. Prime coup de pouce 80 € par kWc jusqu'à 9 kWc.",
  "Reprends la grille du document joint pour cette régie : gammes, prix recommandés, prix max, commissions, surcoûts et financements.",
];

const actionMeta = {
  creer: { label: "Ajout", icon: Plus, className: "border-emerald-500 text-emerald-600" },
  modifier: { label: "Modification", icon: Wand2, className: "border-amber-500 text-amber-600" },
  supprimer: { label: "Suppression", icon: Trash2, className: "border-destructive text-destructive" },
} as const;

const ConfigAssistant = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [domainKey, setDomainKey] = useState(searchParams.get("domaine") || CONFIG_DOMAINS[0].key);
  const [regieId, setRegieId] = useState<string | null>(searchParams.get("regie"));
  const [regies, setRegies] = useState<RegieOption[]>([]);
  const [texte, setTexte] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isModel = domainKey === MODEL_KEY;
  const domain = useMemo(() => (isModel ? undefined : getConfigDomain(domainKey)), [domainKey, isModel]);
  const assistant = useConfigAssistant(domain, regieId);
  const model = useRegieModel(regieId);
  const needsRegie = isModel || !!domain?.regieScoped;

  useEffect(() => {
    const params: Record<string, string> = { domaine: domainKey };
    if (regieId) params.regie = regieId;
    setSearchParams(params, { replace: true });
  }, [domainKey, regieId, setSearchParams]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("regies").select("id, nom").order("nom");
      const list = (data as RegieOption[]) || [];
      setRegies(list);
      setRegieId((current) => current ?? list[0]?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    if (isModel) {
      model.fetchHistory();
      return;
    }
    if (!domain) return;
    if (domain.regieScoped && !regieId) return;
    assistant.fetchRows();
    assistant.fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domainKey, regieId]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const buffer = await blob.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.length; i += 8192) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        }
        await runAsk({ audioBase64: btoa(binary), audioFormat: "webm" });
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

  const onPickFile = async (file: File) => {
    if (file.size > 12 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 12 Mo)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(String(reader.result));
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const runAsk = async (extra: Record<string, unknown> = {}) => {
    if (!isModel && !domain) return;
    if (needsRegie && !regieId) {
      toast.error("Choisissez d'abord une régie");
      return;
    }
    const payload: {
      texte?: string;
      fileDataUrl?: string;
      fileName?: string;
      audioBase64?: string;
      audioFormat?: string;
    } = {
      texte: texte.trim() || undefined,
      fileDataUrl: fileDataUrl || undefined,
      fileName: fileName || undefined,
      ...extra,
    };
    if (!payload.texte && !payload.fileDataUrl && !payload.audioBase64) {
      toast.error("Décrivez ce que vous voulez changer");
      return;
    }
    try {
      if (isModel) await model.ask(payload);
      else await assistant.ask(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'assistant n'a pas pu répondre");
    }
  };

  const onApply = async () => {
    try {
      if (isModel) await model.apply(texte);
      else await assistant.apply(texte);
      setTexte("");
      setFileDataUrl(null);
      setFileName(null);
      toast.success(
        isModel
          ? "Modèle de régie enregistré — les études l'utiliseront à la prochaine ouverture"
          : "Paramétrage mis à jour"
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Échec de l'enregistrement");
    }
  };

  const rejectedList = isModel
    ? model.blocks.flatMap((b) => b.rejected)
    : assistant.rejected;
  const historyList = isModel ? model.history : assistant.history;
  const doRollback = async (entry: (typeof historyList)[number]) => {
    if (isModel) await model.rollback(entry as ModelHistoryEntry);
    else await assistant.rollback(entry as ConfigHistoryEntry);
  };
  const busy = isModel ? model.asking : assistant.asking;

  return (
    <MobileLayout title="Paramétrage assisté" showBackButton>
      <div className="p-4 space-y-4 pb-32">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Réglez tout à la voix ou à l'écrit</p>
              <p className="text-xs text-muted-foreground mt-1">
                Grilles de prix, surcoûts, financements, gammes et aides. Rien n'est enregistré tant que
                vous n'avez pas validé la proposition.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Que voulez-vous régler ?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={domainKey} onValueChange={(v) => setDomainKey(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MODEL_KEY}>Modèle de régie complet</SelectItem>
                {CONFIG_DOMAINS.map((d) => (
                  <SelectItem key={d.key} value={d.key}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {domain && <p className="text-xs text-muted-foreground">{domain.description}</p>}
            {isModel && (
              <p className="text-xs text-muted-foreground">
                Dictez ou collez tout le fonctionnement d'une régie : gammes, grilles de prix et
                commissions, surcoûts, financements et aides. Chaque partie est proposée séparément.
              </p>
            )}

            {needsRegie && (
              <Select value={regieId ?? ""} onValueChange={(v) => setRegieId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une régie" />
                </SelectTrigger>
                <SelectContent>
                  {regies.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {!isModel && (
              <p className="text-xs text-muted-foreground">
                {assistant.loading
                  ? "Chargement…"
                  : `${assistant.rows.length} ligne(s) actuellement configurée(s)`}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Votre demande</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              rows={isModel ? 7 : 4}
              placeholder={
                isModel
                  ? `Ex : ${MODEL_EXAMPLES[0]}`
                  : domain?.examples?.[0]
                    ? `Ex : ${domain.examples[0]}`
                    : "Décrivez la modification souhaitée"
              }
            />
            {(isModel ? MODEL_EXAMPLES : domain?.examples) && (
              <div className="flex flex-wrap gap-2">
                {(isModel ? MODEL_EXAMPLES : domain!.examples).map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => setTexte(ex)}
                    className="text-xs rounded-full border px-3 py-1 text-muted-foreground hover:text-foreground"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}

            {fileName && (
              <div className="flex items-center justify-between text-xs bg-muted rounded-md px-3 py-2">
                <span className="truncate">{fileName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setFileDataUrl(null);
                    setFileName(null);
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label="Joindre un document"
                title="Joindre un document"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-4 w-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
              />
              <Button
                variant={recording ? "destructive" : "outline"}
                size="icon"
                aria-label={recording ? "Arrêter la dictée" : "Dicter la demande"}
                title={recording ? "Arrêter la dictée" : "Dicter la demande"}
                onClick={recording ? stopRecording : startRecording}
              >
                {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button className="flex-1 gap-2" onClick={() => runAsk()} disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {busy && isModel && model.progress
                  ? `Analyse : ${model.progress}…`
                  : "Proposer les changements"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {rejectedList.length > 0 && (
          <Card className="border-destructive/40">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Changements écartés
              </div>
              {rejectedList.map((r) => (
                <p key={r} className="text-xs text-muted-foreground">
                  {r}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {isModel && model.blocks.length > 0 && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Modèle proposé ({model.totalChanges} changement(s))
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {model.blocks.map((block) => (
                <div key={block.domain.key} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{block.domain.label}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {block.changements.length} changement(s)
                    </span>
                  </div>
                  {block.resume && <p className="text-sm">{block.resume}</p>}
                  {block.changements.map((c, i) => {
                    const meta = actionMeta[c.action];
                    const Icon = meta.icon;
                    return (
                      <div key={`${block.domain.key}-${c.id ?? i}`} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                          <span className="text-sm font-medium truncate">
                            {c.cible || "Nouvelle ligne"}
                          </span>
                        </div>
                        {c.action !== "supprimer" && (
                          <p className="text-xs text-muted-foreground">
                            {formatChangeValues(block.domain, c.valeurs)}
                          </p>
                        )}
                        {c.motif && <p className="text-xs text-muted-foreground italic">{c.motif}</p>}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 gap-2" onClick={model.discard}>
                  <X className="h-4 w-4" />
                  Abandonner
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={onApply}
                  disabled={model.applying || model.totalChanges === 0}
                >
                  {model.applying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Appliquer le modèle
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isModel && assistant.proposal && (
          <Card className="border-primary/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Proposition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assistant.proposal.resume && (
                <p className="text-sm font-medium">{assistant.proposal.resume}</p>
              )}
              {assistant.proposal.raisonnement && (
                <p className="text-xs text-muted-foreground whitespace-pre-line">
                  {assistant.proposal.raisonnement}
                </p>
              )}

              {assistant.proposal.changements.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun changement applicable.</p>
              ) : (
                <div className="space-y-2">
                  {assistant.proposal.changements.map((c, i) => {
                    const meta = actionMeta[c.action];
                    const Icon = meta.icon;
                    return (
                      <div key={`${c.action}-${c.id ?? i}`} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                            <Icon className="h-3 w-3" />
                            {meta.label}
                          </Badge>
                          <span className="text-sm font-medium truncate">{c.cible || "Nouvelle ligne"}</span>
                        </div>
                        {domain && c.action !== "supprimer" && (
                          <p className="text-xs text-muted-foreground">
                            {formatChangeValues(domain, c.valeurs)}
                          </p>
                        )}
                        {c.motif && <p className="text-xs text-muted-foreground italic">{c.motif}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1 gap-2" onClick={assistant.discard}>
                  <X className="h-4 w-4" />
                  Abandonner
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={onApply}
                  disabled={assistant.applying || assistant.proposal.changements.length === 0}
                >
                  {assistant.applying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Appliquer
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2">
            <button
              type="button"
              className="flex items-center justify-between w-full"
              onClick={() => setShowHistory((s) => !s)}
            >
              <CardTitle className="text-sm flex items-center gap-2">
                <History className="h-4 w-4" />
                Historique ({historyList.length})
              </CardTitle>
              <span className="text-xs text-muted-foreground">{showHistory ? "Masquer" : "Afficher"}</span>
            </button>
          </CardHeader>
          {showHistory && (
            <CardContent className="space-y-2">
              {historyList.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune modification enregistrée.</p>
              ) : (
                historyList.map((h) => (
                  <div key={h.id} className="rounded-md border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{h.resume || "Modification"}</span>
                      {h.statut === "annule" ? (
                        <Badge variant="outline">Annulée</Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={async () => {
                            try {
                              await doRollback(h);
                              toast.success("Paramétrage restauré");
                            } catch {
                              toast.error("Restauration impossible");
                            }
                          }}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Annuler
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </MobileLayout>
  );
};

export default ConfigAssistant;
