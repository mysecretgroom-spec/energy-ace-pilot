import { useCallback, useRef, useState } from "react";

interface UseLongPressOptions {
  delay?: number;
  onLongPress: () => void;
  onPress?: () => void;
  moveThreshold?: number;
}

interface UseLongPressResult {
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
  };
  isLongPressing: boolean;
}

export function useLongPress({
  delay = 1500,
  onLongPress,
  onPress,
  moveThreshold = 10,
}: UseLongPressOptions): UseLongPressResult {
  const [isLongPressing, setIsLongPressing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLongPressing(false);
  }, []);

  const triggerHaptic = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  }, []);

  const start = useCallback(
    (x: number, y: number) => {
      startPosRef.current = { x, y };
      longPressTriggeredRef.current = false;

      timeoutRef.current = setTimeout(() => {
        setIsLongPressing(true);
        longPressTriggeredRef.current = true;
        triggerHaptic();
        onLongPress();
      }, delay);
    },
    [delay, onLongPress, triggerHaptic]
  );

  const end = useCallback(() => {
    const wasLongPress = longPressTriggeredRef.current;
    clear();
    startPosRef.current = null;

    if (!wasLongPress && onPress) {
      onPress();
    }
  }, [clear, onPress]);

  const move = useCallback(
    (x: number, y: number) => {
      if (!startPosRef.current) return;

      const dx = Math.abs(x - startPosRef.current.x);
      const dy = Math.abs(y - startPosRef.current.y);

      if (dx > moveThreshold || dy > moveThreshold) {
        clear();
      }
    },
    [clear, moveThreshold]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      start(touch.clientX, touch.clientY);
    },
    [start]
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
      move(touch.clientX, touch.clientY);
    },
    [move]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      start(e.clientX, e.clientY);
    },
    [start]
  );

  const onMouseUp = useCallback(() => {
    end();
  }, [end]);

  const onMouseLeave = useCallback(() => {
    clear();
    startPosRef.current = null;
  }, [clear]);

  return {
    handlers: {
      onTouchStart,
      onTouchEnd,
      onTouchMove,
      onMouseDown,
      onMouseUp,
      onMouseLeave,
    },
    isLongPressing,
  };
}
