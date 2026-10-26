import { useQuery } from "@tanstack/react-query";
import { Download, Archive } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deliverFile } from "@/lib/fileDelivery";

/** Liste des archives ZIP des images envoyées sur WhatsApp, téléchargeables. */
export default function WhatsAppImageArchives() {
  const { user } = useAuth();
  const { data: archives = [] } = useQuery({
    queryKey: ["whatsapp-image-archives", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_image_archives")
        .select("id, storage_path, image_count, size_bytes, period_start, period_end, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from("whatsapp-archives").download(path);
    if (error || !data) return toast.error("Téléchargement impossible");
    await deliverFile(data, path.split("/").pop() || "whatsapp.zip");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4" />Images archivées</CardTitle>
        <CardDescription>Les images envoyées sur WhatsApp sont regroupées en ZIP après 2 jours.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {archives.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune archive pour le moment.</p>
        ) : archives.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
            <div className="text-sm">
              <p className="font-medium">{a.image_count} image{a.image_count > 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground">
                {a.period_start ? format(new Date(a.period_start), "d MMM", { locale: fr }) : ""}
                {a.period_end ? ` – ${format(new Date(a.period_end), "d MMM yyyy", { locale: fr })}` : ""}
                {` · ${(a.size_bytes / 1048576).toFixed(1)} Mo`}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => download(a.storage_path)}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
