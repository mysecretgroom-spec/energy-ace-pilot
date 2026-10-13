import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { renderRoofMapImage } from "@/lib/roofMapImage";
import type { EtudeData } from "@/lib/exportEtudePdf";

/**
 * Ajoute la carte satellite de la toiture en ANNEXE, en toute dernière page du PDF
 * (après le rapport et les photos). Ne modifie pas le PDF d'origine si le point
 * toiture est absent ou si le rendu de la carte échoue.
 */
export async function appendRoofMapAnnexeToPdf(
  reportBlob: Blob,
  data: EtudeData
): Promise<Blob> {
  if (data.roofLatitude == null || data.roofLongitude == null) return reportBlob;

  try {
    const img = await renderRoofMapImage(data.roofLatitude, data.roofLongitude, { viewport: data.roofMapViewport });
    if (!img) return reportBlob;

    const [reportBytes, imgBytes] = await Promise.all([
      reportBlob.arrayBuffer(),
      fetch(img).then((r) => r.arrayBuffer()),
    ]);

    const pdf = await PDFDocument.load(reportBytes);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const image = await pdf.embedJpg(imgBytes);

    const page = pdf.addPage([595.28, 841.89]);
    const W = 595.28;

    page.drawText("ANNEXE — LOCALISATION DE LA TOITURE", {
      x: 40,
      y: 841.89 - 60,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });

    const address = [data.clientAdresse, data.clientCodePostal, data.clientVille]
      .filter(Boolean)
      .join(", ");
    page.drawText(address, {
      x: 40,
      y: 841.89 - 78,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    const iw = W - 80;
    const ih = Math.min(600, iw * (data.roofMapViewport ? data.roofMapViewport.height / data.roofMapViewport.width : 224 / 360));
    const imageWidth = ih * (data.roofMapViewport ? data.roofMapViewport.width / data.roofMapViewport.height : 360 / 224);
    page.drawImage(image, { x: (W - imageWidth) / 2, y: 841.89 - 88 - ih, width: imageWidth, height: ih });

    page.drawText(`GPS : ${data.roofLatitude.toFixed(6)}, ${data.roofLongitude.toFixed(6)}`, {
      x: 40,
      y: 841.89 - 88 - ih - 20,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    const bytes = await pdf.save({ useObjectStreams: true });
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  } catch (err) {
    console.warn("[appendRoofMapAnnexeToPdf] Ajout de l'annexe carte impossible:", err);
    return reportBlob;
  }
}
