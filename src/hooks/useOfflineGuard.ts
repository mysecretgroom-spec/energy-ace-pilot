import { useConnectionQuality } from "@/hooks/useConnectionQuality";
import { useCallback } from "react";

/**
 * Hook that provides offline status info.
 * Mutations are now automatically queued by the fetch interceptor,
 * so this hook is mainly for UI display purposes.
 */
export function useOfflineGuard() {
  const { isEffectivelyOffline } = useConnectionQuality();

  const guardAction = useCallback(
    async <T>(action: () => Promise<T> | T): Promise<T | undefined> => {
      // Actions are now queued automatically — just execute
      return action();
    },
    []
  );

  return {
    guardAction,
    isOffline: isEffectivelyOffline,
  };
}
