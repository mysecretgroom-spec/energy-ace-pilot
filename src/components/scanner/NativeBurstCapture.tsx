import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Camera, Check, Images, Trash2, X } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  onDone: (images: string[]) => void;
  onCancel: () => void;
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

/**
 * Rafale avec l'appareil photo natif : une photo à la fois (limite iOS),
 * on revient ici entre chaque prise, puis « Terminé » ouvre la revue des rognages.
 */
export function NativeBurstCapture({ onDone, onCancel }: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<string[]>([]);

  const addFiles = async (files: FileList | null, input: HTMLInputElement | null) => {
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|jpe?g|png)$/i.test(f.name));
    if (input) input.value = "";
    if (list.length === 0) return;
    try {
      const urls = await Promise.all(list.map(readAsDataUrl));
      setPhotos((p) => [...p, ...urls]);
    } catch {
      toast({ title: "Photo illisible", description: "Réessayez la prise de vue", variant: "destructive" });
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Annuler le scan"><X className="h-5 w-5" /></Button>
        <p className="font-semibold">{photos.length === 0 ? "Scanner des pages" : `${photos.length} page${photos.length > 1 ? "s" : ""}`}</p>
        <span className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {photos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
            <Camera className="h-12 w-12" />
            <p className="max-w-xs text-sm">Prenez chaque page en photo avec l'appareil du téléphone. Appuyez sur « Terminé » quand toutes les pages sont prises.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {photos.map((src, i) => (
              <div key={i} className="relative aspect-[3/4] overflow-hidden rounded-md border border-border bg-muted">
                <img src={src} alt={`Page ${i + 1}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-background/85 px-1.5 text-xs font-medium">{i + 1}</span>
                <button
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  aria-label={`Retirer la page ${i + 1}`}
                  className="absolute top-1 right-1 rounded-full bg-background/85 p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12" onClick={() => cameraRef.current?.click()}>
            <Camera className="h-5 w-5 mr-2" />{photos.length === 0 ? "Prendre" : "Page suivante"}
          </Button>
          <Button variant="outline" className="h-12" onClick={() => galleryRef.current?.click()}>
            <Images className="h-5 w-5 mr-2" />Galerie
          </Button>
        </div>
        <Button className="h-12" disabled={photos.length === 0} onClick={() => onDone(photos)}>
          <Check className="h-5 w-5 mr-2" />Terminé{photos.length ? ` (${photos.length})` : ""}
        </Button>
      </div>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => addFiles(e.target.files, e.target)} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden"
        onChange={(e) => addFiles(e.target.files, e.target)} />
    </div>,
    document.body,
  );
}
