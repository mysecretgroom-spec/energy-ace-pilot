import { PDFDocument } from "pdf-lib";
import imageCompression from "browser-image-compression";
import type { ScanPage } from "../types";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 1,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/jpeg" as const,
};

// Convert Uint8Array to base64 string (safe for large files)
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB chunks
  const chunks: string[] = [];
  
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode(...chunk));
  }
  
  return btoa(chunks.join(""));
}

async function compressImage(dataUrl: string): Promise<Uint8Array> {
  // Convert data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();

  // Compress the image
  const compressedBlob = await imageCompression(blob as File, COMPRESSION_OPTIONS);

  // Convert back to array buffer
  const arrayBuffer = await compressedBlob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function generateThumbnail(dataUrl: string, maxWidth = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = dataUrl;
  });
}

export async function generatePdfFromPages(
  pages: ScanPage[]
): Promise<{ blob: Blob; thumbnails: string[] }> {
  const pdfDoc = await PDFDocument.create();
  const thumbnails: string[] = [];

  for (const page of pages) {
    // Compress the image
    const compressedImageData = await compressImage(page.imageData);

    // Embed the image in the PDF
    const image = await pdfDoc.embedJpg(compressedImageData);

    // Calculate dimensions (accounting for rotation)
    let width = image.width;
    let height = image.height;

    if (page.rotation === 90 || page.rotation === 270) {
      [width, height] = [height, width];
    }

    // Add a page with the image dimensions
    const pdfPage = pdfDoc.addPage([width, height]);

    // Draw the image (simplified - no rotation handling at PDF level, already applied in crop)
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });

    // Generate thumbnail
    const thumbnail = await generateThumbnail(page.thumbnailData || page.imageData);
    thumbnails.push(thumbnail);
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });

  return { blob, thumbnails };
}

export async function generatePdfFromFile(
  file: File
): Promise<{ blob: Blob; thumbnails: string[] }> {
  const thumbnails: string[] = [];

  if (file.type === "application/pdf") {
    // For PDF files, return as-is and try to generate thumbnail
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });

    // Try to generate thumbnail from first page using pdfjs with timeout
    try {
      const pdfjsLib = await import("pdfjs-dist");
      
      // Use unpkg as fallback CDN which is more reliable
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      // Add timeout for PDF loading (10 seconds max)
      const loadPromise = pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error("PDF load timeout")), 10000)
      );

      const pdf = await Promise.race([loadPromise, timeoutPromise]);
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.5 });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvasContext: ctx, viewport }).promise;
        thumbnails.push(canvas.toDataURL("image/jpeg", 0.7));
      }
    } catch (err) {
      // If thumbnail generation fails, generate a simple placeholder image
      console.warn("Could not generate PDF thumbnail:", err);
      // Create a simple placeholder thumbnail with text
      const canvas = document.createElement("canvas");
      canvas.width = 200;
      canvas.height = 260;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(0, 0, 200, 260);
        ctx.fillStyle = "#64748b";
        ctx.font = "bold 14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PDF", 100, 130);
        ctx.font = "10px sans-serif";
        ctx.fillText(file.name.slice(0, 20), 100, 150);
        thumbnails.push(canvas.toDataURL("image/jpeg", 0.8));
      }
    }

    return { blob, thumbnails };
  }

  // For image files, convert to PDF
  const pdfDoc = await PDFDocument.create();

  // Read the image
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Compress the image first - use safe base64 encoding for large files
  const dataUrl = `data:${file.type};base64,${uint8ArrayToBase64(uint8Array)}`;
  const compressedData = await compressImage(dataUrl);

  // Embed based on type
  let image;
  if (file.type === "image/png") {
    // For PNG, embed directly (pdf-lib handles it)
    image = await pdfDoc.embedPng(uint8Array);
  } else {
    // For JPEG, use the compressed version
    image = await pdfDoc.embedJpg(compressedData);
  }

  // Add page with image dimensions
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  // Generate thumbnail
  const thumbDataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = e.target?.result as string;
      const thumb = await generateThumbnail(result);
      resolve(thumb);
    };
    reader.readAsDataURL(file);
  });
  thumbnails.push(thumbDataUrl);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });

  return { blob, thumbnails };
}
