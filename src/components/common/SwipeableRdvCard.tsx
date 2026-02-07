import { ReactNode, useRef, useState, useCallback } from "react";
import { Phone, Navigation, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRdvActions } from "@/hooks/useRdvActions";

interface SwipeableRdvCardProps {
  children: ReactNode;
  phone?: string | null;
  address?: string;
  postalCode?: string;
  city?: string;
  rdvId: string;
  clientId: string;
  className?: string;
}

export function SwipeableRdvCard({
  children,
  phone,
  address,
  postalCode,
  city,
  rdvId,
  clientId,
  className,
}: SwipeableRdvCardProps) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const swiping = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);

  const { callPhone, openGoogleMaps, openClient } = useRdvActions();

  const THRESHOLD = 70;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    swiping.current = true;
    isHorizontal.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    // Determine swipe direction on first significant move
    if (isHorizontal.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }

    if (!isHorizontal.current) return;

    // Apply resistance
    const clamped = Math.max(-THRESHOLD - 20, Math.min(THRESHOLD + 20, dx * 0.6));
    setOffset(clamped);
  }, []);

  const handleTouchEnd = useCallback(() => {
    swiping.current = false;
    isHorizontal.current = null;

    if (offset > THRESHOLD) {
      // Swipe right → Call
      if (phone) {
        triggerHaptic();
        callPhone(phone);
      }
    } else if (offset < -THRESHOLD) {
      // Swipe left → GPS
      triggerHaptic();
      openGoogleMaps(address, postalCode, city);
    }

    setOffset(0);
  }, [offset, phone, address, postalCode, city, callPhone, openGoogleMaps]);

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const leftRevealed = offset > 20;
  const rightRevealed = offset < -20;
  const leftTriggered = offset > THRESHOLD;
  const rightTriggered = offset < -THRESHOLD;

  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)}>
      {/* Left action (call) */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex items-center justify-center w-20 transition-colors rounded-l-lg",
          leftTriggered ? "bg-green-500" : "bg-green-500/20"
        )}
        style={{ opacity: leftRevealed ? 1 : 0 }}
      >
        <Phone className={cn("h-5 w-5", leftTriggered ? "text-white" : "text-green-600")} />
      </div>

      {/* Right action (GPS) */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex items-center justify-center w-20 transition-colors rounded-r-lg",
          rightTriggered ? "bg-blue-500" : "bg-blue-500/20"
        )}
        style={{ opacity: rightRevealed ? 1 : 0 }}
      >
        <Navigation className={cn("h-5 w-5", rightTriggered ? "text-white" : "text-blue-600")} />
      </div>

      {/* Card content */}
      <div
        className="relative z-10 bg-background transition-transform"
        style={{
          transform: `translateX(${offset}px)`,
          transitionDuration: swiping.current ? "0ms" : "300ms",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
