import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Trash2,
  RefreshCw,
  Crop,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  Camera,
  Upload,
  Plus,
} from "lucide-react";
import { getGroupedCategories, type DocumentType } from "@/lib/documentCategories";
import useEmblaCarousel from "embla-carousel-react";

export interface ImportedDoc {
  id: string;
  file: File;
  preview: string;
  documentType?: DocumentType | null;
  description?: string;
  rotation: number;
}

interface ImportPreviewCarouselProps {
  documents: ImportedDoc[];
  onDocumentsChange: (docs: ImportedDoc[]) => void;
  onDelete: (id: string) => void;
  onReplace: (id: string) => void;
  onCrop: (id: string) => void;
  onAddMore: () => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
}

export function ImportPreviewCarousel({
  documents,
  onDocumentsChange,
  onDelete,
  onReplace,
  onCrop,
  onAddMore,
  onSave,
  onClose,
  isSaving,
}: ImportPreviewCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [currentIndex, setCurrentIndex] = useState(0);
  const groupedCategories = getGroupedCategories();

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  // Re-init when documents change
  useEffect(() => {
    if (emblaApi) {
      emblaApi.reInit();
      // Clamp index
      if (currentIndex >= documents.length && documents.length > 0) {
        emblaApi.scrollTo(documents.length - 1);
      }
    }
  }, [emblaApi, documents.length]);

  const currentDoc = documents[currentIndex];

  const handleRotate = useCallback((id: string) => {
    onDocumentsChange(
      documents.map((d) =>
        d.id === id ? { ...d, rotation: (d.rotation + 90) % 360 } : d
      )
    );
  }, [documents, onDocumentsChange]);

  const handleTypeChange = useCallback((id: string, type: string) => {
    onDocumentsChange(
      documents.map((d) =>
        d.id === id ? { ...d, documentType: type as DocumentType } : d
      )
    );
  }, [documents, onDocumentsChange]);

  const handleDeleteCurrent = useCallback(() => {
    if (!currentDoc) return;
    onDelete(currentDoc.id);
  }, [currentDoc, onDelete]);

  const allTyped = documents.every((d) => !!d.documentType);

  if (documents.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-muted-foreground">Aucun document</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={onAddMore}>
            <Plus className="h-4 w-4 mr-2" />
            Ajouter des fichiers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b bg-background z-10">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <span className="font-medium text-sm">
            {currentIndex + 1} / {documents.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onAddMore}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Carousel */}
      <div className="flex-1 min-h-0 relative">
        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center p-4 bg-muted/30"
              >
                <div className="relative max-w-full max-h-full">
                  {doc.preview && doc.preview !== "/placeholder.svg" ? (
                    <img
                      src={doc.preview}
                      alt={doc.description || doc.file.name}
                      className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-lg"
                      style={{ transform: `rotate(${doc.rotation}deg)` }}
                      draggable={false}
                    />
                  ) : (
                    <div className="w-64 h-80 bg-muted rounded-lg flex items-center justify-center">
                      <div className="text-center text-muted-foreground">
                        <Upload className="h-10 w-10 mx-auto mb-2" />
                        <p className="text-sm font-medium">{doc.file.name}</p>
                        <p className="text-xs">PDF</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nav arrows (desktop) */}
        {documents.length > 1 && (
          <>
            {currentIndex > 0 && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-80 hidden sm:flex"
                onClick={() => emblaApi?.scrollPrev()}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {currentIndex < documents.length - 1 && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full opacity-80 hidden sm:flex"
                onClick={() => emblaApi?.scrollNext()}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
          </>
        )}

        {/* Dots indicator */}
        {documents.length > 1 && documents.length <= 10 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {documents.map((_, i) => (
              <button
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === currentIndex
                    ? "w-6 bg-primary"
                    : "w-2 bg-muted-foreground/30"
                }`}
                onClick={() => emblaApi?.scrollTo(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom panel - Actions + Type selector */}
      {currentDoc && (
        <div className="border-t bg-background p-3 pb-24 space-y-3">
          {/* File name */}
          <p className="text-sm font-medium truncate text-center text-muted-foreground">
            {currentDoc.file.name}
          </p>

          {/* Action buttons */}
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onCrop(currentDoc.id)}
            >
              <Crop className="h-4 w-4" />
              Recadrer
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => handleRotate(currentDoc.id)}
            >
              <RotateCw className="h-4 w-4" />
              Rotation
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onReplace(currentDoc.id)}
            >
              <Camera className="h-4 w-4" />
              Remplacer
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10"
              onClick={handleDeleteCurrent}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Type selector */}
          <div className="flex items-center gap-2">
            <Select
              value={currentDoc.documentType || ""}
              onValueChange={(v) => handleTypeChange(currentDoc.id, v)}
            >
              <SelectTrigger className="flex-1 h-9">
                <SelectValue placeholder="Type de document *" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {Array.from(groupedCategories.entries()).map(([group, cats]) => (
                  <div key={group}>
                    <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                      {group}
                    </div>
                    {cats.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {currentDoc.documentType && (
              <Badge variant="secondary" className="flex-shrink-0">✓</Badge>
            )}
          </div>

          {/* Save button */}
          <Button
            className="w-full"
            onClick={onSave}
            disabled={isSaving || !allTyped}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Enregistrer {documents.length > 1 ? `(${documents.length})` : ""}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
