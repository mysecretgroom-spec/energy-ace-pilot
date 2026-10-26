import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { callDrive } from "@/components/settings/GoogleDriveConnect";
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
    callDrive({ action: "complete", code })
      .then(() => navigate("/parametres/envois-drive", { replace: true }))
      .catch((e) => setError((e as Error).message.slice(0, 200)));
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      {error ? (
        <>
          <p className="font-medium">Google Drive n'a pas pu être relié</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/parametres/envois-drive", { replace: true })}>Retour</Button>
        </>
      ) : (
        <><Loader2 className="h-8 w-8 animate-spin text-primary" /><p>Connexion à Google Drive…</p></>
      )}
    </div>
  );
}
