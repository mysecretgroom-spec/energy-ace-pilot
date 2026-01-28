import { useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

const BLUR_RESET_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

interface BlurOverlayProps {
  children: ReactNode;
  /** Storage key for persistence - if set, blur won't show again once dismissed (for 30 min) */
  storageKey?: string;
  /** Blur intensity (default: 8) */
  blurAmount?: number;
  /** Show a darker/more opaque overlay */
  opaque?: boolean;
}

export function BlurOverlay({ 
  children, 
  storageKey, 
  blurAmount = 8,
  opaque = false 
}: BlurOverlayProps) {
  const [isBlurred, setIsBlurred] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Check if already dismissed (persisted) - resets after 30 min
  useEffect(() => {
    if (storageKey) {
      const dismissedAt = sessionStorage.getItem(`blur_dismissed_${storageKey}`);
      if (dismissedAt) {
        const elapsed = Date.now() - parseInt(dismissedAt, 10);
        if (elapsed < BLUR_RESET_INTERVAL_MS) {
          setIsBlurred(false);
        } else {
          // 30 min passed, clear and show blur again
          sessionStorage.removeItem(`blur_dismissed_${storageKey}`);
        }
      }
    }
  }, [storageKey]);

  const dismissBlur = useCallback(() => {
    setIsBlurred(false);
    if (storageKey) {
      // Store timestamp instead of boolean
      sessionStorage.setItem(`blur_dismissed_${storageKey}`, Date.now().toString());
    }
  }, [storageKey]);

  // Handle direct click on the blur overlay only
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (isBlurred) {
      dismissBlur();
    }
  }, [isBlurred, dismissBlur]);

  // Handle touch start - record position for drag detection
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isBlurred) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [isBlurred]);

  // Handle touch move - detect drag/swipe on the overlay
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isBlurred || !touchStartRef.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // If user has dragged more than 20px, dismiss the blur
    if (deltaX > 20 || deltaY > 20) {
      dismissBlur();
      touchStartRef.current = null;
    }
  }, [isBlurred, dismissBlur]);

  // Handle touch end - reset touch tracking
  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative"
    >
      {/* Blur overlay - captures interactions directly */}
      <AnimatePresence>
        {isBlurred && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={`absolute inset-0 z-20 flex items-center justify-center rounded-xl cursor-pointer ${
              opaque ? "bg-background/80" : "bg-background/40"
            }`}
            style={{ 
              backdropFilter: `blur(${blurAmount + 6}px)`, 
              WebkitBackdropFilter: `blur(${blurAmount + 6}px)`,
              touchAction: "pan-x pan-y"
            }}
            onClick={handleOverlayClick}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className={`rounded-2xl px-6 py-4 shadow-lg border border-border ${
                opaque ? "bg-card" : "bg-card/95 backdrop-blur-sm"
              }`}>
                <p className="text-sm text-muted-foreground">
                  Touchez ou glissez pour afficher
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content with conditional blur */}
      <motion.div
        animate={{ filter: isBlurred ? `blur(${blurAmount}px)` : "blur(0px)" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
