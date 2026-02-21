import { useRef, useState, useCallback, useEffect } from "react";
import type { Quad, WorkerResult } from "../types";
import { isStable as checkStable } from "../utils/metrics";

interface WorkerPipelineResult {
  detectedQuad: Quad | null;
  isStable: boolean;
  confidence: number;
  isProcessing: boolean;
  detectFromCanvas: (canvas: HTMLCanvasElement) => void;
  warpImage: (canvas: HTMLCanvasElement, quad: Quad, maxDim?: number) => Promise<{ pixels: Uint8ClampedArray; width: number; height: number }>;
  applyFilter: (canvas: HTMLCanvasElement, preset: string) => Promise<{ pixels: Uint8ClampedArray; width: number; height: number }>;
}

export function useWorkerPipeline(): WorkerPipelineResult {
  const workerRef = useRef<Worker | null>(null);
  const [detectedQuad, setDetectedQuad] = useState<Quad | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const quadHistory = useRef<Quad[]>([]);
  const [stable, setStable] = useState(false);
  const pendingCallbacks = useRef<Map<string, (result: any) => void>>(new Map());
  const callIdRef = useRef(0);

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/scanWorker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      const msg = e.data;

      if (msg.type === "detect") {
        setDetectedQuad(msg.quad);
        setConfidence(msg.confidence);
        setIsProcessing(false);

        if (msg.quad) {
          quadHistory.current.push(msg.quad);
          if (quadHistory.current.length > 8) quadHistory.current.shift();
          setStable(checkStable(quadHistory.current));
        } else {
          setStable(false);
        }
      }

      // Handle promise-based responses
      if (msg.type === "warp" || msg.type === "filter") {
        const cb = pendingCallbacks.current.get(msg.type);
        if (cb) {
          cb(msg);
          pendingCallbacks.current.delete(msg.type);
        }
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const detectFromCanvas = useCallback((canvas: HTMLCanvasElement) => {
    if (!workerRef.current || isProcessing) return;
    setIsProcessing(true);

    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    workerRef.current.postMessage(
      { type: "detect", imageData: imageData.data, width: canvas.width, height: canvas.height },
      [imageData.data.buffer] as any
    );
  }, [isProcessing]);

  const warpImage = useCallback((canvas: HTMLCanvasElement, quad: Quad, maxDim = 2048): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> => {
    return new Promise((resolve) => {
      if (!workerRef.current) return resolve({ pixels: new Uint8ClampedArray(0), width: 0, height: 0 });

      pendingCallbacks.current.set("warp", (msg: any) => {
        resolve({ pixels: msg.imageData, width: msg.width, height: msg.height });
      });

      const ctx = canvas.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      workerRef.current.postMessage(
        { type: "warp", imageData: imageData.data, width: canvas.width, height: canvas.height, quad, maxDim },
        [imageData.data.buffer] as any
      );
    });
  }, []);

  const applyFilterFn = useCallback((canvas: HTMLCanvasElement, preset: string): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> => {
    return new Promise((resolve) => {
      if (!workerRef.current) return resolve({ pixels: new Uint8ClampedArray(0), width: 0, height: 0 });

      pendingCallbacks.current.set("filter", (msg: any) => {
        resolve({ pixels: msg.imageData, width: msg.width, height: msg.height });
      });

      const ctx = canvas.getContext("2d")!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      workerRef.current.postMessage(
        { type: "filter", imageData: imageData.data, width: canvas.width, height: canvas.height, preset },
        [imageData.data.buffer] as any
      );
    });
  }, []);

  return {
    detectedQuad,
    isStable: stable,
    confidence,
    isProcessing,
    detectFromCanvas,
    warpImage,
    applyFilter: applyFilterFn,
  };
}
