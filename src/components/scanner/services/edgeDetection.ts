/**
 * Edge detection service with OpenCV.js lazy loading
 */

interface Point {
  x: number;
  y: number;
}

interface DetectedEdges {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
  confidence: number;
}

let cvLoaded = false;
let cvLoadPromise: Promise<any> | null = null;

/**
 * Lazy load OpenCV.js
 */
async function loadOpenCV(): Promise<any> {
  if (cvLoaded && (window as any).cv) {
    return (window as any).cv;
  }

  if (cvLoadPromise) {
    return cvLoadPromise;
  }

  cvLoadPromise = new Promise((resolve, reject) => {
    // Check if already loaded
    if ((window as any).cv && (window as any).cv.Mat) {
      cvLoaded = true;
      resolve((window as any).cv);
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://docs.opencv.org/4.8.0/opencv.js';
    script.async = true;

    script.onload = () => {
      // Wait for OpenCV to be ready
      const checkReady = () => {
        if ((window as any).cv && (window as any).cv.Mat) {
          cvLoaded = true;
          resolve((window as any).cv);
        } else if ((window as any).cv) {
          (window as any).cv.onRuntimeInitialized = () => {
            cvLoaded = true;
            resolve((window as any).cv);
          };
        } else {
          setTimeout(checkReady, 100);
        }
      };
      checkReady();
    };

    script.onerror = () => {
      cvLoadPromise = null;
      reject(new Error('Failed to load OpenCV.js'));
    };

    document.head.appendChild(script);
  });

  return cvLoadPromise;
}

/**
 * Check if OpenCV is available
 */
export function isOpenCVAvailable(): boolean {
  return cvLoaded && !!(window as any).cv?.Mat;
}

/**
 * Preload OpenCV (call early to reduce wait time)
 */
export function preloadOpenCV(): void {
  loadOpenCV().catch(console.error);
}

/**
 * Detect document edges in an image using OpenCV
 */
export async function detectDocumentEdges(
  imageData: string
): Promise<DetectedEdges | null> {
  try {
    const cv = await loadOpenCV();
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Create canvas to get image data
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);

          // Read image into OpenCV matrix
          const src = cv.imread(canvas);
          const dst = new cv.Mat();
          const gray = new cv.Mat();
          const edges = new cv.Mat();

          // Convert to grayscale
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

          // Apply Gaussian blur
          cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

          // Edge detection
          cv.Canny(gray, edges, 50, 150);

          // Dilate to connect edges
          const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
          cv.dilate(edges, edges, kernel);

          // Find contours
          const contours = new cv.MatVector();
          const hierarchy = new cv.Mat();
          cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

          // Find the largest quadrilateral
          let maxArea = 0;
          let bestContour: any = null;

          for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);

            if (area < (img.width * img.height * 0.1)) {
              continue; // Skip small contours
            }

            // Approximate contour
            const peri = cv.arcLength(contour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, 0.02 * peri, true);

            // Look for 4-sided polygons
            if (approx.rows === 4 && area > maxArea) {
              maxArea = area;
              bestContour = approx;
            } else {
              approx.delete();
            }
          }

          let result: DetectedEdges | null = null;

          if (bestContour && maxArea > (img.width * img.height * 0.15)) {
            // Extract corner points
            const points: Point[] = [];
            for (let i = 0; i < 4; i++) {
              points.push({
                x: bestContour.data32S[i * 2],
                y: bestContour.data32S[i * 2 + 1],
              });
            }

            // Sort points to get consistent order (top-left, top-right, bottom-right, bottom-left)
            const sortedPoints = sortCornerPoints(points);

            result = {
              ...sortedPoints,
              confidence: Math.min(maxArea / (img.width * img.height), 1),
            };

            bestContour.delete();
          }

          // Cleanup
          src.delete();
          dst.delete();
          gray.delete();
          edges.delete();
          kernel.delete();
          contours.delete();
          hierarchy.delete();

          resolve(result);
        } catch (error) {
          console.error('OpenCV processing error:', error);
          resolve(null);
        }
      };

      img.onerror = () => resolve(null);
      img.src = imageData;
    });
  } catch (error) {
    console.error('Failed to load OpenCV:', error);
    return null;
  }
}

/**
 * Sort corner points into consistent order
 */
function sortCornerPoints(points: Point[]): Omit<DetectedEdges, 'confidence'> {
  // Sort by y coordinate (top vs bottom)
  const sortedByY = [...points].sort((a, b) => a.y - b.y);
  const topPoints = sortedByY.slice(0, 2);
  const bottomPoints = sortedByY.slice(2);

  // Sort top points by x (left to right)
  topPoints.sort((a, b) => a.x - b.x);
  // Sort bottom points by x (left to right)
  bottomPoints.sort((a, b) => a.x - b.x);

  return {
    topLeft: topPoints[0],
    topRight: topPoints[1],
    bottomRight: bottomPoints[1],
    bottomLeft: bottomPoints[0],
  };
}

/**
 * Apply perspective correction using OpenCV
 */
export async function applyPerspectiveCorrection(
  imageData: string,
  corners: Omit<DetectedEdges, 'confidence'>
): Promise<string> {
  try {
    const cv = await loadOpenCV();

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Cannot get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0);

          const src = cv.imread(canvas);

          // Calculate output dimensions
          const widthTop = Math.sqrt(
            Math.pow(corners.topRight.x - corners.topLeft.x, 2) +
            Math.pow(corners.topRight.y - corners.topLeft.y, 2)
          );
          const widthBottom = Math.sqrt(
            Math.pow(corners.bottomRight.x - corners.bottomLeft.x, 2) +
            Math.pow(corners.bottomRight.y - corners.bottomLeft.y, 2)
          );
          const heightLeft = Math.sqrt(
            Math.pow(corners.bottomLeft.x - corners.topLeft.x, 2) +
            Math.pow(corners.bottomLeft.y - corners.topLeft.y, 2)
          );
          const heightRight = Math.sqrt(
            Math.pow(corners.bottomRight.x - corners.topRight.x, 2) +
            Math.pow(corners.bottomRight.y - corners.topRight.y, 2)
          );

          const outputWidth = Math.max(widthTop, widthBottom);
          const outputHeight = Math.max(heightLeft, heightRight);

          // Source points
          const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
            corners.topLeft.x, corners.topLeft.y,
            corners.topRight.x, corners.topRight.y,
            corners.bottomRight.x, corners.bottomRight.y,
            corners.bottomLeft.x, corners.bottomLeft.y,
          ]);

          // Destination points
          const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0,
            outputWidth, 0,
            outputWidth, outputHeight,
            0, outputHeight,
          ]);

          // Get perspective transform matrix
          const transformMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints);

          // Apply transform
          const dst = new cv.Mat();
          const dsize = new cv.Size(outputWidth, outputHeight);
          cv.warpPerspective(src, dst, transformMatrix, dsize);

          // Output to canvas
          const outputCanvas = document.createElement('canvas');
          cv.imshow(outputCanvas, dst);

          // Cleanup
          src.delete();
          dst.delete();
          srcPoints.delete();
          dstPoints.delete();
          transformMatrix.delete();

          resolve(outputCanvas.toDataURL('image/jpeg', 0.92));
        } catch (error) {
          console.error('Perspective correction error:', error);
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = imageData;
    });
  } catch (error) {
    console.error('Failed to apply perspective correction:', error);
    throw error;
  }
}
