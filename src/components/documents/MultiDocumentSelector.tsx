import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  FileText,
  Image,
  Download,
  Loader2,
  CheckSquare,
  Square,
  FileArchive,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";

interface DocumentItem {
  id: string;
  nom: string;
  url: string;
  type_document: string;
  created_at: string;
  thumbnails_urls?: string[] | null;
}

interface MultiDocumentSelectorProps {
  documents: DocumentItem[];
  clientName: string;
}

export function MultiDocumentSelector({
  documents,
  clientName,
}: MultiDocumentSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  }, [documents, selectedIds.size]);

  const getFileType = (url: string): "pdf" | "image" | "unknown" => {
    const lower = url.toLowerCase();
    if (lower.includes(".pdf") || lower.includes("application/pdf")) return "pdf";
    if (
      lower.includes(".jpg") ||
      lower.includes(".jpeg") ||
      lower.includes(".png") ||
      lower.includes("image/")
    )
      return "image";
    return "unknown";
  };

  const fetchAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
    // Handle base64 data URLs
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
    return response.arrayBuffer();
  };

  const generateCombinedPdf = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast({
        title: "Sélection vide",
        description: "Veuillez sélectionner au moins un document",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      const mergedPdf = await PDFDocument.create();
      const selectedDocs = documents.filter((d) => selectedIds.has(d.id));

      for (const doc of selectedDocs) {
        const fileType = getFileType(doc.url);

        try {
          const arrayBuffer = await fetchAsArrayBuffer(doc.url);

          if (fileType === "pdf") {
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            pages.forEach((page) => mergedPdf.addPage(page));
          } else if (fileType === "image") {
            // Embed image as a new page
            let image;
            const url = doc.url.toLowerCase();
            
            if (url.includes(".png") || url.includes("image/png")) {
              image = await mergedPdf.embedPng(arrayBuffer);
            } else {
              image = await mergedPdf.embedJpg(arrayBuffer);
            }

            const page = mergedPdf.addPage([image.width, image.height]);
            page.drawImage(image, {
              x: 0,
              y: 0,
              width: image.width,
              height: image.height,
            });
          }
        } catch (error) {
          console.error(`Error processing document ${doc.nom}:`, error);
          toast({
            title: "Erreur",
            description: `Impossible de traiter: ${doc.nom}`,
            variant: "destructive",
          });
        }
      }

      if (mergedPdf.getPageCount() === 0) {
        throw new Error("Aucune page n'a pu être ajoutée au PDF");
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      // Download the file
      const link = document.createElement("a");
      link.href = url;
      link.download = `Dossier_${clientName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF généré",
        description: `${mergedPdf.getPageCount()} page(s) dans le dossier`,
      });

      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error generating combined PDF:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF combiné",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedIds, documents, clientName]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isAllSelected = selectedIds.size === documents.length && documents.length > 0;

  return (
    <div className="space-y-3">
      {/* Selection controls */}
      {documents.length > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            className="gap-2"
          >
            {isAllSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {isAllSelected ? "Désélectionner tout" : "Tout sélectionner"}
          </Button>

          {selectedIds.size > 0 && (
            <Button
              size="sm"
              onClick={generateCombinedPdf}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileArchive className="h-4 w-4" />
              )}
              Générer PDF ({selectedIds.size})
            </Button>
          )}
        </div>
      )}

      {/* Document list */}
      {documents.map((doc) => {
        const isSelected = selectedIds.has(doc.id);
        const fileType = getFileType(doc.url);

        return (
          <Card
            key={doc.id}
            className={`shadow-card cursor-pointer transition-all ${
              isSelected ? "ring-2 ring-primary bg-primary/5" : ""
            }`}
            onClick={() => toggleSelection(doc.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelection(doc.id)}
                  onClick={(e) => e.stopPropagation()}
                />

                <div className="p-2 rounded-lg bg-muted flex-shrink-0">
                  {fileType === "image" ? (
                    <Image className="h-4 w-4 text-primary" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary" />
                  )}
                </div>

                {/* Thumbnail if available */}
                {doc.thumbnails_urls && doc.thumbnails_urls[0] && (
                  <div className="w-12 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={doc.thumbnails_urls[0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.nom}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {doc.type_document.replace("_", " ")} • {formatDate(doc.created_at)}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(doc.url, "_blank");
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
