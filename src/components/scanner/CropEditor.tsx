import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, X, RotateCw, Wand2, Loader2, SunMedium, Contrast } from "lucide-react";
import { detectDocumentEdgesLight } from "./services/edgeDetectionLight";
import { applyPerspectiveCorrectionLight } from "./services/perspectiveCorrection";
import { enhanceForDocument, convertToBlackAndWhite } from "./services/imageEnhancement";

// ---- Types ----

interface NormalizedCorners {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
}

interface CropEditorProps {
  imageData: string;
  onComplete: (croppedImage: string, thumbnail: string) => void;
  onCancel: () => void;
  initialCorners?: NormalizedCorners;
}

interface Point { x: number; y: number }

interface CropPoints {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

type CornerHandle = keyof CropPoints;
type EdgeHandle = "top" | "right" | "bottom" | "left";
type HandleType = CornerHandle | EdgeHandle;

const CORNER_SIZE = 28; // touch target
const MIDPOINT_W = 20;
const MIDPOINT_H = 8;

const ACCENT = "#2dd4bf"; // teal-400

// ---- Image utilities ----

function rotateImage(dataUrl: string, degrees: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const isSwap = degrees === 90 || degrees === 270;
      const w = isSwap ? img.height : img.width;
      const h = isSwap ? img.width : img.height;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No ctx"));
      ctx.translate(w / 2, h / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

function generateThumbnail(dataUrl: string, thumbWidth: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const thumbHeight = (img.height / img.width) * thumbWidth;
      const canvas = document.createElement("canvas");
      canvas.width = thumbWidth; canvas.height = thumbHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No ctx"));
      ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

function basicCrop(
  img: HTMLImageElement,
  points: { topLeft: Point; topRight: Point; bottomRight: Point; bottomLeft: Point },
  rotation: number
): { cropped: string; thumbnail: string } {
  const minX = Math.min(points.topLeft.x, points.bottomLeft.x);
  const maxX = Math.max(points.topRight.x, points.bottomRight.x);
  const minY = Math.min(points.topLeft.y, points.topRight.y);
  const maxY = Math.max(points.bottomLeft.y, points.bottomRight.y);
  const w = maxX - minX; const h = maxY - minY;
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, minX, minY, w, h, 0, 0, w, h);
  const cropped = canvas.toDataURL("image/jpeg", 0.92);
  const tw = 200; const th = (h / w) * tw;
  const tc = document.createElement("canvas");
  tc.width = tw; tc.height = th;
  tc.getContext("2d")!.drawImage(canvas, 0, 0, tw, th);
  return { cropped, thumbnail: tc.toDataURL("image/jpeg", 0.7) };
}

// ---- Component ----

export function CropEditor({ imageData, onComplete, onCancel, initialCorners }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [cropPoints, setCropPoints] = useState<CropPoints | null>(null);
  const [activeHandle, setActiveHandle] = useState<HandleType | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [dragStartPoints, setDragStartPoints] = useState<CropPoints | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  const [isDetecting, setIsDetecting] = useState(false);
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [blackAndWhite, setBlackAndWhite] = useState(false);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);

  // Load image + auto-detect
  useEffect(() => {
    const img = new Image();
    img.onload = async () => {
      imageRef.current = img;
      setImageSize({ width: img.width, height: img.height });
      setIsDetecting(true);
      try {
        const edges = await detectDocumentEdgesLight(imageData);
        if (edges && edges.confidence > 0.3) {
          (window as any).__detectedEdges = edges;
        }
      } catch (err) {
        console.error("Edge detection failed:", err);
      } finally {
        setIsDetecting(false);
      }
    };
    img.src = imageData;
  }, [imageData]);

  // Enhancements
  useEffect(() => {
    if (!imageData) return;
    if (!autoEnhance && !blackAndWhite) { setEnhancedImage(null); return; }
    setIsEnhancing(true);
    (async () => {
      try {
        let result = imageData;
        if (autoEnhance) result = await enhanceForDocument(result);
        if (blackAndWhite) result = await convertToBlackAndWhite(result);
        setEnhancedImage(result);
      } catch (err) { console.error("Enhancement failed:", err); }
      finally { setIsEnhancing(false); }
    })();
  }, [imageData, autoEnhance, blackAndWhite]);

  // Calculate display size + initial crop points
  useEffect(() => {
    if (!containerRef.current || !imageSize.width) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const isRotated = rotation === 90 || rotation === 270;
    const imgW = isRotated ? imageSize.height : imageSize.width;
    const imgH = isRotated ? imageSize.width : imageSize.height;

    const scale = Math.min(cw / imgW, ch / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;
    setDisplaySize({ width: dw, height: dh, offsetX: ox, offsetY: oy });

    const detectedEdges = (window as any).__detectedEdges;
    if (initialCorners) {
      setCropPoints({
        topLeft: { x: ox + initialCorners.topLeft.x * dw, y: oy + initialCorners.topLeft.y * dh },
        topRight: { x: ox + initialCorners.topRight.x * dw, y: oy + initialCorners.topRight.y * dh },
        bottomRight: { x: ox + initialCorners.bottomRight.x * dw, y: oy + initialCorners.bottomRight.y * dh },
        bottomLeft: { x: ox + initialCorners.bottomLeft.x * dw, y: oy + initialCorners.bottomLeft.y * dh },
      });
    } else if (detectedEdges) {
      setCropPoints({
        topLeft: { x: ox + detectedEdges.topLeft.x * dw, y: oy + detectedEdges.topLeft.y * dh },
        topRight: { x: ox + detectedEdges.topRight.x * dw, y: oy + detectedEdges.topRight.y * dh },
        bottomRight: { x: ox + detectedEdges.bottomRight.x * dw, y: oy + detectedEdges.bottomRight.y * dh },
        bottomLeft: { x: ox + detectedEdges.bottomLeft.x * dw, y: oy + detectedEdges.bottomLeft.y * dh },
      });
      delete (window as any).__detectedEdges;
    } else {
      const m = 0.1;
      setCropPoints({
        topLeft: { x: ox + dw * m, y: oy + dh * m },
        topRight: { x: ox + dw * (1 - m), y: oy + dh * m },
        bottomRight: { x: ox + dw * (1 - m), y: oy + dh * (1 - m) },
        bottomLeft: { x: ox + dw * m, y: oy + dh * (1 - m) },
      });
    }
  }, [imageSize, rotation]);

  const handleRotate = useCallback(() => {
    setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  }, []);

  const handleAutoDetect = useCallback(async () => {
    setIsDetecting(true);
    try {
      const edges = await detectDocumentEdgesLight(imageData);
      if (edges && edges.confidence > 0.2) {
        setCropPoints({
          topLeft: { x: displaySize.offsetX + edges.topLeft.x * displaySize.width, y: displaySize.offsetY + edges.topLeft.y * displaySize.height },
          topRight: { x: displaySize.offsetX + edges.topRight.x * displaySize.width, y: displaySize.offsetY + edges.topRight.y * displaySize.height },
          bottomRight: { x: displaySize.offsetX + edges.bottomRight.x * displaySize.width, y: displaySize.offsetY + edges.bottomRight.y * displaySize.height },
          bottomLeft: { x: displaySize.offsetX + edges.bottomLeft.x * displaySize.width, y: displaySize.offsetY + edges.bottomLeft.y * displaySize.height },
        });
      }
    } catch (err) { console.error("Auto-detect failed:", err); }
    finally { setIsDetecting(false); }
  }, [imageData, displaySize]);

  // ---- Pointer handling: corners + edge midpoints ----

  const clampX = useCallback((x: number) =>
    Math.max(displaySize.offsetX, Math.min(x, displaySize.offsetX + displaySize.width)),
  [displaySize]);
  const clampY = useCallback((y: number) =>
    Math.max(displaySize.offsetY, Math.min(y, displaySize.offsetY + displaySize.height)),
  [displaySize]);

  const handlePointerDown = useCallback(
    (handle: HandleType) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveHandle(handle);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        if (cropPoints) setDragStartPoints({ ...cropPoints });
      }
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [cropPoints]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle || !dragStart || !dragStartPoints || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - dragStart.x;
      const dy = y - dragStart.y;

      setCropPoints(() => {
        const p = { ...dragStartPoints };

        switch (activeHandle) {
          // Corner handles — move single point
          case "topLeft":
            return { ...p, topLeft: { x: clampX(p.topLeft.x + dx), y: clampY(p.topLeft.y + dy) } };
          case "topRight":
            return { ...p, topRight: { x: clampX(p.topRight.x + dx), y: clampY(p.topRight.y + dy) } };
          case "bottomRight":
            return { ...p, bottomRight: { x: clampX(p.bottomRight.x + dx), y: clampY(p.bottomRight.y + dy) } };
          case "bottomLeft":
            return { ...p, bottomLeft: { x: clampX(p.bottomLeft.x + dx), y: clampY(p.bottomLeft.y + dy) } };

          // Edge handles — move both corners on that edge
          case "top":
            return {
              ...p,
              topLeft: { x: p.topLeft.x, y: clampY(p.topLeft.y + dy) },
              topRight: { x: p.topRight.x, y: clampY(p.topRight.y + dy) },
            };
          case "bottom":
            return {
              ...p,
              bottomLeft: { x: p.bottomLeft.x, y: clampY(p.bottomLeft.y + dy) },
              bottomRight: { x: p.bottomRight.x, y: clampY(p.bottomRight.y + dy) },
            };
          case "left":
            return {
              ...p,
              topLeft: { x: clampX(p.topLeft.x + dx), y: p.topLeft.y },
              bottomLeft: { x: clampX(p.bottomLeft.x + dx), y: p.bottomLeft.y },
            };
          case "right":
            return {
              ...p,
              topRight: { x: clampX(p.topRight.x + dx), y: p.topRight.y },
              bottomRight: { x: clampX(p.bottomRight.x + dx), y: p.bottomRight.y },
            };
          default:
            return p;
        }
      });
    },
    [activeHandle, dragStart, dragStartPoints, clampX, clampY]
  );

  const handlePointerUp = useCallback(() => {
    setActiveHandle(null);
    setDragStart(null);
    setDragStartPoints(null);
  }, []);

  // ---- Crop processing ----

  const generateCroppedImage = useCallback(async (): Promise<{ cropped: string; thumbnail: string } | null> => {
    if (!imageRef.current || !cropPoints) return null;
    const sourceImage = enhancedImage || imageData;
    const scaleX = imageSize.width / displaySize.width;
    const scaleY = imageSize.height / displaySize.height;
    const toImg = (p: Point) => ({
      x: (p.x - displaySize.offsetX) * scaleX,
      y: (p.y - displaySize.offsetY) * scaleY,
    });
    const imgPoints = {
      topLeft: toImg(cropPoints.topLeft),
      topRight: toImg(cropPoints.topRight),
      bottomRight: toImg(cropPoints.bottomRight),
      bottomLeft: toImg(cropPoints.bottomLeft),
    };
    try {
      const normalized = {
        topLeft: { x: imgPoints.topLeft.x / imageSize.width, y: imgPoints.topLeft.y / imageSize.height },
        topRight: { x: imgPoints.topRight.x / imageSize.width, y: imgPoints.topRight.y / imageSize.height },
        bottomRight: { x: imgPoints.bottomRight.x / imageSize.width, y: imgPoints.bottomRight.y / imageSize.height },
        bottomLeft: { x: imgPoints.bottomLeft.x / imageSize.width, y: imgPoints.bottomLeft.y / imageSize.height },
      };
      let finalImage = await applyPerspectiveCorrectionLight(sourceImage, normalized);
      if (rotation !== 0) finalImage = await rotateImage(finalImage, rotation);
      const thumbnail = await generateThumbnail(finalImage, 200);
      return { cropped: finalImage, thumbnail };
    } catch (err) {
      console.error("Perspective correction failed:", err);
      return basicCrop(imageRef.current, imgPoints, rotation);
    }
  }, [cropPoints, imageSize, displaySize, rotation, enhancedImage, imageData]);

  const handleComplete = useCallback(async () => {
    setIsProcessingCrop(true);
    try {
      const result = await generateCroppedImage();
      if (result) onComplete(result.cropped, result.thumbnail);
    } finally { setIsProcessingCrop(false); }
  }, [generateCroppedImage, onComplete]);

  // ---- Rendering ----

  const midpoint = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const renderCornerHandle = (key: CornerHandle) => {
    if (!cropPoints) return null;
    const p = cropPoints[key];
    return (
      <div
        key={key}
        className="absolute touch-none"
        style={{
          left: p.x - CORNER_SIZE / 2,
          top: p.y - CORNER_SIZE / 2,
          width: CORNER_SIZE,
          height: CORNER_SIZE,
          cursor: "move",
          zIndex: 12,
        }}
        onPointerDown={handlePointerDown(key)}
      >
        <div
          className="absolute rounded-full"
          style={{
            inset: 3,
            backgroundColor: ACCENT,
            border: `2px solid white`,
            boxShadow: `0 0 8px ${ACCENT}80`,
          }}
        />
      </div>
    );
  };

  const renderEdgeMidpointHandle = (edge: EdgeHandle) => {
    if (!cropPoints) return null;

    let a: Point, b: Point;
    let isHorizontal: boolean;

    switch (edge) {
      case "top":    a = cropPoints.topLeft; b = cropPoints.topRight; isHorizontal = true; break;
      case "bottom": a = cropPoints.bottomLeft; b = cropPoints.bottomRight; isHorizontal = true; break;
      case "left":   a = cropPoints.topLeft; b = cropPoints.bottomLeft; isHorizontal = false; break;
      case "right":  a = cropPoints.topRight; b = cropPoints.bottomRight; isHorizontal = false; break;
    }

    const mid = midpoint(a, b);
    const handleW = isHorizontal ? MIDPOINT_W : MIDPOINT_H;
    const handleH = isHorizontal ? MIDPOINT_H : MIDPOINT_W;

    return (
      <div
        key={edge}
        className="absolute touch-none"
        style={{
          left: mid.x - handleW / 2,
          top: mid.y - handleH / 2,
          width: handleW,
          height: handleH,
          // Bigger touch target
          padding: 10,
          margin: -10,
          cursor: isHorizontal ? "ns-resize" : "ew-resize",
          zIndex: 11,
        }}
        onPointerDown={handlePointerDown(edge)}
      >
        <div
          style={{
            width: handleW,
            height: handleH,
            borderRadius: 4,
            backgroundColor: ACCENT,
            border: "1px solid white",
            boxShadow: `0 0 6px ${ACCENT}60`,
          }}
        />
      </div>
    );
  };

  const renderCropOverlay = () => {
    if (!cropPoints) return null;
    const { topLeft, topRight, bottomRight, bottomLeft } = cropPoints;
    const path = `M ${topLeft.x} ${topLeft.y} L ${topRight.x} ${topRight.y} L ${bottomRight.x} ${bottomRight.y} L ${bottomLeft.x} ${bottomLeft.y} Z`;

    return (
      <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
        <defs>
          <mask id="cropMask">
            <rect width="100%" height="100%" fill="white" />
            <path d={path} fill="black" />
          </mask>
        </defs>
        {/* Dark overlay outside */}
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#cropMask)" />
        {/* Main border */}
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="2.5" />
        {/* Dashed inner grid — thirds */}
        {(() => {
          const lerp = (a: Point, b: Point, t: number): Point => ({
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
          });
          const lines: React.ReactNode[] = [];
          // Horizontal thirds
          for (const t of [1/3, 2/3]) {
            const l = lerp(topLeft, bottomLeft, t);
            const r = lerp(topRight, bottomRight, t);
            lines.push(
              <line key={`h${t}`} x1={l.x} y1={l.y} x2={r.x} y2={r.y}
                stroke={ACCENT} strokeWidth="0.8" strokeDasharray="6 4" opacity={0.5} />
            );
          }
          // Vertical thirds
          for (const t of [1/3, 2/3]) {
            const top = lerp(topLeft, topRight, t);
            const bot = lerp(bottomLeft, bottomRight, t);
            lines.push(
              <line key={`v${t}`} x1={top.x} y1={top.y} x2={bot.x} y2={bot.y}
                stroke={ACCENT} strokeWidth="0.8" strokeDasharray="6 4" opacity={0.5} />
            );
          }
          return lines;
        })()}
      </svg>
    );
  };

  const displayImageSrc = enhancedImage || imageData;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={onCancel}>
          <X className="h-6 w-6" />
        </Button>
        <span className="text-white font-medium">
          {isDetecting ? "Détection..." : "Rogner"}
        </span>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleRotate}>
          <RotateCw className="h-5 w-5" />
        </Button>
      </div>

      {/* Enhancement controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 bg-black/60">
        <Button variant="ghost" size="sm" className="text-white hover:bg-white/20 gap-2"
          onClick={handleAutoDetect} disabled={isDetecting}>
          {isDetecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Auto
        </Button>
        <div className="flex items-center gap-2">
          <Switch id="enhance" checked={autoEnhance} onCheckedChange={setAutoEnhance} disabled={isEnhancing} />
          <Label htmlFor="enhance" className="text-white text-xs flex items-center gap-1">
            <SunMedium className="h-3 w-3" /> Améliorer
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="bw" checked={blackAndWhite} onCheckedChange={setBlackAndWhite} disabled={isEnhancing} />
          <Label htmlFor="bw" className="text-white text-xs flex items-center gap-1">
            <Contrast className="h-3 w-3" /> N&B
          </Label>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {(isDetecting || isEnhancing) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}

        {imageSize.width > 0 && (
          <img
            src={displayImageSrc}
            alt="Document"
            className="absolute"
            style={{
              width: displaySize.width,
              height: displaySize.height,
              left: displaySize.offsetX,
              top: displaySize.offsetY,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }}
            draggable={false}
          />
        )}

        {renderCropOverlay()}
        {renderCornerHandle("topLeft")}
        {renderCornerHandle("topRight")}
        {renderCornerHandle("bottomRight")}
        {renderCornerHandle("bottomLeft")}
        {renderEdgeMidpointHandle("top")}
        {renderEdgeMidpointHandle("bottom")}
        {renderEdgeMidpointHandle("left")}
        {renderEdgeMidpointHandle("right")}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center p-4 pb-20 bg-black/80">
        <Button
          onClick={handleComplete}
          disabled={isProcessingCrop}
          className="rounded-lg px-8 py-3"
          style={{ backgroundColor: ACCENT, color: "#000" }}
        >
          {isProcessingCrop ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Check className="h-5 w-5 mr-2" />
          )}
          Confirmer
        </Button>
      </div>
    </div>
  );
}
