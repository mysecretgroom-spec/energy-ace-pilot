import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Check,
  X,
  Trash2,
  GripVertical,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { ScanPage } from "./types";
import { MediaPreview } from "@/components/documents/MediaPreview";

interface PageManagerProps {
  pages: ScanPage[];
  onPagesChange: (pages: ScanPage[]) => void;
  onAddPage: () => void;
  onFinish: () => void;
  onCancel: () => void;
}

export function PageManager({
  pages,
  onPagesChange,
  onAddPage,
  onFinish,
  onCancel,
}: PageManagerProps) {
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const handleDeletePage = useCallback(
    (pageId: string) => {
      onPagesChange(pages.filter((p) => p.id !== pageId));
      if (selectedPage === pageId) {
        setSelectedPage(null);
      }
    },
    [pages, onPagesChange, selectedPage]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index === 0) return;
      const newPages = [...pages];
      [newPages[index - 1], newPages[index]] = [newPages[index], newPages[index - 1]];
      onPagesChange(newPages);
    },
    [pages, onPagesChange]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index === pages.length - 1) return;
      const newPages = [...pages];
      [newPages[index], newPages[index + 1]] = [newPages[index + 1], newPages[index]];
      onPagesChange(newPages);
    },
    [pages, onPagesChange]
  );

  if (pages.length === 0) {
    return (
      <div className="fixed inset-0 z-[70] bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">Aucune page scannée</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button onClick={onAddPage}>
            <Plus className="h-4 w-4 mr-2" />
            Scanner une page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-5 w-5" />
        </Button>
        <span className="font-medium">
          {pages.length} page{pages.length > 1 ? "s" : ""} scannée{pages.length > 1 ? "s" : ""}
        </span>
        <Button variant="ghost" size="icon" onClick={onAddPage}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Pages list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {pages.map((page, index) => (
            <div
              key={page.id}
              className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${
                selectedPage === page.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => setSelectedPage(page.id === selectedPage ? null : page.id)}
            >
              {/* Drag handle visual indicator */}
              <div className="text-muted-foreground">
                <GripVertical className="h-5 w-5" />
              </div>

              {/* Thumbnail */}
              <Button variant="ghost" aria-label={`Aperçu de la page ${index + 1}`} className="p-0 relative w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0" onClick={(e) => { e.stopPropagation(); setPreviewIndex(index); }}>
                <img
                  src={page.thumbnailData}
                  alt={`Page ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-background/85 text-foreground text-xs text-center py-0.5">
                  {index + 1}
                </div>
              </Button>

              {/* Page info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium">Page {index + 1}</p>
                <p className="text-sm text-muted-foreground">
                  {page.rotation !== 0 ? `Rotation ${page.rotation}°` : "Original"}
                </p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveUp(index);
                  }}
                  disabled={index === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveDown(index);
                  }}
                  disabled={index === pages.length - 1}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeletePage(page.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="flex items-center justify-between p-4 pb-20 border-t bg-background">
        <Button variant="outline" onClick={onAddPage}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une page
        </Button>
        <Button onClick={onFinish}>
          <Check className="h-4 w-4 mr-2" />
          Terminer
        </Button>
      </div>
      <MediaPreview isOpen={previewIndex !== null} onClose={() => setPreviewIndex(null)} initialIndex={previewIndex ?? 0} items={pages.map((page, i) => ({ id: page.id, nom: `Page ${i + 1}`, url: page.imageData, mime_type: "image/png", thumbnails_urls: [page.thumbnailData] }))} />
    </div>
  );
}
