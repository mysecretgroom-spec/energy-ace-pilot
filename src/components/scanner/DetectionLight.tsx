import React from "react";

/**
 * Small status light replacing the live crop outline: dark red (no / poor
 * detection) blending to dark green (optimal framing).
 */
export function DetectionLight({ score, className = "" }: { score: number; className?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  const color = `color-mix(in oklab, hsl(var(--scan-good)) ${pct}%, hsl(var(--scan-bad)))`;
  return (
    <div
      role="status"
      aria-label={pct >= 85 ? "Détection optimale" : "Détection en cours"}
      className={`w-4 h-4 rounded-full border-2 border-background/70 transition-colors duration-300 ${className}`}
      style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
    />
  );
}
