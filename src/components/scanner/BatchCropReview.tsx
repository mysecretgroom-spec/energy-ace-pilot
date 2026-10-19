import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Check, Crop, Loader2, Trash2, Undo2, X } from "lucide-react";
import { CropEditor } from "./CropEditor";
import { autoCropPage } from "./services/scanPipeline";
import type { ScanCorners } from "./services/scanQuality";
import type { ScanPage } from "./types";

interface Item {
  id: string;
  original: string;
  originalThumb?: string;
  status: "pending" | "ready";
  corners: ScanCorners | null;
  cropped?: string;
  croppedThumb?: string;
  /** User chose to keep the raw photo. */
  noCrop: boolean;
}

interface Props {
  images: string[];
  onDone: (pages: ScanPage[]) => void;
  onCancel: () => void;
}

/** Review every pre-cropped photo of a burst in a swipeable carousel, then validate all at once. */
export function BatchCropReview({ images, onDone, onCancel }: Props) {
  const [items, setItems] = useState<Item[]>(() =>
    images.map((original) => ({ id: crypto.randomUUID(), original, status: "pending", corners: null, noCrop: false })),
  );
  const [index, setIndex] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Pre-crop every photo sequentially (bounded memory on iPhone).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const item of items) {
        if (cancelled) return;
        if (item.status === "ready") continue;
        try {
          const r = await autoCropPage(item.original);
          if (cancelled) return;
          setItems((prev) => prev.map((it) => it.id === item.id ? {
            ...it, status: "ready", corners: r.corners,
            cropped: r.corners ? r.image : undefined, croppedThumb: r.corners ? r.thumbnail : undefined,
            originalThumb: r.corners ? it.originalThumb : r.thumbnail,
            noCrop: !r.corners,
          } : it));
        } catch {
          setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, status: "ready", noCrop: true } : it));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }, []);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((it) => it.id !== id);
      if (next.length === 0) onCancel();
      setIndex((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const toggleNoCrop = (id: string) =>
    setItems((prev) => prev.map((it) => it.id === id && it.cropped ? { ...it, noCrop: !it.noCrop } : it));

  const allReady = items.every((it) => it.status === "ready");
  const readyCount = items.filter((it) => it.status === "ready").length;

  const validateAll = () => {
    onDone(items.map((it) => {
      const useCrop = !it.noCrop && !!it.cropped;
      return {
        id: it.id,
        imageData: useCrop ? it.cropped! : it.original,
        thumbnailData: (useCrop ? it.croppedThumb : it.originalThumb) ?? it.croppedThumb ?? it.original,
        rotation: 0,
        cropped: useCrop,
      };
    }));
  };

  const editing = items.find((it) => it.id === editingId);
  if (editing) {
    return (
      <CropEditor
        key={editing.id}
        imageData={editing.original}
        initialCorners={editing.corners ?? undefined}
        progressLabel={`Photo ${items.indexOf(editing) + 1} / ${items.length}`}
        onCancel={() => setEditingId(null)}
        onSkipCrop={(_, thumb) => {
          setItems((prev) => prev.map((it) => it.id === editing.id ? { ...it, noCrop: true, originalThumb: thumb } : it));
          setEditingId(null);
        }}
        onComplete={(cropped, thumbnail) => {
          setItems((prev) => prev.map((it) => it.id === editing.id
            ? { ...it, cropped, croppedThumb: thumbnail, noCrop: false, status: "ready" } : it));
          setEditingId(null);
        }}
      />
    );
  }

  const current = items[index];

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Annuler le scan"><X className="h-5 w-5" /></Button>
        <div className="text-center">
          <p className="font-semibold">Vérifier les pages</p>
          <p className="text-xs text-muted-foreground">
            {allReady ? `Page ${index + 1} / ${items.length}` : `Rognage auto… ${readyCount} / ${items.length}`}
          </p>
        </div>
        <span className="w-10" />
      </header>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex-1 flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((it, i) => {
          const src = !it.noCrop && it.cropped ? it.cropped : it.original;
          return (
            <div key={it.id} className="snap-center shrink-0 w-full h-full flex items-center justify-center p-4 relative">
              {it.status === "pending" ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Détection des bords…</span>
                </div>
              ) : (
                <img src={src} alt={`Page ${i + 1}`} className="max-h-full max-w-full object-contain rounded-md shadow-lg bg-muted" />
              )}
              {it.status === "ready" && (
                <span className="absolute top-6 left-6 rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium border border-border">
                  {it.noCrop ? (it.cropped ? "Sans rognage" : "Bords non trouvés") : "Rogné auto"}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Thumbnails strip */}
      <div className="flex gap-2 overflow-x-auto px-4 py-2 border-t border-border">
        {items.map((it, i) => (
          <button
            key={it.id}
            onClick={() => goTo(i)}
            aria-label={`Aller à la page ${i + 1}`}
            className={`relative h-16 w-12 shrink-0 overflow-hidden rounded border-2 ${i === index ? "border-primary" : "border-transparent"} bg-muted`}
          >
            {it.status === "ready"
              ? <img src={(!it.noCrop && it.croppedThumb) || it.originalThumb || it.original} alt="" className="h-full w-full object-cover" />
              : <Loader2 className="m-auto mt-5 h-4 w-4 animate-spin text-muted-foreground" />}
            <span className="absolute bottom-0 right-0 bg-background/80 px-1 text-[10px]">{i + 1}</span>
          </button>
        ))}
      </div>

      {current && (
        <div className="grid grid-cols-3 gap-2 px-4 pt-2">
          <Button variant="outline" size="sm" disabled={current.status !== "ready"} onClick={() => setEditingId(current.id)}>
            <Crop className="h-4 w-4 mr-1" /> Ajuster
          </Button>
          <Button variant="outline" size="sm" disabled={current.status !== "ready" || !current.cropped} onClick={() => toggleNoCrop(current.id)}>
            <Undo2 className="h-4 w-4 mr-1" /> {current.noCrop ? "Rogner" : "Sans rognage"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => remove(current.id)}>
            <Trash2 className="h-4 w-4 mr-1" /> Retirer
          </Button>
        </div>
      )}

      <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button className="w-full h-12" disabled={!allReady || items.length === 0} onClick={validateAll}>
          {allReady ? <><Check className="h-5 w-5 mr-2" /> Tout valider ({items.length})</> : <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Préparation…</>}
        </Button>
      </div>
    </div>,
    document.body,
  );
}
