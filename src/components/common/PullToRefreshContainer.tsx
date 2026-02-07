import { ReactNode, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { cn } from "@/lib/utils";

async function checkPWAUpdate() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          window.location.reload();
        }
      }
    } catch (e) {
      console.log('[PWA] Update check failed:', e);
    }
  }
}

interface PullToRefreshContainerProps {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function PullToRefreshContainer({
  onRefresh,
  children,
  className,
  disabled = false,
}: PullToRefreshContainerProps) {
  const handleRefresh = useCallback(async () => {
    await Promise.all([
      Promise.resolve(onRefresh()),
      checkPWAUpdate(),
    ]);
  }, [onRefresh]);

  const { containerRef, pullDistance, refreshing, progress } = usePullToRefresh({
    onRefresh: handleRefresh,
    disabled,
  });

  return (
    <div ref={containerRef} className={cn("relative overflow-auto", className)}>
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center pointer-events-none z-10 transition-opacity duration-200"
        style={{
          top: -40 + pullDistance,
          opacity: progress > 0.1 ? 1 : 0,
        }}
      >
        <div className={cn(
          "w-9 h-9 rounded-full bg-background border border-border shadow-md flex items-center justify-center transition-all",
          refreshing && "animate-pulse"
        )}>
          <RefreshCw
            className={cn(
              "h-4 w-4 text-primary transition-transform duration-200",
              refreshing && "animate-spin"
            )}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with pull transform */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transitionDuration: pullDistance > 0 ? "0ms" : "300ms",
        }}
      >
        {children}
      </div>
    </div>
  );
}
