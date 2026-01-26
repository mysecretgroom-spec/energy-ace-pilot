import { useCallback, useRef, useState, useEffect } from "react";

interface UseLongPressOptions {
  /** Delay in ms before long press triggers (default: 600ms) */
  delay?: number;
  /** Callback when long press is triggered */
  onLongPress: () => void;
  /** Callback for normal tap/click (if not a long press) */
  onPress?: () => void;
  /** Max movement in pixels before cancelling (default: 10) */
  moveThreshold?: number;
  /** Whether to disable the long press (default: false) */
  disabled?: boolean;
  /** Vibration duration in ms (default: 50, 0 to disable) */
  vibrationDuration?: number;
  /** Cancel on scroll (default: true) */
  cancelOnScroll?: boolean;
}

interface UseLongPressResult {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
    onContextMenu: (e: React.MouseEvent) => void;
  };
  /** Whether long press is currently active */
  isLongPressing: boolean;
  /** Progress from 0 to 1 during the press (for visual feedback) */
  progress: number;
  /** Whether the press is in progress (before long press triggers) */
  isPressing: boolean;
}

const DEFAULT_DELAY = 600; // Reduced for better responsiveness
const DEFAULT_MOVE_THRESHOLD = 10;
const DEFAULT_VIBRATION = 50;
const PROGRESS_UPDATE_INTERVAL = 16; // ~60fps

export function useLongPress({
  delay = DEFAULT_DELAY,
  onLongPress,
  onPress,
  moveThreshold = DEFAULT_MOVE_THRESHOLD,
  disabled = false,
  vibrationDuration = DEFAULT_VIBRATION,
  cancelOnScroll = true,
}: UseLongPressOptions): UseLongPressResult {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const startTimeRef = useRef<number>(0);
  const longPressTriggeredRef = useRef(false);

  // Clear all timers
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setIsLongPressing(false);
    setIsPressing(false);
    setProgress(0);
  }, []);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (vibrationDuration > 0 && navigator.vibrate) {
      navigator.vibrate(vibrationDuration);
    }
  }, [vibrationDuration]);

  // Start tracking press
  const start = useCallback(
    (x: number, y: number) => {
      if (disabled) return;
      
      startPosRef.current = { x, y };
      startTimeRef.current = Date.now();
      longPressTriggeredRef.current = false;
      setIsPressing(true);
      setProgress(0);

      // Progress animation for visual feedback
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min(elapsed / delay, 1);
        setProgress(newProgress);
        
        if (newProgress >= 1) {
          clearInterval(progressIntervalRef.current!);
          progressIntervalRef.current = null;
        }
      }, PROGRESS_UPDATE_INTERVAL);

      // Long press trigger
      timeoutRef.current = setTimeout(() => {
        setIsLongPressing(true);
        setIsPressing(false);
        longPressTriggeredRef.current = true;
        triggerHaptic();
        onLongPress();
      }, delay);
    },
    [delay, onLongPress, triggerHaptic, disabled]
  );

  // End tracking
  const end = useCallback(() => {
    const wasLongPress = longPressTriggeredRef.current;
    clear();
    startPosRef.current = null;

    // Only trigger onPress if it wasn't a long press
    if (!wasLongPress && onPress) {
      onPress();
    }
  }, [clear, onPress]);

  // Track movement to cancel if threshold exceeded
  const move = useCallback(
    (x: number, y: number) => {
      if (!startPosRef.current) return;

      const dx = Math.abs(x - startPosRef.current.x);
      const dy = Math.abs(y - startPosRef.current.y);

      if (dx > moveThreshold || dy > moveThreshold) {
        clear();
        startPosRef.current = null;
      }
    },
    [clear, moveThreshold]
  );

  // Cancel on scroll
  useEffect(() => {
    if (!cancelOnScroll || !isPressing) return;

    const handleScroll = () => {
      if (isPressing && !longPressTriggeredRef.current) {
        clear();
        startPosRef.current = null;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", handleScroll, { capture: true });
  }, [cancelOnScroll, isPressing, clear]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      const touch = e.touches[0];
      if (!touch) return;
      start(touch.clientX, touch.clientY);
    },
    [start, disabled]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (longPressTriggeredRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
      end();
    },
    [end]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      move(touch.clientX, touch.clientY);
    },
    [move]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only left click
      if (disabled || e.button !== 0) return;
      start(e.clientX, e.clientY);
    },
    [start, disabled]
  );

  const onMouseUp = useCallback(() => {
    end();
  }, [end]);

  const onMouseLeave = useCallback(() => {
    clear();
    startPosRef.current = null;
  }, [clear]);

  // Prevent context menu on long press
  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (longPressTriggeredRef.current || isPressing) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [isPressing]
  );

  return {
    handlers: {
      onTouchStart,
      onTouchEnd,
      onTouchMove,
      onMouseDown,
      onMouseUp,
      onMouseLeave,
      onContextMenu,
    },
    isLongPressing,
    progress,
    isPressing,
  };
}
