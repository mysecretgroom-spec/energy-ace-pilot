import { Check, Loader2, Cloud, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoSaveIndicatorProps {
  isSaving: boolean;
  lastSaved: Date | null;
  hasUnsavedChanges: boolean;
  isOnline: boolean;
  className?: string;
}

export function AutoSaveIndicator({
  isSaving,
  lastSaved,
  hasUnsavedChanges,
  isOnline,
  className,
}: AutoSaveIndicatorProps) {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-opacity duration-300",
        className
      )}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-amber-500">Hors-ligne</span>
        </>
      ) : isSaving ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Enregistrement...</span>
        </>
      ) : hasUnsavedChanges ? (
        <>
          <Cloud className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-amber-500">Modifications non sauvées</span>
        </>
      ) : lastSaved ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-500" />
          <span className="text-muted-foreground">
            Sauvegardé à {formatTime(lastSaved)}
          </span>
        </>
      ) : null}
    </div>
  );
}
