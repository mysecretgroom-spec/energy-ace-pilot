import { useState, useRef, useCallback, useEffect } from "react";

interface Position {
  x: number;
  y: number;
}

interface UseDraggablePositionOptions {
  storageKey: string;
  defaultPosition: Position;
  longPressDuration?: number;
}

export function useDraggablePosition({
  storageKey,
  defaultPosition,
  longPressDuration = 1200,
}: UseDraggablePositionOptions) {
  const [position, setPosition] = useState<Position>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          return parsed;
        }
      }
    } catch {}
    return defaultPosition;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isDragReady, setIsDragReady] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPos = useRef<Position>({ x: 0, y: 0 });
  const elementStartPos = useRef<Position>({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Clamp position to viewport
  const clampPosition = useCallback((pos: Position): Position => {
    const el = elementRef.current;
    const w = el?.offsetWidth ?? 120;
    const h = el?.offsetHeight ?? 48;
    const maxX = window.innerWidth - w;
    const maxY = window.innerHeight - h;
    return {
      x: Math.max(0, Math.min(pos.x, maxX)),
      y: Math.max(0, Math.min(pos.y, maxY)),
    };
  }, []);

  // Save position
  const savePosition = useCallback(
    (pos: Position) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(pos));
      } catch {}
    },
    [storageKey]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const touch = { x: e.clientX, y: e.clientY };
      dragStartPos.current = touch;
      elementStartPos.current = { ...position };
      hasMoved.current = false;

      longPressTimer.current = setTimeout(() => {
        setIsDragReady(true);
        setIsDragging(true);
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, longPressDuration);
    },
    [position, longPressDuration]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) {
        // If moved too much before long press, cancel
        const dx = Math.abs(e.clientX - dragStartPos.current.x);
        const dy = Math.abs(e.clientY - dragStartPos.current.y);
        if (dx > 10 || dy > 10) {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      hasMoved.current = true;

      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;

      const newPos = clampPosition({
        x: elementStartPos.current.x + dx,
        y: elementStartPos.current.y + dy,
      });

      setPosition(newPos);
    },
    [isDragging, clampPosition]
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isDragging) {
      setIsDragging(false);
      setIsDragReady(false);
      savePosition(position);
    }
  }, [isDragging, position, savePosition]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  return {
    position,
    isDragging,
    isDragReady,
    hasMoved,
    elementRef,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}
