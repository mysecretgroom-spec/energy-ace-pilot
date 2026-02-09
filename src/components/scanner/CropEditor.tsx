import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Check, X, RotateCw, Move, Wand2, Loader2, SunMedium, Contrast } from "lucide-react";
import { detectDocumentEdgesLight } from "./services/edgeDetectionLight";
import { applyPerspectiveCorrectionLight } from "./services/perspectiveCorrection";
import { enhanceForDocument, convertToBlackAndWhite } from "./services/imageEnhancement";

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
  /** AI-detected corners in normalized (0-1) coordinates */
  initialCorners?: NormalizedCorners;
}

interface Point {
  x: number;
  y: number;
}

interface CropPoints {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

const HANDLE_SIZE = 24;

function rotateImage(dataUrl: string, degrees: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const isSwap = degrees === 90 || degrees === 270;
      const w = isSwap ? img.height : img.width;
      const h = isSwap ? img.width : img.height;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
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
      canvas.width = thumbWidth;
      canvas.height = thumbHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("No ctx"));
      ctx.drawImage(img, 0, 0, thumbWidth, thumbHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => reject(new Error("Failed to load"));
    img.src = dataUrl;
  });
}

interface PointXY { x: number; y: number }

function basicCrop(
  img: HTMLImageElement,
  points: { topLeft: PointXY; topRight: PointXY; bottomRight: PointXY; bottomLeft: PointXY },
  rotation: number
): { cropped: string; thumbnail: string } {
  const minX = Math.min(points.topLeft.x, points.bottomLeft.x);
  const maxX = Math.max(points.topRight.x, points.bottomRight.x);
  const minY = Math.min(points.topLeft.y, points.topRight.y);
  const maxY = Math.max(points.bottomLeft.y, points.bottomRight.y);
  const w = maxX - minX;
  const h = maxY - minY;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, minX, minY, w, h, 0, 0, w, h);
  const cropped = canvas.toDataURL("image/jpeg", 0.92);
  const tw = 200;
  const th = (h / w) * tw;
  const tc = document.createElement("canvas");
  tc.width = tw; tc.height = th;
  tc.getContext("2d")!.drawImage(canvas, 0, 0, tw, th);
  return { cropped, thumbnail: tc.toDataURL("image/jpeg", 0.7) };
}


export function CropEditor({ imageData, onComplete, onCancel, initialCorners }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [cropPoints, setCropPoints] = useState<CropPoints | null>(null);
  const [activeHandle, setActiveHandle] = useState<keyof CropPoints | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });
  
  // Enhancement states
  const [isDetecting, setIsDetecting] = useState(false);
  const [autoEnhance, setAutoEnhance] = useState(false);
  const [blackAndWhite, setBlackAndWhite] = useState(false);
  const [enhancedImage, setEnhancedImage] = useState<string | null>(null);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // No preloading needed — lightweight JS detection

  // Load image and try auto-detection
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
      } catch (error) {
        console.error("Edge detection failed:", error);
      } finally {
        setIsDetecting(false);
      }
    };
    img.src = imageData;
  }, [imageData]);

  // Apply image enhancements
  useEffect(() => {
    const applyEnhancements = async () => {
      if (!imageData) return;
      
      if (!autoEnhance && !blackAndWhite) {
        setEnhancedImage(null);
        return;
      }

      setIsEnhancing(true);
      try {
        let result = imageData;
        
        if (autoEnhance) {
          result = await enhanceForDocument(result);
        }
        
        if (blackAndWhite) {
          result = await convertToBlackAndWhite(result);
        }
        
        setEnhancedImage(result);
      } catch (error) {
        console.error("Enhancement failed:", error);
      } finally {
        setIsEnhancing(false);
      }
    };

    applyEnhancements();
  }, [imageData, autoEnhance, blackAndWhite]);

  // Calculate display size and initial crop points
  useEffect(() => {
    if (!containerRef.current || !imageSize.width) return;

    const container = containerRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    setContainerSize({ width: containerWidth, height: containerHeight });

    // Account for rotation
    const isRotated = rotation === 90 || rotation === 270;
    const imgWidth = isRotated ? imageSize.height : imageSize.width;
    const imgHeight = isRotated ? imageSize.width : imageSize.height;

    // Calculate display size (fit to container)
    const scale = Math.min(
      containerWidth / imgWidth,
      containerHeight / imgHeight
    );
    const displayWidth = imgWidth * scale;
    const displayHeight = imgHeight * scale;
    const offsetX = (containerWidth - displayWidth) / 2;
    const offsetY = (containerHeight - displayHeight) / 2;

    setDisplaySize({ width: displayWidth, height: displayHeight, offsetX, offsetY });

    // Use AI-detected corners or OpenCV-detected edges or default margin
    const detectedEdges = (window as any).__detectedEdges;
    if (initialCorners) {
      // AI corners are normalized (0-1), convert to display coordinates
      setCropPoints({
        topLeft: { x: offsetX + initialCorners.topLeft.x * displayWidth, y: offsetY + initialCorners.topLeft.y * displayHeight },
        topRight: { x: offsetX + initialCorners.topRight.x * displayWidth, y: offsetY + initialCorners.topRight.y * displayHeight },
        bottomRight: { x: offsetX + initialCorners.bottomRight.x * displayWidth, y: offsetY + initialCorners.bottomRight.y * displayHeight },
        bottomLeft: { x: offsetX + initialCorners.bottomLeft.x * displayWidth, y: offsetY + initialCorners.bottomLeft.y * displayHeight },
      });
    } else if (detectedEdges) {
      // detectedEdges from edgeDetectionLight are normalized 0-1
      setCropPoints({
        topLeft: { x: offsetX + detectedEdges.topLeft.x * displayWidth, y: offsetY + detectedEdges.topLeft.y * displayHeight },
        topRight: { x: offsetX + detectedEdges.topRight.x * displayWidth, y: offsetY + detectedEdges.topRight.y * displayHeight },
        bottomRight: { x: offsetX + detectedEdges.bottomRight.x * displayWidth, y: offsetY + detectedEdges.bottomRight.y * displayHeight },
        bottomLeft: { x: offsetX + detectedEdges.bottomLeft.x * displayWidth, y: offsetY + detectedEdges.bottomLeft.y * displayHeight },
      });
      delete (window as any).__detectedEdges;
    } else {
      const margin = 0.1;
      setCropPoints({
        topLeft: { x: offsetX + displayWidth * margin, y: offsetY + displayHeight * margin },
        topRight: { x: offsetX + displayWidth * (1 - margin), y: offsetY + displayHeight * margin },
        bottomRight: { x: offsetX + displayWidth * (1 - margin), y: offsetY + displayHeight * (1 - margin) },
        bottomLeft: { x: offsetX + displayWidth * margin, y: offsetY + displayHeight * (1 - margin) },
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
        const scaleX = displaySize.width;
        const scaleY = displaySize.height;
        
        setCropPoints({
          topLeft: { x: displaySize.offsetX + edges.topLeft.x * scaleX, y: displaySize.offsetY + edges.topLeft.y * scaleY },
          topRight: { x: displaySize.offsetX + edges.topRight.x * scaleX, y: displaySize.offsetY + edges.topRight.y * scaleY },
          bottomRight: { x: displaySize.offsetX + edges.bottomRight.x * scaleX, y: displaySize.offsetY + edges.bottomRight.y * scaleY },
          bottomLeft: { x: displaySize.offsetX + edges.bottomLeft.x * scaleX, y: displaySize.offsetY + edges.bottomLeft.y * scaleY },
        });
      }
    } catch (error) {
      console.error("Auto-detect failed:", error);
    } finally {
      setIsDetecting(false);
    }
  }, [imageData, displaySize, imageSize]);

  const handlePointerDown = useCallback(
    (handle: keyof CropPoints) => (e: React.PointerEvent) => {
      e.preventDefault();
      setActiveHandle(handle);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeHandle || !cropPoints || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(
        displaySize.offsetX,
        Math.min(e.clientX - rect.left, displaySize.offsetX + displaySize.width)
      );
      const y = Math.max(
        displaySize.offsetY,
        Math.min(e.clientY - rect.top, displaySize.offsetY + displaySize.height)
      );

      setCropPoints((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [activeHandle]: { x, y },
        };
      });
    },
    [activeHandle, cropPoints, displaySize]
  );

  const handlePointerUp = useCallback(() => {
    setActiveHandle(null);
  }, []);

  const generateCroppedImage = useCallback(async (): Promise<{ cropped: string; thumbnail: string } | null> => {
    if (!imageRef.current || !cropPoints) return null;

    // Use enhanced image if available
    const sourceImage = enhancedImage || imageData;

    // Convert display coordinates back to image coordinates
    const scaleX = imageSize.width / displaySize.width;
    const scaleY = imageSize.height / displaySize.height;

    const toImageCoords = (p: Point) => ({
      x: (p.x - displaySize.offsetX) * scaleX,
      y: (p.y - displaySize.offsetY) * scaleY,
    });

    const imgPoints = {
      topLeft: toImageCoords(cropPoints.topLeft),
      topRight: toImageCoords(cropPoints.topRight),
      bottomRight: toImageCoords(cropPoints.bottomRight),
      bottomLeft: toImageCoords(cropPoints.bottomLeft),
    };

    try {
      // Normalize corners to 0-1 for perspective correction
      const normalizedCorners = {
        topLeft: { x: imgPoints.topLeft.x / imageSize.width, y: imgPoints.topLeft.y / imageSize.height },
        topRight: { x: imgPoints.topRight.x / imageSize.width, y: imgPoints.topRight.y / imageSize.height },
        bottomRight: { x: imgPoints.bottomRight.x / imageSize.width, y: imgPoints.bottomRight.y / imageSize.height },
        bottomLeft: { x: imgPoints.bottomLeft.x / imageSize.width, y: imgPoints.bottomLeft.y / imageSize.height },
      };

      // Use pure JS perspective correction to straighten the document
      const corrected = await applyPerspectiveCorrectionLight(sourceImage, normalizedCorners);

      // Apply rotation if needed
      let finalImage = corrected;
      if (rotation !== 0) {
        finalImage = await rotateImage(corrected, rotation);
      }

      // Generate thumbnail
      const thumbnail = await generateThumbnail(finalImage, 200);

      return { cropped: finalImage, thumbnail };
    } catch (error) {
      console.error("Perspective correction failed, falling back to basic crop:", error);
      // Fallback: basic bounding-box crop
      return basicCrop(imageRef.current, imgPoints, rotation);
    }
  }, [cropPoints, imageSize, displaySize, rotation, enhancedImage, imageData]);

  const [isProcessingCrop, setIsProcessingCrop] = useState(false);

  const handleComplete = useCallback(async () => {
    setIsProcessingCrop(true);
    try {
      const result = await generateCroppedImage();
      if (result) {
        onComplete(result.cropped, result.thumbnail);
      }
    } finally {
      setIsProcessingCrop(false);
    }
  }, [generateCroppedImage, onComplete]);

  const renderHandle = (key: keyof CropPoints) => {
    if (!cropPoints) return null;
    const point = cropPoints[key];

    return (
      <div
        key={key}
        className="absolute cursor-move touch-none"
        style={{
          left: point.x - HANDLE_SIZE / 2,
          top: point.y - HANDLE_SIZE / 2,
          width: HANDLE_SIZE,
          height: HANDLE_SIZE,
        }}
        onPointerDown={handlePointerDown(key)}
      >
        <div className="absolute inset-1 bg-white rounded-full border-2 border-primary shadow-lg" />
        <Move className="absolute inset-0 m-auto h-3 w-3 text-primary" />
      </div>
    );
  };

  const renderCropOverlay = () => {
    if (!cropPoints) return null;

    const { topLeft, topRight, bottomRight, bottomLeft } = cropPoints;

    // Create SVG path for the crop area
    const path = `M ${topLeft.x} ${topLeft.y} L ${topRight.x} ${topRight.y} L ${bottomRight.x} ${bottomRight.y} L ${bottomLeft.x} ${bottomLeft.y} Z`;

    return (
      <>
        {/* Darkened area outside crop */}
        <svg className="absolute inset-0 pointer-events-none">
          <defs>
            <mask id="cropMask">
              <rect width="100%" height="100%" fill="white" />
              <path d={path} fill="black" />
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.5)"
            mask="url(#cropMask)"
          />
          <path
            d={path}
            fill="none"
            stroke="white"
            strokeWidth="2"
          />
        </svg>
      </>
    );
  };

  const displayImageSrc = enhancedImage || imageData;

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={onCancel}
        >
          <X className="h-6 w-6" />
        </Button>
        <span className="text-white font-medium">
          {isDetecting ? "Détection..." : "Recadrer"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={handleRotate}
        >
          <RotateCw className="h-5 w-5" />
        </Button>
      </div>

      {/* Enhancement controls */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 bg-black/60">
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-white/20 gap-2"
          onClick={handleAutoDetect}
          disabled={isDetecting}
        >
          {isDetecting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          Auto
        </Button>
        
        <div className="flex items-center gap-2">
          <Switch
            id="enhance"
            checked={autoEnhance}
            onCheckedChange={setAutoEnhance}
            disabled={isEnhancing}
          />
          <Label htmlFor="enhance" className="text-white text-xs flex items-center gap-1">
            <SunMedium className="h-3 w-3" />
            Améliorer
          </Label>
        </div>
        
        <div className="flex items-center gap-2">
          <Switch
            id="bw"
            checked={blackAndWhite}
            onCheckedChange={setBlackAndWhite}
            disabled={isEnhancing}
          />
          <Label htmlFor="bw" className="text-white text-xs flex items-center gap-1">
            <Contrast className="h-3 w-3" />
            N&B
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
        {/* Loading overlay */}
        {(isDetecting || isEnhancing) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <Loader2 className="h-8 w-8 text-white animate-spin" />
          </div>
        )}

        {/* Image */}
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

        {/* Crop overlay and handles */}
        {renderCropOverlay()}
        {renderHandle("topLeft")}
        {renderHandle("topRight")}
        {renderHandle("bottomRight")}
        {renderHandle("bottomLeft")}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 pb-20 bg-black/80">
        <p className="text-white/70 text-sm">
          Déplacez les points pour ajuster
        </p>
        <Button onClick={handleComplete} className="bg-primary hover:bg-primary/90" disabled={isProcessingCrop}>
          {isProcessingCrop ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Check className="h-4 w-4 mr-2" />
          )}
          Confirmer
        </Button>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
