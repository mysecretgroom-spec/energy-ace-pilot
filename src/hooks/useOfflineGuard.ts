import { toast } from "sonner";
import { useConnectionQuality } from "@/hooks/useConnectionQuality";
import { useCallback } from "react";

/**
 * Hook that provides a guard function to wrap any action requiring internet.
 * If offline, shows a toast and prevents execution.
 * If online, executes the action normally.
 *
 * Usage:
 *   const { guardAction, isOffline } = useOfflineGuard();
 *   const handleSave = () => guardAction(async () => { await saveToDB(); });
 */
export function useOfflineGuard() {
  const { isEffectivelyOffline } = useConnectionQuality();

  const guardAction = useCallback(
    async <T>(action: () => Promise<T> | T): Promise<T | undefined> => {
      if (isEffectivelyOffline) {
        toast.error("Action indisponible, vérifiez votre connexion internet", {
          icon: "📡",
          duration: 2500,
        });
        return undefined;
      }
      return action();
    },
    [isEffectivelyOffline]
  );

  return {
    guardAction,
    isOffline: isEffectivelyOffline,
  };
}

/**
 * Standalone guard function (non-hook) for use outside React components.
 * Checks navigator.onLine + Network Information API.
 */
export function guardOnlineAction<T>(
  action: () => Promise<T> | T
): Promise<T | undefined> {
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  const weakTypes = new Set(["slow-2g", "2g"]);

  const isOffline =
    !navigator.onLine ||
    (conn && (weakTypes.has(conn.effectiveType) || conn.rtt > 2000 || conn.downlink < 0.1));

  if (isOffline) {
    toast.error("Action indisponible, vérifiez votre connexion internet", {
      icon: "📡",
      duration: 2500,
    });
    return Promise.resolve(undefined);
  }

  return Promise.resolve(action());
}
