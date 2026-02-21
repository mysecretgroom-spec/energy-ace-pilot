import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { RotateCw, Sparkles, Wand2, X, Check, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Quad, Point } from "../types";
import { defaultQuad, rescaleQuad, computeOutputSize, confidenceScore } from "../utils/quad";
import { downscale, releaseCanvas, loadImageToCanvas } from "../utils/image";
import { MAX_ANALYSIS_DIM } from "../types";
import { useWorkerPipeline } from "../hooks/useWorkerPipeline";
import { supabase } from "@/integrations/supabase/client";

interface CropEditorProps {
  imageSrc: string; // blob URL
  imageSize: { w: number; h: number };
  initialQuad?: Quad | null;
  onConfirm: (quad: Quad) => void;
  onCancel: () => void;
}

type DragTarget = "topLeft" | "topRight" | "bottomRight" | "bottomLeft" | null;

export function CropEditor({ imageSrc, imageSize, initialQuad, onConfirm, onCancel }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [quad, setQuad] = useState<Quad>(initialQuad || defaultQuad(imageSize.w, imageSize.h));
  const [dragging, setDragging] = useState<DragTarget>(null);
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const [rotation, setRotation] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [displayScale, setDisplayScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const { detectFromCanvas, detectedQuad, confidence } = useWorkerPipeline();

  // Draw image on canvas
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const cw = container.clientWidth;
      const ch = container.clientHeight - 60; // leave space for buttons
      const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight, 1);

      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      setDisplayScale(scale);
      const ox = (cw - canvas.width) / 2;
      const oy = (ch - canvas.height) / 2;
      setCanvasOffset({ x: ox, y: oy });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Convert image coords to screen coords
  const toScreen = useCallback((p: Point) => ({
    x: p.x * displayScale + canvasOffset.x,
    y: p.y * displayScale + canvasOffset.y,
  }), [displayScale, canvasOffset]);

  // Convert screen coords to image coords
  const toImage = useCallback((sx: number, sy: number): Point => ({
    x: Math.max(0, Math.min(imageSize.w, (sx - canvasOffset.x) / displayScale)),
    y: Math.max(0, Math.min(imageSize.h, (sy - canvasOffset.y) / displayScale)),
  }), [displayScale, canvasOffset, imageSize]);

  const conf = useMemo(() => confidenceScore(quad, imageSize.w, imageSize.h), [quad, imageSize]);

  // Touch/Mouse handlers
  const getEventPos = (e: React.TouchEvent | React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const findNearestCorner = (pos: { x: number; y: number }): DragTarget => {
    const corners: DragTarget[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];
    let minDist = 44; // touch zone
    let nearest: DragTarget = null;
    for (const c of corners) {
      const sp = toScreen(quad[c as keyof Quad]);
      const d = Math.sqrt((pos.x - sp.x) ** 2 + (pos.y - sp.y) ** 2);
      if (d < minDist) { minDist = d; nearest = c; }
    }
    return nearest;
  };

  const handlePointerDown = (e: React.TouchEvent | React.MouseEvent) => {
    const pos = getEventPos(e);
    const corner = findNearestCorner(pos);
    if (corner) {
      setDragging(corner);
      setDragPos(pos);
    }
  };

  const handlePointerMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragging) return;
    const pos = getEventPos(e);
    setDragPos(pos);
    const imgPos = toImage(pos.x, pos.y);
    setQuad((prev) => ({ ...prev, [dragging]: imgPos }));
  };

  const handlePointerUp = () => {
    setDragging(null);
    setDragPos(null);
  };

  // Auto-detect
  const handleAuto = async () => {
    try {
      const canvas = await loadImageToCanvas(imageSrc);
      const small = downscale(canvas, MAX_ANALYSIS_DIM);
      detectFromCanvas(small);
      releaseCanvas(canvas);
      releaseCanvas(small);
    } catch {}
  };

  // Update quad when worker detects
  useEffect(() => {
    if (detectedQuad) {
      // Rescale from analysis dim to original
      const analysisScale = Math.min(MAX_ANALYSIS_DIM / imageSize.w, MAX_ANALYSIS_DIM / imageSize.h, 1);
      const analysisW = Math.round(imageSize.w * analysisScale);
      const analysisH = Math.round(imageSize.h * analysisScale);
      const rescaled = rescaleQuad(detectedQuad, { w: analysisW, h: analysisH }, imageSize);
      setQuad(rescaled);
    }
  }, [detectedQuad, imageSize]);

  // AI crop detect
  const handleAiCrop = async () => {
    setAiLoading(true);
    try {
      const canvas = await loadImageToCanvas(imageSrc);
      const small = downscale(canvas, 1600);
      const ctx = small.getContext("2d")!;
      const blob = await new Promise<Blob>((res) => small.toBlob((b) => res(b!), "image/jpeg", 0.8));
      const reader = new FileReader();
      const base64 = await new Promise<string>((res) => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(blob);
      });

      const { data } = await supabase.functions.invoke("ai-crop-detect", {
        body: {
          images: [{ id: "crop", base64 }],
          local_corners: {
            crop: {
              topLeft: { x: quad.topLeft.x / imageSize.w, y: quad.topLeft.y / imageSize.h },
              topRight: { x: quad.topRight.x / imageSize.w, y: quad.topRight.y / imageSize.h },
              bottomRight: { x: quad.bottomRight.x / imageSize.w, y: quad.bottomRight.y / imageSize.h },
              bottomLeft: { x: quad.bottomLeft.x / imageSize.w, y: quad.bottomLeft.y / imageSize.h },
            },
          },
        },
      });

      const result = data?.results?.[0];
      if (result?.needs_crop && result.corners) {
        const c = result.corners;
        setQuad({
          topLeft: { x: c.topLeft.x * imageSize.w, y: c.topLeft.y * imageSize.h },
          topRight: { x: c.topRight.x * imageSize.w, y: c.topRight.y * imageSize.h },
          bottomRight: { x: c.bottomRight.x * imageSize.w, y: c.bottomRight.y * imageSize.h },
          bottomLeft: { x: c.bottomLeft.x * imageSize.w, y: c.bottomLeft.y * imageSize.h },
        });
        setAiUsed(true);
      }

      releaseCanvas(canvas);
      releaseCanvas(small);
    } catch (err) {
      console.error("AI crop failed:", err);
    } finally {
      setAiLoading(false);
    }
  };

  // Rotation
  const handleRotate = () => setRotation((r) => ((r + 90) % 360) as any);

  // Render magnifier
  const renderMagnifier = () => {
    if (!dragging || !dragPos) return null;
    const magnifierSize = 80;
    return (
      <div
        className="absolute pointer-events-none z-30 rounded-full border-2 border-teal-400 overflow-hidden shadow-lg"
        style={{
          width: magnifierSize,
          height: magnifierSize,
          left: dragPos.x - magnifierSize / 2,
          top: dragPos.y - magnifierSize - 30,
          backgroundImage: `url(${imageSrc})`,
          backgroundSize: `${imageSize.w * displayScale * 3}px ${imageSize.h * displayScale * 3}px`,
          backgroundPosition: `${-(dragPos.x - canvasOffset.x) * 3 + magnifierSize / 2}px ${-(dragPos.y - canvasOffset.y) * 3 + magnifierSize / 2}px`,
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 border border-teal-400 rounded-full" />
        </div>
      </div>
    );
  };

  const corners = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />
          Annuler
        </Button>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {aiUsed && (
            <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Coins IA
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => onConfirm(quad)}>
          <Check className="w-4 h-4 mr-1" />
          Valider
        </Button>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 relative touch-none select-none overflow-hidden"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          className="absolute"
          style={{
            left: canvasOffset.x,
            top: canvasOffset.y,
            transform: `rotate(${rotation}deg)`,
          }}
        />

        {/* Quad overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
          {/* Fill */}
          <polygon
            points={corners.map((c) => {
              const sp = toScreen(quad[c]);
              return `${sp.x},${sp.y}`;
            }).join(" ")}
            fill="rgba(45, 212, 191, 0.08)"
            stroke="#2dd4bf"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Corner handles */}
          {corners.map((c) => {
            const sp = toScreen(quad[c]);
            return (
              <circle
                key={c}
                cx={sp.x}
                cy={sp.y}
                r={dragging === c ? 12 : 8}
                fill="#2dd4bf"
                stroke="white"
                strokeWidth="2"
                className="transition-all"
              />
            );
          })}
        </svg>

        {renderMagnifier()}
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-card border-t safe-area-bottom">
        <Button variant="outline" size="sm" onClick={handleRotate}>
          <RotateCw className="w-4 h-4 mr-1" />
          Rotation
        </Button>
        <Button variant="outline" size="sm" onClick={handleAuto}>
          <Wand2 className="w-4 h-4 mr-1" />
          Auto
        </Button>
        {conf < 0.6 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAiCrop}
            disabled={aiLoading}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            {aiLoading ? "Analyse..." : "IA"}
          </Button>
        )}
      </div>
    </div>
  );
}
