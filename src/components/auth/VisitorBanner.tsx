import { useNavigate } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function VisitorBanner() {
  const navigate = useNavigate();
  const leave = async (to: string) => {
    await supabase.auth.signOut({ scope: "local" });
    navigate(to, { replace: true });
  };
  return (
    <div role="status" className="sticky top-0 z-[70] border-b bg-accent text-accent-foreground">
      <div className="max-w-5xl mx-auto px-3 py-2 flex flex-wrap items-center gap-2 text-sm">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="flex-1 min-w-0">
          <strong>Mode visiteur</strong> · données fictives, IA désactivée, rien n'est enregistré.
        </span>
        <Button size="sm" variant="ghost" onClick={() => leave("/")}>Quitter</Button>
        <Button size="sm" onClick={() => leave("/signup")}>Créer un compte</Button>
      </div>
    </div>
  );
}
