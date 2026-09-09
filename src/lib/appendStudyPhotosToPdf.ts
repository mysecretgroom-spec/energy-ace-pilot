import { PDFDocument } from "pdf-lib";
import { mergeStudyPhotosIntoPdf } from "@/components/scanner/QuickPhotoButton";

/**
 * Ajoute les photos d'étude à la fin du PDF du rapport, dans un seul document.
 * Si aucune photo n'existe (ou en cas d'erreur), le PDF d'origine est renvoyé tel quel.
 */
export async function appendStudyPhotosToPdf(
  reportBlob: Blob,
  userId?: string | null,
  clientId?: string | null,
  etudeId?: string | null
): Promise<Blob> {
  if (!userId || !clientId || !etudeId) return reportBlob;

  try {
    const photosBlob = await mergeStudyPhotosIntoPdf(userId, clientId, etudeId);
    if (!photosBlob) return reportBlob;

    const [reportBytes, photosBytes] = await Promise.all([
      reportBlob.arrayBuffer(),
      photosBlob.arrayBuffer(),
    ]);

    const merged = await PDFDocument.load(reportBytes);
    const photosDoc = await PDFDocument.load(photosBytes);
    const pages = await merged.copyPages(photosDoc, photosDoc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));

    const bytes = await merged.save({ useObjectStreams: true });
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  } catch (err) {
    console.warn("[appendStudyPhotosToPdf] Fusion des photos impossible:", err);
    return reportBlob;
  }
}
