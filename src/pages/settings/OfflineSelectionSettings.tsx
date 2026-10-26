import { useCallback, useEffect, useMemo, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, FileText, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatBytes, listPins, pinDocument, pinEtude, unpin, PINS_EVENT, type Pin, type PinKind } from "@/lib/offline/pinned";

type Row = { id: string; title: string; subtitle: string; url?: string };

const clientName = (c: { nom?: string | null; prenom?: string | null } | null) =>
  c ? [c.prenom, c.nom].filter(Boolean).join(" ") : "Client";

const OfflineSelectionSettings = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<PinKind>("etude");
  const [etudes, setEtudes] = useState<Row[] | null>(null);
  const [docs, setDocs] = useState<Row[] | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const refreshPins = useCallback(() => { if (user) listPins(user.id).then(setPins); }, [user]);

  useEffect(() => {
    refreshPins();
    window.addEventListener(PINS_EVENT, refreshPins);
    return () => window.removeEventListener(PINS_EVENT, refreshPins);
  }, [refreshPins]);

  useEffect(() => {
    if (!user) return;
    supabase.from("etudes").select("id, product_type, updated_at, clients(nom, prenom)")
      .eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100)
      .then(({ data }) => setEtudes((data ?? []).map((e: any) => ({
        id: e.id,
        title: clientName(e.clients),
        subtitle: `Étude ${e.product_type ?? ""} · ${new Date(e.updated_at).toLocaleDateString("fr-FR")}`,
      }))));
    supabase.from("documents").select("id, nom, url, created_at, clients(nom, prenom)")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(150)
      .then(({ data }) => setDocs((data ?? []).map((d: any) => ({
        id: d.id, url: d.url, title: d.nom,
        subtitle: `${clientName(d.clients)} · ${new Date(d.created_at).toLocaleDateString("fr-FR")}`,
      }))));
  }, [user]);

  const pinned = useMemo(() => new Map(pins.map((p) => [`${p.kind}:${p.id}`, p])), [pins]);
  const total = pins.reduce((s, p) => s + p.bytes, 0);
  const rows = (tab === "etude" ? etudes : docs)?.filter((r) =>
    `${r.title} ${r.subtitle}`.toLowerCase().includes(search.toLowerCase()));

  const toggle = async (row: Row, on: boolean) => {
    if (!user) return;
    if (on && !navigator.onLine) { toast.error("Connexion nécessaire pour télécharger"); return; }
    setBusy(row.id);
    try {
      if (!on) await unpin(user.id, tab, row.id);
      else if (tab === "etude") await pinEtude(user.id, { id: row.id, label: `${row.title} — ${row.subtitle}` });
      else await pinDocument(user.id, { id: row.id, nom: row.title, url: row.url! });
      toast.success(on ? "Disponible hors ligne" : "Retiré du téléphone");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Échec du téléchargement");
    } finally { setBusy(null); }
  };

  return (
    <MobileLayout title="Hors ligne">
      <div className="p-4 space-y-4 max-w-lg mx-auto pb-32">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Disponible sans connexion</CardTitle>
            <CardDescription>
              Choisis les études et documents à garder sur ce téléphone. Ils s'ouvriront même sans réseau.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {pins.length} élément{pins.length > 1 ? "s" : ""} gardé{pins.length > 1 ? "s" : ""} · {formatBytes(total)}
          </CardContent>
        </Card>

        <Tabs value={tab} onValueChange={(v) => setTab(v as PinKind)}>
          <TabsList className="grid grid-cols-2 w-full h-auto">
            <TabsTrigger value="etude">Études</TabsTrigger>
            <TabsTrigger value="document">Documents</TabsTrigger>
          </TabsList>
        </Tabs>

        <Input placeholder="Rechercher un client ou un document" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="space-y-2">
          {!rows ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)
            : rows.length === 0 ? <p className="text-center text-muted-foreground py-8">Aucun élément</p>
            : rows.map((row) => {
              const pin = pinned.get(`${tab}:${row.id}`);
              const Icon = tab === "etude" ? ClipboardList : FileText;
              return (
                <label key={row.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card min-h-[64px]">
                  <Icon className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{row.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {row.subtitle}{pin ? ` · ${formatBytes(pin.bytes)}` : ""}
                    </p>
                  </div>
                  {busy === row.id ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    : <Switch checked={!!pin} onCheckedChange={(v) => toggle(row, v)} aria-label={`Garder ${row.title} hors ligne`} />}
                </label>
              );
            })}
        </div>
      </div>
    </MobileLayout>
  );
};

export default OfflineSelectionSettings;
