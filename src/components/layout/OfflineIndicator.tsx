import { WifiOff, CloudOff, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOfflineDocuments } from "@/hooks/useOfflineDocuments";

export function OfflineIndicator() {
  const { pendingCount, isSyncing, isOnline, syncPendingDocuments } = useOfflineDocuments();

  // Don't show anything if online and no pending docs
  if (isOnline && pendingCount === 0) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40">
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm ${
          isOnline
            ? "bg-amber-500/90 text-white"
            : "bg-slate-800/95 text-white"
        }`}
      >
        <div className="flex items-center gap-3">
          {!isOnline ? (
            <WifiOff className="h-5 w-5" />
          ) : pendingCount > 0 ? (
            <CloudOff className="h-5 w-5" />
          ) : (
            <Check className="h-5 w-5" />
          )}
          <div>
            <p className="font-medium text-sm">
              {!isOnline
                ? "Mode hors-ligne"
                : pendingCount > 0
                ? "Documents en attente"
                : "Tout est synchronisé"}
            </p>
            {pendingCount > 0 && (
              <p className="text-xs opacity-90">
                {pendingCount} document{pendingCount > 1 ? "s" : ""} à synchroniser
              </p>
            )}
          </div>
        </div>

        {isOnline && pendingCount > 0 && (
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 h-8"
            onClick={() => syncPendingDocuments()}
            disabled={isSyncing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sync..." : "Sync"}
          </Button>
        )}
      </div>
    </div>
  );
}
