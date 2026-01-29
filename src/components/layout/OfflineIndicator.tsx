import { WifiOff, CloudOff, RefreshCw, Check, FileText, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineDocuments } from "@/hooks/useOfflineDocuments";
import { useOfflineData } from "@/hooks/useOfflineData";

export function OfflineIndicator() {
  const { pendingCount: pendingDocsCount, isSyncing: isSyncingDocs, isOnline, syncPendingDocuments } = useOfflineDocuments();
  const { 
    pendingEtudesCount, 
    pendingWhatsAppCount, 
    isSyncing: isSyncingData, 
    syncAll 
  } = useOfflineData();

  const isSyncing = isSyncingDocs || isSyncingData;
  const totalPending = pendingDocsCount + pendingEtudesCount + pendingWhatsAppCount;

  // Don't show anything if online and no pending items
  if (isOnline && totalPending === 0) return null;

  const handleSync = async () => {
    await Promise.all([syncPendingDocuments(), syncAll()]);
  };

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
          ) : totalPending > 0 ? (
            <CloudOff className="h-5 w-5" />
          ) : (
            <Check className="h-5 w-5" />
          )}
          <div>
            <p className="font-medium text-sm">
              {!isOnline
                ? "Mode hors-ligne"
                : totalPending > 0
                ? "Éléments en attente"
                : "Tout est synchronisé"}
            </p>
            {totalPending > 0 && (
              <div className="flex items-center gap-2 text-xs opacity-90 mt-0.5">
                {pendingDocsCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {pendingDocsCount} doc{pendingDocsCount > 1 ? "s" : ""}
                  </span>
                )}
                {pendingEtudesCount > 0 && (
                  <span className="flex items-center gap-1">
                    📋 {pendingEtudesCount} étude{pendingEtudesCount > 1 ? "s" : ""}
                  </span>
                )}
                {pendingWhatsAppCount > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {pendingWhatsAppCount} msg
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {isOnline && totalPending > 0 && (
          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5 h-8"
            onClick={handleSync}
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
