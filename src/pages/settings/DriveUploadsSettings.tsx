import { useEffect, useState } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, FileText, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Row = {
  id: string; file_name: string; drive_link: string | null; status: string;
  error: string | null; created_at: string; source: string;
  clients: { nom: string | null; prenom: string | null } | null;
};

const SOURCES: Record<string, string> = { document: "Document", whatsapp: "WhatsApp", etude: "Étude", scan: "Scan" };

const DriveUploadsSettings = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("drive_uploads")
      .select("id, file_name, drive_link, status, error, created_at, source, clients:client_id(nom, prenom)")
      .eq("user_id", user.id).order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setRows((data ?? []) as unknown as Row[]));
  }, [user]);

  const name = (r: Row) => r.clients ? [r.clients.prenom, r.clients.nom].filter(Boolean).join(" ") : "Sans client";
  const list = rows?.filter((r) => `${r.file_name} ${name(r)}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <MobileLayout title="Envois Google Drive">
      <div className="p-4 space-y-4 max-w-lg mx-auto pb-32">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg">Envois Google Drive</CardTitle>
            <CardDescription>Chaque fichier envoyé sur ton Google Drive, avec la date, le client et le lien.</CardDescription>
          </CardHeader>
        </Card>

        <Input placeholder="Rechercher un client ou un fichier" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="space-y-2">
          {!list ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)
            : list.length === 0 ? <p className="text-center text-muted-foreground py-8">Aucun envoi pour le moment</p>
            : list.map((r) => {
              const failed = r.status !== "sent";
              const Icon = failed ? AlertCircle : FileText;
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card min-h-[64px]">
                  <Icon className={`h-5 w-5 shrink-0 ${failed ? "text-destructive" : "text-primary"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.file_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {name(r)} · {SOURCES[r.source] ?? r.source} · {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                    {failed && r.error && <p className="text-xs text-destructive truncate">{r.error}</p>}
                  </div>
                  {r.drive_link && (
                    <a href={r.drive_link} target="_blank" rel="noopener noreferrer"
                      className="h-11 w-11 flex items-center justify-center rounded-lg border text-primary shrink-0"
                      aria-label={`Ouvrir ${r.file_name} dans Google Drive`}>
                      <ExternalLink className="h-5 w-5" />
                    </a>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </MobileLayout>
  );
};

export default DriveUploadsSettings;
