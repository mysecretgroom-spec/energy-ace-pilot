import { useState, useEffect, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BlurOverlayProps {
  children: ReactNode;
  /** Storage key for persistence - if set, blur won't show again once dismissed */
  storageKey?: string;
}

export function BlurOverlay({ children, storageKey }: BlurOverlayProps) {
  const [isBlurred, setIsBlurred] = useState(true);

  // Check if already dismissed (persisted)
  useEffect(() => {
    if (storageKey) {
      const dismissed = sessionStorage.getItem(`blur_dismissed_${storageKey}`);
      if (dismissed === "true") {
        setIsBlurred(false);
      }
    }
  }, [storageKey]);

  const dismissBlur = useCallback(() => {
    setIsBlurred(false);
    if (storageKey) {
      sessionStorage.setItem(`blur_dismissed_${storageKey}`, "true");
    }
  }, [storageKey]);

  // Handle scroll event
  useEffect(() => {
    if (!isBlurred) return;

    const handleScroll = () => {
      dismissBlur();
    };

    // Listen to scroll on both window and touch events
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("touchmove", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchmove", handleScroll);
    };
  }, [isBlurred, dismissBlur]);

  // Handle click
  const handleClick = useCallback(() => {
    if (isBlurred) {
      dismissBlur();
    }
  }, [isBlurred, dismissBlur]);

  return (
    <div className="relative" onClick={handleClick}>
      {/* Blur overlay */}
      <AnimatePresence>
        {isBlurred && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.2 }}
              className="text-center pointer-events-auto"
            >
              <div className="bg-card/90 backdrop-blur-sm rounded-2xl px-6 py-4 shadow-lg border border-border">
                <p className="text-sm text-muted-foreground">
                  Touchez ou scrollez pour afficher
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content with conditional blur */}
      <motion.div
        animate={{ filter: isBlurred ? "blur(8px)" : "blur(0px)" }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
