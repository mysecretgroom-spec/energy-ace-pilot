import { useEffect, useState } from "react";
import { subscribeDragRegistry, getDragEntries, type AlignGuide } from "@/hooks/useDraggablePosition";

/**
 * Renders Figma-style alignment guide lines when floating buttons are being dragged.
 * Listens to the global drag registry to detect active drags and their guides.
 */
export function AlignmentGuides() {
  const [entries, setEntries] = useState(getDragEntries());

  useEffect(() => {
    return subscribeDragRegistry(() => {
      setEntries(getDragEntries());
    });
  }, []);

  const anyDragging = entries.some((e) => e.isDragging);
  if (!anyDragging) return null;

  // Collect guides from the currently dragging element via a custom event approach
  // Since guides are stored in the hook, we render them via global overlay
  return <AlignmentOverlay />;
}

function AlignmentOverlay() {
  // We listen for guide updates via a lightweight pub/sub on window
  const [guides, setGuides] = useState<AlignGuide[]>([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<AlignGuide[]>).detail;
      setGuides(detail ?? []);
    };
    window.addEventListener("drag-guides-update", handler);
    return () => window.removeEventListener("drag-guides-update", handler);
  }, []);

  if (guides.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      {guides.map((guide, i) => {
        if (guide.type === "vertical") {
          return (
            <div
              key={`v-${i}`}
              className="absolute top-0 bottom-0 w-px"
              style={{
                left: `${guide.position}px`,
                background: guide.isScreenCenter
                  ? "rgba(59,130,246,0.6)"
                  : "rgba(239,68,68,0.5)",
                boxShadow: guide.isScreenCenter
                  ? "0 0 4px rgba(59,130,246,0.4)"
                  : "0 0 3px rgba(239,68,68,0.3)",
              }}
            />
          );
        }
        if (guide.type === "horizontal") {
          return (
            <div
              key={`h-${i}`}
              className="absolute left-0 right-0 h-px"
              style={{
                top: `${guide.position}px`,
                background: guide.isScreenCenter
                  ? "rgba(59,130,246,0.6)"
                  : "rgba(239,68,68,0.5)",
                boxShadow: guide.isScreenCenter
                  ? "0 0 4px rgba(59,130,246,0.4)"
                  : "0 0 3px rgba(239,68,68,0.3)",
              }}
            />
          );
        }
        if (guide.type === "symmetry") {
          return (
            <div
              key={`s-${i}`}
              className="absolute top-0 bottom-0"
              style={{
                left: `${guide.position}px`,
                width: "2px",
                marginLeft: "-1px",
                background: "repeating-linear-gradient(to bottom, rgba(16,185,129,0.7) 0px, rgba(16,185,129,0.7) 6px, transparent 6px, transparent 12px)",
                boxShadow: "0 0 6px rgba(16,185,129,0.3)",
              }}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
