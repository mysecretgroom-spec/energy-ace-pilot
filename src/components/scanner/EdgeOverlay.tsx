import React, { useMemo } from "react";
import { DetectedQuad } from "./hooks/useRealtimeEdgeDetection";

interface EdgeOverlayProps {
  quad: DetectedQuad | null;
  isStable: boolean;
  videoWidth: number;
  videoHeight: number;
  containerWidth: number;
  containerHeight: number;
}

const TEAL = "#2dd4bf";
const TEAL_FILL = "rgba(45,212,191,0.12)";

export function EdgeOverlay({
  quad,
  isStable,
  videoWidth,
  videoHeight,
  containerWidth,
  containerHeight,
}: EdgeOverlayProps) {
  const { scaleX, scaleY, offsetX, offsetY } = useMemo(() => {
    if (!videoWidth || !videoHeight || !containerWidth || !containerHeight) {
      return { scaleX: 1, scaleY: 1, offsetX: 0, offsetY: 0 };
    }
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;
    let scale: number, ox = 0, oy = 0;
    if (videoAspect > containerAspect) {
      scale = containerHeight / videoHeight;
      ox = (containerWidth - videoWidth * scale) / 2;
    } else {
      scale = containerWidth / videoWidth;
      oy = (containerHeight - videoHeight * scale) / 2;
    }
    return { scaleX: scale, scaleY: scale, offsetX: ox, offsetY: oy };
  }, [videoWidth, videoHeight, containerWidth, containerHeight]);

  if (!quad) return null;

  const transform = (x: number, y: number) => ({
    x: x * scaleX + offsetX,
    y: y * scaleY + offsetY,
  });

  const tl = transform(quad.topLeft.x, quad.topLeft.y);
  const tr = transform(quad.topRight.x, quad.topRight.y);
  const br = transform(quad.bottomRight.x, quad.bottomRight.y);
  const bl = transform(quad.bottomLeft.x, quad.bottomLeft.y);

  const pathD = `M ${tl.x} ${tl.y} L ${tr.x} ${tr.y} L ${br.x} ${br.y} L ${bl.x} ${bl.y} Z`;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={containerWidth}
      height={containerHeight}
    >
      {/* Semi-transparent teal fill */}
      <path
        d={pathD}
        fill={TEAL_FILL}
        stroke={TEAL}
        strokeWidth={3}
        strokeLinejoin="round"
        className="transition-all duration-150"
      />

      {/* Corner dots */}
      {[tl, tr, br, bl].map((point, i) => (
        <circle
          key={i}
          cx={point.x}
          cy={point.y}
          r={8}
          fill={TEAL}
          stroke="white"
          strokeWidth={2}
        />
      ))}

      {/* Stable indicator badge */}
      {isStable && (
        <g transform={`translate(${(tl.x + tr.x) / 2}, ${Math.max(tl.y, tr.y) - 28})`}>
          <rect x={-50} y={-12} width={100} height={24} rx={12} fill={TEAL} />
          <text x={0} y={5} textAnchor="middle" fill="white" fontSize={11} fontWeight="600">
            Prêt ✓
          </text>
        </g>
      )}
    </svg>
  );
}
