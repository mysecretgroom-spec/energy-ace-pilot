import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Camera, X, RotateCcw, AlertCircle, Upload,
  Zap, ZapOff, Undo2, Focus, Sun, SunDim, ScanLine, Loader2,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useRealtimeEdgeDetection, DetectedQuad } from "./hooks/useRealtimeEdgeDetection";
import { DetectionLight } from "./DetectionLight";
import { CropEditor } from "./CropEditor";
import { captureStill, applyDocumentFocus } from "./services/stillCapture";

interface CapturedPage {
  id: string;
  imageData: string;
  thumbnailData: string;
}

async function makeThumbnail(dataUrl: string): Promise<string> {
  const img = new Image();
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Image illisible")); img.src = dataUrl; });
  const scale = 240 / Math.max(img.width, img.height);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
  c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.7);
}

interface CameraScannerProps {
  onCapture: (imageData: string, detectedQuad?: DetectedQuad) => void;
  onCancel: () => void;
  pageCount: number;
  onMultiCapture?: (pages: CapturedPage[]) => void;
}

type CameraState = "requesting" | "active" | "error" | "denied";

// Blur threshold — below this, image is too blurry
const BLUR_THRESHOLD = 100;
// Brightness thresholds
const LOW_BRIGHTNESS = 60;
// Cadrage : surface minimale occupée par le document dans l'image
const MIN_COVERAGE = 0.35;
// Cadrage : inclinaison max tolérée (0 = parfaitement de face)
const MAX_SKEW = 0.15;

/** Part de l'image occupée par le document détecté (0-1). */
function quadCoverage(quad: DetectedQuad, w: number, h: number): number {
  if (!w || !h) return 0;
  const pts = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2 / (w * h);
}

/** Écart entre côtés opposés : 0 = document bien de face, >0 = photo prise de biais. */
function quadSkew(quad: DetectedQuad): number {
  const len = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);
  const top = len(quad.topLeft, quad.topRight);
  const bottom = len(quad.bottomLeft, quad.bottomRight);
  const left = len(quad.topLeft, quad.bottomLeft);
  const right = len(quad.topRight, quad.bottomRight);
  const h = Math.abs(top - bottom) / Math.max(1, Math.max(top, bottom));
  const v = Math.abs(left - right) / Math.max(1, Math.max(left, right));
  return Math.max(h, v);
}

function generateThumbnail(dataUrl: string, size = 80): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.height / img.width;
      const w = size, h = size * ratio;
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL("image/jpeg", 0.6));
      c.width = 0; c.height = 0;
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
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [cameraState, setCameraState] = useState<CameraState>("requesting");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [autoCapture, setAutoCapture] = useState(() => localStorage.getItem("scanner_auto_capture") === "on");
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingScan, setPendingScan] = useState<string | null>(null);
  const [capturedPages, setCapturedPages] = useState<CapturedPage[]>([]);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const captureCooldownRef = useRef(false);
  const cameraRequestRef = useRef(0);

  // Real-time edge detection with Canny+Hough
  const { detectedQuad, isStable, blurScore, brightness, reset } = useRealtimeEdgeDetection({
    videoRef,
    enabled: cameraState === "active" && !isCapturing && !pendingScan,
    onStableDetection: (quad) => {
      // Déclenchement auto : net, bien cadré (assez grand) et pris de face
      const video = videoRef.current;
      const coverage = video ? quadCoverage(quad, video.videoWidth, video.videoHeight) : 0;
      if (
        autoCapture && !pendingScan && !isCapturing && !captureCooldownRef.current &&
        blurScore > BLUR_THRESHOLD && quad.confidence > 0.7 &&
        coverage >= MIN_COVERAGE && quadSkew(quad) <= MAX_SKEW
      ) {
        performCapture(quad);
      }
    },
  });

  const isBlurry = blurScore > 0 && blurScore < BLUR_THRESHOLD;
  const isDark = brightness < LOW_BRIGHTNESS;
  const coverage = detectedQuad
    ? quadCoverage(detectedQuad, videoDimensions.width, videoDimensions.height)
    : 0;
  const skew = detectedQuad ? quadSkew(detectedQuad) : 0;
  const tooFar = !!detectedQuad && coverage > 0 && coverage < MIN_COVERAGE;
  const tooSkewed = !!detectedQuad && skew > MAX_SKEW;

  const stopCamera = useCallback(() => {
    cameraRequestRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraState("requesting");
    stopCamera();
    const request = ++cameraRequestRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 4096 },
          height: { ideal: 2160 },
        },
        audio: false,
      });
      if (request !== cameraRequestRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;

      // Check torch support
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as any;
      if (caps?.torch) setTorchSupported(true);
      // Continuous autofocus / exposure / white balance for documents
      await applyDocumentFocus(track ?? null);
      if (request !== cameraRequestRef.current) return;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (request !== cameraRequestRef.current) return;
        setVideoDimensions({
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight,
        });
        setCameraState("active");
      }
    } catch (error: unknown) {
      if (request !== cameraRequestRef.current) return;
      stopCamera();
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
    if (pendingScan || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => setCameraState("error"));
  }, [pendingScan]);

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
  }, [pendingScan, cameraState]);

  // Auto-enable torch in dark conditions
  useEffect(() => {
    if (torchSupported && isDark && !torchOn && streamRef.current) {
      toggleTorch(true);
    }
  }, [isDark, torchSupported, torchOn]);

  const handleVideoMetadata = useCallback(() => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    }
  }, []);

  const toggleTorch = useCallback(async (forceState?: boolean) => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    const newState = forceState ?? !torchOn;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: newState }] });
      setTorchOn(newState);
    } catch {
      // torch not supported on this device
    }
  }, [torchOn]);

  /** Every capture is reviewed on the actual image before joining the PDF. */
  const performCapture = useCallback(async (_quad?: DetectedQuad, _review = false) => {
    if (!videoRef.current || !canvasRef.current || pendingScan || isCapturing || captureCooldownRef.current) return;
    
    // Cooldown to prevent burst captures
    captureCooldownRef.current = true;
    setTimeout(() => { captureCooldownRef.current = false; }, onMultiCapture ? 700 : 4000);

    setIsCapturing(true);
    if (navigator.vibrate) navigator.vibrate(50);

    // Flash effect
    const flash = document.createElement("div");
    flash.className = "fixed inset-0 bg-white z-[100] pointer-events-none";
    flash.style.animation = "flash 200ms ease-out";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 200);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setIsCapturing(false); return; }

    try {
    // Full-resolution still (sensor photo) with video-frame fallback
    const track = streamRef.current?.getVideoTracks()[0] ?? null;
    const still = await captureStill(track, video, canvas);
    const rawImage = still.dataUrl;
    reset();
    if (onMultiCapture) {
      // Rafale : on garde la photo brute ; le rognage est validé page par page après « Terminé ».
      const thumb = await makeThumbnail(rawImage);
      setCapturedPages(prev => [...prev, { id: crypto.randomUUID(), imageData: rawImage, thumbnailData: thumb }]);
    } else {
      setPendingScan(rawImage);
    }
    } catch (error) {
      console.error("Capture failed:", error);
      toast({ title: "Capture impossible", description: "Réessayez ou importez une photo", variant: "destructive" });
    } finally { setIsCapturing(false); }
    // Batch mode: stay on camera for next page
  }, [isCapturing, pendingScan, reset, onMultiCapture]);

  const handleManualCapture = useCallback(() => {
    // Block capture if too blurry
    if (isBlurry) {
      toast({ title: "Image trop floue", description: "Stabilisez votre appareil", variant: "destructive" });
      return;
    }
    performCapture(detectedQuad || undefined);
  }, [performCapture, detectedQuad, isBlurry]);

  const handleUndo = useCallback(() => {
    setCapturedPages((prev) => prev.slice(0, -1));
  }, []);

  const handleFinish = useCallback(() => {
    stopCamera();
    if (onMultiCapture && capturedPages.length > 0) {
      onMultiCapture(capturedPages);
    } else if (capturedPages.length > 0) {
      onCapture(capturedPages[0].imageData);
    }
  }, [stopCamera, onMultiCapture, onCapture, capturedPages]);

  const handleSwitchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) setPendingScan(result);
    };
    reader.onerror = () => toast({ title: "Erreur", description: "Impossible de lire le fichier", variant: "destructive" });
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  const toggleAutoCapture = useCallback(() => {
    setAutoCapture((prev) => { const next = !prev; localStorage.setItem("scanner_auto_capture", next ? "on" : "off"); return next; });
  }, []);

  const totalPages = pageCount + capturedPages.length;

  // Status message for the detection badge
  const getStatusBadge = () => {
    if (isBlurry) {
      return (
        <div className="bg-red-500/80 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
          <Focus className="w-3 h-3" />
          Image floue — stabilisez
        </div>
      );
    }
    if (isDark) {
      return (
        <div className="bg-amber-500/80 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
          <SunDim className="w-3 h-3" />
          Faible luminosité
        </div>
      );
    }
    if (tooFar) {
      return (
        <div className="bg-amber-500/80 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
          Rapprochez-vous du document
        </div>
      );
    }
    if (tooSkewed) {
      return (
        <div className="bg-amber-500/80 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
          Placez l'appareil bien à plat
        </div>
      );
    }
    if (isStable && detectedQuad && detectedQuad.confidence > 0.5) {
      return (
        <div className="bg-teal-500/90 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          {autoCapture ? "Cadrage OK — capture auto" : "Document détecté ✓"}
        </div>
      );
    }
    if (detectedQuad) {
      return (
        <div className="bg-amber-500/80 text-white px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
          Détection... {Math.round(detectedQuad.confidence * 100)}%
        </div>
      );
    }
    return (
      <div className="bg-black/50 text-white/70 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-sm">
        Placez le document dans le cadre
      </div>
    );
  };

  if (pendingScan) return (
    <CropEditor imageData={pendingScan} initialEnhance
      onCancel={() => setPendingScan(null)}
      onComplete={(imageData, thumbnailData) => {
        setCapturedPages(prev => [...prev, { id: crypto.randomUUID(), imageData, thumbnailData }]);
        setPendingScan(null);
      }} />
  );

  // Error/denied states
  if (cameraState === "denied") {
    return (
      <div className="fixed inset-0 z-[70] bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Accès caméra refusé</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-sm">
          Pour scanner des documents, autorisez l'accès à la caméra dans les paramètres de votre navigateur.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button variant="secondary" onClick={() => photoInputRef.current?.click()}><Camera className="h-4 w-4 mr-2" />Photo haute résolution</Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Importer un fichier
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleFileImport} className="hidden" />
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileImport} className="hidden" />
      </div>
    );
  }

  if (cameraState === "error") {
    return (
      <div className="fixed inset-0 z-[70] bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Caméra non disponible</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-sm">
          Aucune caméra n'a été détectée. Vous pouvez importer un fichier à la place.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose}>Annuler</Button>
          <Button variant="secondary" onClick={() => photoInputRef.current?.click()}><Camera className="h-4 w-4 mr-2" />Photo haute résolution</Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />Importer un fichier
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleFileImport} className="hidden" />
        <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileImport} className="hidden" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
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
          {/* Auto-capture toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={`text-white hover:bg-white/20 ${autoCapture ? "bg-teal-500/30" : ""}`}
            onClick={toggleAutoCapture}
            title={autoCapture ? "Auto-capture ON" : "Auto-capture OFF"}
          >
            {autoCapture ? <Zap className="h-5 w-5 text-teal-400" /> : <ZapOff className="h-5 w-5" />}
          </Button>
          {/* Torch toggle */}
          {torchSupported && (
            <Button
              variant="ghost"
              size="icon"
              className={`text-white hover:bg-white/20 ${torchOn ? "bg-amber-500/30" : ""}`}
              onClick={() => toggleTorch()}
              title="Flash"
            >
              {torchOn ? <Sun className="h-5 w-5 text-amber-400" /> : <SunDim className="h-5 w-5" />}
            </Button>
          )}
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

        {/* Detection light (no live outline) */}
        {cameraState === "active" && (
          <DetectionLight
            className="absolute top-16 right-4 z-20"
            score={
              !detectedQuad || isBlurry ? 0
                : Math.min(1, detectedQuad.confidence * (isStable ? 1 : 0.75) * (tooFar || tooSkewed ? 0.6 : 1))
            }
          />
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

      <div className="absolute bottom-32 left-0 right-0 z-10 flex justify-center gap-2">
        <Button variant="secondary" onClick={() => photoInputRef.current?.click()} disabled={isCapturing}>
          <Camera className="h-4 w-4 mr-2" />Photo haute résolution
        </Button>
        <Button onClick={() => {
          if (isBlurry) { toast({ title: "Image trop floue", description: "Stabilisez votre appareil", variant: "destructive" }); return; }
          performCapture(undefined, true);
        }} disabled={cameraState !== "active" || isCapturing}>
          {isCapturing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ScanLine className="h-4 w-4 mr-2" />}
          Scan net
        </Button>
      </div>

      {/* Footer controls */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-8 pb-10 pt-6 bg-gradient-to-t from-black/80 to-transparent">
        {/* Undo last page */}
        <button
          className="flex flex-col items-center gap-1 text-white/70 disabled:opacity-30"
          onClick={handleUndo}
          disabled={capturedPages.length === 0}
        >
          <Undo2 className="h-7 w-7" />
        </button>

        {/* Capture button */}
        <button
          className={`relative h-[72px] w-[72px] rounded-full transition-all ${
            isCapturing ? "scale-90" : ""
          } ${isBlurry ? "opacity-50" : ""}`}
          onClick={handleManualCapture}
          disabled={cameraState !== "active" || isCapturing}
        >
          <span className={`absolute inset-0 rounded-full border-[4px] transition-colors ${
            isStable && !isBlurry ? "border-teal-400" : isBlurry ? "border-red-400" : "border-white/60"
          }`} />
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
      <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileImport} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png"
        onChange={handleFileImport}
        className="hidden"
      />
    </div>
  );
}
