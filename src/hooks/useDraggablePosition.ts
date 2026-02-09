import { useState, useRef, useCallback, useEffect } from "react";

export interface DragPosition {
  x: number;
  y: number;
}

interface UseDraggablePositionOptions {
  storageKey: string;
  defaultPosition: DragPosition;
  longPressDuration?: number;
  /** Snap threshold in px – when within this distance of a guide, snap to it */
  snapThreshold?: number;
}

// ── Global registry so alignment guides can read all draggable positions ──
type DragEntry = {
  key: string;
  position: DragPosition;
  size: { w: number; h: number };
  isDragging: boolean;
};

const registry = new Map<string, DragEntry>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function subscribeDragRegistry(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function getDragEntries(): DragEntry[] {
  return Array.from(registry.values());
}

// ──────────────────────────────────────────────────────────────────────────

export function useDraggablePosition({
  storageKey,
  defaultPosition,
  longPressDuration = 1200,
  snapThreshold = 8,
}: UseDraggablePositionOptions) {
  // Compute a safe default that works even if window isn't ready yet
  const getSafeDefault = useCallback((): DragPosition => {
    if (typeof window === "undefined") return defaultPosition;
    // Clamp default to viewport
    return {
      x: Math.max(0, Math.min(defaultPosition.x, window.innerWidth - 60)),
      y: Math.max(0, Math.min(defaultPosition.y, window.innerHeight - 60)),
    };
  }, [defaultPosition]);

  const [position, setPosition] = useState<DragPosition>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          // Validate saved position is still within viewport
          if (typeof window !== "undefined") {
            const maxX = window.innerWidth - 40;
            const maxY = window.innerHeight - 40;
            if (parsed.x <= maxX && parsed.y <= maxY && parsed.x >= 0 && parsed.y >= 0) {
              return parsed;
            }
          }
          return parsed;
        }
      }
    } catch {}
    return getSafeDefault();
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isDragReady, setIsDragReady] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPos = useRef<DragPosition>({ x: 0, y: 0 });
  const elementStartPos = useRef<DragPosition>({ x: 0, y: 0 });
  const hasMoved = useRef(false);
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Keep registry in sync
  useEffect(() => {
    const el = elementRef.current;
    registry.set(storageKey, {
      key: storageKey,
      position,
      size: { w: el?.offsetWidth ?? 120, h: el?.offsetHeight ?? 48 },
      isDragging,
    });
    notifyListeners();
    return () => {
      registry.delete(storageKey);
      notifyListeners();
    };
  }, [storageKey, position, isDragging]);

  const clampPosition = useCallback((pos: DragPosition): DragPosition => {
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

  /** Snap to other draggable items or screen guides */
  const snapPosition = useCallback(
    (pos: DragPosition): { snapped: DragPosition; guides: AlignGuide[] } => {
      const el = elementRef.current;
      const w = el?.offsetWidth ?? 120;
      const h = el?.offsetHeight ?? 48;
      const cx = pos.x + w / 2;
      const cy = pos.y + h / 2;
      const screenCx = window.innerWidth / 2;
      const screenCy = window.innerHeight / 2;

      let sx = pos.x;
      let sy = pos.y;
      const guides: AlignGuide[] = [];

      // Check screen center vertical
      if (Math.abs(cx - screenCx) < snapThreshold) {
        sx = screenCx - w / 2;
        guides.push({ type: "vertical", position: screenCx, isScreenCenter: true });
      }
      // Check screen center horizontal
      if (Math.abs(cy - screenCy) < snapThreshold) {
        sy = screenCy - h / 2;
        guides.push({ type: "horizontal", position: screenCy, isScreenCenter: true });
      }

      // Check against other draggable items
      for (const [key, entry] of registry) {
        if (key === storageKey) continue;
        const ow = entry.size.w;
        const oh = entry.size.h;
        const ocx = entry.position.x + ow / 2;
        const ocy = entry.position.y + oh / 2;

        // Vertical alignment (same center X)
        if (Math.abs(cx - ocx) < snapThreshold) {
          sx = ocx - w / 2;
          guides.push({ type: "vertical", position: ocx });
        }
        // Left edge alignment
        if (Math.abs(pos.x - entry.position.x) < snapThreshold) {
          sx = entry.position.x;
          guides.push({ type: "vertical", position: entry.position.x });
        }
        // Right edge alignment
        if (Math.abs(pos.x + w - (entry.position.x + ow)) < snapThreshold) {
          sx = entry.position.x + ow - w;
          guides.push({ type: "vertical", position: entry.position.x + ow });
        }

        // Horizontal alignment (same center Y)
        if (Math.abs(cy - ocy) < snapThreshold) {
          sy = ocy - h / 2;
          guides.push({ type: "horizontal", position: ocy });
        }
        // Top edge alignment
        if (Math.abs(pos.y - entry.position.y) < snapThreshold) {
          sy = entry.position.y;
          guides.push({ type: "horizontal", position: entry.position.y });
        }
        // Bottom edge alignment
        if (Math.abs(pos.y + h - (entry.position.y + oh)) < snapThreshold) {
          sy = entry.position.y + oh - h;
          guides.push({ type: "horizontal", position: entry.position.y + oh });
        }

        // Symmetry check (mirrored X about screen center)
        const mirrorX = window.innerWidth - entry.position.x - ow;
        if (Math.abs(pos.x - mirrorX) < snapThreshold) {
          sx = mirrorX;
          guides.push({ type: "symmetry", position: screenCx });
        }
      }

      return { snapped: { x: sx, y: sy }, guides };
    },
    [storageKey, snapThreshold]
  );

  const [activeGuides, setActiveGuides] = useState<AlignGuide[]>([]);

  const savePosition = useCallback(
    (pos: DragPosition) => {
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
        if (navigator.vibrate) navigator.vibrate(50);
      }, longPressDuration);
    },
    [position, longPressDuration]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) {
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

      const raw = clampPosition({
        x: elementStartPos.current.x + dx,
        y: elementStartPos.current.y + dy,
      });

      const { snapped, guides } = snapPosition(raw);
      setPosition(snapped);
      setActiveGuides(guides);

      // Broadcast guides for the overlay
      window.dispatchEvent(new CustomEvent("drag-guides-update", { detail: guides }));
    },
    [isDragging, clampPosition, snapPosition]
  );

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isDragging) {
      setIsDragging(false);
      setIsDragReady(false);
      setActiveGuides([]);
      savePosition(position);
      // Clear guides overlay
      window.dispatchEvent(new CustomEvent("drag-guides-update", { detail: [] }));
    }
  }, [isDragging, position, savePosition]);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setPosition((prev) => clampPosition(prev));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  return {
    position,
    isDragging,
    isDragReady,
    hasMoved,
    elementRef,
    activeGuides,
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp,
    },
  };
}

export interface AlignGuide {
  type: "vertical" | "horizontal" | "symmetry";
  position: number; // px from left (vertical) or top (horizontal)
  isScreenCenter?: boolean;
}
