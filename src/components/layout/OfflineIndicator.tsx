import { useState, useEffect, useRef } from "react";
import { WifiOff, CloudOff, RefreshCw, Check, FileText, MessageCircle, Wifi, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineDocuments } from "@/hooks/useOfflineDocuments";
import { useOfflineData } from "@/hooks/useOfflineData";
import { getPendingMutationCount } from "@/lib/offlineMutationQueue";
import { cn } from "@/lib/utils";

export function OfflineIndicator() {
  const { pendingCount: pendingDocsCount, isSyncing: isSyncingDocs, isOnline, syncPendingDocuments } = useOfflineDocuments();
  const { 
    pendingEtudesCount, 
    pendingWhatsAppCount, 
    isSyncing: isSyncingData, 
    syncAll 
  } = useOfflineData();

  const [showBackOnline, setShowBackOnline] = useState(false);
  const [pendingMutationsCount, setPendingMutationsCount] = useState(0);
  const wasOffline = useRef(false);

  // Track pending mutations count
  useEffect(() => {
    const refresh = async () => {
      const count = await getPendingMutationCount();
      setPendingMutationsCount(count);
    };
    refresh();
    window.addEventListener("offline-queue-changed", refresh);
    // Also refresh periodically when offline
    const interval = setInterval(refresh, 3000);
    return () => {
      window.removeEventListener("offline-queue-changed", refresh);
      clearInterval(interval);
    };
  }, []);

  // Detect transition from offline → online
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  const isSyncing = isSyncingDocs || isSyncingData;
  const totalPending = pendingDocsCount + pendingEtudesCount + pendingWhatsAppCount + pendingMutationsCount;

  // Show "back online" toast briefly
  if (showBackOnline && totalPending === 0) {
    return (
      <div className="fixed bottom-[5.5rem] left-3 right-3 z-30 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm bg-emerald-500/90 text-white">
          <Wifi className="h-5 w-5" />
          <p className="font-medium text-sm">Connexion rétablie ✓</p>
        </div>
      </div>
    );
  }

  // Don't show anything if online and no pending items
  if (isOnline && totalPending === 0) return null;

  const handleSync = async () => {
    await Promise.all([syncPendingDocuments(), syncAll()]);
  };

  return (
    <div className={cn(
      "fixed bottom-[5.5rem] left-3 right-3 z-30",
      "animate-in slide-in-from-bottom-4 fade-in duration-300"
    )}>
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
              <div className="flex items-center gap-2 text-xs opacity-90 mt-0.5 flex-wrap">
                {pendingMutationsCount > 0 && (
                  <span className="flex items-center gap-1">
                    <Send className="h-3 w-3" />
                    {pendingMutationsCount} action{pendingMutationsCount > 1 ? "s" : ""}
                  </span>
                )}
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
