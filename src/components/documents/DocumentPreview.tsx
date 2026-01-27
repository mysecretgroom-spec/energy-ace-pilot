import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Loader2,
  FileText,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { TransferDocumentsDialog } from "./TransferDocumentsDialog";

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
    // Reset zoom and rotation when changing document
    setZoom(1);
    setRotation(0);
    setIsLoading(true);
    setError(false);
  }, [currentIndex]);

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

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handleDownload = () => {
    if (!currentDoc) return;
    const link = document.createElement("a");
    link.href = currentDoc.url;
    link.download = currentDoc.nom || "document";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  if (!currentDoc) return null;

  const fileType = getFileType(currentDoc.url);

  // Use Google Docs Viewer for PDF preview
  const getPdfViewerUrl = (url: string) => {
    return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <DialogTitle className="truncate pr-4">{currentDoc.nom}</DialogTitle>
              <p className="text-xs text-muted-foreground capitalize mt-1">
                {currentDoc.type_document.replace(/_/g, " ")}
                {documents.length > 1 && ` • ${currentIndex + 1} / ${documents.length}`}
              </p>
            </div>
            
            <div className="flex items-center gap-1">
              {fileType === "image" && (
                <>
                  <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom arrière">
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom avant">
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleRotate} title="Pivoter">
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}
              
              <Button variant="ghost" size="icon" onClick={handleDownload} title="Télécharger">
                <Download className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTransferDialogOpen(true)}
                title="Transférer"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(currentDoc.url, "_blank")}
                title="Ouvrir dans un nouvel onglet"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 relative overflow-hidden bg-muted/30 flex items-center justify-center min-h-0">
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
          <div className="border-t p-2 flex-shrink-0">
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
      </DialogContent>

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
    </Dialog>
  );
}
