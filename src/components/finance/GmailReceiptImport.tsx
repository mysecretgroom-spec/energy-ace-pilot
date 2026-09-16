import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Mail, Plus, Trash2, RefreshCw, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Filtre {
  id: string;
  terme: string;
  champ: "sujet" | "contenu" | "tout";
  actif: boolean;
}

const CHAMP_LABEL: Record<Filtre["champ"], string> = {
  sujet: "Sujet",
  contenu: "Contenu",
  tout: "Sujet + contenu",
};

// Mots-clés proposés automatiquement à la première ouverture
const DEFAULT_TERMES: Array<{ terme: string; champ: Filtre["champ"] }> = [
  { terme: "facture", champ: "tout" },
  { terme: "reçu", champ: "tout" },
  { terme: "recu", champ: "tout" },
  { terme: "paiement", champ: "tout" },
  { terme: "péage", champ: "tout" },
  { terme: "peage", champ: "tout" },
  { terme: "note de frais", champ: "tout" },
  { terme: "invoice", champ: "tout" },
  { terme: "receipt", champ: "tout" },
  { terme: "toll", champ: "contenu" },
  { terme: "carburant", champ: "tout" },
];

interface Props {
  onImported?: () => void;
}

export function GmailReceiptImport({ onImported }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filtres, setFiltres] = useState<Filtre[]>([]);
  const [newTerme, setNewTerme] = useState("");
  const [newChamp, setNewChamp] = useState<Filtre["champ"]>("sujet");
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [interval, setIntervalMinutes] = useState(60);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if (user) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [{ data: f }, { data: s }] = await Promise.all([
        supabase
          .from("email_frais_filtres")
          .select("id, terme, champ, actif")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("user_settings")
          .select("gmail_frais_sync_enabled, gmail_frais_sync_interval_minutes, gmail_frais_last_auto_sync")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      const existing = (f as Filtre[]) || [];
      if (existing.length === 0) {
        // Première ouverture : pré-remplir avec les mots-clés par défaut
        const { data: seeded } = await supabase
          .from("email_frais_filtres")
          .insert(DEFAULT_TERMES.map((t) => ({ ...t, user_id: user.id })))
          .select("id, terme, champ, actif");
        if (seeded?.length) setFiltres(seeded as Filtre[]);
      } else {
        setFiltres(existing);
      }
      if (s) {
        setAutoEnabled(!!s.gmail_frais_sync_enabled);
        setIntervalMinutes(s.gmail_frais_sync_interval_minutes ?? 60);
        setLastSync(s.gmail_frais_last_auto_sync ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  const addFiltre = async () => {
    if (!user) return;
    const terme = newTerme.trim();
    if (!terme) return;
    const { data, error } = await supabase
      .from("email_frais_filtres")
      .insert({ user_id: user.id, terme, champ: newChamp })
      .select("id, terme, champ, actif")
      .single();
    if (error) {
      toast.error(
        error.code === "23505" ? "Ce mot-clé existe déjà" : "Impossible d'ajouter le mot-clé",
      );
      return;
    }
    setFiltres((prev) => [...prev, data as Filtre]);
    setNewTerme("");
  };

  const toggleFiltre = async (f: Filtre) => {
    setFiltres((prev) => prev.map((x) => (x.id === f.id ? { ...x, actif: !x.actif } : x)));
    await supabase.from("email_frais_filtres").update({ actif: !f.actif }).eq("id", f.id);
  };

  const removeFiltre = async (id: string) => {
    setFiltres((prev) => prev.filter((f) => f.id !== id));
    await supabase.from("email_frais_filtres").delete().eq("id", id);
  };

  const saveAuto = async (enabled: boolean, minutes: number) => {
    if (!user) return;
    setAutoEnabled(enabled);
    setIntervalMinutes(minutes);
    await supabase.from("user_settings").upsert(
      {
        user_id: user.id,
        gmail_frais_sync_enabled: enabled,
        gmail_frais_sync_interval_minutes: minutes,
      },
      { onConflict: "user_id" },
    );
  };

  const scanNow = async () => {
    if (!filtres.some((f) => f.actif)) {
      toast.error("Ajoutez au moins un mot-clé actif");
      return;
    }
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-gmail-frais", {
        body: { days: 30 },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.code === "GOOGLE_NOT_CONNECTED") {
          toast.error("Compte Google non connecté", {
            description: "Connectez-le dans les paramètres",
          });
        } else {
          toast.error(data.error);
        }
        return;
      }
      const imported = data?.imported ?? 0;
      if (imported > 0) {
        toast.success(
          imported === 1 ? "1 justificatif importé" : `${imported} justificatifs importés`,
        );
        onImported?.();
      } else if (data?.errors > 0) {
        toast.warning(`${data.errors} pièce(s) jointe(s) illisible(s)`);
      } else {
        toast.info("Aucun nouveau justificatif trouvé");
      }
    } catch (err) {
      console.error("Gmail frais scan error:", err);
      toast.error("Analyse des emails impossible");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex flex-col max-h-[85vh]">
      <div className="p-4 border-b">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Factures reçues par email
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Les emails sont repérés par mots-clés dans le sujet ou le contenu, pas par expéditeur.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-5">
          {/* Ajout de mot-clé */}
          <div className="space-y-2">
            <Label>Mots-clés à rechercher</Label>
            <div className="flex gap-2">
              <Input
                placeholder="ex : facture, reçu, péage"
                value={newTerme}
                onChange={(e) => setNewTerme(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addFiltre();
                  }
                }}
              />
              <Select value={newChamp} onValueChange={(v) => setNewChamp(v as Filtre["champ"])}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sujet">Sujet</SelectItem>
                  <SelectItem value="contenu">Contenu</SelectItem>
                  <SelectItem value="tout">Sujet + contenu</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" onClick={() => void addFiltre()} disabled={!newTerme.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Liste */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtres.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Aucun mot-clé pour l'instant. Ajoutez-en un pour lancer la détection.
            </p>
          ) : (
            <div className="space-y-2">
              {filtres.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Switch checked={f.actif} onCheckedChange={() => void toggleFiltre(f)} />
                    <span className="truncate text-sm font-medium">{f.terme}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {CHAMP_LABEL[f.champ]}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => void removeFiltre(f.id)}
                    aria-label={`Supprimer ${f.terme}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Automatisation */}
          <div className="space-y-4 rounded-lg border p-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Détection automatique
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Analyse vos emails en arrière-plan.
                </p>
              </div>
              <Switch
                checked={autoEnabled}
                onCheckedChange={(v) => void saveAuto(v, interval)}
              />
            </div>

            {autoEnabled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fréquence</span>
                  <Badge variant="secondary" className="font-mono">
                    {interval} min
                  </Badge>
                </div>
                <Slider
                  value={[interval]}
                  onValueChange={([v]) => setIntervalMinutes(v)}
                  onValueCommit={([v]) => void saveAuto(true, v)}
                  min={60}
                  max={360}
                  step={60}
                />
                {lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Dernière analyse :{" "}
                    {format(new Date(lastSync), "dd MMM à HH:mm", { locale: fr })}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <Button className="w-full gap-2 h-11" onClick={() => void scanNow()} disabled={scanning}>
          {scanning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyse en cours…
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Analyser mes emails
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
