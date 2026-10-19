/** Deterministic satellite layout: exactly `count` panels centred on the designated roof point. */
export function satellitePanelGrid(count: number, panel: { w: number; h: number }, target: { x: number; y: number }) {
  const n = Math.max(0, Math.floor(count));
  if (!n) return [];
  const cols = Math.min(n, Math.max(1, Math.round(Math.sqrt((n * panel.h) / panel.w))));
  const rows = Math.ceil(n / cols);
  const gap = Math.max(1, Math.round(panel.w * 0.08));
  const totalH = rows * panel.h + (rows - 1) * gap;
  const rects: { x: number; y: number; w: number; h: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(cols, n - r * cols);
    const rowW = inRow * panel.w + (inRow - 1) * gap;
    for (let c = 0; c < inRow; c++) {
      rects.push({
        x: target.x - rowW / 2 + c * (panel.w + gap),
        y: target.y - totalH / 2 + r * (panel.h + gap),
        w: panel.w,
        h: panel.h,
      });
    }
  }
  return rects;
}

export async function renderSatellitePanels(
  source: string,
  target: { x: number; y: number },
  panel: { w: number; h: number },
  count: number,
): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("Carte illisible.")); img.src = source; });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const center = { x: target.x * canvas.width, y: target.y * canvas.height };
  for (const r of satellitePanelGrid(count, panel, center)) {
    ctx.fillStyle = "#0b1a33";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "#c7d2e0";
    ctx.lineWidth = Math.max(1, r.w * 0.06);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  }
  return canvas.toDataURL("image/png");
}
