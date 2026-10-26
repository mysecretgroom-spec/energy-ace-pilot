import React, { useEffect, useRef, useCallback, useState } from "react";
import { Camera, ImagePlus, X, Undo, Layers, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetectionLight } from "@/components/scanner/DetectionLight";
import { useCameraStream } from "../hooks/useCameraStream";
import { useWorkerPipeline } from "../hooks/useWorkerPipeline";
import { downscale, releaseCanvas } from "../utils/image";
import { hapticFeedback } from "@/lib/haptics";
import type { Quad } from "../types";
import { MAX_ANALYSIS_DIM } from "../types";

/** Live preview analysis size; the captured photo keeps full resolution. */
const LIVE_ANALYSIS_DIM = 640;

interface CameraCaptureProps {
  onCapture: (canvas: HTMLCanvasElement, quad: Quad | null, scanNet?: boolean) => void;
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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const captureCooldownRef = useRef(false);
  const analysisScaleRef = useRef(1);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  // Detection loop: ~3.5fps
  useEffect(() => {
    if (!isReady) return;
    const run = () => {
      const small = captureFrame(LIVE_ANALYSIS_DIM);
      if (small) {
        const vw = videoRef.current?.videoWidth || small.width;
        analysisScaleRef.current = vw / Math.max(1, small.width);
        detectFromCanvas(small);
        releaseCanvas(small);
      }
    };
    detectionIntervalRef.current = window.setInterval(run, 300);
    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [isReady, captureFrame, detectFromCanvas]);

  const handleCapture = useCallback((scanNet = false) => {
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
    onCapture(frame, detectedQuad, scanNet);
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
    // Quad is in analysis-canvas pixels; map back to video pixels.
    const scale = analysisScaleRef.current;
    const pts = [q.topLeft, q.topRight, q.bottomRight, q.bottomLeft].map((p) => ({
      x: p.x * scale,
      y: p.y * scale,
    }));
    const points = pts.map((p) => `${p.x},${p.y}`).join(" ");
    const unit = Math.max(vw, vh) / 100;

    return (
      // viewBox in video pixels + "slice" reproduces the video's object-cover crop,
      // so the outline sits exactly on the paper shown on screen.
      <svg
        ref={overlayRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        viewBox={`0 0 ${vw} ${vh}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <polygon
          points={points}
          fill="rgba(45, 212, 191, 0.12)"
          stroke="#2dd4bf"
          strokeWidth={unit * 0.4}
          strokeLinejoin="round"
        />
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={unit * 1.2}
            fill="#2dd4bf"
            stroke="white"
            strokeWidth={unit * 0.3}
          />
        ))}
      </svg>
    );
  };

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6 gap-4">
        <Camera className="w-12 h-12 text-muted-foreground" />
        <p className="text-center text-muted-foreground">{error}</p>
        <div className="flex w-full max-w-sm flex-col gap-3 [&>button]:w-full">
          <Button variant="outline" onClick={onCancel}>Annuler</Button>
          <Button variant="secondary" onClick={() => photoInputRef.current?.click()}>
            <Camera className="w-4 h-4 mr-2" />Photo haute résolution
          </Button>
          <Button onClick={handleImportClick}>
            <ImagePlus className="w-4 h-4 mr-2" />
            Importer
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
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
        <DetectionLight
          className="absolute top-5 left-4 z-20"
          score={detectedQuad ? Math.min(1, confidence * (isStable ? 1 : 0.75)) : 0}
        />

        {/* Close button */}
        <button onClick={onCancel} className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="absolute bottom-28 inset-x-0 z-20 flex justify-center gap-2">
        <Button variant="secondary" onClick={() => photoInputRef.current?.click()}>
          <Camera className="h-4 w-4 mr-2" />Photo haute résolution
        </Button>
        <Button onClick={() => handleCapture(true)} disabled={!isReady}>
          <ScanLine className="h-4 w-4 mr-2" />Scan net
        </Button>
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
          onClick={() => handleCapture()}
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
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
}
