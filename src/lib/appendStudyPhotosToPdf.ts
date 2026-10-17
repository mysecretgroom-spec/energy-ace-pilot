import { PDFDocument } from "pdf-lib";
import { mergeStudyPhotosIntoPdf } from "@/components/scanner/QuickPhotoButton";
import { appendStudyScansToPdf } from "./appendStudyScansToPdf";

/**
 * Ajoute les photos puis les documents scannés de cette étude au même rapport.
 */
export async function appendStudyPhotosToPdf(
  reportBlob: Blob,
  userId?: string | null,
  clientId?: string | null,
  etudeId?: string | null
): Promise<Blob> {
  if (!userId || !clientId || !etudeId) return reportBlob;

  let withPhotos = reportBlob;

  try {
    const photosBlob = await mergeStudyPhotosIntoPdf(userId, clientId, etudeId);
    if (photosBlob) {
    const [reportBytes, photosBytes] = await Promise.all([
      reportBlob.arrayBuffer(),
      photosBlob.arrayBuffer(),
    ]);

    const merged = await PDFDocument.load(reportBytes);
    const photosDoc = await PDFDocument.load(photosBytes);
    const pages = await merged.copyPages(photosDoc, photosDoc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));

    const bytes = await merged.save({ useObjectStreams: true });
    withPhotos = new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
    }
  } catch (err) {
    console.warn("[appendStudyPhotosToPdf] Fusion des photos impossible:", err);
  }
  return appendStudyScansToPdf(withPhotos, userId, clientId, etudeId);
}
