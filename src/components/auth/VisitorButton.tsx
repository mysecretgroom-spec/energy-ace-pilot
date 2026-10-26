import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { startVisitorSession } from "@/lib/visitorMode";

export function VisitorButton({ label = "Essayer en visiteur", ...props }: ButtonProps & { label?: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      await startVisitorSession();
      navigate("/planning", { replace: true });
    } catch {
      toast.error("Le mode visiteur est momentanément indisponible.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button type="button" onClick={start} disabled={busy} {...props}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
      {label}
    </Button>
  );
}
