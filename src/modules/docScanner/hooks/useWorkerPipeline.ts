import { useRef, useState, useCallback, useEffect } from "react";
import type { Quad, WorkerResult } from "../types";

/** Number of frames to keep the last good quad visible when detection fails */
const PERSIST_FRAMES = 12;
/** Number of stable frames needed before declaring stable */
const STABLE_THRESHOLD = 4;
/** Max variance (px²) across recent quads to be considered stable */
const STABILITY_VARIANCE = 10;

interface WorkerPipelineResult {
  detectedQuad: Quad | null;
  isStable: boolean;
  confidence: number;
  isProcessing: boolean;
  detectFromCanvas: (canvas: HTMLCanvasElement) => void;
  warpImage: (canvas: HTMLCanvasElement, quad: Quad, maxDim?: number) => Promise<{ pixels: Uint8ClampedArray; width: number; height: number }>;
  applyFilter: (canvas: HTMLCanvasElement, preset: string) => Promise<{ pixels: Uint8ClampedArray; width: number; height: number }>;
}

function quadVariance(history: Quad[]): number {
  if (history.length < 2) return Infinity;
  const corners = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;
  let maxVar = 0;
  for (const c of corners) {
    const xs = history.map((q) => q[c].x);
    const ys = history.map((q) => q[c].y);
    const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    const variance = (arr: number[]) => {
      const m = mean(arr);
      return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
    };
    maxVar = Math.max(maxVar, variance(xs), variance(ys));
  }
  return maxVar;
}

export function useWorkerPipeline(): WorkerPipelineResult {
  const workerRef = useRef<Worker | null>(null);
  const [displayQuad, setDisplayQuad] = useState<Quad | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stable, setStable] = useState(false);

  const quadHistory = useRef<Quad[]>([]);
  const missCounter = useRef(0);
  const lastGoodQuad = useRef<Quad | null>(null);
  const lastGoodConfidence = useRef(0);
  const pendingCallbacks = useRef<Map<string, (result: any) => void>>(new Map());

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/scanWorker.ts", import.meta.url),
      { type: "module" }
    );

    worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      const msg = e.data;

      if (msg.type === "detect") {
        setIsProcessing(false);

        if (msg.quad && msg.confidence > 0.25) {
          // Good detection — reset miss counter, update history
          missCounter.current = 0;
          lastGoodQuad.current = msg.quad;
          lastGoodConfidence.current = msg.confidence;

          quadHistory.current.push(msg.quad);
          if (quadHistory.current.length > 8) quadHistory.current.shift();

          // Smooth: average last 3 quads for display
          const recent = quadHistory.current.slice(-3);
          const smoothed = smoothQuads(recent);
          setDisplayQuad(smoothed);
          setConfidence(msg.confidence);

          // Stability check
          if (quadHistory.current.length >= STABLE_THRESHOLD) {
            const v = quadVariance(quadHistory.current.slice(-STABLE_THRESHOLD));
            setStable(v < STABILITY_VARIANCE);
          }
        } else {
          // Detection failed — persist the last good quad for PERSIST_FRAMES
          missCounter.current++;
          if (missCounter.current < PERSIST_FRAMES && lastGoodQuad.current) {
            // Keep showing last good quad with decaying confidence
            const decay = 1 - missCounter.current / PERSIST_FRAMES;
            setConfidence(lastGoodConfidence.current * decay);
            // Don't change displayQuad — keep showing last good
          } else {
            // Too many misses — clear
            setDisplayQuad(null);
            setConfidence(0);
            setStable(false);
            quadHistory.current = [];
            lastGoodQuad.current = null;
          }
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
    detectedQuad: displayQuad,
    isStable: stable,
    confidence,
    isProcessing,
    detectFromCanvas,
    warpImage,
    applyFilter: applyFilterFn,
  };
}

/** Average multiple quads into one smoothed quad */
function smoothQuads(quads: Quad[]): Quad {
  if (quads.length === 1) return quads[0];
  const corners = ["topLeft", "topRight", "bottomRight", "bottomLeft"] as const;
  const result: any = {};
  for (const c of corners) {
    result[c] = {
      x: quads.reduce((s, q) => s + q[c].x, 0) / quads.length,
      y: quads.reduce((s, q) => s + q[c].y, 0) / quads.length,
    };
  }
  return result as Quad;
}
