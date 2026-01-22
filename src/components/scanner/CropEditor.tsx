import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, RotateCw, Move } from "lucide-react";

interface CropEditorProps {
  imageData: string;
  onComplete: (croppedImage: string, thumbnail: string) => void;
  onCancel: () => void;
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

export function CropEditor({ imageData, onComplete, onCancel }: CropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [cropPoints, setCropPoints] = useState<CropPoints | null>(null);
  const [activeHandle, setActiveHandle] = useState<keyof CropPoints | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0, offsetX: 0, offsetY: 0 });

  // Load image and set initial crop points
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imageRef.current = img;
      setImageSize({ width: img.width, height: img.height });
    };
    img.src = imageData;
  }, [imageData]);

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

    // Set initial crop points (10% margin)
    const margin = 0.1;
    setCropPoints({
      topLeft: { x: offsetX + displayWidth * margin, y: offsetY + displayHeight * margin },
      topRight: { x: offsetX + displayWidth * (1 - margin), y: offsetY + displayHeight * margin },
      bottomRight: { x: offsetX + displayWidth * (1 - margin), y: offsetY + displayHeight * (1 - margin) },
      bottomLeft: { x: offsetX + displayWidth * margin, y: offsetY + displayHeight * (1 - margin) },
    });
  }, [imageSize, rotation]);

  const handleRotate = useCallback(() => {
    setRotation((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270);
  }, []);

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

  const generateCroppedImage = useCallback((): { cropped: string; thumbnail: string } | null => {
    if (!imageRef.current || !cropPoints || !canvasRef.current) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const img = imageRef.current;

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

    // Calculate bounding box
    const minX = Math.min(imgPoints.topLeft.x, imgPoints.bottomLeft.x);
    const maxX = Math.max(imgPoints.topRight.x, imgPoints.bottomRight.x);
    const minY = Math.min(imgPoints.topLeft.y, imgPoints.topRight.y);
    const maxY = Math.max(imgPoints.bottomLeft.y, imgPoints.bottomRight.y);

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    // Set canvas size
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Apply rotation and draw
    ctx.save();
    
    if (rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      
      if (rotation === 90 || rotation === 270) {
        ctx.drawImage(
          img,
          minX, minY, cropWidth, cropHeight,
          -cropHeight / 2, -cropWidth / 2, cropHeight, cropWidth
        );
        // Resize canvas for rotated dimensions
        const temp = canvas.width;
        canvas.width = canvas.height;
        canvas.height = temp;
      } else {
        ctx.drawImage(
          img,
          minX, minY, cropWidth, cropHeight,
          -cropWidth / 2, -cropHeight / 2, cropWidth, cropHeight
        );
      }
    } else {
      ctx.drawImage(
        img,
        minX, minY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );
    }
    
    ctx.restore();

    // Generate cropped image
    const cropped = canvas.toDataURL("image/jpeg", 0.92);

    // Generate thumbnail (200px wide)
    const thumbWidth = 200;
    const thumbHeight = (canvas.height / canvas.width) * thumbWidth;
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
    const thumbCtx = thumbCanvas.getContext("2d");
    if (thumbCtx) {
      thumbCtx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
    }
    const thumbnail = thumbCanvas.toDataURL("image/jpeg", 0.7);

    return { cropped, thumbnail };
  }, [imageRef, cropPoints, imageSize, displaySize, rotation]);

  const handleComplete = useCallback(() => {
    const result = generateCroppedImage();
    if (result) {
      onComplete(result.cropped, result.thumbnail);
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

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
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
        <span className="text-white font-medium">Recadrer</span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={handleRotate}
        >
          <RotateCw className="h-5 w-5" />
        </Button>
      </div>

      {/* Image area */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden touch-none"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Image */}
        {imageSize.width > 0 && (
          <img
            src={imageData}
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
      <div className="flex items-center justify-between p-4 bg-black/80">
        <p className="text-white/70 text-sm">
          Déplacez les points pour ajuster
        </p>
        <Button onClick={handleComplete} className="bg-primary hover:bg-primary/90">
          <Check className="h-4 w-4 mr-2" />
          Confirmer
        </Button>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
