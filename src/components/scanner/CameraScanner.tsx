import React, { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, RotateCcw, AlertCircle, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface CameraScannerProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  pageCount: number;
}

type CameraState = "requesting" | "active" | "error" | "denied";

export function CameraScanner({ onCapture, onCancel, pageCount }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraState, setCameraState] = useState<CameraState>("requesting");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

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
        setCameraState("active");
      }
    } catch (error: unknown) {
      console.error("Camera error:", error);
      const err = error as { name?: string };
      if (err.name === "NotAllowedError") {
        setCameraState("denied");
      } else {
        setCameraState("error");
      }
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = canvas.toDataURL("image/jpeg", 0.92);
    onCapture(imageData);
  }, [onCapture]);

  const handleSwitchCamera = useCallback(() => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  }, []);

  useEffect(() => {
    if (cameraState === "active") {
      startCamera();
    }
  }, [facingMode]);

  const handleFileImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onCapture(result);
      }
    };
    reader.onerror = () => {
      toast({
        title: "Erreur",
        description: "Impossible de lire le fichier",
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [onCapture]);

  const handleClose = useCallback(() => {
    stopCamera();
    onCancel();
  }, [stopCamera, onCancel]);

  // Error/denied states
  if (cameraState === "denied") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Accès caméra refusé</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-sm">
          Pour scanner des documents, autorisez l'accès à la caméra dans les paramètres de votre navigateur.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Importer un fichier
          </Button>
        </div>
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

  if (cameraState === "error") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center p-6">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Caméra non disponible</h2>
        <p className="text-muted-foreground text-center mb-6 max-w-sm">
          Aucune caméra n'a été détectée sur cet appareil. Vous pouvez importer un fichier à la place.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Importer un fichier
          </Button>
        </div>
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

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={handleClose}
        >
          <X className="h-6 w-6" />
        </Button>
        <span className="text-white font-medium">
          {pageCount > 0 ? `Page ${pageCount + 1}` : "Scanner"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={handleSwitchCamera}
        >
          <RotateCcw className="h-5 w-5" />
        </Button>
      </div>

      {/* Video feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Document guide overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-8 sm:inset-16 border-2 border-white/60 rounded-lg">
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-lg" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-lg" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-lg" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-lg" />
          </div>
        </div>

        {/* Loading state */}
        {cameraState === "requesting" && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-4" />
              <p>Activation de la caméra...</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with capture button */}
      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center p-6 pb-24 bg-gradient-to-t from-black/60 to-transparent">
        <Button
          size="lg"
          className="h-16 w-16 rounded-full bg-white hover:bg-white/90 text-black shadow-lg"
          onClick={handleCapture}
          disabled={cameraState !== "active"}
        >
          <Camera className="h-8 w-8" />
        </Button>
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
