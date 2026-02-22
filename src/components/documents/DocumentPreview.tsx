import React, { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  Share2,
  Loader2,
  FileText,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { TransferDocumentsDialog } from "./TransferDocumentsDialog";
import { toast } from "sonner";

interface DocumentPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  documents: Array<{
    id: string;
    nom: string;
    url: string;
    type_document: string;
  }>;
  initialIndex?: number;
  clientId?: string;
  onTransferSuccess?: () => void;
}

export function DocumentPreview({
  isOpen,
  onClose,
  documents,
  initialIndex = 0,
  clientId,
  onTransferSuccess,
}: DocumentPreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);

  const currentDoc = documents[currentIndex];

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setIsLoading(true);
    setError(false);
  }, [currentIndex]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const getFileType = (url: string): "pdf" | "image" | "unknown" => {
    const lower = url.toLowerCase();
    if (lower.includes(".pdf") || lower.includes("application/pdf")) return "pdf";
    if (
      lower.includes(".jpg") ||
      lower.includes(".jpeg") ||
      lower.includes(".png") ||
      lower.includes(".webp") ||
      lower.includes("image/")
    )
      return "image";
    return "unknown";
  };

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : documents.length - 1));
  }, [documents.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < documents.length - 1 ? prev + 1 : 0));
  }, [documents.length]);

  const handleDownload = async () => {
    if (!currentDoc) return;
    try {
      // Fetch the file as blob for native share
      const response = await fetch(currentDoc.url);
      const blob = await response.blob();
      const ext = currentDoc.url.toLowerCase().includes(".pdf") ? "pdf" : 
                  currentDoc.url.toLowerCase().includes(".png") ? "png" : "jpg";
      const filename = currentDoc.nom || `document.${ext}`;
      const file = new File([blob], filename, { type: blob.type });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
      } else {
        // Fallback: direct download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Impossible de télécharger");
      }
    }
  };

  const handleShare = async () => {
    if (!currentDoc) return;
    try {
      if (navigator.share) {
        // Try sharing the URL first
        await navigator.share({
          title: currentDoc.nom,
          url: currentDoc.url,
        });
      } else {
        // Fallback: copy URL to clipboard
        await navigator.clipboard.writeText(currentDoc.url);
        toast.success("Lien copié dans le presse-papier");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        // Fallback to clipboard
        try {
          await navigator.clipboard.writeText(currentDoc.url);
          toast.success("Lien copié dans le presse-papier");
        } catch {
          toast.error("Impossible de partager");
        }
      }
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
      if (e.key === "Escape") onClose();
    },
    [isOpen, handlePrev, handleNext, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !currentDoc) return null;

  const fileType = getFileType(currentDoc.url);

  const getPdfViewerUrl = (url: string) => {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  };

  return (
    <>
      {/* Fullscreen overlay */}
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-md flex-shrink-0">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="font-semibold text-foreground truncate text-sm">{currentDoc.nom}</h2>
            <p className="text-xs text-muted-foreground capitalize">
              {currentDoc.type_document.replace(/_/g, " ")}
              {documents.length > 1 && ` • ${currentIndex + 1} / ${documents.length}`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleShare}>
              <Share2 className="h-4.5 w-4.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleDownload}>
              <Download className="h-4.5 w-4.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 relative overflow-hidden flex items-center justify-center min-h-0">
          {/* Navigation buttons */}
          {documents.length > 1 && (
            <>
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 shadow-lg"
                onClick={handlePrev}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 shadow-lg"
                onClick={handleNext}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </>
          )}

          {/* Floating Action Button - Transfer */}
          <div className="absolute bottom-6 right-6 z-20">
            <Button
              className="shadow-lg gap-2"
              onClick={() => setTransferDialogOpen(true)}
            >
              <ArrowRight className="h-4 w-4" />
              Transférer
            </Button>
          </div>

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-5">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <p>Impossible de charger la prévisualisation</p>
              <Button variant="outline" onClick={() => window.open(currentDoc.url, "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir dans un nouvel onglet
              </Button>
            </div>
          )}

          {/* Image preview */}
          {fileType === "image" && !error && (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4">
              <img
                src={currentDoc.url}
                alt={currentDoc.nom}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
                onLoad={() => setIsLoading(false)}
                onError={() => {
                  setIsLoading(false);
                  setError(true);
                }}
              />
            </div>
          )}

          {/* PDF preview using Google Docs Viewer */}
          {fileType === "pdf" && !error && (
            <iframe
              src={getPdfViewerUrl(currentDoc.url)}
              className="w-full h-full border-0"
              title={currentDoc.nom}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setError(true);
              }}
            />
          )}

          {/* Unknown file type */}
          {fileType === "unknown" && (
            <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <FileText className="h-16 w-16" />
              <p>Prévisualisation non disponible pour ce type de fichier</p>
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
            </div>
          )}
        </div>

        {/* Thumbnails bar for multiple documents */}
        {documents.length > 1 && (
          <div className="border-t p-2 flex-shrink-0 bg-background">
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-1">
                {documents.map((doc, index) => (
                  <button
                    key={doc.id}
                    onClick={() => setCurrentIndex(index)}
                    className={`flex-shrink-0 w-16 h-20 rounded border-2 overflow-hidden transition-all ${
                      index === currentIndex
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-muted-foreground/30"
                    }`}
                  >
                    {getFileType(doc.url) === "image" ? (
                      <img
                        src={doc.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Transfer Dialog */}
      <TransferDocumentsDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        documentIds={[currentDoc.id]}
        currentClientId={clientId}
        onSuccess={() => {
          onTransferSuccess?.();
          onClose();
        }}
      />
    </>
  );
}
