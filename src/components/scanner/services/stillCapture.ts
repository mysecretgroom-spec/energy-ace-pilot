/**
 * Full-resolution still capture.
 *
 * Uses the ImageCapture API (`takePhoto`) to grab a real photo from the camera
 * sensor instead of a downscaled video frame. Falls back to the video frame
 * when the API is unavailable or fails.
 */

export interface StillCaptureResult {
  dataUrl: string;
  width: number;
  height: number;
  /** "photo" = full sensor still, "video" = downscaled preview frame */
  source: "photo" | "video";
  /** true when the still framing matches the preview framing (safe to auto-crop) */
  matchesPreviewFraming: boolean;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image decode failed"));
    img.src = src;
  });
}

function frameFromVideo(video: HTMLVideoElement, canvas: HTMLCanvasElement): StillCaptureResult {
  const ctx = canvas.getContext("2d");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.95),
    width: canvas.width,
    height: canvas.height,
    source: "video",
    matchesPreviewFraming: true,
  };
}

/**
 * Capture the sharpest, largest image the device can produce.
 */
export async function captureStill(
  track: MediaStreamTrack | null,
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): Promise<StillCaptureResult> {
  const ImageCaptureCtor = (window as any).ImageCapture;
  if (!track || typeof ImageCaptureCtor !== "function") {
    return frameFromVideo(video, canvas);
  }

  try {
    const imageCapture = new ImageCaptureCtor(track);

    // Ask for the largest still the sensor supports.
    let photoSettings: Record<string, number> | undefined;
    try {
      const caps = await imageCapture.getPhotoCapabilities();
      const maxW = caps?.imageWidth?.max;
      const maxH = caps?.imageHeight?.max;
      if (typeof maxW === "number" && typeof maxH === "number") {
        photoSettings = { imageWidth: maxW, imageHeight: maxH };
      }
    } catch {
      /* capabilities unavailable — take the default still */
    }

    const blob: Blob = await imageCapture.takePhoto(photoSettings);
    if (!blob || blob.size === 0) return frameFromVideo(video, canvas);

    const dataUrl = await blobToDataUrl(blob);
    const img = await loadImage(dataUrl);

    // A still smaller than the preview is useless — keep the video frame.
    if (img.naturalWidth < video.videoWidth) {
      return frameFromVideo(video, canvas);
    }

    const previewAspect = video.videoWidth / Math.max(1, video.videoHeight);
    const photoAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const matchesPreviewFraming =
      Math.abs(previewAspect - photoAspect) / previewAspect < 0.04;

    return {
      dataUrl,
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: "photo",
      matchesPreviewFraming,
    };
  } catch {
    return frameFromVideo(video, canvas);
  }
}

/** Best-effort continuous autofocus / auto-exposure for document scanning. */
export async function applyDocumentFocus(track: MediaStreamTrack | null): Promise<void> {
  if (!track) return;
  const caps = (track.getCapabilities?.() ?? {}) as any;
  const advanced: Record<string, unknown>[] = [];
  if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) {
    advanced.push({ focusMode: "continuous" });
  }
  if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) {
    advanced.push({ exposureMode: "continuous" });
  }
  if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes("continuous")) {
    advanced.push({ whiteBalanceMode: "continuous" });
  }
  if (!advanced.length) return;
  try {
    await track.applyConstraints({ advanced } as MediaTrackConstraints);
  } catch {
    /* device refused — keep defaults */
  }
}
