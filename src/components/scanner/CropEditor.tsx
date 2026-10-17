import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, X, RotateCw, Wand2, Loader2, SunMedium, Contrast, SplitSquareHorizontal, ScanLine, Eye } from "lucide-react";
import { detectDocumentEdgesLight } from "./services/edgeDetectionLight";
import { applyPerspectiveCorrectionLight } from "./services/perspectiveCorrection";
import { enhanceForDocument, convertToBlackAndWhite, autoDeskew } from "./services/imageEnhancement";
import { correctDocumentShadows, rotateCorners, validScanCorners, type ScanCorners } from "./services/scanQuality";
import { toast } from "sonner";
import { detectFoldLines, type DetectedFolds } from "./services/foldDetection";

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
  onSplitPages?: (pages: Array<{ croppedImage: string; thumbnail: string }>) => void;
  initialCorners?: NormalizedCorners;
  initialEnhance?: boolean;
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

const CORNER_TOUCH = 44; // touch target size
const CORNER_RADIUS = 11; // visible circle radius
const MIDPOINT_W = 24;
const MIDPOINT_H = 8;
const MIDPOINT_ROUNDING = 4;

const ACCENT = "hsl(var(--primary))"; // teal-400
const ACCENT_GLOW = "hsl(var(--primary) / 0.35)";
const ACCENT_FILL = "hsl(var(--primary) / 0.08)"; // CamScanner highlight
const BORDER_WIDTH = 2.5;

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

// ---- Component ----

export function CropEditor({ imageData, onComplete, onCancel, onSplitPages, initialCorners, initialEnhance = true }: CropEditorProps) {
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
  const [autoEnhance, setAutoEnhance] = useState(true);
  const [deskew, setDeskew] = useState(true);
  const [blackAndWhite, setBlackAndWhite] = useState(false);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isProcessingCrop, setIsProcessingCrop] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [detectedFolds, setDetectedFolds] = useState<DetectedFolds | null>(null);

  const [detectedEdges, setDetectedEdges] = useState<ScanCorners | null>(null);
  const [shadowCorrection, setShadowCorrection] = useState(initialEnhance);
  const [showOriginal, setShowOriginal] = useState(false);
  const [cropPreview, setCropPreview] = useState<string | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const manualCornersRef = useRef<ScanCorners | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => setLayoutVersion(v => v + 1));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Load image + auto-detect
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = async () => {
      if (cancelled) return;
      imageRef.current = img;
      setImageSize({ width: img.width, height: img.height });
      setIsDetecting(true);
      try {
        const edges = await detectDocumentEdgesLight(imageData);
        if (!cancelled && !initialCorners && edges && edges.confidence > 0.5 && validScanCorners(edges)) {
          setDetectedEdges(edges);
        }
      } catch (err) {
        console.warn("Edge detection failed, using default crop:", err);
      } finally {
        if (!cancelled) setIsDetecting(false);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        console.error("Failed to load image for crop editor");
        setIsDetecting(false);
      }
    };
    img.src = imageData;
    return () => { cancelled = true; };
  }, [imageData, initialCorners]);

  // Cancellation prevents an older preview from overwriting a newer selection.
  useEffect(() => {
    let cancelled = false;
    if (!autoEnhance && !blackAndWhite && !shadowCorrection) {
      setEnhancedImage(null); setIsEnhancing(false); return;
    }
    setIsEnhancing(true);
    (async () => {
      try {
        let result = imageData;
        if (shadowCorrection) result = await correctDocumentShadows(result);
        if (autoEnhance) result = await enhanceForDocument(result);
        if (blackAndWhite) result = await convertToBlackAndWhite(result);
        if (!cancelled) setEnhancedImage(result);
      } catch (err) {
        if (!cancelled) { setEnhancedImage(null); toast.error("Correction impossible, original conservé"); }
      } finally { if (!cancelled) setIsEnhancing(false); }
    })();
    return () => { cancelled = true; };
  }, [imageData, autoEnhance, blackAndWhite, shadowCorrection]);

  // Calculate display size + initial crop points
  useEffect(() => {
    if (!containerRef.current || !imageSize.width) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;

    const isRotated = rotation === 90 || rotation === 270;
    const imgW = isRotated ? imageSize.height : imageSize.width;
    const imgH = isRotated ? imageSize.width : imageSize.height;

    const scale = Math.min(Math.max(1, cw - CORNER_TOUCH - 8) / imgW, Math.max(1, ch - CORNER_TOUCH - 8) / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const ox = (cw - dw) / 2;
    const oy = (ch - dh) / 2;
    setDisplaySize({ width: dw, height: dh, offsetX: ox, offsetY: oy });

    const edges = manualCornersRef.current || rotateCorners(detectedEdges || initialCorners || {
      topLeft: {x:0,y:0}, topRight:{x:1,y:0}, bottomRight:{x:1,y:1}, bottomLeft:{x:0,y:1},
    }, rotation);
    setCropPoints({
      topLeft: { x: ox + edges.topLeft.x * dw, y: oy + edges.topLeft.y * dh },
      topRight: { x: ox + edges.topRight.x * dw, y: oy + edges.topRight.y * dh },
      bottomRight: { x: ox + edges.bottomRight.x * dw, y: oy + edges.bottomRight.y * dh },
      bottomLeft: { x: ox + edges.bottomLeft.x * dw, y: oy + edges.bottomLeft.y * dh },
    });
  }, [imageSize, rotation, detectedEdges, initialCorners, layoutVersion]);

  const currentCorners = useCallback((): ScanCorners | null => {
    if (!cropPoints || !displaySize.width || !displaySize.height) return null;
    const point = (p: Point) => ({ x: (p.x - displaySize.offsetX) / displaySize.width,
      y: (p.y - displaySize.offsetY) / displaySize.height });
    return { topLeft: point(cropPoints.topLeft), topRight: point(cropPoints.topRight),
      bottomRight: point(cropPoints.bottomRight), bottomLeft: point(cropPoints.bottomLeft) };
  }, [cropPoints, displaySize]);

  const handleRotate = useCallback(() => {
    const corners = currentCorners();
    manualCornersRef.current = corners ? rotateCorners(corners, 90) : null;
    setRotation(prev => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  }, [currentCorners]);

  const handleAutoDetect = useCallback(async () => {
    setIsDetecting(true);
    try {
      const edges = await detectDocumentEdgesLight(imageData);
      if (edges && edges.confidence > 0.5 && validScanCorners(edges)) {
        manualCornersRef.current = null;
        setDetectedEdges({ ...edges });
      } else toast.info("Contours incertains : ajustez les quatre coins");
    } catch { toast.error("Détection impossible : ajustez les quatre coins"); }
    finally { setIsDetecting(false); }
  }, [imageData]);

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
    manualCornersRef.current = currentCorners();
    setActiveHandle(null);
    setDragStart(null);
    setDragStartPoints(null);
  }, [currentCorners]);

  // ---- Crop processing ----

  const generateCroppedImage = useCallback(async (): Promise<{ cropped: string; thumbnail: string } | null> => {
    if (!imageRef.current || !cropPoints) return null;
    const displayed = currentCorners();
    if (!displayed || !validScanCorners(displayed)) {
      toast.error("Les quatre coins doivent former un cadre sans se croiser");
      return null;
    }
    try {
      const normalized = rotateCorners(displayed, (360 - rotation) % 360);
      let finalImage = await applyPerspectiveCorrectionLight(imageData, normalized);
      if (rotation !== 0) finalImage = await rotateImage(finalImage, rotation);
      if (shadowCorrection) finalImage = await correctDocumentShadows(finalImage);
      if (autoEnhance) finalImage = await enhanceForDocument(finalImage);
      if (deskew) finalImage = await autoDeskew(finalImage);
      if (blackAndWhite) finalImage = await convertToBlackAndWhite(finalImage);
      const thumbnail = await generateThumbnail(finalImage, 200);
      return { cropped: finalImage, thumbnail };
    } catch (err) {
      console.error("Perspective correction failed:", err);
      toast.error("Recadrage impossible, original conservé : réessayez");
      return null;
    }
  }, [cropPoints, currentCorners, rotation, imageData, shadowCorrection, autoEnhance, blackAndWhite, deskew]);

  const handleComplete = useCallback(async () => {
    setIsProcessingCrop(true);
    try {
      const result = await generateCroppedImage();
      if (result) onComplete(result.cropped, result.thumbnail);
    } finally { setIsProcessingCrop(false); }
  }, [generateCroppedImage, onComplete]);

  // ---- Fold detection + split ----

  const handleDetectFolds = useCallback(async () => {
    if (!cropPoints || !imageSize.width) return;
    setIsSplitting(true);
    try {
      const normalizedCrop = {
        topLeft: {
          x: (cropPoints.topLeft.x - displaySize.offsetX) / displaySize.width,
          y: (cropPoints.topLeft.y - displaySize.offsetY) / displaySize.height,
        },
        topRight: {
          x: (cropPoints.topRight.x - displaySize.offsetX) / displaySize.width,
          y: (cropPoints.topRight.y - displaySize.offsetY) / displaySize.height,
        },
        bottomRight: {
          x: (cropPoints.bottomRight.x - displaySize.offsetX) / displaySize.width,
          y: (cropPoints.bottomRight.y - displaySize.offsetY) / displaySize.height,
        },
        bottomLeft: {
          x: (cropPoints.bottomLeft.x - displaySize.offsetX) / displaySize.width,
          y: (cropPoints.bottomLeft.y - displaySize.offsetY) / displaySize.height,
        },
      };

      const folds = await detectFoldLines(imageData, rotateCorners(normalizedCrop, (360 - rotation) % 360));
      if (folds && folds.subQuads.length > 1 && onSplitPages) {
        setDetectedFolds(folds);
        // Process each sub-quad into a separate page
        const pages: Array<{ croppedImage: string; thumbnail: string }> = [];
        const sourceImage = imageData;
        for (const quad of folds.subQuads) {
          try {
            let cropped = await applyPerspectiveCorrectionLight(sourceImage, quad);
            if (rotation !== 0) cropped = await rotateImage(cropped, rotation);
            if (shadowCorrection) cropped = await correctDocumentShadows(cropped);
            if (autoEnhance) cropped = await enhanceForDocument(cropped);
            if (deskew) cropped = await autoDeskew(cropped);
            if (blackAndWhite) cropped = await convertToBlackAndWhite(cropped);
            const thumbnail = await generateThumbnail(cropped, 200);
            pages.push({ croppedImage: cropped, thumbnail });
          } catch (err) {
            console.error("Failed to crop sub-quad:", err);
          }
        }
        if (pages.length > 1) {
          onSplitPages(pages);
          return;
        }
      }
      // No folds detected — notify user
      setDetectedFolds(null);
    } catch (err) {
      console.error("Fold detection failed:", err);
    } finally {
      setIsSplitting(false);
    }
  }, [cropPoints, displaySize, imageData, rotation, onSplitPages, shadowCorrection, autoEnhance, deskew, blackAndWhite]);

  // ---- Rendering ----

  const midpoint = (a: Point, b: Point): Point => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });

  const renderCornerHandle = (key: CornerHandle) => {
    if (!cropPoints) return null;
    const p = cropPoints[key];
    const c = CORNER_TOUCH / 2;

    return (
      <div
        key={key}
        role="slider"
        aria-label={`Coin ${key}`}
        className="absolute touch-none"
        style={{
          left: p.x - c,
          top: p.y - c,
          width: CORNER_TOUCH,
          height: CORNER_TOUCH,
          cursor: "move",
          zIndex: 12,
        }}
        onPointerDown={handlePointerDown(key)}
      >
        <svg
          width={CORNER_TOUCH}
          height={CORNER_TOUCH}
          viewBox={`0 0 ${CORNER_TOUCH} ${CORNER_TOUCH}`}
          className="absolute inset-0"
          style={{ overflow: "visible" }}
        >
          {/* Glow */}
          <circle cx={c} cy={c} r={CORNER_RADIUS + 3} fill={ACCENT_GLOW} />
          {/* White ring */}
          <circle cx={c} cy={c} r={CORNER_RADIUS} fill="hsl(var(--primary-foreground))" />
          {/* Teal center */}
          <circle cx={c} cy={c} r={CORNER_RADIUS - 2.5} fill={ACCENT} />
        </svg>
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
    const w = isHorizontal ? MIDPOINT_W : MIDPOINT_H;
    const h = isHorizontal ? MIDPOINT_H : MIDPOINT_W;

    return (
      <div
        key={edge}
        className="absolute touch-none"
        style={{
          left: mid.x - (w + 20) / 2,
          top: mid.y - (h + 20) / 2,
          width: w + 20,
          height: h + 20,
          cursor: isHorizontal ? "ns-resize" : "ew-resize",
          zIndex: 11,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onPointerDown={handlePointerDown(edge)}
      >
        <div
          style={{
            width: w,
            height: h,
            borderRadius: MIDPOINT_ROUNDING,
            backgroundColor: ACCENT,
            border: "2px solid hsl(var(--primary-foreground))",
            boxShadow: `0 0 8px ${ACCENT_GLOW}`,
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
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
        <defs>
          <mask id="cropMask">
            <rect width="100%" height="100%" fill="white" />
            <path d={path} fill="black" />
          </mask>
          <filter id="borderGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Dark overlay outside crop area */}
        <rect width="100%" height="100%" fill="hsl(var(--foreground) / 0.55)" mask="url(#cropMask)" />
        {/* Teal highlight inside crop area */}
        <path d={path} fill={ACCENT_FILL} />
        {/* Soft glow border */}
        <path d={path} fill="none" stroke={ACCENT} strokeWidth="8" strokeLinejoin="round" opacity={0.18} />
        {/* Main border with glow filter */}
        <path d={path} fill="none" stroke={ACCENT} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" filter="url(#borderGlow)" />
      </svg>
    );
  };

  const displayImageSrc = showOriginal ? imageData : enhancedImage || imageData;

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-2 bg-card">
        <Button variant="ghost" size="icon" className="text-foreground hover:bg-accent" onClick={onCancel}>
          <X className="h-6 w-6" />
        </Button>
        <span className="text-foreground font-medium">
          {isDetecting ? "Détection..." : "Rogner"}
        </span>
        <Button variant="ghost" size="icon" aria-label="Tourner le document" disabled={!!cropPreview} className="text-foreground hover:bg-accent" onClick={handleRotate}>
          <RotateCw className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 border-b bg-card">
        <Button size="sm" onClick={() => { setShadowCorrection(true); setAutoEnhance(true); setDeskew(true); setShowOriginal(false); handleAutoDetect(); }}
          disabled={isDetecting || isEnhancing || isProcessingCrop || !!cropPreview}>
          <ScanLine className="h-4 w-4 mr-2" />Scan net
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowOriginal(v => !v)} disabled={!enhancedImage}>
          <Eye className="h-4 w-4 mr-2" />{showOriginal ? "Voir le résultat" : "Voir l’original"}
        </Button>
      </div>
      {/* Enhancement controls */}
      <div className="flex shrink-0 items-center justify-center gap-3 px-4 py-2 bg-muted flex-wrap" hidden={!!cropPreview}>
        <Button variant="ghost" size="sm" className="text-foreground hover:bg-accent gap-2"
          onClick={handleAutoDetect} disabled={isDetecting}>
          {isDetecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          Auto
        </Button>
        {onSplitPages && (
          <Button variant="ghost" size="sm" className="text-foreground hover:bg-accent gap-2"
            onClick={handleDetectFolds} disabled={isSplitting}>
            {isSplitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <SplitSquareHorizontal className="h-4 w-4" />}
            Séparer
          </Button>
        )}
        <div className="flex items-center gap-2">
          <Switch id="deskew" checked={deskew} onCheckedChange={setDeskew} disabled={isEnhancing || !!cropPreview} />
          <Label htmlFor="deskew" className="text-foreground text-xs">Redresser</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="shadows" checked={shadowCorrection} onCheckedChange={setShadowCorrection} disabled={isEnhancing} />
          <Label htmlFor="shadows" className="text-foreground text-xs">Ombres</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="enhance" checked={autoEnhance} onCheckedChange={setAutoEnhance} disabled={isEnhancing} />
          <Label htmlFor="enhance" className="text-foreground text-xs flex items-center gap-1">
            <SunMedium className="h-3 w-3" /> Contraste
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="bw" checked={blackAndWhite} onCheckedChange={setBlackAndWhite} disabled={isEnhancing} />
          <Label htmlFor="bw" className="text-foreground text-xs flex items-center gap-1">
            <Contrast className="h-3 w-3" /> N&B
          </Label>
        </div>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        aria-label="Zone de recadrage"
      >
        {(isDetecting || isEnhancing || isProcessingCrop) && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center z-20">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
        )}

        {cropPreview ? <img src={showOriginal ? imageData : cropPreview} alt="Aperçu du scan" className="w-full h-full object-contain p-4" /> : imageSize.width > 0 && (
          <img
            src={displayImageSrc}
            alt="Document"
            className="absolute"
            style={{
              width: rotation === 90 || rotation === 270 ? displaySize.height : displaySize.width,
              height: rotation === 90 || rotation === 270 ? displaySize.width : displaySize.height,
              left: displaySize.offsetX + (displaySize.width - (rotation === 90 || rotation === 270 ? displaySize.height : displaySize.width)) / 2,
              top: displaySize.offsetY + (displaySize.height - (rotation === 90 || rotation === 270 ? displaySize.width : displaySize.height)) / 2,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "center center",
            }}
            draggable={false}
          />
        )}

        {!cropPreview && <>
          {renderCropOverlay()}
          {renderCornerHandle("topLeft")}
          {renderCornerHandle("topRight")}
          {renderCornerHandle("bottomRight")}
          {renderCornerHandle("bottomLeft")}
          {renderEdgeMidpointHandle("top")}
          {renderEdgeMidpointHandle("bottom")}
          {renderEdgeMidpointHandle("left")}
          {renderEdgeMidpointHandle("right")}
        </>}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-center gap-3 p-3 pb-[max(12px,env(safe-area-inset-bottom))] bg-card">
        <Button variant="outline" disabled={isDetecting || isEnhancing || isProcessingCrop || !cropPoints} onClick={async () => {
          if (cropPreview) { setCropPreview(null); return; }
          setIsProcessingCrop(true);
          try { const result = await generateCroppedImage(); if (result) { setCropPreview(result.cropped); setShowOriginal(false); } }
          finally { setIsProcessingCrop(false); }
        }}><Eye className="h-4 w-4 mr-2" />{cropPreview ? "Ajuster" : "Aperçu"}</Button>
        <Button
          onClick={handleComplete}
          disabled={isProcessingCrop || isEnhancing || isDetecting || !cropPoints}
          className="rounded-lg px-8 py-3"
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
