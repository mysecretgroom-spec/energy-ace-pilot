import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { callDrive } from "@/components/settings/GoogleDriveConnect";
import { callGoogleAccount } from "@/lib/googleConnection";
import { Button } from "@/components/ui/button";

export default function GoogleDriveReturn() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) { setError(params.get("error") ?? "Connexion annulée"); return; }
    const state = params.get("state");
    window.history.replaceState({}, "", window.location.pathname);
    const complete = state ? callGoogleAccount({ action: "complete", code, state }) : callDrive({ action: "complete", code });
    complete.then(() => {
      if (window.opener) {
        window.opener.postMessage({ type: "googleAccountComplete", ok: true }, window.location.origin);
        window.close();
      } else navigate("/parametres/envois-drive", { replace: true });
    }).catch((e) => {
      const message = (e as Error).message.slice(0, 200);
      setError(message);
      window.opener?.postMessage({ type: "googleAccountComplete", ok: false, error: message }, window.location.origin);
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="font-medium">Google n'a pas pu être relié</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/parametres/envois-drive", { replace: true })}>Retour</Button>
        </>
      ) : (
        <><Loader2 className="h-8 w-8 animate-spin text-primary" /><p>Connexion à Gmail, Drive et Agenda…</p></>
      )}
    </div>
  );
}
