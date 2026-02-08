import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
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
  RotateCcw,
  Crop,
  ChevronLeft,
  ChevronRight,
  Save,
  Loader2,
  Camera,
  Plus,
  Upload,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import { getGroupedCategories, type DocumentType } from "@/lib/documentCategories";
import { enhanceImage, enhanceForDocument, convertToBlackAndWhite } from "./services/imageEnhancement";
import useEmblaCarousel from "embla-carousel-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export interface ImportedDoc {
  id: string;
  file: File;
  preview: string; // original or auto-cropped
  processedPreview?: string; // after filter applied
  documentType?: DocumentType | null;
  description?: string;
  rotation: number;
  activeFilter: string;
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

// Filter presets inspired by CamScanner
const FILTERS = [
  { id: "original", label: "Original", icon: "📄" },
  { id: "enhanced", label: "Amélioré", icon: "✨" },
  { id: "no_shadow", label: "Sans Ombre", icon: "☀️" },
  { id: "bw", label: "N&B", icon: "⬛" },
  { id: "sharp", label: "Net", icon: "🔍" },
] as const;

type FilterId = typeof FILTERS[number]["id"];

async function applyFilter(imageData: string, filterId: FilterId): Promise<string> {
  if (filterId === "original") return imageData;
  if (filterId === "enhanced") return enhanceForDocument(imageData);
  if (filterId === "no_shadow") return enhanceImage(imageData, { autoContrast: true, brightness: 115, contrast: 130 });
  if (filterId === "bw") return convertToBlackAndWhite(imageData);
  if (filterId === "sharp") return enhanceImage(imageData, { contrast: 110, sharpen: true });
  return imageData;
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
  const [isApplyingFilter, setIsApplyingFilter] = useState(false);
  const [applyToAll, setApplyToAll] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const groupedCategories = getGroupedCategories();

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  useEffect(() => {
    if (emblaApi) {
      emblaApi.reInit();
      if (currentIndex >= documents.length && documents.length > 0) {
        emblaApi.scrollTo(documents.length - 1);
      }
    }
  }, [emblaApi, documents.length]);

  const currentDoc = documents[currentIndex];
  const isImage = currentDoc?.preview && currentDoc.preview !== "/placeholder.svg";
  const allTyped = documents.every((d) => !!d.documentType);
  const typedCount = documents.filter((d) => !!d.documentType).length;

  const handleFilterSelect = useCallback(async (filterId: FilterId) => {
    if (!currentDoc || !isImage) return;
    setIsApplyingFilter(true);

    try {
      if (applyToAll) {
        const updated = await Promise.all(
          documents.map(async (d) => {
            if (d.preview === "/placeholder.svg") return { ...d, activeFilter: filterId };
            const processed = await applyFilter(d.preview, filterId);
            return { ...d, activeFilter: filterId, processedPreview: filterId === "original" ? undefined : processed };
          })
        );
        onDocumentsChange(updated);
      } else {
        const processed = await applyFilter(currentDoc.preview, filterId);
        onDocumentsChange(
          documents.map((d) =>
            d.id === currentDoc.id
              ? { ...d, activeFilter: filterId, processedPreview: filterId === "original" ? undefined : processed }
              : d
          )
        );
      }
    } catch (err) {
      console.error("Filter error:", err);
    } finally {
      setIsApplyingFilter(false);
    }
  }, [currentDoc, isImage, applyToAll, documents, onDocumentsChange]);

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
    setShowTypeSelector(false);
  }, [documents, onDocumentsChange]);

  const handleDeleteCurrent = useCallback(() => {
    if (!currentDoc) return;
    onDelete(currentDoc.id);
  }, [currentDoc, onDelete]);

  if (documents.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-white/70">Aucun document</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white hover:bg-white/10">Annuler</Button>
          <Button onClick={onAddMore} className="bg-primary">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter
          </Button>
        </div>
      </div>
    );
  }

  // Type selector overlay
  if (showTypeSelector && currentDoc) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex flex-col">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => setShowTypeSelector(false)} className="text-white hover:bg-white/10">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-white font-medium flex-1">Type de document</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-4 pb-24">
            {Array.from(groupedCategories.entries()).map(([group, cats]) => (
              <div key={group} className="mb-4">
                <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 px-2">{group}</p>
                {cats.map((cat) => (
                  <button
                    key={cat.value}
                    className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                      currentDoc.documentType === cat.value
                        ? "bg-primary text-primary-foreground"
                        : "text-white/80 hover:bg-white/10"
                    }`}
                    onClick={() => handleTypeChange(currentDoc.id, cat.value)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      {/* Header - dark like CamScanner */}
      <div className="flex items-center gap-3 px-3 py-3 bg-black z-10">
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
          <X className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <span className="text-white/90 text-sm font-medium">
            Document {currentIndex + 1}/{documents.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" onClick={onAddMore} className="text-white hover:bg-white/10">
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Main document preview - dark background */}
      <div className="flex-1 min-h-0 relative bg-neutral-900">
        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full">
            {documents.map((doc) => {
              const displaySrc = doc.processedPreview || doc.preview;
              const isImg = displaySrc && displaySrc !== "/placeholder.svg";
              return (
                <div
                  key={doc.id}
                  className="flex-[0_0_100%] min-w-0 h-full flex items-center justify-center p-3"
                >
                  {isImg ? (
                    <div className="relative">
                      {/* Delete button on image corner */}
                      <button
                        className="absolute top-2 left-2 z-10 bg-black/60 rounded-full p-1.5"
                        onClick={handleDeleteCurrent}
                      >
                        <Trash2 className="h-4 w-4 text-white/80" />
                      </button>
                      <img
                        src={displaySrc}
                        alt={doc.description || doc.file.name}
                        className="max-w-full max-h-[55vh] object-contain rounded-lg shadow-2xl"
                        style={{ transform: `rotate(${doc.rotation}deg)` }}
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="w-64 h-80 bg-neutral-800 rounded-lg flex items-center justify-center border border-white/10">
                      <div className="text-center text-white/50">
                        <Upload className="h-10 w-10 mx-auto mb-2" />
                        <p className="text-sm">{doc.file.name}</p>
                        <p className="text-xs mt-1">PDF</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Page navigation arrows */}
        {documents.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-4">
            <button
              className="bg-black/60 rounded-full p-2 disabled:opacity-30"
              onClick={() => emblaApi?.scrollPrev()}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 text-white" />
            </button>
            <span className="text-white/80 text-sm font-medium min-w-[3rem] text-center">
              {currentIndex + 1}/{documents.length}
            </span>
            <button
              className="bg-black/60 rounded-full p-2 disabled:opacity-30"
              onClick={() => emblaApi?.scrollNext()}
              disabled={currentIndex === documents.length - 1}
            >
              <ChevronRight className="h-4 w-4 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom panel - CamScanner style */}
      <div className="bg-neutral-950 pt-3 pb-6 space-y-2">
        {/* Apply to all toggle */}
        <div className="flex items-center justify-center gap-2 px-4">
          <button
            className={`flex items-center gap-1.5 text-xs px-3 py-1 rounded-full transition-colors ${
              applyToAll
                ? "bg-primary/20 text-primary"
                : "text-white/40 hover:text-white/60"
            }`}
            onClick={() => setApplyToAll(!applyToAll)}
          >
            <Check className={`h-3 w-3 ${applyToAll ? "opacity-100" : "opacity-0"}`} />
            Appliquer à tous les éléments
          </button>
        </div>

        {/* Filter strip - horizontal scroll */}
        {isImage && (
          <div className="relative">
            {isApplyingFilter && (
              <div className="absolute inset-0 bg-black/50 z-10 flex items-center justify-center rounded">
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              </div>
            )}
            <ScrollArea className="w-full">
              <div className="flex gap-2 px-4 py-1">
                {FILTERS.map((filter) => {
                  const isActive = currentDoc?.activeFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 rounded-lg overflow-hidden transition-all ${
                        isActive
                          ? "ring-2 ring-primary"
                          : "ring-1 ring-white/10"
                      }`}
                      onClick={() => handleFilterSelect(filter.id)}
                      disabled={isApplyingFilter}
                    >
                      {/* Filter thumbnail preview */}
                      <div className="w-16 h-16 bg-neutral-800 flex items-center justify-center overflow-hidden">
                        {currentDoc?.preview && currentDoc.preview !== "/placeholder.svg" ? (
                          <img
                            src={currentDoc.preview}
                            alt=""
                            className="w-full h-full object-cover"
                            style={{
                              filter:
                                filter.id === "bw" ? "grayscale(1)" :
                                filter.id === "enhanced" ? "contrast(1.2) brightness(1.05)" :
                                filter.id === "no_shadow" ? "brightness(1.15) contrast(1.3)" :
                                filter.id === "sharp" ? "contrast(1.1)" :
                                "none",
                            }}
                          />
                        ) : (
                          <span className="text-lg">{filter.icon}</span>
                        )}
                      </div>
                      <span className={`text-[10px] pb-1 ${
                        isActive ? "text-primary font-semibold" : "text-white/60"
                      }`}>
                        {filter.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" className="invisible" />
            </ScrollArea>
          </div>
        )}

        {/* Action toolbar - bottom icons like CamScanner */}
        <div className="flex items-center justify-around px-2 pt-1">
          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors p-2"
            onClick={onAddMore}
          >
            <ImageIcon className="h-5 w-5" />
            <span className="text-[10px]">Importer</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors p-2"
            onClick={() => currentDoc && handleRotate(currentDoc.id)}
          >
            <RotateCcw className="h-5 w-5" />
            <span className="text-[10px]">Rotation</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors p-2"
            onClick={() => currentDoc && onCrop(currentDoc.id)}
          >
            <Crop className="h-5 w-5" />
            <span className="text-[10px]">Recadrer</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors p-2"
            onClick={() => setShowTypeSelector(true)}
          >
            <div className="relative">
              <Upload className="h-5 w-5" />
              {currentDoc?.documentType && (
                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary" />
              )}
            </div>
            <span className="text-[10px]">Type</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 text-white/70 hover:text-white transition-colors p-2"
            onClick={() => currentDoc && onReplace(currentDoc.id)}
          >
            <Camera className="h-5 w-5" />
            <span className="text-[10px]">Remplacer</span>
          </button>

          {/* Save FAB */}
          <button
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-all ${
              allTyped && !isSaving
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                : "bg-white/10 text-white/30"
            }`}
            onClick={onSave}
            disabled={isSaving || !allTyped}
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Check className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Status text */}
        <p className="text-center text-[10px] text-white/30 px-4">
          {allTyped
            ? `${documents.length} document${documents.length > 1 ? "s" : ""} prêt${documents.length > 1 ? "s" : ""}`
            : `${typedCount}/${documents.length} typé${typedCount > 1 ? "s" : ""} — sélectionnez le type pour chaque doc`
          }
        </p>
      </div>
    </div>
  );
}
