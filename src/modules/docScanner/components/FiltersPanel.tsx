import React, { useState, useEffect, useCallback } from "react";
import type { FilterPreset } from "../types";
import { downscale, loadImageToCanvas, releaseCanvas, pixelsToCanvas, canvasToBlob } from "../utils/image";
import { useWorkerPipeline } from "../hooks/useWorkerPipeline";

interface FiltersPanelProps {
  imageSrc: string;
  activeFilter: FilterPreset;
  onSelectFilter: (preset: FilterPreset) => void;
}

const FILTERS: { key: FilterPreset; label: string }[] = [
  { key: "original", label: "Original" },
  { key: "photo", label: "Photo" },
  { key: "document", label: "Document" },
  { key: "bw", label: "N&B" },
  { key: "enhanced", label: "Amélioré" },
];

export function FiltersPanel({ imageSrc, activeFilter, onSelectFilter }: FiltersPanelProps) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const { applyFilter } = useWorkerPipeline();

  // Generate small previews for each filter
  useEffect(() => {
    let cancelled = false;

    const generatePreviews = async () => {
      try {
        const canvas = await loadImageToCanvas(imageSrc);
        const small = downscale(canvas, 120);

        // Original
        const origBlob = await canvasToBlob(small, "image/jpeg", 0.7);
        if (cancelled) return;
        setPreviews((prev) => ({ ...prev, original: URL.createObjectURL(origBlob) }));

        // Others
        for (const f of FILTERS) {
          if (f.key === "original" || cancelled) continue;
          const result = await applyFilter(small, f.key);
          if (cancelled) break;
          const filtered = pixelsToCanvas(result.pixels, result.width, result.height);
          const blob = await canvasToBlob(filtered, "image/jpeg", 0.7);
          setPreviews((prev) => ({ ...prev, [f.key]: URL.createObjectURL(blob) }));
          releaseCanvas(filtered);
        }

        releaseCanvas(canvas);
        releaseCanvas(small);
      } catch (err) {
        console.error("Filter preview error:", err);
      }
    };

    generatePreviews();

    return () => {
      cancelled = true;
    };
  }, [imageSrc, applyFilter]);

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(previews).forEach(URL.revokeObjectURL);
    };
  }, []);

  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto">
      {FILTERS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSelectFilter(key)}
          className={`flex flex-col items-center gap-1 min-w-[60px] transition-all ${
            activeFilter === key ? "opacity-100" : "opacity-60"
          }`}
        >
          <div
            className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
              activeFilter === key ? "border-primary" : "border-transparent"
            }`}
          >
            {previews[key] ? (
              <img src={previews[key]} alt={label} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-muted animate-pulse" />
            )}
          </div>
          <span className={`text-[10px] font-medium ${
            activeFilter === key ? "text-primary" : "text-muted-foreground"
          }`}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
