import { useRef, useCallback, useState, useEffect } from "react";

interface Point {
  x: number;
  y: number;
}

export interface DetectedQuad {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  confidence: number;
}

interface UseRealtimeEdgeDetectionProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  enabled: boolean;
  onStableDetection?: (quad: DetectedQuad) => void;
}

/**
 * Lightweight real-time edge detection without OpenCV
 * Uses canvas-based Sobel edge detection for fast performance
 */
export function useRealtimeEdgeDetection({
  videoRef,
  enabled,
  onStableDetection,
}: UseRealtimeEdgeDetectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const stableCountRef = useRef(0);
  const lastQuadRef = useRef<DetectedQuad | null>(null);
  
  const [detectedQuad, setDetectedQuad] = useState<DetectedQuad | null>(null);
  const [isStable, setIsStable] = useState(false);

  // Create offscreen canvas for processing
  useEffect(() => {
    canvasRef.current = document.createElement("canvas");
    return () => {
      canvasRef.current = null;
    };
  }, []);

  /**
   * Fast grayscale conversion
   */
  const toGrayscale = useCallback((imageData: ImageData): Uint8ClampedArray => {
    const gray = new Uint8ClampedArray(imageData.width * imageData.height);
    const data = imageData.data;
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      // Luminance formula
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    return gray;
  }, []);

  /**
   * Apply Sobel edge detection (fast approximation)
   */
  const sobelEdges = useCallback((
    gray: Uint8ClampedArray,
    width: number,
    height: number
  ): Uint8ClampedArray => {
    const edges = new Uint8ClampedArray(width * height);
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        
        // Sobel kernels (simplified)
        const gx = 
          -gray[idx - width - 1] + gray[idx - width + 1] +
          -2 * gray[idx - 1] + 2 * gray[idx + 1] +
          -gray[idx + width - 1] + gray[idx + width + 1];
        
        const gy = 
          -gray[idx - width - 1] - 2 * gray[idx - width] - gray[idx - width + 1] +
          gray[idx + width - 1] + 2 * gray[idx + width] + gray[idx + width + 1];
        
        edges[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      }
    }
    
    return edges;
  }, []);

  /**
   * Find lines using simplified Hough-like detection
   */
  const findDominantLines = useCallback((
    edges: Uint8ClampedArray,
    width: number,
    height: number,
    threshold: number = 100
  ): { horizontal: number[]; vertical: number[] } => {
    const horizontalHist = new Float32Array(height);
    const verticalHist = new Float32Array(width);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = edges[y * width + x];
        if (val > threshold) {
          horizontalHist[y] += val;
          verticalHist[x] += val;
        }
      }
    }
    
    // Find peaks
    const findPeaks = (hist: Float32Array, minDist: number): number[] => {
      const peaks: number[] = [];
      const avg = hist.reduce((a, b) => a + b, 0) / hist.length;
      const peakThreshold = avg * 2;
      
      for (let i = minDist; i < hist.length - minDist; i++) {
        if (hist[i] > peakThreshold &&
            hist[i] > hist[i - 1] && hist[i] > hist[i + 1]) {
          // Check distance from existing peaks
          const tooClose = peaks.some(p => Math.abs(p - i) < minDist);
          if (!tooClose) {
            peaks.push(i);
          }
        }
      }
      
      return peaks.sort((a, b) => hist[b] - hist[a]).slice(0, 4);
    };
    
    return {
      horizontal: findPeaks(horizontalHist, height * 0.1),
      vertical: findPeaks(verticalHist, width * 0.1),
    };
  }, []);

  /**
   * Detect document quadrilateral
   */
  const detectQuad = useCallback((
    edges: Uint8ClampedArray,
    width: number,
    height: number
  ): DetectedQuad | null => {
    const lines = findDominantLines(edges, width, height);
    
    // Need at least 2 horizontal and 2 vertical lines
    if (lines.horizontal.length < 2 || lines.vertical.length < 2) {
      return null;
    }
    
    // Sort lines
    const hLines = lines.horizontal.sort((a, b) => a - b);
    const vLines = lines.vertical.sort((a, b) => a - b);
    
    // Get outer lines
    const topY = hLines[0];
    const bottomY = hLines[hLines.length - 1];
    const leftX = vLines[0];
    const rightX = vLines[vLines.length - 1];
    
    // Validate dimensions
    const quadWidth = rightX - leftX;
    const quadHeight = bottomY - topY;
    
    if (quadWidth < width * 0.2 || quadHeight < height * 0.2) {
      return null;
    }
    
    // Calculate confidence based on detected area
    const detectedArea = quadWidth * quadHeight;
    const imageArea = width * height;
    const areaRatio = detectedArea / imageArea;
    
    // Confidence: higher when document fills 30-80% of frame
    let confidence = 0;
    if (areaRatio >= 0.15 && areaRatio <= 0.85) {
      confidence = Math.min(1, areaRatio * 1.5);
      
      // Boost confidence for well-centered documents
      const centerX = (leftX + rightX) / 2;
      const centerY = (topY + bottomY) / 2;
      const centerDist = Math.sqrt(
        Math.pow((centerX - width / 2) / width, 2) +
        Math.pow((centerY - height / 2) / height, 2)
      );
      confidence *= (1 - centerDist * 0.5);
    }
    
    if (confidence < 0.3) {
      return null;
    }
    
    return {
      topLeft: { x: leftX, y: topY },
      topRight: { x: rightX, y: topY },
      bottomRight: { x: rightX, y: bottomY },
      bottomLeft: { x: leftX, y: bottomY },
      confidence,
    };
  }, [findDominantLines]);

  /**
   * Compare two quads for stability
   */
  const quadsAreSimilar = useCallback((
    q1: DetectedQuad | null,
    q2: DetectedQuad | null,
    tolerance: number = 20
  ): boolean => {
    if (!q1 || !q2) return false;
    
    const dist = (p1: Point, p2: Point) => 
      Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    
    return (
      dist(q1.topLeft, q2.topLeft) < tolerance &&
      dist(q1.topRight, q2.topRight) < tolerance &&
      dist(q1.bottomRight, q2.bottomRight) < tolerance &&
      dist(q1.bottomLeft, q2.bottomLeft) < tolerance
    );
  }, []);

  /**
   * Process single frame
   */
  const processFrame = useCallback(() => {
    if (!enabled || !videoRef.current || !canvasRef.current) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    // Use smaller resolution for faster processing
    const scale = 0.25;
    const w = Math.floor(video.videoWidth * scale);
    const h = Math.floor(video.videoHeight * scale);
    
    if (w === 0 || h === 0) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    canvas.width = w;
    canvas.height = h;
    
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      animationRef.current = requestAnimationFrame(processFrame);
      return;
    }
    
    // Draw scaled video frame
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    
    // Process
    const gray = toGrayscale(imageData);
    const edges = sobelEdges(gray, w, h);
    const quad = detectQuad(edges, w, h);
    
    if (quad) {
      // Scale coordinates back to video size
      const scaledQuad: DetectedQuad = {
        topLeft: { x: quad.topLeft.x / scale, y: quad.topLeft.y / scale },
        topRight: { x: quad.topRight.x / scale, y: quad.topRight.y / scale },
        bottomRight: { x: quad.bottomRight.x / scale, y: quad.bottomRight.y / scale },
        bottomLeft: { x: quad.bottomLeft.x / scale, y: quad.bottomLeft.y / scale },
        confidence: quad.confidence,
      };
      
      setDetectedQuad(scaledQuad);
      
      // Check stability
      if (quadsAreSimilar(scaledQuad, lastQuadRef.current)) {
        stableCountRef.current++;
        if (stableCountRef.current >= 8 && !isStable) { // ~250ms of stability at 30fps
          setIsStable(true);
          onStableDetection?.(scaledQuad);
        }
      } else {
        stableCountRef.current = 0;
        setIsStable(false);
      }
      
      lastQuadRef.current = scaledQuad;
    } else {
      setDetectedQuad(null);
      stableCountRef.current = 0;
      setIsStable(false);
      lastQuadRef.current = null;
    }
    
    animationRef.current = requestAnimationFrame(processFrame);
  }, [
    enabled,
    videoRef,
    toGrayscale,
    sobelEdges,
    detectQuad,
    quadsAreSimilar,
    isStable,
    onStableDetection,
  ]);

  // Start/stop processing
  useEffect(() => {
    if (enabled) {
      animationRef.current = requestAnimationFrame(processFrame);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [enabled, processFrame]);

  const reset = useCallback(() => {
    stableCountRef.current = 0;
    lastQuadRef.current = null;
    setDetectedQuad(null);
    setIsStable(false);
  }, []);

  return {
    detectedQuad,
    isStable,
    reset,
  };
}
