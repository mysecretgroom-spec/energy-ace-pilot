import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw, AlertCircle, Upload, Zap, ZapOff, Undo2, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRealtimeEdgeDetection, DetectedQuad } from "./hooks/useRealtimeEdgeDetection";
import { EdgeOverlay } from "./EdgeOverlay";
import { applyPerspectiveCorrectionLight } from "./services/perspectiveCorrection";

interface CapturedPage {
  id: string;
  imageData: string;
  thumbnailData: string;
}

interface CameraScannerProps {
  onCapture: (imageData: string, detectedQuad?: DetectedQuad) => void;
  onCancel: () => void;
  pageCount: number;
  /** New: multi-page mode — scanner handles pages internally */
  onMultiCapture?: (pages: CapturedPage[]) => void;
}

type CameraState = "requesting" | "active" | "error" | "denied";

function generateThumbnail(dataUrl: string, size = 80): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.height / img.width;
      const w = size, h = size * ratio;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function CameraScanner({ onCapture, onCancel, pageCount, onMultiCapture }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraState, setCameraState] = useState<CameraState>("requesting");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [autoCapture, setAutoCapture] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);

  // Real-time edge detection
  const { detectedQuad, isStable, reset } = useRealtimeEdgeDetection({
    videoRef,
    enabled: cameraState === "active" && !isCapturing,
    onStableDetection: (quad) => {
      if (autoCapture && !isCapturing) {
        performCapture(quad);
      }
    },
  });

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState("requesting");
    stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setVideoDimensions({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        });
        setCameraState("active");
      }
    } catch (error: unknown) {
      console.error("Camera error:", error);
      const err = error as { name?: string };
      setCameraState(err.name === "NotAllowedError" ? "denied" : "error");
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleVideoMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    }
  }, []);

  /** Capture frame, auto-crop if quad detected, store as page */
  const performCapture = useCallback(async (quad?: DetectedQuad) => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    setIsCapturing(true);

    if (navigator.vibrate) navigator.vibrate(50);

    // Flash
    const flash = document.createElement("div");
    flash.className = "fixed inset-0 bg-white z-[100] pointer-events-none";
    flash.style.animation = "flash 200ms ease-out";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 200);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setIsCapturing(false); return; }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const rawImage = canvas.toDataURL("image/jpeg", 0.92);
    reset();

    // Auto-crop with perspective correction if quad was detected
    let finalImage = rawImage;
    if (quad && quad.confidence > 0.3) {
      try {
        const normalizedCorners = {
          topLeft: { x: quad.topLeft.x / video.videoWidth, y: quad.topLeft.y / video.videoHeight },
          topRight: { x: quad.topRight.x / video.videoWidth, y: quad.topRight.y / video.videoHeight },
          bottomRight: { x: quad.bottomRight.x / video.videoWidth, y: quad.bottomRight.y / video.videoHeight },
          bottomLeft: { x: quad.bottomLeft.x / video.videoWidth, y: quad.bottomLeft.y / video.videoHeight },
        };
        finalImage = await applyPerspectiveCorrectionLight(rawImage, normalizedCorners);
      } catch (err) {
        console.warn("Auto perspective correction failed, using raw image:", err);
      }
    }

    const thumbnail = await generateThumbnail(finalImage);
    const page: CapturedPage = {
      id: crypto.randomUUID(),
      imageData: finalImage,
      thumbnailData: thumbnail,
    };

    setCapturedPages((prev) => [...prev, page]);
    setIsCapturing(false);
  }, [isCapturing, reset]);

  const handleManualCapture = useCallback(() => {
    performCapture(detectedQuad || undefined);
  }, [performCapture, detectedQuad]);

  const handleUndo = useCallback(() => {
    setCapturedPages((prev) => prev.slice(0, -1));
  }, []);

  const handleFinish = useCallback(() => {
    stopCamera();
    if (onMultiCapture && capturedPages.length > 0) {
      onMultiCapture(capturedPages);
    } else if (capturedPages.length > 0) {
      // Fallback: send first page via legacy onCapture
      onCapture(capturedPages[0].imageData);
    }
  }, [stopCamera, onMultiCapture, onCapture, capturedPages]);

  const handleSwitchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  useEffect(() => {
    if (cameraState === "active") startCamera();
  }, [facingMode]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) onCapture(result);
    };
    reader.onerror = () => toast({ title: "Erreur", description: "Impossible de lire le fichier", variant: "destructive" });
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onCapture]);

  const handleClose = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  const toggleAutoCapture = useCallback(() => {
    setAutoCapture((prev) => !prev);
  }, []);

  const totalPages = pageCount + capturedPages.length;

  // Error/denied states
  if (cameraState === "denied") {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Accès caméra refusé</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-sm">
          Pour scanner des documents, autorisez l'accès à la caméra dans les paramètres de votre navigateur.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Importer un fichier
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleFileImport} className="hidden" />
      </div>
    );
  }

  if (cameraState === "error") {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Caméra non disponible</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-sm">
          Aucune caméra n'a été détectée. Vous pouvez importer un fichier à la place.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Importer un fichier
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleFileImport} className="hidden" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <style>{`
        @keyframes flash {
          0% { opacity: 0.8; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleClose}>
          <X className="h-6 w-6" />
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className={`text-white hover:bg-white/20 ${autoCapture ? "bg-teal-500/30" : ""}`}
            onClick={toggleAutoCapture}
          >
            {autoCapture ? <Zap className="h-5 w-5 text-teal-400" /> : <ZapOff className="h-5 w-5" />}
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={handleSwitchCamera}>
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      {/* Video feed */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={handleVideoMetadata}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Edge detection overlay */}
        {cameraState === "active" && (
          <EdgeOverlay
            quad={detectedQuad}
            isStable={isStable}
            videoWidth={videoDimensions.width}
            videoHeight={videoDimensions.height}
            containerWidth={containerDimensions.width}
            containerHeight={containerDimensions.height}
          />
        )}

        {/* Guide when no detection */}
        {!detectedQuad && cameraState === "active" && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-8 sm:inset-16 border-2 border-white/30 border-dashed rounded-lg">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white/50 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white/50 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white/50 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white/50 rounded-br-lg" />
            </div>
            <div className="absolute inset-x-0 top-1/3 text-center">
              <p className="text-white/80 text-sm font-medium bg-black/30 px-4 py-2 rounded-full inline-block">
                Placez le document dans le cadre
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {cameraState === "requesting" && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
              <p>Activation de la caméra...</p>
            </div>
          </div>
        )}
      </div>

      {/* Page thumbnails strip */}
      {capturedPages.length > 0 && (
        <div className="absolute right-4 bottom-44 z-10 flex flex-col items-end gap-1">
          <div className="relative">
            <img
              src={capturedPages[capturedPages.length - 1].thumbnailData}
              alt="Dernière page"
              className="w-14 h-auto rounded border-2 border-white shadow-lg"
            />
            <span className="absolute -top-2 -right-2 bg-teal-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow">
              {totalPages}
            </span>
          </div>
        </div>
      )}

      {/* Scanner label */}
      <div className="absolute bottom-32 left-0 right-0 z-10 text-center pointer-events-none">
        <span className="text-teal-400 text-sm font-semibold tracking-wide">Scanner</span>
      </div>

      {/* Footer controls — iOS style */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-8 pb-10 pt-6 bg-gradient-to-t from-black/80 to-transparent">
        {/* Undo last page */}
        <button
          className="flex flex-col items-center gap-1 text-white/70 disabled:opacity-30"
          onClick={handleUndo}
          disabled={capturedPages.length === 0}
        >
          <Undo2 className="h-7 w-7" />
        </button>

        {/* Capture button — teal ring like iOS */}
        <button
          className={`relative h-[72px] w-[72px] rounded-full transition-all ${
            isCapturing ? "scale-90" : ""
          }`}
          onClick={handleManualCapture}
          disabled={cameraState !== "active" || isCapturing}
        >
          {/* Outer teal ring */}
          <span className={`absolute inset-0 rounded-full border-[4px] transition-colors ${
            isStable ? "border-teal-400" : "border-white/60"
          }`} />
          {/* Inner white circle */}
          <span className="absolute inset-[6px] rounded-full bg-white" />
        </button>

        {/* Terminé / Done button */}
        <button
          className={`flex flex-col items-center gap-1 transition-colors ${
            capturedPages.length > 0
              ? "text-teal-400 font-semibold"
              : "text-white/30 pointer-events-none"
          }`}
          onClick={handleFinish}
          disabled={capturedPages.length === 0}
        >
          <span className="text-sm font-semibold bg-teal-500 text-white px-4 py-2 rounded-lg">
            Terminé
          </span>
        </button>
      </div>

      {/* Hidden elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,application/pdf"
        onChange={handleFileImport}
        className="hidden"
      />
    </div>
  );
}
