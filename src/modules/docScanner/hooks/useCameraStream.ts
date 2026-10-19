import { useRef, useState, useCallback, useEffect } from "react";
import { applyDocumentFocus } from "@/components/scanner/services/stillCapture";

interface CameraStreamResult {
  videoRef: React.RefObject<HTMLVideoElement>;
  isReady: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  captureFrame: (maxDim?: number) => HTMLCanvasElement | null;
}

export function useCameraStream(): CameraStreamResult {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    requestRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    const request = ++requestRef.current;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 4096 },
          height: { ideal: 2160 },
        },
        audio: false,
      });
      if (request !== requestRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      await applyDocumentFocus(stream.getVideoTracks()[0] ?? null);
      if (request !== requestRef.current) return;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (request !== requestRef.current) return;
        setIsReady(true);
      }
    } catch (err: any) {
      if (request !== requestRef.current) return;
      const message =
        err.name === "NotAllowedError"
          ? "Accès caméra refusé. Utilisez l'import fichier."
          : err.name === "NotFoundError"
          ? "Aucune caméra trouvée."
          : "Erreur caméra: " + (err.message || err.name);
      setError(message);
    }
  }, []);

  const captureFrame = useCallback((maxDim?: number): HTMLCanvasElement | null => {
    const video = videoRef.current;
    if (!video || !isReady || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return null;

    const canvas = document.createElement("canvas");
    // Analysis frames are drawn directly at low resolution: copying a full
    // 4K frame several times per second made the live scanner sluggish.
    const s = maxDim ? Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight)) : 1;
    canvas.width = Math.round(video.videoWidth * s);
    canvas.height = Math.round(video.videoHeight * s);
    const ctx = canvas.getContext("2d", { willReadFrequently: !!maxDim });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  }, [isReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return { videoRef: videoRef as React.RefObject<HTMLVideoElement>, isReady, error, startCamera, stopCamera, captureFrame };
}
