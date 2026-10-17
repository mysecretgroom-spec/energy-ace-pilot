import { AlertTriangle, Loader2, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PageLoading({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 bg-background px-4 ${fullScreen ? "min-h-screen" : "min-h-64 py-12"}`}>
      <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin motion-reduce:animate-none text-primary" />
      <p className="text-sm text-muted-foreground">Chargement en cours…</p>
    </div>
  );
}

export function PageError({ title = "Chargement impossible", message = "Les informations n’ont pas pu être chargées. Vérifiez votre connexion et réessayez.", onRetry, onBack, fullScreen = false }: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  onBack?: () => void;
  fullScreen?: boolean;
}) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-4 bg-background px-4 text-center ${fullScreen ? "min-h-screen" : "min-h-64 py-12"}`}>
      <AlertTriangle aria-hidden="true" className="h-8 w-8 text-destructive" />
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {onRetry && <Button onClick={onRetry} className="gap-2"><RefreshCw className="h-4 w-4" />Réessayer</Button>}
        {onBack && <Button variant="outline" onClick={onBack} className="gap-2"><Home className="h-4 w-4" />Retour</Button>}
      </div>
    </div>
  );
}