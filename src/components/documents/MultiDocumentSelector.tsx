import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Loader2,
  CheckSquare,
  Square,
  FileArchive,
  Eye,
  ArrowRight,
  Trash2,
  GripVertical,
  Check,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPreview } from "./DocumentPreview";
import { SortableDocumentCard } from "./SortableDocumentCard";
import { TransferDocumentsDialog } from "./TransferDocumentsDialog";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { generatePdfFromFile } from "@/components/scanner/services/pdfGenerator";

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
  clientId?: string;
  onDocumentsChange?: () => void;
}

export function MultiDocumentSelector({
  documents,
  clientName,
  clientId,
  onDocumentsChange,
}: MultiDocumentSelectorProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [isDragMode, setIsDragMode] = useState(false);
  const [orderedDocs, setOrderedDocs] = useState<DocumentItem[]>(documents);
  
  // Sync orderedDocs with documents prop
  React.useEffect(() => {
    setOrderedDocs(documents);
  }, [documents]);
  
  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocuments, setPreviewDocuments] = useState<DocumentItem[]>([]);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);
  
  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedDocs((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

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
    if (selectedIds.size === orderedDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orderedDocs.map((d) => d.id)));
    }
  }, [orderedDocs, selectedIds.size]);

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
    if (url.startsWith("data:")) {
      const base64 = url.split(",")[1];
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }

    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
      return response.arrayBuffer();
    } catch (corsError) {
      console.warn("CORS issue, trying with proxy approach...", corsError);
      
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(`XHR failed: ${xhr.status}`));
          }
        };
        
        xhr.onerror = () => reject(new Error('XHR network error'));
        xhr.send();
      });
    }
  };

  const openSinglePreview = useCallback((doc: DocumentItem) => {
    setPreviewDocuments([doc]);
    setPreviewInitialIndex(0);
    setPreviewOpen(true);
  }, []);

  const openSelectedPreview = useCallback(() => {
    if (selectedIds.size === 0) {
      toast({
        title: "Sélection vide",
        description: "Veuillez sélectionner au moins un document",
        variant: "destructive",
      });
      return;
    }
    
    const selectedDocs = orderedDocs.filter((d) => selectedIds.has(d.id));
    setPreviewDocuments(selectedDocs);
    setPreviewInitialIndex(0);
    setPreviewOpen(true);
  }, [selectedIds, orderedDocs]);

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
      // Use ordered docs to maintain order
      const selectedDocs = orderedDocs.filter((d) => selectedIds.has(d.id));

      for (const doc of selectedDocs) {
        const fileType = getFileType(doc.url);

        try {
          const arrayBuffer = await fetchAsArrayBuffer(doc.url);

          if (fileType === "pdf") {
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
            pages.forEach((page) => mergedPdf.addPage(page));
          } else if (fileType === "image") {
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
  }, [selectedIds, orderedDocs, clientName]);

  const handleDeleteDocument = useCallback(async (docId: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .eq("id", docId);

      if (error) throw error;

      toast({
        title: "Document supprimé",
        description: "Le document a été supprimé avec succès",
      });
      
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      onDocumentsChange?.();
    } catch (error) {
      console.error("Error deleting document:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le document",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDocToDelete(null);
    }
  }, [onDocumentsChange]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("documents")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      toast({
        title: "Documents supprimés",
        description: `${selectedIds.size} document(s) supprimé(s)`,
      });
      
      setSelectedIds(new Set());
      onDocumentsChange?.();
    } catch (error) {
      console.error("Error deleting documents:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les documents",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, onDocumentsChange]);

  const handleReplaceDocument = useCallback(async (docId: string, file: File) => {
    const doc = orderedDocs.find((d) => d.id === docId);
    if (!doc || !clientId) return;

    setIsReplacing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      let pdfBlob: Blob;
      
      if (file.type.startsWith("image/")) {
        const result = await generatePdfFromFile(file);
        pdfBlob = result.blob;
      } else if (file.type === "application/pdf") {
        pdfBlob = file;
      } else {
        throw new Error("Format de fichier non supporté");
      }

      const timestamp = Date.now();
      const fileName = `${user.id}/${clientId}/${doc.type_document}_${timestamp}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("receipts")
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) throw new Error("Impossible de générer l'URL");

      const { error: updateError } = await supabase
        .from("documents")
        .update({
          url: urlData.publicUrl,
          nom: file.name.replace(/\.[^/.]+$/, ".pdf"),
        })
        .eq("id", docId);

      if (updateError) throw updateError;

      toast({
        title: "Document remplacé",
        description: "Le document a été remplacé avec succès",
      });
      
      onDocumentsChange?.();
    } catch (error) {
      console.error("Error replacing document:", error);
      toast({
        title: "Erreur",
        description: "Impossible de remplacer le document",
        variant: "destructive",
      });
    } finally {
      setIsReplacing(false);
    }
  }, [orderedDocs, clientId, onDocumentsChange]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const isAllSelected = selectedIds.size === orderedDocs.length && orderedDocs.length > 0;

  return (
    <>
      <div className="space-y-3">
        {/* Selection controls */}
        {orderedDocs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Drag mode toggle */}
            <Button
              variant={isDragMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsDragMode(!isDragMode);
                if (isDragMode) {
                  setSelectedIds(new Set());
                }
              }}
              className="gap-2"
            >
              {isDragMode ? (
                <Check className="h-4 w-4" />
              ) : (
                <GripVertical className="h-4 w-4" />
              )}
              {isDragMode ? "Terminer" : "Classer"}
            </Button>
            
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
              {isAllSelected ? "Désélect." : "Tout"}
            </Button>

            {selectedIds.size > 0 && (
              <div className="flex flex-wrap gap-1.5 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openSelectedPreview}
                  className="gap-1 h-8 px-2"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Voir</span> ({selectedIds.size})
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransferDialogOpen(true)}
                  className="gap-1 h-8 px-2"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Transf.</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="gap-1 h-8 px-2 text-destructive hover:bg-destructive/10"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">Suppr.</span>
                </Button>
                
                <Button
                  size="sm"
                  onClick={generateCombinedPdf}
                  disabled={isGenerating}
                  className="gap-1 h-8 px-2"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileArchive className="h-3.5 w-3.5" />
                  )}
                  PDF
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Document list with DnD */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={orderedDocs.map(d => d.id)}
            strategy={verticalListSortingStrategy}
          >
            {orderedDocs.map((doc) => {
              const isSelected = selectedIds.has(doc.id);
              const fileType = getFileType(doc.url);

              return (
                <SortableDocumentCard
                  key={doc.id}
                  doc={doc}
                  isSelected={isSelected}
                  fileType={fileType}
                  onToggleSelection={() => toggleSelection(doc.id)}
                  onOpenPreview={() => openSinglePreview(doc)}
                  onDelete={() => {
                    setDocToDelete(doc.id);
                    setDeleteDialogOpen(true);
                  }}
                  onReplace={(file) => handleReplaceDocument(doc.id, file)}
                  formatDate={formatDate}
                  isDragMode={isDragMode}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      {/* Preview dialog */}
      <DocumentPreview
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        documents={previewDocuments}
        initialIndex={previewInitialIndex}
        clientId={clientId}
        onTransferSuccess={() => {
          setPreviewOpen(false);
          setSelectedIds(new Set());
          onDocumentsChange?.();
        }}
      />

      {/* Transfer dialog for multi-selection */}
      <TransferDocumentsDialog
        open={transferDialogOpen}
        onOpenChange={setTransferDialogOpen}
        documentIds={Array.from(selectedIds)}
        currentClientId={clientId}
        onSuccess={() => {
          setSelectedIds(new Set());
          onDocumentsChange?.();
        }}
      />

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open);
          if (!open) setDocToDelete(null);
        }}
        onConfirm={() => docToDelete && handleDeleteDocument(docToDelete)}
        title="Supprimer ce document ?"
        description="Cette action est irréversible. Le document sera définitivement supprimé."
        isLoading={isDeleting}
      />
    </>
  );
}
