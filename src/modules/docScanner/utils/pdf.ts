/**
 * PDF multi-page generation using jsPDF.
 */
import jsPDF from "jspdf";
import type { ScanPage, ExportSettings } from "../types";
import { QUALITY_MAP } from "../types";
import { loadImageToCanvas, canvasToBlob, releaseCanvas } from "./image";

// A4 dimensions in mm
const A4_W = 210;
const A4_H = 297;
const MM_TO_PT = 72 / 25.4;

export async function generateMultiPagePdf(
  pages: ScanPage[],
  settings: ExportSettings
): Promise<Blob> {
  const quality = QUALITY_MAP[settings.quality];
  const isA4 = settings.pdfMode === "a4";
  const margin = settings.margins;

  let doc: jsPDF | null = null;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const src = page.warpedPreviewUrl || page.normalizedBlobUrl || page.originalBlobUrl;
    const canvas = await loadImageToCanvas(src);

    // Get JPEG data URL
    const dataUrl = canvas.toDataURL("image/jpeg", quality);

    const imgW = canvas.width;
    const imgH = canvas.height;

    if (isA4) {
      // Determine orientation
      const landscape = imgW > imgH;
      const pageW = landscape ? A4_H : A4_W;
      const pageH = landscape ? A4_W : A4_H;

      if (i === 0) {
        doc = new jsPDF({
          orientation: landscape ? "landscape" : "portrait",
          unit: "mm",
          format: "a4",
        });
      } else {
        doc!.addPage([pageW, pageH], landscape ? "landscape" : "portrait");
      }

      // Contain image within A4 with margins
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const scale = Math.min(availW / imgW, availH / imgH);
      const w = imgW * scale;
      const h = imgH * scale;
      const x = margin + (availW - w) / 2;
      const y = margin + (availH - h) / 2;

      doc!.addImage(dataUrl, "JPEG", x, y, w, h);
    } else {
      // Original size mode: page size matches image ratio
      // Convert pixels to mm (assuming 96 DPI)
      const pxToMm = 25.4 / 96;
      const pageW = imgW * pxToMm;
      const pageH = imgH * pxToMm;

      if (i === 0) {
        doc = new jsPDF({
          orientation: pageW > pageH ? "landscape" : "portrait",
          unit: "mm",
          format: [pageW, pageH],
        });
      } else {
        doc!.addPage([pageW, pageH], pageW > pageH ? "landscape" : "portrait");
      }

      doc!.addImage(dataUrl, "JPEG", margin, margin, pageW - margin * 2, pageH - margin * 2);
    }

    releaseCanvas(canvas);
  }

  if (!doc) throw new Error("No pages to export");

  return doc.output("blob");
}
