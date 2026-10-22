import { PDFDocument } from "pdf-lib";

/** Margin around annex content, in PDF points (about 5 mm). */
export const ANNEX_MARGIN_PT = 14;

/**
 * Fit a source page box into the target page as large as possible
 * (aspect ratio kept, centered) inside the margin.
 */
export function fitIntoPage(
  src: { width: number; height: number },
  target: { width: number; height: number },
  margin = ANNEX_MARGIN_PT,
) {
  const availW = Math.max(1, target.width - margin * 2);
  const availH = Math.max(1, target.height - margin * 2);
  const scale = Math.min(availW / src.width, availH / src.height);
  const width = src.width * scale;
  const height = src.height * scale;
  return { x: (target.width - width) / 2, y: (target.height - height) / 2, width, height, scale };
}

/**
 * Append every page of `source` to `target` at the target's first-page size,
 * so all pages of the shared study PDF have one uniform format. The original
 * content is embedded unchanged (vector/raster kept), only scaled to fit.
 */
export async function appendPagesUniform(target: PDFDocument, source: PDFDocument): Promise<void> {
  const ref = target.getPageCount() > 0 ? target.getPage(0).getSize() : { width: 595.28, height: 841.89 };
  const pages = source.getPages();
  if (!pages.length) return;
  // A page with no content stream cannot be embedded by pdf-lib: give empty
  // pages an invisible mark so they are shared instead of breaking the export.
  pages.forEach((p) => {
    if (!p.node.Contents()) p.drawRectangle({ x: 0, y: 0, width: 0.5, height: 0.5, opacity: 0 });
  });
  const embedded = await target.embedPages(pages);
  embedded.forEach((ep) => {
    const page = target.addPage([ref.width, ref.height]);
    const box = fitIntoPage({ width: ep.width, height: ep.height }, ref);
    page.drawPage(ep, { x: box.x, y: box.y, width: box.width, height: box.height });
  });
}
