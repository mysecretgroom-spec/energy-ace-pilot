import { useCallback, useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CloudUpload, Loader2, Unplug } from "lucide-react";

type Status = { connected: boolean; email?: string | null; reconnectRequired?: boolean };

export async function callDrive<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("google-drive", { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    throw new Error(details);
  }
  return data as T;
}

export function GoogleDriveConnect({ onSynced }: { onSynced?: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);

  const refresh = useCallback(() => {
    callDrive<Status>({ action: "status" }).then(setStatus).catch(() => setStatus({ connected: false }));
  }, []);
  useEffect(refresh, [refresh]);

  const connect = async () => {
    setBusy("connect");
    try {
      const { authorizationUrl } = await callDrive<{ authorizationUrl: string }>({ action: "start", origin: window.location.origin });
      window.location.assign(authorizationUrl);
    } catch (e) {
      toast.error("Impossible d'ouvrir Google", { description: (e as Error).message.slice(0, 200) });
      setBusy(null);
    }
  };

  const sync = async () => {
    setBusy("sync");
    try {
      let total = 0, failed = 0, remaining = 1, rounds = 0;
      while (remaining > 0 && rounds < 20) {
        const r = await callDrive<{ connected: boolean; sent: number; failed: number; remaining: number; reconnectRequired?: boolean }>({ action: "sync" });
        if (!r.connected) { setStatus(r); toast.error("Reconnecte ton Google Drive"); return; }
        total += r.sent; failed += r.failed; remaining = r.remaining; rounds++;
        onSynced?.();
        if (r.sent + r.failed === 0) break;
      }
      toast.success(`${total} fichier${total > 1 ? "s" : ""} envoyé${total > 1 ? "s" : ""} sur Drive`, {
        description: failed ? `${failed} en échec, détail dans la liste` : undefined,
      });
    } catch (e) {
      toast.error("Envoi interrompu", { description: (e as Error).message.slice(0, 200) });
    } finally { setBusy(null); }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    try { setStatus(await callDrive<Status>({ action: "disconnect" })); } finally { setBusy(null); }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Mon Google Drive</CardTitle>
        <CardDescription>
          {status === null ? "Vérification…"
            : status.connected ? `Relié à ${status.email ?? "ton compte Google"}. Les fichiers vont dans le dossier DébalePro, un sous-dossier par client.`
            : status.reconnectRequired ? "L'accès a expiré, reconnecte ton compte."
            : "Relie ton compte Google pour y envoyer tes documents, photos WhatsApp et études."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {status?.connected ? (
          <>
            <Button onClick={sync} disabled={!!busy}>
              {busy === "sync" ? <Loader2 className="h-5 w-5 animate-spin" /> : <CloudUpload className="h-5 w-5" />}
              Envoyer les fichiers sur Drive
            </Button>
            <Button variant="outline" onClick={disconnect} disabled={!!busy}>
              <Unplug className="h-5 w-5" /> Déconnecter
            </Button>
          </>
        ) : (
          <Button onClick={connect} disabled={!!busy || status === null}>
            {busy === "connect" && <Loader2 className="h-5 w-5 animate-spin" />}
            {status?.reconnectRequired ? "Reconnecter Google Drive" : "Connecter Google Drive"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
