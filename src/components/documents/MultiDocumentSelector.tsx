import React, { useState, useCallback, Suspense } from "react";
import { Button } from "@/components/ui/button";
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
  Pencil,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPreview } from "./DocumentPreview";
import { TransferDocumentsDialog } from "./TransferDocumentsDialog";
import { DeleteConfirmDialog } from "@/components/common/DeleteConfirmDialog";
import { generatePdfFromFile } from "@/components/scanner/services/pdfGenerator";
import { uploadDocumentToStorage } from "@/components/scanner/services/uploadService";
import { ImportPreviewCarousel, type ImportedDoc } from "@/components/scanner/ImportPreviewCarousel";
import { CropEditor } from "@/components/scanner/CropEditor";
import { useAiCrop, type AiCropCorners } from "@/components/scanner/hooks/useAiCrop";
import { useAuth } from "@/hooks/useAuth";

// Lazy load heavy DnD component
const LazyDndList = React.lazy(() => import("./DndDocumentList"));

interface DocumentItem {
  id: string;
  nom: string;
  url: string;
  mime_type?: string | null;
  type_document: string;
  created_at: string;
  thumbnails_urls?: string[] | null;
}

interface MultiDocumentSelectorProps {
  documents: DocumentItem[];
  clientName: string;
  clientAddress?: string;
  clientId?: string;
  etudeId?: string;
  onDocumentsChange?: () => void;
}

const getFileType = (
  input: string | Pick<DocumentItem, "url" | "nom" | "mime_type">
): "pdf" | "image" | "unknown" => {
  const asDoc = typeof input === "string" ? { url: input, nom: "", mime_type: "" } : input;

  const mime = (asDoc.mime_type || "").toLowerCase();
  if (mime.includes("application/pdf")) return "pdf";
  if (mime.startsWith("image/")) return "image";

  const lower = `${asDoc.url} ${asDoc.nom}`.toLowerCase();
  if (lower.includes(".pdf")) return "pdf";
  if (lower.includes(".jpg") || lower.includes(".jpeg") || lower.includes(".png") || lower.includes("image/")) {
    return "image";
  }
  return "unknown";
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const resolveDocumentUrl = async (url: string): Promise<string> => {
  // If it's a data URL, return as-is
  if (url.startsWith("data:")) return url;

  // If it's a Supabase storage URL, create a signed URL for reliable access
  if (url.includes("/storage/v1/object/")) {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);

      if (match) {
        const [, bucket, rawPath] = match;
        const decodedPath = decodeURIComponent(rawPath).split("?")[0].replace(/^\/+/, "");
        const pathCandidates = decodedPath.startsWith(`${bucket}/`)
          ? [decodedPath, decodedPath.slice(bucket.length + 1)]
          : [decodedPath];

        for (const path of pathCandidates) {
          if (!path) continue;
          const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
          if (!error && data?.signedUrl) return data.signedUrl;
        }
      }
    } catch (err) {
      console.warn("Failed to normalize storage URL, using original:", err);
    }
  }

  // If it's not a full URL, treat as storage path in documents bucket
  if (!url.startsWith("http")) {
    const cleanedPath = url.replace(/^\/+/, "").replace(/^documents\//, "");
    const { data } = supabase.storage.from("documents").getPublicUrl(cleanedPath);
    return data.publicUrl;
  }

  return url;
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

  // Resolve URL first (signed URLs for Supabase storage)
  const resolvedUrl = await resolveDocumentUrl(url);

  try {
    const response = await fetch(resolvedUrl, { mode: "cors" });
    if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
    return response.arrayBuffer();
  } catch (corsError) {
    console.warn("CORS issue, trying XHR...", corsError);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", resolvedUrl, true);
      xhr.responseType = "arraybuffer";
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
        else reject(new Error(`XHR failed: ${xhr.status}`));
      };
      xhr.onerror = () => reject(new Error("XHR network error"));
      xhr.send();
    });
  }
};

export function MultiDocumentSelector({
  documents,
  clientName,
  clientAddress,
  clientId,
  etudeId,
  onDocumentsChange,
}: MultiDocumentSelectorProps) {
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<string | null>(null);
  const [isDragMode, setIsDragMode] = useState(false);
  const [orderedDocs, setOrderedDocs] = useState<DocumentItem[]>(documents);

  // Edit carousel state
  const [editCarouselDocs, setEditCarouselDocs] = useState<ImportedDoc[]>([]);
  const [showEditCarousel, setShowEditCarousel] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editDocIdMap, setEditDocIdMap] = useState<Map<string, string>>(new Map()); // carouselId -> originalDocId
  const [editCropDocId, setEditCropDocId] = useState<string | null>(null);
  const [editCropImageData, setEditCropImageData] = useState<string | null>(null);
  const [editCropInitialCorners, setEditCropInitialCorners] = useState<AiCropCorners | undefined>(undefined);
  const { detectCropCorners, autoCropSingle, isAnalyzing: isAiCropping, progress: aiCropProgress } = useAiCrop();

  // Sync orderedDocs with documents prop
  React.useEffect(() => {
    setOrderedDocs(documents);
  }, [documents]);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocuments, setPreviewDocuments] = useState<DocumentItem[]>([]);
  const [previewInitialIndex, setPreviewInitialIndex] = useState(0);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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

  const openSinglePreview = useCallback((doc: DocumentItem) => {
    setPreviewDocuments([doc]);
    setPreviewInitialIndex(0);
    setPreviewOpen(true);
  }, []);

  const openSelectedPreview = useCallback(() => {
    if (selectedIds.size === 0) {
      toast({ title: "Sélection vide", description: "Veuillez sélectionner au moins un document", variant: "destructive" });
      return;
    }
    const selectedDocs = orderedDocs.filter((d) => selectedIds.has(d.id));
    setPreviewDocuments(selectedDocs);
    setPreviewInitialIndex(0);
    setPreviewOpen(true);
  }, [selectedIds, orderedDocs]);

  // Dynamic import of pdf-lib for PDF generation (heavy dependency)
  const generateCombinedPdf = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast({ title: "Sélection vide", description: "Veuillez sélectionner au moins un document", variant: "destructive" });
      return;
    }

    setIsGenerating(true);

    try {
      const { PDFDocument } = await import("pdf-lib");
      const mergedPdf = await PDFDocument.create();
      const selectedDocs = orderedDocs.filter((d) => selectedIds.has(d.id));

      let failedDocs: string[] = [];
      for (const doc of selectedDocs) {
        let fileType = getFileType(doc);
        let lastError: unknown = null;

        // Retry up to 2 times (initial + 1 retry) for transient network issues
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            console.log(`[MergedPDF] Processing "${doc.nom}" (type: ${fileType}, attempt: ${attempt + 1}, url: ${doc.url.substring(0, 80)}...)`);
            const arrayBuffer = await fetchAsArrayBuffer(doc.url);
            console.log(`[MergedPDF] Fetched "${doc.nom}": ${arrayBuffer.byteLength} bytes`);

            if (arrayBuffer.byteLength === 0) {
              throw new Error("Empty file (0 bytes)");
            }

            // Detect actual content type from magic bytes if getFileType returned unknown
            if (fileType === "unknown") {
              const header = new Uint8Array(arrayBuffer.slice(0, 5));
              const headerStr = String.fromCharCode(...header);
              if (headerStr.startsWith("%PDF")) fileType = "pdf";
              else if (header[0] === 0xFF && header[1] === 0xD8) fileType = "image"; // JPEG
              else if (header[0] === 0x89 && headerStr.includes("PNG")) fileType = "image"; // PNG
            }

            if (fileType === "pdf") {
              const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
              const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
              pages.forEach((page) => mergedPdf.addPage(page));
            } else if (fileType === "image") {
              const url = doc.url.toLowerCase();
              const image =
                url.includes(".png") || url.includes("image/png")
                  ? await mergedPdf.embedPng(arrayBuffer)
                  : await mergedPdf.embedJpg(arrayBuffer);

              const A4_W = 595, A4_H = 842, MARGIN = 20;
              const scale = Math.min((A4_W - 2 * MARGIN) / image.width, (A4_H - 2 * MARGIN) / image.height, 1);
              const sw = image.width * scale, sh = image.height * scale;
              const page = mergedPdf.addPage([A4_W, A4_H]);
              page.drawImage(image, { x: (A4_W - sw) / 2, y: A4_H - MARGIN - sh, width: sw, height: sh });
            } else {
              console.warn(`[MergedPDF] Unknown file type for "${doc.nom}", skipping`);
              failedDocs.push(doc.nom);
            }
            lastError = null;
            break; // Success, no need to retry
          } catch (error) {
            lastError = error;
            console.warn(`[MergedPDF] Attempt ${attempt + 1} failed for "${doc.nom}":`, error);
            if (attempt < 1) await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
          }
        }

        if (lastError) {
          console.error(`[MergedPDF] All attempts failed for "${doc.nom}":`, lastError);
          failedDocs.push(doc.nom);
        }
      }

      if (failedDocs.length > 0) {
        sonnerToast.warning(`${failedDocs.length} document(s) non inclus`, {
          description: failedDocs.join(", "),
          duration: 5000,
        });
      }

      // Auto-include étude PDF if available
      if (etudeId) {
        try {
          const { data: etude } = await supabase
            .from("etudes")
            .select("pdf_url")
            .eq("id", etudeId)
            .maybeSingle();

          if (etude?.pdf_url) {
            const { data: signed } = await supabase.storage
              .from("etudes-pdf")
              .createSignedUrl(etude.pdf_url, 3600);

            if (signed?.signedUrl) {
              const resp = await fetch(signed.signedUrl);
              if (resp.ok) {
                const arrayBuffer = await resp.arrayBuffer();
                const etudePdfDoc = await PDFDocument.load(arrayBuffer);
                const pages = await mergedPdf.copyPages(etudePdfDoc, etudePdfDoc.getPageIndices());
                pages.forEach((page) => mergedPdf.addPage(page));
              }
            }
          }
        } catch (err) {
          console.warn("Could not include étude PDF:", err);
        }
      }

      if (mergedPdf.getPageCount() === 0) throw new Error("Aucune page n'a pu être ajoutée au PDF");

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });

      const namePart = clientName.trim().replace(/\s+/g, "_");
      const fileName = `Dossier_${namePart}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      // Small delay to let iOS finalize the File object before sharing
      await new Promise(r => setTimeout(r, 100));

      try {
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: fileName });
        } else {
          downloadBlob(blob, fileName);
        }
      } catch (shareErr: any) {
        if (shareErr?.name !== "AbortError") {
          downloadBlob(blob, fileName);
        }
      }

      toast({ title: "PDF généré", description: `${mergedPdf.getPageCount()} page(s) dans le dossier` });
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error generating combined PDF:", error);
      toast({ title: "Erreur", description: "Impossible de générer le PDF combiné", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  }, [selectedIds, orderedDocs, clientName, etudeId]);

  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      setIsDeleting(true);
      try {
        const { error } = await supabase.from("documents").delete().eq("id", docId);
        if (error) throw error;

        toast({ title: "Document supprimé", description: "Le document a été supprimé avec succès" });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(docId);
          return next;
        });
        onDocumentsChange?.();
      } catch (error) {
        console.error("Error deleting document:", error);
        toast({ title: "Erreur", description: "Impossible de supprimer le document", variant: "destructive" });
      } finally {
        setIsDeleting(false);
        setDeleteDialogOpen(false);
        setDocToDelete(null);
      }
    },
    [onDocumentsChange]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("documents").delete().in("id", Array.from(selectedIds));
      if (error) throw error;

      toast({ title: "Documents supprimés", description: `${selectedIds.size} document(s) supprimé(s)` });
      setSelectedIds(new Set());
      onDocumentsChange?.();
    } catch (error) {
      console.error("Error deleting documents:", error);
      toast({ title: "Erreur", description: "Impossible de supprimer les documents", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, onDocumentsChange]);

  const handleReplaceDocument = useCallback(
    async (docId: string, file: File) => {
      const doc = orderedDocs.find((d) => d.id === docId);
      if (!doc || !clientId) return;

      setIsReplacing(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
          .upload(fileName, pdfBlob, { contentType: "application/pdf", upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(fileName);
        if (!urlData?.publicUrl) throw new Error("Impossible de générer l'URL");

        const { error: updateError } = await supabase
          .from("documents")
          .update({ url: urlData.publicUrl, nom: file.name.replace(/\.[^/.]+$/, ".pdf") })
          .eq("id", docId);

        if (updateError) throw updateError;

        toast({ title: "Document remplacé", description: "Le document a été remplacé avec succès" });
        onDocumentsChange?.();
      } catch (error) {
        console.error("Error replacing document:", error);
        toast({ title: "Erreur", description: "Impossible de remplacer le document", variant: "destructive" });
      } finally {
        setIsReplacing(false);
      }
    },
    [orderedDocs, clientId, onDocumentsChange]
  );

  // ===== EDIT CAROUSEL HANDLERS =====

  const handleOpenEditCarousel = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast({ title: "Sélection vide", description: "Sélectionnez des documents à modifier", variant: "destructive" });
      return;
    }

    setIsLoadingEdit(true);
    const selectedDocs = orderedDocs.filter((d) => selectedIds.has(d.id));
    const idMap = new Map<string, string>();

    try {
      const carouselDocs: ImportedDoc[] = await Promise.all(
        selectedDocs.map(async (doc) => {
          const carouselId = crypto.randomUUID();
          idMap.set(carouselId, doc.id);

          let preview = "";
          const fileType = getFileType(doc);

          if (fileType === "image") {
            // Fetch image as data URL
            try {
              const resp = await fetch(doc.url);
              const blob = await resp.blob();
              preview = await new Promise<string>((res, rej) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result as string);
                reader.onerror = rej;
                reader.readAsDataURL(blob);
              });
            } catch {
              preview = doc.url;
            }
          } else if (fileType === "pdf") {
            // Render first page of PDF as image
            try {
              const { pdfjsLib } = await import("@/lib/pdfWorker");
              const resp = await fetch(doc.url);
              const arrayBuffer = await resp.arrayBuffer();
              const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
              const page = await pdf.getPage(1);
              const viewport = page.getViewport({ scale: 2 });
              const canvas = document.createElement("canvas");
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                await page.render({ canvasContext: ctx, viewport }).promise;
                preview = canvas.toDataURL("image/jpeg", 0.9);
              }
            } catch {
              preview = "/placeholder.svg";
            }
          }

          // Create a dummy File object
          const blob = preview.startsWith("data:") 
            ? await fetch(preview).then(r => r.blob()) 
            : new Blob([], { type: "image/jpeg" });
          const file = new File([blob], doc.nom, { type: blob.type || "image/jpeg" });

          return {
            id: carouselId,
            file,
            preview,
            rotation: 0,
            activeFilter: "original",
            description: doc.nom,
            documentType: doc.type_document as any,
          };
        })
      );

      setEditDocIdMap(idMap);
      setEditCarouselDocs(carouselDocs);
      setShowEditCarousel(true);
    } catch (err) {
      console.error("Failed to load docs for editing:", err);
      toast({ title: "Erreur", description: "Impossible de charger les documents", variant: "destructive" });
    } finally {
      setIsLoadingEdit(false);
    }
  }, [selectedIds, orderedDocs]);

  const handleEditCarouselSave = useCallback(async () => {
    if (!user || !clientId) return;

    setIsSavingEdit(true);
    try {
      let savedCount = 0;

      for (const doc of editCarouselDocs) {
        const originalDocId = editDocIdMap.get(doc.id);
        if (!originalDocId) continue;

        const finalPreview = doc.processedPreview || doc.preview;
        if (!finalPreview || finalPreview === "/placeholder.svg") continue;

        // Convert to PDF
        let fileForPdf: File | Blob = doc.file;
        if (finalPreview.startsWith("data:image")) {
          const resp = await fetch(finalPreview);
          fileForPdf = await resp.blob();
        }

        const pdfResult = await generatePdfFromFile(
          fileForPdf instanceof File ? fileForPdf : new File([fileForPdf], doc.file.name, { type: fileForPdf.type })
        );

        const signedUrl = await uploadDocumentToStorage(pdfResult.blob, user.id, "client_docs");

        const { error } = await supabase
          .from("documents")
          .update({
            url: signedUrl,
            thumbnails_urls: pdfResult.thumbnails,
          })
          .eq("id", originalDocId);

        if (error) throw error;
        savedCount++;
      }

      // Silent save
      setShowEditCarousel(false);
      setEditCarouselDocs([]);
      setSelectedIds(new Set());
      onDocumentsChange?.();
    } catch (err) {
      console.error("Save edited docs error:", err);
      sonnerToast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSavingEdit(false);
    }
  }, [editCarouselDocs, editDocIdMap, user, clientId, onDocumentsChange]);

  const handleEditCrop = useCallback((id: string) => {
    const doc = editCarouselDocs.find((d) => d.id === id);
    if (!doc || !doc.preview || doc.preview === "/placeholder.svg") return;
    setEditCropDocId(id);
    setEditCropImageData(doc.preview);
    setEditCropInitialCorners(undefined);
  }, [editCarouselDocs]);

  const handleEditCropComplete = useCallback((croppedImage: string) => {
    if (!editCropDocId) return;
    setEditCarouselDocs((prev) =>
      prev.map((d) =>
        d.id === editCropDocId ? { ...d, preview: croppedImage, rotation: 0, activeFilter: "original", processedPreview: undefined } : d
      )
    );
    setEditCropDocId(null);
    setEditCropImageData(null);
    setEditCropInitialCorners(undefined);
  }, [editCropDocId]);

  const isAllSelected = selectedIds.size === orderedDocs.length && orderedDocs.length > 0;

  return (
    <>
      <div className="space-y-3">
        {/* Selection controls */}
        {orderedDocs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isDragMode ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setIsDragMode(!isDragMode);
                if (isDragMode) setSelectedIds(new Set());
              }}
              className="gap-2"
            >
              {isDragMode ? <Check className="h-4 w-4" /> : <GripVertical className="h-4 w-4" />}
              {isDragMode ? "Terminer" : "Classer"}
            </Button>

            <Button variant="ghost" size="sm" onClick={selectAll} className="gap-2">
              {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              {isAllSelected ? "Désélect." : "Tout"}
            </Button>

            {selectedIds.size > 0 && (
              <div className="flex flex-wrap gap-1.5 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEditCarousel}
                  disabled={isLoadingEdit}
                  className="gap-1 h-8 px-2"
                >
                  {isLoadingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Éditer</span>
                </Button>

                <Button variant="outline" size="sm" onClick={openSelectedPreview} className="gap-1 h-8 px-2">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Voir</span> ({selectedIds.size})
                </Button>

                <Button variant="outline" size="sm" onClick={() => setTransferDialogOpen(true)} className="gap-1 h-8 px-2">
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
                  {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Suppr.</span>
                </Button>

                <Button size="sm" onClick={generateCombinedPdf} disabled={isGenerating} className="gap-1 h-8 px-2">
                  {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileArchive className="h-3.5 w-3.5" />}
                  PDF
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Document list - DnD loaded lazily */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <LazyDndList
            orderedDocs={orderedDocs}
            onReorder={setOrderedDocs}
            selectedIds={selectedIds}
            onToggleSelection={toggleSelection}
            onOpenPreview={openSinglePreview}
            onDelete={(id) => {
              setDocToDelete(id);
              setDeleteDialogOpen(true);
            }}
            onReplace={handleReplaceDocument}
            formatDate={formatDate}
            isDragMode={isDragMode}
            getFileType={getFileType}
          />
        </Suspense>
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

      {/* Transfer dialog */}
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

      {/* Delete confirmation */}
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

      {/* Edit carousel overlay */}
      {editCropImageData && editCropDocId ? (
        <CropEditor
          imageData={editCropImageData}
          onComplete={(croppedImage) => handleEditCropComplete(croppedImage)}
          onCancel={() => { setEditCropDocId(null); setEditCropImageData(null); setEditCropInitialCorners(undefined); }}
          initialCorners={editCropInitialCorners}
        />
      ) : showEditCarousel && editCarouselDocs.length > 0 ? (
        <ImportPreviewCarousel
          documents={editCarouselDocs}
          onDocumentsChange={setEditCarouselDocs}
          onDelete={(id) => setEditCarouselDocs((prev) => prev.filter((d) => d.id !== id))}
          onReplace={() => {}}
          onCrop={handleEditCrop}
          onAiCrop={async (_mode, idx) => {
            const doc = editCarouselDocs[idx];
            if (!doc) return;
            const updated = await autoCropSingle(doc);
            if (updated) {
              setEditCarouselDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
            }
          }}
          isAiCropping={isAiCropping}
          aiCropProgress={aiCropProgress}
          onAddMore={() => {}}
          onSave={handleEditCarouselSave}
          onClose={() => { setShowEditCarousel(false); setEditCarouselDocs([]); }}
          isSaving={isSavingEdit}
        />
      ) : null}
    </>
  );
}
