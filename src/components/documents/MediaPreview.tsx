import { useCallback, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, FileText, Loader2, RotateCcw, Share2, X, ZoomIn, ZoomOut } from "lucide-react";
import { deliverFile } from "@/lib/fileDelivery";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { previewKind, resolvePreviewUrl, type PreviewMedia } from "./previewMedia";

function MediaPage({ item, active, zoom }: { item: PreviewMedia; active: boolean; zoom: number }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [retry, setRetry] = useState(0);
  const [page, setPage] = useState(item.initial_page ?? 1);
  const [count, setCount] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const kind = previewKind(item);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setError(false); setLoaded(false); setSrc("");
    resolvePreviewUrl(item.url).then((url) => { if (!cancelled) setSrc(url); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [active, item.url, retry]);

  useEffect(() => {
    if (!active || !src || kind !== "pdf") return;
    let cancelled = false;
    let dispose = () => {};
    (async () => {
      try {
        const { pdfjsLib } = await import("@/lib/pdfWorker");
        if (cancelled) return;
        const task = pdfjsLib.getDocument(src);
        dispose = () => { void task.destroy(); };
        const pdf = await task.promise;
        if (cancelled) return;
        setCount(pdf.numPages);
        const pdfPage = await pdf.getPage(Math.min(page, pdf.numPages));
        const canvas = canvasRef.current;
        const area = containerRef.current;
        if (!canvas || !area || cancelled) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const fit = Math.min((area.clientWidth - 24) / base.width, (area.clientHeight - 24) / base.height);
        const viewport = pdfPage.getViewport({ scale: Math.max(0.1, fit) * Math.min(devicePixelRatio || 1, 2) * zoom });
        canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        const render = pdfPage.render({ canvasContext: context, viewport });
        dispose = () => { render.cancel(); void task.destroy(); };
        await render.promise;
        if (!cancelled) setLoaded(true);
      } catch { if (!cancelled) { setError(true); setLoaded(false); } }
    })();
    return () => { cancelled = true; dispose(); };
  }, [active, src, kind, page, zoom]);

  if (!active) return null;
  return <div className="h-full min-h-0 flex flex-col">
    <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto flex">
      {!loaded && !error && kind !== "unknown" && <div className="absolute inset-0 grid place-items-center pointer-events-none"><Loader2 aria-label="Chargement de l’aperçu" className="h-6 w-6 animate-spin" /></div>}
      {error || kind === "unknown" ? <div className="m-auto flex flex-col items-center gap-4 px-6 text-center">
        <FileText className="h-10 w-10 opacity-50" /><p className="text-sm">{error ? "Impossible d’afficher cet élément" : "Aperçu indisponible"}</p>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => setRetry((n) => n + 1)}><RotateCcw className="h-4 w-4" />Réessayer</Button><Button variant="ghost" onClick={async () => { try { window.open(await resolvePreviewUrl(item.url), "_blank", "noopener,noreferrer"); } catch { toast.error("Document indisponible"); } }}><ExternalLink className="h-4 w-4" />Ouvrir</Button></div>
      </div> : kind === "pdf" ? <canvas ref={canvasRef} className={`m-auto object-contain ${zoom === 1 ? "max-w-[calc(100%-1.5rem)] max-h-[calc(100%-1.5rem)]" : "max-w-none"}`} /> : src ? <img src={src} alt={item.nom} draggable={false} onLoad={() => setLoaded(true)} onError={() => setError(true)} className={`m-auto object-contain ${zoom === 1 ? "max-w-full max-h-full" : "max-w-none"}`} style={zoom > 1 ? { width: `${zoom * 100}%`, flexShrink: 0 } : undefined} /> : null}
    </div>
    {kind === "pdf" && count > 1 && <div className="flex items-center justify-center gap-4 py-2 shrink-0 text-sm">
      <Button variant="ghost" size="icon" aria-label="Page précédente" disabled={page <= 1} onClick={() => { setLoaded(false); setPage((n) => n - 1); }}><ChevronLeft className="h-5 w-5" /></Button>
      <span className="min-w-24 text-center tabular-nums">Page {page} / {count}</span>
      <Button variant="ghost" size="icon" aria-label="Page suivante" disabled={page >= count} onClick={() => { setLoaded(false); setPage((n) => n + 1); }}><ChevronRight className="h-5 w-5" /></Button>
    </div>}
  </div>;
}

export function MediaPreview({ isOpen, onClose, items, initialIndex = 0, action }: {
  isOpen: boolean; onClose: () => void; items: PreviewMedia[]; initialIndex?: number;
  action?: { label: string; icon: React.ReactNode; onClick: (item: PreviewMedia) => void };
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [busy, setBusy] = useState(false);
  const [prepared, setPrepared] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const [emblaRef, api] = useEmblaCarousel({ startIndex: index, watchDrag: zoom === 1, loop: false });
  const item = items[index];
  useEffect(() => {
    if (!api) return;
    const select = () => { setIndex(api.selectedScrollSnap()); setZoom(1); };
    // Zoom changes drag options and slide dimensions. Restore the selected
    // position after Embla measures them instead of leaving it off-screen.
    const realign = () => { api.scrollTo(api.selectedScrollSnap(), true); };
    api.on("select", select);
    api.on("reInit", realign);
    return () => { api.off("select", select); api.off("reInit", realign); };
  }, [api]);
  useEffect(() => { if (isOpen) { setIndex(Math.max(0, Math.min(initialIndex, items.length - 1))); setZoom(1); api?.scrollTo(initialIndex, true); } }, [isOpen, initialIndex, api, items.length]);
  useEffect(() => {
    if (!isOpen) return;
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") api?.scrollNext(); if (e.key === "ArrowLeft") api?.scrollPrev(); };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [isOpen, api]);

  useEffect(() => {
    setPrepared(null);
    if (!isOpen || !item) return;
    const controller = new AbortController();
    const prepare = async () => {
      try {
        const response = await fetch(await resolvePreviewUrl(item.url), { signal: controller.signal });
        if (!response.ok) throw new Error("File unavailable");
        const raw = await response.blob();
        const blob = item.mime_type && raw.type !== item.mime_type ? new Blob([raw], { type: item.mime_type }) : raw;
        const extension = previewKind(item) === "pdf" ? "pdf" : blob.type.includes("png") ? "png" : "jpg";
        const name = /\.[a-z0-9]{2,5}$/i.test(item.nom) ? item.nom : `${item.nom}.${extension}`;
        if (!controller.signal.aborted) setPrepared({ url: item.url, blob, name });
      } catch { /* Preview recovery remains available; never enable an empty export. */ }
    };
    void prepare();
    return () => controller.abort();
  }, [isOpen, item?.url, item?.nom, item?.mime_type]);

  const exportItem = useCallback(async (share: boolean) => {
    if (!item || busy || prepared?.url !== item.url) return;
    setBusy(true);
    try { await deliverFile(prepared.blob, prepared.name, share); }
    catch { toast.error("Impossible d’enregistrer ce fichier"); }
    finally { setBusy(false); }
  }, [item, busy, prepared]);

  if (!item) return null;
  return <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
    <Dialog.Portal><Dialog.Overlay className="media-viewer fixed inset-0 z-[150]" />
      <Dialog.Content aria-describedby={undefined} className="media-viewer fixed inset-0 z-[151] flex min-h-0 flex-col overflow-hidden outline-none">
        <header className="flex shrink-0 items-center gap-2 px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] border-b border-border">
          <Button variant="ghost" size="icon" aria-label="Fermer l’aperçu" title="Fermer" onClick={onClose}><X className="h-5 w-5" /></Button>
          <div className="min-w-0 flex-1 text-center"><Dialog.Title className="truncate text-sm font-medium">{item.nom}</Dialog.Title><p className="text-xs text-muted-foreground tabular-nums">{index + 1} / {items.length}</p></div>
          <Button variant="ghost" size="icon" disabled={busy || prepared?.url !== item.url} aria-label="Partager" title="Partager" onClick={() => exportItem(true)}><Share2 className="h-5 w-5" /></Button>
        </header>
        <div className="relative flex-1 min-h-0">
          <div ref={emblaRef} className="h-full overflow-hidden"><div className="flex h-full touch-pan-y">{items.map((entry, i) => <div key={entry.id} className="min-w-0 h-full flex-[0_0_100%]"><MediaPage item={entry} active={i === index} zoom={zoom} /></div>)}</div></div>
          {items.length > 1 && <><Button variant="ghost" size="icon" className="absolute left-3 top-1/2 hidden md:flex" disabled={index === 0} aria-label="Élément précédent" onClick={() => api?.scrollPrev()}><ChevronLeft /></Button><Button variant="ghost" size="icon" className="absolute right-3 top-1/2 hidden md:flex" disabled={index === items.length - 1} aria-label="Élément suivant" onClick={() => api?.scrollNext()}><ChevronRight /></Button></>}
        </div>
        <footer className="shrink-0 border-t border-border pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {items.length > 1 && <div className="flex justify-start gap-2 overflow-x-auto px-4 pt-3 pb-1 md:justify-center">{items.map((entry, i) => <Button variant="ghost" key={entry.id} aria-label={`Afficher ${entry.nom}`} aria-current={i === index ? "true" : undefined} onClick={() => api?.scrollTo(i)} className={`h-12 w-10 p-0 shrink-0 overflow-hidden rounded border ${index === i ? "border-foreground" : "border-border opacity-50"}`}>{entry.thumbnails_urls?.[0] || previewKind(entry) === "image" ? <img src={entry.thumbnails_urls?.[0] || entry.url} alt="" className="h-full w-full object-cover" /> : <FileText className="h-5 w-5" />}</Button>)}</div>}
          <div className="flex items-center justify-center gap-4 px-3 py-2">
            <Button variant="ghost" size="icon" title="Réduire" aria-label="Réduire" disabled={zoom <= 1} onClick={() => setZoom((n) => Math.max(1, n - 0.5))}><ZoomOut className="h-5 w-5" /></Button>
            <span className="text-xs tabular-nums min-w-10 text-center">{Math.round(zoom * 100)} %</span>
            <Button variant="ghost" size="icon" title="Agrandir" aria-label="Agrandir" disabled={zoom >= 3} onClick={() => setZoom((n) => Math.min(3, n + 0.5))}><ZoomIn className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" title="Télécharger" aria-label="Télécharger" disabled={busy || prepared?.url !== item.url} onClick={() => exportItem(false)}><Download className="h-5 w-5" /></Button>
            {action && <Button variant="ghost" size="icon" title={action.label} aria-label={action.label} onClick={() => action.onClick(item)}>{action.icon}</Button>}
          </div>
        </footer>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}