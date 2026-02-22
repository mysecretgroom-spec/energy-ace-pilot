import React, { useEffect, useRef, useCallback, useState } from "react";
import { Camera, ImagePlus, X, Undo, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCameraStream } from "../hooks/useCameraStream";
import { useWorkerPipeline } from "../hooks/useWorkerPipeline";
import { downscale, releaseCanvas } from "../utils/image";
import { hapticFeedback } from "@/lib/haptics";
import type { Quad } from "../types";
import { MAX_ANALYSIS_DIM } from "../types";

interface CameraCaptureProps {
  onCapture: (canvas: HTMLCanvasElement, quad: Quad | null) => void;
  onImport: (file: File) => void;
  onCancel: () => void;
  pageCount: number;
  thumbnails?: string[];
}

export function CameraCapture({ onCapture, onImport, onCancel, pageCount, thumbnails = [] }: CameraCaptureProps) {
  const { videoRef, isReady, error, startCamera, stopCamera, captureFrame } = useCameraStream();
  const { detectedQuad, isStable, confidence, detectFromCanvas } = useWorkerPipeline();
  const overlayRef = useRef<SVGSVGElement>(null);
  const [flashVisible, setFlashVisible] = useState(false);
  const detectionIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captureCooldownRef = useRef(false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Detection loop: ~3.5fps
  useEffect(() => {
    if (!isReady) return;
    const run = () => {
      const frame = captureFrame();
      if (frame) {
        const small = downscale(frame, MAX_ANALYSIS_DIM);
        detectFromCanvas(small);
        releaseCanvas(frame);
        releaseCanvas(small);
      }
    };
    detectionIntervalRef.current = window.setInterval(run, 300);
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [isReady, captureFrame, detectFromCanvas]);

  const handleCapture = useCallback(() => {
    // Prevent double-tap and accidental rapid captures
    if (captureCooldownRef.current) return;
    captureCooldownRef.current = true;
    setTimeout(() => { captureCooldownRef.current = false; }, 1200);

    const frame = captureFrame();
    if (!frame) { captureCooldownRef.current = false; return; }
    hapticFeedback("medium");
    setFlashVisible(true);
    setTimeout(() => setFlashVisible(false), 150);

    // Scale quad from analysis resolution to original
    onCapture(frame, detectedQuad);
  }, [captureFrame, detectedQuad, onCapture]);

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    e.target.value = "";
  };

  // Render quad overlay points
  const renderQuadOverlay = () => {
    if (!detectedQuad || !videoRef.current) return null;
    const video = videoRef.current;
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;

    const q = detectedQuad;
    const toPercent = (p: { x: number; y: number }) => ({
      x: (p.x / vw) * 100,
      y: (p.y / vh) * 100,
    });

    // Scale quad from analysis dim back to video dim
    const scale = Math.max(vw, vh) / MAX_ANALYSIS_DIM;
    const scaled = {
      topLeft: { x: q.topLeft.x * scale, y: q.topLeft.y * scale },
      topRight: { x: q.topRight.x * scale, y: q.topRight.y * scale },
      bottomRight: { x: q.bottomRight.x * scale, y: q.bottomRight.y * scale },
      bottomLeft: { x: q.bottomLeft.x * scale, y: q.bottomLeft.y * scale },
    };

    const pts = [scaled.topLeft, scaled.topRight, scaled.bottomRight, scaled.bottomLeft];
    const points = pts.map((p) => {
      const pct = toPercent(p);
      return `${pct.x}%,${pct.y}%`;
    }).join(" ");

    return (
      <svg
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polygon
          points={points}
          fill="rgba(45, 212, 191, 0.12)"
          stroke="#2dd4bf"
          strokeWidth="0.4"
          strokeLinejoin="round"
        />
        {pts.map((p, i) => {
          const pct = toPercent(p);
          return (
            <circle
              key={i}
              cx={`${pct.x}%`}
              cy={`${pct.y}%`}
              r="0.8"
              fill="#2dd4bf"
              stroke="white"
              strokeWidth="0.3"
            />
          );
        })}
      </svg>
    );
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 gap-4">
        <Camera className="w-12 h-12 text-muted-foreground" />
        <p className="text-center text-muted-foreground">{error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button onClick={handleImportClick}>
            <ImagePlus className="w-4 h-4 mr-2" />
            Importer
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Flash overlay */}
      {flashVisible && <div className="absolute inset-0 z-30 bg-white animate-pulse pointer-events-none" />}

      {/* Video */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />
        {renderQuadOverlay()}

        {/* Detection badge */}
        {isReady && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            {isStable && confidence >= 0.75 ? (
              <div className="bg-teal-500/90 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Détection OK
              </div>
            ) : detectedQuad ? (
              <div className="bg-amber-500/80 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
                Détection... {Math.round(confidence * 100)}%
              </div>
            ) : (
              <div className="bg-black/50 text-white/70 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
                Cadrez le document
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        <button onClick={onCancel} className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom bar */}
      <div className="bg-black/90 backdrop-blur-sm px-4 py-4 flex items-center justify-between safe-area-bottom">
        {/* Thumbnails / Page count */}
        <div className="flex items-center gap-2 min-w-[60px]">
          {pageCount > 0 && (
            <div className="flex items-center gap-1 text-white/80 text-xs">
              <Layers className="w-4 h-4" />
              <span>{pageCount}</span>
            </div>
          )}
        </div>

        {/* Capture button */}
        <button
          onClick={handleCapture}
          disabled={!isReady}
          className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
        >
          <div className="w-12 h-12 rounded-full bg-white" />
        </button>

        {/* Import button */}
        <div className="min-w-[60px] flex justify-end">
          <button
            onClick={handleImportClick}
            className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center text-white"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
}
