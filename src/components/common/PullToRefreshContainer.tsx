import { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { cn } from "@/lib/utils";

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
  const { containerRef, pullDistance, refreshing, progress } = usePullToRefresh({
    onRefresh,
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
