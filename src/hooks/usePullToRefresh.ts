import { useState, useRef, useCallback, useEffect } from "react";
import { useConnectionQuality } from "@/hooks/useConnectionQuality";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void> | void;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  maxPull = 120,
  disabled = false,
}: UsePullToRefreshOptions) {
  const { isEffectivelyOffline } = useConnectionQuality();
  const isDisabled = disabled || isEffectivelyOffline;
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (isDisabled || refreshing) return;
      // Only activate if scrolled to top
      const el = containerRef.current;
      if (el && el.scrollTop <= 0) {
        startY.current = e.touches[0].clientY;
        setPulling(true);
      }
    },
    [isDisabled, refreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!pulling || isDisabled || refreshing) return;
      const diff = e.touches[0].clientY - startY.current;
      if (diff > 0) {
        // Apply resistance
        const distance = Math.min(diff * 0.5, maxPull);
        setPullDistance(distance);
        if (distance > 10) {
          e.preventDefault();
        }
      }
    },
    [pulling, isDisabled, refreshing, maxPull]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!pulling || isDisabled) return;
    setPulling(false);

    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold * 0.6);
      try {
        // Trigger PWA update check alongside data refresh (don't force SKIP_WAITING here)
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg) reg.update();
          });
        }
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pulling, pullDistance, threshold, refreshing, onRefresh, disabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);

  return {
    containerRef,
    pullDistance,
    refreshing,
    progress,
  };
}
