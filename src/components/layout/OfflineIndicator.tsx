import { useState, useEffect, useRef } from "react";
import { WifiOff, CloudOff, RefreshCw, Wifi } from "lucide-react";

import { useOfflineDocuments } from "@/hooks/useOfflineDocuments";
import { useOfflineData } from "@/hooks/useOfflineData";
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
  const [dismissed, setDismissed] = useState(false);
  const wasOffline = useRef(false);
  const offlineSince = useRef<number | null>(null);

  // Detect transition from offline → online
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setDismissed(false);
      if (!offlineSince.current) offlineSince.current = Date.now();
    } else if (wasOffline.current) {
      wasOffline.current = false;
      offlineSince.current = null;
      setShowBackOnline(true);
      const timer = setTimeout(() => setShowBackOnline(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  const isSyncing = isSyncingDocs || isSyncingData;
  const totalPending = pendingDocsCount + pendingEtudesCount + pendingWhatsAppCount;

  // Show brief "back online" pill
  if (showBackOnline && totalPending === 0) {
    return (
      <div className="fixed bottom-[5.5rem] left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full shadow-md bg-emerald-500/90 text-white text-xs font-medium">
          <Wifi className="h-3.5 w-3.5" />
          Connexion rétablie
        </div>
      </div>
    );
  }

  // Don't show anything if online and no pending items, or dismissed
  if (isOnline && totalPending === 0) return null;
  if (dismissed && isOnline) return null;

  // L'état hors ligne est déjà confirmé par sondes réseau en amont : pas de délai ici.

  const handleSync = async () => {
    await Promise.all([syncPendingDocuments(), syncAll()]);
    setDismissed(true);
  };

  // Compact pill design instead of full-width banner
  return (
    <div className="fixed bottom-[5.5rem] left-1/2 -translate-x-1/2 z-30 animate-in fade-in slide-in-from-bottom-2 duration-200">
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full shadow-md text-xs font-medium",
          !isOnline
            ? "bg-slate-700/90 text-white/90"
            : "bg-amber-500/85 text-white"
        )}
      >
        {!isOnline ? (
          <>
            <WifiOff className="h-3.5 w-3.5" />
            <span>Hors-ligne</span>
            {totalPending > 0 && (
              <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
                {totalPending}
              </span>
            )}
          </>
        ) : totalPending > 0 ? (
          <>
            <CloudOff className="h-3.5 w-3.5" />
            <span>{totalPending} en attente</span>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="ml-1 bg-white/25 hover:bg-white/35 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors"
            >
              {isSyncing ? (
                <RefreshCw className="h-3 w-3 animate-spin inline" />
              ) : (
                "Sync"
              )}
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
