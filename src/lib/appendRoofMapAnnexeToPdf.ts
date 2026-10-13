import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { renderRoofMapImage } from "@/lib/roofMapImage";
import type { EtudeData } from "@/lib/exportEtudePdf";
import { fetchLatestAiVisuals } from "@/lib/roofAiVisuals";

/**
 * Ajoute la carte satellite de la toiture en ANNEXE, en toute dernière page du PDF
 * (après le rapport et les photos). Ne modifie pas le PDF d'origine si le point
 * toiture est absent ou si le rendu de la carte échoue.
 */
export async function appendRoofMapAnnexeToPdf(
  reportBlob: Blob,
  data: EtudeData,
  etudeId?: string | null
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

    const manualCount = data.roofMapViewport?.panelLayout?.panels.length ?? 0;
    const visuals = !manualCount && etudeId ? await fetchLatestAiVisuals(etudeId).catch(() => null) : null;
    const hasVisuals = !!(visuals?.satellite || visuals?.photo);
    const iw = W - 80;
    const ih = Math.min(hasVisuals ? 300 : 600, iw * (data.roofMapViewport ? data.roofMapViewport.height / data.roofMapViewport.width : 224 / 360));
    const imageWidth = ih * (data.roofMapViewport ? data.roofMapViewport.width / data.roofMapViewport.height : 360 / 224);
    page.drawImage(image, { x: (W - imageWidth) / 2, y: 841.89 - 88 - ih, width: imageWidth, height: ih });

    page.drawText(`GPS : ${data.roofLatitude.toFixed(6)}, ${data.roofLongitude.toFixed(6)}`, {
      x: 40,
      y: 841.89 - 88 - ih - 20,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    if (manualCount) page.drawText(`Plan manuel : ${manualCount} panneaux de 1130 x 2095 mm.`, {
      x: 40, y: 841.89 - 88 - ih - 38, size: 9, font, color: rgb(0.3, 0.3, 0.3),
    });

    if (hasVisuals && visuals) {
      let y = 841.89 - 88 - ih - 48;
      page.drawText("VISUALISATION IA DE L'INSTALLATION", { x: 40, y, size: 11, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
      const items = [
        { url: visuals.satellite, label: "Vue satellite" },
        { url: visuals.photo, label: "Photo d'étude" },
      ].filter((i): i is { url: string; label: string } => !!i.url);
      const gap = 12;
      const cellW = (W - 80 - gap * (items.length - 1)) / items.length;
      const maxH = y - 60;
      let x = 40;
      for (const item of items) {
        try {
          const buf = await fetch(item.url).then((r) => r.arrayBuffer());
          const head = new Uint8Array(buf.slice(0, 4));
          const emb = head[0] === 0x89 ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
          const scale = Math.min(cellW / emb.width, maxH / emb.height);
          const w = emb.width * scale, h = emb.height * scale;
          page.drawImage(emb, { x: x + (cellW - w) / 2, y: y - 14 - h, width: w, height: h });
          page.drawText(item.label, { x, y: y - 14 - h - 12, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
        } catch (e) {
          console.warn("[appendRoofMapAnnexeToPdf] visuel IA ignoré:", e);
        }
        x += cellW + gap;
      }
      page.drawText(
        `Simulation indicative${visuals.nbPanneaux ? ` — ${visuals.nbPanneaux} panneaux` : ""} de 1130 x 2095 mm.`,
        { x: 40, y: 34, size: 8, font, color: rgb(0.4, 0.4, 0.4) }
      );
    }

    const bytes = await pdf.save({ useObjectStreams: true });
    return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
  } catch (err) {
    console.warn("[appendRoofMapAnnexeToPdf] Ajout de l'annexe carte impossible:", err);
    return reportBlob;
  }
}
