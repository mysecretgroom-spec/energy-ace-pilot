import React, { useState, useRef, useCallback } from "react";
import { clampDateToToday } from "@/lib/dateValidation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Receipt,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generatePdfFromFile } from "./services/pdfGenerator";
import { uploadDocumentToStorage } from "./services/uploadService";
import { detectDocumentEdgesLight } from "./services/edgeDetectionLight";
import { applyPerspectiveCorrectionLight } from "./services/perspectiveCorrection";
import { CLIENT_DOC_CATEGORIES, getGroupedCategories, type DocumentType } from "@/lib/documentCategories";
import { ImportPreviewCarousel, type ImportedDoc } from "./ImportPreviewCarousel";
import { CropEditor } from "./CropEditor";
import { useAiCrop, type AiCropCorners } from "./hooks/useAiCrop";
import { useDocumentEnhancement } from "@/hooks/useDocumentEnhancement";
import { LibraryDocPicker } from "./LibraryDocPicker";

export type MultiImportContext = "finance" | "client_docs";

interface ImportedFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "analyzing" | "success" | "error" | "manual";
  montant_ttc?: number | null;
  montant_ht?: number | null;
  tva?: number | null;
  taux_tva?: number | null;
  date?: string | null;
  fournisseur?: string | null;
  description?: string | null;
  categorie?: string | null;
  document_type?: DocumentType | null;
  confidence?: number;
  error_message?: string;
}

interface MultiImportFlowProps {
  isOpen: boolean;
  context: MultiImportContext;
  clientId?: string;
  onSuccess?: () => void;
  onClose: () => void;
}

const FINANCE_CATEGORIES = [
  { value: "carburant", label: "Carburant" },
  { value: "peage", label: "Péage" },
  { value: "repas", label: "Repas" },
  { value: "hotel", label: "Hôtel" },
  { value: "parking", label: "Parking" },
  { value: "train", label: "Trains" },
  { value: "location_vehicule", label: "Location Véhicule" },
  { value: "autre", label: "Autre" },
];

export function MultiImportFlow({
  isOpen,
  context,
  clientId,
  onSuccess,
  onClose,
}: MultiImportFlowProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Finance mode state (unchanged)
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [isApplyingEdits, setIsApplyingEdits] = useState(false);

  // Client docs carousel mode state
  const [carouselDocs, setCarouselDocs] = useState<ImportedDoc[]>([]);
  const [showCarousel, setShowCarousel] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Crop mode
  const [cropDocId, setCropDocId] = useState<string | null>(null);
  const [cropImageData, setCropImageData] = useState<string | null>(null);
  const [cropInitialCorners, setCropInitialCorners] = useState<AiCropCorners | undefined>(undefined);

  // Replace mode
  const [replaceDocId, setReplaceDocId] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  // AI crop hook
  const { detectCropCorners, autoCropSingle, isAnalyzing: isAiCropping, progress: aiCropProgress } = useAiCrop();
  const { enhance: aiEnhance, isEnhancing: isAiEnhancing } = useDocumentEnhancement();

  // No preloading needed — lightweight JS detection is instant

  const title = context === "finance" 
    ? "Importer des factures" 
    : "Importer des documents";

  // ===== CLIENT DOCS: Carousel flow =====

  const processFilesForCarousel = async (selectedFiles: File[]) => {
    setIsProcessing(true);
    setProcessingProgress(0);

    const docs: ImportedDoc[] = [];
    const BATCH_SIZE = 3;
    const breathe = () => new Promise(r => setTimeout(r, 10)); // let GC run

    for (let batch = 0; batch < selectedFiles.length; batch += BATCH_SIZE) {
      const chunk = selectedFiles.slice(batch, batch + BATCH_SIZE);

      const results = await Promise.all(
        chunk.map(async (file) => {
          let preview = "";
          try {
            if (file.type.startsWith("image/")) {
              preview = URL.createObjectURL(file);
              try {
                const edges = await Promise.race([
                  detectDocumentEdgesLight(preview),
                  new Promise<null>((_, rej) => setTimeout(() => rej(new Error("edge timeout")), 5000)),
                ]);
                if (edges && edges.confidence > 0.3) {
                  const corrected = await applyPerspectiveCorrectionLight(preview, edges);
                  URL.revokeObjectURL(preview);
                  preview = corrected;
                }
              } catch (err) {
                console.warn("Auto-crop failed for", file.name, err);
              }
            } else if (file.type === "application/pdf") {
              preview = "/placeholder.svg";
            }
          } catch (err) {
            console.warn("Process failed for", file.name, err);
            if (!preview) preview = "/placeholder.svg";
          }

          return {
            id: crypto.randomUUID(),
            file,
            preview,
            rotation: 0,
            activeFilter: "original" as const,
            description: file.name.replace(/\.[^/.]+$/, ""),
          };
        })
      );

      docs.push(...results);
      setProcessingProgress(((batch + chunk.length) / selectedFiles.length) * 100);
      await breathe();
    }

    setCarouselDocs((prev) => [...prev, ...docs]);
    setShowCarousel(true);
    setIsProcessing(false);
    setProcessingProgress(0);
  };

  const handleClientDocsSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    if (fileInputRef.current) fileInputRef.current.value = "";
    await processFilesForCarousel(selectedFiles);
  };

  const handleCarouselDelete = useCallback((id: string) => {
    setCarouselDocs((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const handleCarouselReplace = useCallback((id: string) => {
    setReplaceDocId(id);
    setTimeout(() => replaceInputRef.current?.click(), 100);
  }, []);

  const handleReplaceFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !replaceDocId) return;
    if (replaceInputRef.current) replaceInputRef.current.value = "";

    let preview = "";
    if (file.type.startsWith("image/")) {
      preview = URL.createObjectURL(file);
      try {
        const edges = await detectDocumentEdgesLight(preview);
        if (edges && edges.confidence > 0.3) {
          const corrected = await applyPerspectiveCorrectionLight(preview, edges);
          URL.revokeObjectURL(preview);
          preview = corrected;
        }
      } catch {}
    } else {
      preview = "/placeholder.svg";
    }

    setCarouselDocs((prev) =>
      prev.map((d) =>
        d.id === replaceDocId
          ? { ...d, file, preview, rotation: 0, activeFilter: "original", description: file.name.replace(/\.[^/.]+$/, "") }
          : d
      )
    );
    setReplaceDocId(null);
  }, [replaceDocId]);

  const handleCarouselCrop = useCallback((id: string) => {
    const doc = carouselDocs.find((d) => d.id === id);
    if (!doc || !doc.preview || doc.preview === "/placeholder.svg") {
      toast.error("Le recadrage n'est disponible que pour les images");
      return;
    }
    setCropDocId(id);
    setCropImageData(doc.preview);
    setCropInitialCorners(undefined); // manual crop = no AI corners
  }, [carouselDocs]);

  const handleCropComplete = useCallback((croppedImage: string, _thumbnail: string) => {
    if (!cropDocId) return;
    setCarouselDocs((prev) =>
      prev.map((d) =>
        d.id === cropDocId ? { ...d, preview: croppedImage, rotation: 0, activeFilter: "original", processedPreview: undefined } : d
      )
    );
    setCropDocId(null);
    setCropImageData(null);
    setCropInitialCorners(undefined);
  }, [cropDocId]);

  const handleCarouselSave = useCallback(async () => {
    if (!user || !clientId) return;

    // Allow docs without type - AI will classify them
    const validDocs = carouselDocs;
    if (validDocs.length === 0) {
      toast.error("Aucun document à enregistrer");
      return;
    }

    setSaving(true);
    try {
      const { data: existingDocs } = await supabase
        .from("documents")
        .select("nom, type_document")
        .eq("user_id", user.id)
        .eq("client_id", clientId);

      let savedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      const existing = existingDocs || [];
      const BATCH = 3;
      const breathe = () => new Promise(r => setTimeout(r, 10));

      for (let i = 0; i < validDocs.length; i += BATCH) {
        const chunk = validDocs.slice(i, i + BATCH);

        const results = await Promise.allSettled(
          chunk.map(async (doc) => {
            const docName = doc.description || doc.file.name;
            const docType = doc.documentType || "autre";

            const isDuplicate = existing.some(
              (e) => e.nom === docName && e.type_document === docType
            );
            if (isDuplicate) return "duplicate" as const;

            let fileForPdf: File | Blob = doc.file;
            const finalPreview = doc.processedPreview || doc.preview;
            if (finalPreview && finalPreview.startsWith("data:image")) {
              const resp = await fetch(finalPreview);
              fileForPdf = await resp.blob();
            }

            let pdfBlob: Blob;
            let thumbnailsForDb: string[] = [];

            if (doc.file.type === "application/pdf" && !(finalPreview && finalPreview.startsWith("data:image"))) {
              pdfBlob = doc.file;
              const canvas = document.createElement("canvas");
              canvas.width = 200; canvas.height = 260;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.fillStyle = "#f1f5f9"; ctx.fillRect(0, 0, 200, 260);
                ctx.fillStyle = "#64748b"; ctx.font = "bold 14px sans-serif";
                ctx.textAlign = "center"; ctx.fillText("PDF", 100, 130);
                ctx.font = "10px sans-serif"; ctx.fillText(doc.file.name.slice(0, 20), 100, 150);
              }
              thumbnailsForDb = [canvas.toDataURL("image/jpeg", 0.8)];
              canvas.width = 0; canvas.height = 0; // free memory
            } else {
              const pdfResult = await generatePdfFromFile(
                fileForPdf instanceof File ? fileForPdf : new File([fileForPdf], doc.file.name, { type: fileForPdf.type })
              );
              pdfBlob = pdfResult.blob;
              thumbnailsForDb = pdfResult.thumbnails;
            }

            const signedUrl = await uploadDocumentToStorage(pdfBlob, user.id, "client_docs");

            const { data: insertedDoc, error } = await supabase.from("documents").insert({
              user_id: user.id,
              client_id: clientId,
              nom: docName,
              url: signedUrl,
              type_document: docType as any,
              mime_type: "application/pdf",
              taille_bytes: pdfBlob.size,
              thumbnails_urls: thumbnailsForDb,
              context_source: "multi_import",
            }).select("id").single();

            if (error) throw error;

            // Queue AI classification if no type was manually selected
            if (!doc.documentType && insertedDoc) {
              await supabase.from("background_jobs").insert({
                user_id: user.id,
                job_type: "ai_classify_document",
                payload: { documentId: insertedDoc.id, url: signedUrl },
                status: "pending",
                priority: 3,
              });
            }

            existing.push({ nom: docName, type_document: docType });
            return "saved" as const;
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled") {
            if (r.value === "duplicate") duplicateCount++;
            else savedCount++;
          } else {
            console.error("Save doc error:", r.reason);
            errorCount++;
          }
        }
        await breathe();
      }

      if (errorCount > 0) {
        toast.error(`${errorCount} erreur(s), ${savedCount} enregistrés`);
      } else if (duplicateCount > 0 && savedCount > 0) {
        toast.success(`${savedCount} enregistrés, ${duplicateCount} doublons ignorés`);
      } else if (duplicateCount > 0 && savedCount === 0) {
        toast.info(`${duplicateCount} doublons détectés, aucun nouveau document`);
      } else {
        toast.success(`${savedCount} documents enregistrés`);
      }

      setCarouselDocs([]);
      setShowCarousel(false);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }, [carouselDocs, user, clientId, onSuccess, onClose]);

  const handleCarouselClose = useCallback(() => {
    setCarouselDocs([]);
    setShowCarousel(false);
    onClose();
  }, [onClose]);

  const handleCarouselAddMore = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleAddFromLibrary = useCallback(async (libraryDocs: Array<{
    id: string; nom: string; url: string; type_document: string; thumbnails_urls: string[] | null;
  }>) => {
    setShowLibraryPicker(false);
    if (libraryDocs.length === 0) return;

    const newDocs: ImportedDoc[] = await Promise.all(
      libraryDocs.map(async (doc) => {
        let preview = "/placeholder.svg";
        const thumb = doc.thumbnails_urls?.[0];
        if (thumb && !thumb.includes("PDF")) {
          preview = thumb;
        } else {
          // Try to fetch and render the first page
          try {
            const resp = await fetch(doc.url);
            const contentType = resp.headers.get("content-type") || "";
            if (contentType.includes("image")) {
              const blob = await resp.blob();
              preview = await new Promise<string>((res) => {
                const reader = new FileReader();
                reader.onload = () => res(reader.result as string);
                reader.onerror = () => res("/placeholder.svg");
                reader.readAsDataURL(blob);
              });
            }
          } catch {
            // keep placeholder
          }
        }

        const blob = preview.startsWith("data:")
          ? await fetch(preview).then((r) => r.blob())
          : new Blob([], { type: "application/pdf" });
        const file = new File([blob], doc.nom, { type: blob.type || "application/pdf" });

        return {
          id: crypto.randomUUID(),
          file,
          preview,
          rotation: 0,
          activeFilter: "original" as const,
          description: doc.nom,
          documentType: doc.type_document as DocumentType,
        };
      })
    );

    setCarouselDocs((prev) => [...prev, ...newDocs]);
  }, []);

  // ===== FINANCE MODE (unchanged logic) =====

  const handleFinanceFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newFiles: ImportedFile[] = await Promise.all(
      selectedFiles.map(async (file) => {
        let preview = "";
        if (file.type.startsWith("image/")) {
          preview = URL.createObjectURL(file);
        } else if (file.type === "application/pdf") {
          preview = "/placeholder.svg";
        }
        return { id: crypto.randomUUID(), file, preview, status: "pending" as const };
      })
    );

    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const analyzeFile = async (importedFile: ImportedFile): Promise<ImportedFile> => {
    try {
      let base64: string;
      
      if (importedFile.file.type === "application/pdf") {
        try {
          const { pdfjsLib } = await import("@/lib/pdfWorker");
          const arrayBuffer = await importedFile.file.arrayBuffer();
          const pdf = await Promise.race([
            pdfjsLib.getDocument({ data: arrayBuffer }).promise,
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 10000)),
          ]);
          const page = await pdf.getPage(1);
          // Use scale 1 instead of 2 — sufficient for AI analysis, halves memory
          const viewport = page.getViewport({ scale: 1 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(viewport.width, 1200);
          canvas.height = Math.min(viewport.height, 1600);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const scale = Math.min(canvas.width / viewport.width, canvas.height / viewport.height);
            const sv = page.getViewport({ scale });
            canvas.width = sv.width;
            canvas.height = sv.height;
            await page.render({ canvasContext: ctx, viewport: sv }).promise;
            base64 = canvas.toDataURL("image/jpeg", 0.7);
          } else throw new Error("no ctx");
          // Free canvas memory immediately
          canvas.width = 0;
          canvas.height = 0;
        } catch {
          base64 = await new Promise<string>((res, rej) => {
            const r = new FileReader();
            r.onload = () => res(r.result as string);
            r.onerror = rej;
            r.readAsDataURL(importedFile.file);
          });
        }
      } else {
        const maxSize = 2 * 1024 * 1024; // Lower threshold: compress sooner
        if (importedFile.file.size > maxSize) {
          const imageCompression = (await import("browser-image-compression")).default;
          const compressed = await imageCompression(importedFile.file, { maxSizeMB: 1, maxWidthOrHeight: 1200, useWebWorker: true });
          base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(compressed); });
        } else {
          base64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(importedFile.file); });
        }
      }

      const { data, error } = await supabase.functions.invoke("analyze-document", { body: { image_base64: base64, context } });
      if (error) throw new Error(error.message || "Erreur serveur");

      if (data.success) {
        return {
          ...importedFile,
          status: "success",
          montant_ttc: data.montant_ttc,
          montant_ht: data.montant_ht,
          tva: data.tva,
          taux_tva: data.taux_tva,
          date: data.date,
          fournisseur: data.fournisseur,
          description: data.description,
          categorie: data.categorie,
        };
      }
      return { ...importedFile, status: "manual", error_message: data.error_message || "Saisie manuelle requise" };
    } catch (error: any) {
      return { ...importedFile, status: "manual", error_message: error.message || "Erreur" };
    }
  };

  const handleAnalyzeAll = async () => {
    const pending = files.filter((f) => f.status === "pending");
    if (pending.length === 0) return;
    setIsAnalyzing(true);
    setFiles((prev) => prev.map((f) => f.status === "pending" ? { ...f, status: "analyzing" as const } : f));

    // Process in batches of 3 to avoid rate limits and memory pressure
    const BATCH = 3;
    const allResults: ImportedFile[] = [];
    for (let i = 0; i < pending.length; i += BATCH) {
      const chunk = pending.slice(i, i + BATCH);
      const results = await Promise.allSettled(chunk.map(analyzeFile));
      for (let j = 0; j < results.length; j++) {
        if (results[j].status === "fulfilled") {
          allResults.push((results[j] as PromiseFulfilledResult<ImportedFile>).value);
        } else {
          allResults.push({ ...chunk[j], status: "manual", error_message: "Erreur d'analyse" });
        }
      }
      setFiles((prev) => prev.map((f) => { const r = allResults.find((x) => x.id === f.id); return r || f; }));
    }

    setIsAnalyzing(false);
    const sc = allResults.filter((r) => r.status === "success").length;
    const mc = allResults.filter((r) => r.status === "manual").length;
    if (mc > 0) toast.info(`${sc} analysés, ${mc} à compléter`);
    else toast.success(`${sc} analysés`);
  };

  const handleRemoveFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const updateFileField = (id: string, field: string, value: any) => setFiles((prev) => prev.map((f) => f.id === id ? { ...f, [field]: value } : f));

  const handleApplyAiEdits = async () => {
    const editable = files.filter((f) => f.status === "success" || f.status === "manual");
    if (editable.length === 0) {
      toast.error("Analysez d'abord les factures");
      return;
    }
    if (!aiEditPrompt.trim()) return;

    setIsApplyingEdits(true);
    try {
      const invoices = editable.map((f, idx) => ({
        index: idx,
        fournisseur: f.fournisseur ?? null,
        date: f.date ?? null,
        montant_ttc: f.montant_ttc ?? null,
        taux_tva: f.taux_tva ?? null,
        categorie: f.categorie ?? null,
        description: f.description ?? null,
      }));

      const { data, error } = await supabase.functions.invoke("apply-invoice-edits", {
        body: { invoices, instruction: aiEditPrompt.trim() },
      });

      if (error) {
        const ctx = (error as { context?: { status?: number } }).context;
        if (ctx?.status === 429) toast.error("Trop de requêtes IA. Réessayez dans un instant.");
        else if (ctx?.status === 402) toast.error("Crédits IA épuisés.");
        else toast.error("Erreur lors de l'application");
        return;
      }

      const patches: Array<{ index: number; patch: Record<string, any> }> = data?.patches || [];
      if (patches.length === 0) {
        toast.info("Aucune modification reconnue");
        return;
      }

      const idsByIndex = editable.map((f) => f.id);
      const touched = new Set<string>();

      setFiles((prev) =>
        prev.map((f) => {
          const idx = idsByIndex.indexOf(f.id);
          if (idx < 0) return f;
          const matching = patches.find((p) => p.index === idx);
          if (!matching) return f;
          touched.add(f.id);
          const next = { ...f, ...matching.patch };
          // Recompute TVA if taux_tva or montant_ttc changed
          if (matching.patch.taux_tva != null || matching.patch.montant_ttc != null) {
            const ttc = Number(next.montant_ttc) || 0;
            const taux = Number(next.taux_tva) || 0;
            if (ttc > 0 && taux > 0) {
              const ht = ttc / (1 + taux / 100);
              next.montant_ht = Math.round(ht * 100) / 100;
              next.tva = Math.round((ttc - ht) * 100) / 100;
            }
          }
          return next;
        })
      );

      toast.success(`${touched.size} facture(s) modifiée(s)`);
      setAiEditPrompt("");
    } catch (e: any) {
      console.error("apply-invoice-edits failed", e);
      toast.error("Erreur lors de l'application");
    } finally {
      setIsApplyingEdits(false);
    }
  };

  const handleSaveAll = async () => {
    if (!user) return;
    const validFiles = files.filter((f) => f.status === "success" || f.status === "manual");
    if (validFiles.length === 0) { toast.error("Aucun document à enregistrer"); return; }
    for (const f of validFiles) { if (!f.montant_ttc) { toast.error(`Montant TTC requis pour ${f.file.name}`); return; } }

    setSaving(true);
    try {
      let savedCount = 0, duplicateCount = 0, matchedCount = 0;

      // Fetch existing frais for duplicate check
      const { data } = await supabase.from("frais").select("id, montant, date_frais, description, fournisseur, justificatif_url").eq("user_id", user.id);
      const existingFrais = data || [];

      // Helper: fuzzy string match (Levenshtein-like simple check)
      const fuzzyMatch = (a: string | null | undefined, b: string | null | undefined): boolean => {
        if (!a || !b) return false;
        const na = a.toLowerCase().trim();
        const nb = b.toLowerCase().trim();
        if (na === nb) return true;
        if (na.includes(nb) || nb.includes(na)) return true;
        // Simple char-distance check: allow 2 char difference for short strings
        if (Math.abs(na.length - nb.length) > 3) return false;
        let diff = 0;
        const maxLen = Math.max(na.length, nb.length);
        for (let i = 0; i < maxLen; i++) {
          if (na[i] !== nb[i]) diff++;
          if (diff > 2) return false;
        }
        return true;
      };

      // Helper: find a manual expense (no receipt) matching by amount + date + vendor
      const findManualMatch = (montant: number, date: string | null, vendor: string | null | undefined) => {
        const targetDate = date || new Date().toISOString().split("T")[0];
        return existingFrais.find(e => {
          // Must be a manual entry (no receipt attached)
          if (e.justificatif_url) return false;
          // Amount must match exactly
          if (Number(e.montant) !== montant) return false;
          // Date must match
          if (e.date_frais !== targetDate) return false;
          // Vendor fuzzy match (against fournisseur or description)
          if (vendor) {
            return fuzzyMatch(e.fournisseur, vendor) || fuzzyMatch(e.description, vendor);
          }
          return true; // Same amount + date, no vendor to check
        });
      };

      for (const importedFile of validFiles) {
        // Check for exact duplicate (already has receipt)
        const isDuplicate = existingFrais.some((e) => 
          e.justificatif_url && 
          Number(e.montant) === importedFile.montant_ttc && 
          e.date_frais === (importedFile.date || new Date().toISOString().split("T")[0]) && 
          (e.description === importedFile.fournisseur || e.description === importedFile.description)
        );
        if (isDuplicate) { duplicateCount++; continue; }

        // Try to find a matching manual expense to attach receipt to
        const manualMatch = findManualMatch(
          importedFile.montant_ttc!, 
          importedFile.date ? clampDateToToday(importedFile.date) : null,
          importedFile.fournisseur
        );

        const pdfResult = await generatePdfFromFile(importedFile.file);
        const signedUrl = await uploadDocumentToStorage(pdfResult.blob, user.id, context);

        if (manualMatch) {
          // Update the existing manual expense with the receipt
          const { error } = await supabase.from("frais").update({
            justificatif_url: signedUrl,
            fournisseur: importedFile.fournisseur || manualMatch.fournisseur,
            description: importedFile.description || manualMatch.description,
            ocr_data: { montant_ttc: importedFile.montant_ttc, montant_ht: importedFile.montant_ht, tva: importedFile.tva, taux_tva: importedFile.taux_tva, fournisseur: importedFile.fournisseur } as any,
          }).eq("id", manualMatch.id);
          if (error) throw error;
          // Mark as matched so it won't match again
          manualMatch.justificatif_url = signedUrl;
          matchedCount++;
        } else {
          // Create new expense
          const { error } = await supabase.from("frais").insert({
            user_id: user.id,
            montant: importedFile.montant_ttc!,
            date_frais: clampDateToToday(importedFile.date),
            categorie: (importedFile.categorie || "autre") as any,
            description: importedFile.description || importedFile.fournisseur,
            fournisseur: importedFile.fournisseur || null,
            justificatif_url: signedUrl,
            ocr_data: { montant_ttc: importedFile.montant_ttc, montant_ht: importedFile.montant_ht, tva: importedFile.tva, taux_tva: importedFile.taux_tva, fournisseur: importedFile.fournisseur },
          });
          if (error) throw error;
          existingFrais.push({ id: crypto.randomUUID(), montant: importedFile.montant_ttc!, date_frais: importedFile.date || new Date().toISOString().split("T")[0], description: importedFile.fournisseur || importedFile.description || null, fournisseur: importedFile.fournisseur || null, justificatif_url: signedUrl });
          savedCount++;
        }
      }

      // Build result message
      const parts: string[] = [];
      if (savedCount > 0) parts.push(`${savedCount} créés`);
      if (matchedCount > 0) parts.push(`${matchedCount} rattachés à des frais manuels`);
      if (duplicateCount > 0) parts.push(`${duplicateCount} doublons ignorés`);

      if (matchedCount > 0) {
        toast.success(`✅ ${parts.join(", ")}`, { duration: 5000 });
      } else if (duplicateCount > 0 && savedCount === 0) {
        toast.info(parts.join(", "));
      } else {
        toast.success(parts.join(", ") || "Aucun frais enregistré");
      }

      setFiles([]);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setCarouselDocs([]);
    setShowCarousel(false);
    setPreviewUrl(null);
    onClose();
  };

  // ===== RENDER: Crop editor overlay =====
  if (cropImageData && cropDocId) {
    return (
      <CropEditor
        imageData={cropImageData}
        onComplete={handleCropComplete}
        onCancel={() => { setCropDocId(null); setCropImageData(null); setCropInitialCorners(undefined); }}
        initialCorners={cropInitialCorners}
      />
    );
  }

  // ===== RENDER: Client docs carousel mode =====
  if (context === "client_docs") {
    // Processing overlay
    if (isProcessing) {
      return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="sm:max-w-sm">
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Préparation des documents...</p>
              <Progress value={processingProgress} className="w-full" />
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    // Carousel view
    if (showCarousel && carouselDocs.length > 0) {
      return (
        <>
          <ImportPreviewCarousel
            documents={carouselDocs}
            onDocumentsChange={setCarouselDocs}
            onDelete={handleCarouselDelete}
            onReplace={handleCarouselReplace}
            onCrop={handleCarouselCrop}
            onAiCrop={async (_mode, idx) => {
              const doc = carouselDocs[idx];
              if (!doc) return;
              // Store original preview for revert before AI crop modifies it
              if (!doc.originalPreview) {
                setCarouselDocs(prev => prev.map(d => 
                  d.id === doc.id ? { ...d, originalPreview: d.preview } : d
                ));
              }
              // Detect corners via AI, then open CropEditor with those corners for manual adjustment
              const result = await detectCropCorners(doc);
              if (result) {
                setCropDocId(result.docId);
                setCropImageData(doc.originalPreview || doc.preview);
                setCropInitialCorners(result.corners);
              }
            }}
            isAiCropping={isAiCropping}
            aiCropProgress={aiCropProgress}
            onAiEnhance={async (id) => {
              const doc = carouselDocs.find(d => d.id === id);
              if (!doc || !doc.preview || doc.preview === "/placeholder.svg") return;
              const enhanced = await aiEnhance(doc.preview, "auto");
              if (enhanced) {
                setCarouselDocs(prev => prev.map(d =>
                  d.id === id ? { ...d, originalPreview: d.originalPreview || d.preview, preview: enhanced, processedPreview: undefined, activeFilter: "original" } : d
                ));
              }
            }}
            isAiEnhancing={isAiEnhancing}
            onAddMore={handleCarouselAddMore}
            onAddFromLibrary={clientId ? () => setShowLibraryPicker(true) : undefined}
            onSave={handleCarouselSave}
            onClose={handleCarouselClose}
            isSaving={isSaving}
          />
          {/* Library doc picker */}
          {showLibraryPicker && clientId && (
            <LibraryDocPicker
              clientId={clientId}
              onSelect={handleAddFromLibrary}
              onClose={() => setShowLibraryPicker(false)}
            />
          )}
          {/* Hidden inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png"
            multiple
            onChange={handleClientDocsSelect}
            className="hidden"
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,application/pdf"
            onChange={handleReplaceFileChange}
            className="hidden"
          />
        </>
      );
    }

    // Initial upload dialog
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {title}
            </DialogTitle>
          </DialogHeader>
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Sélectionnez vos documents</p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, JPG, PNG • Plusieurs fichiers autorisés
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png"
            multiple
            onChange={handleClientDocsSelect}
            className="hidden"
          />
        </DialogContent>
      </Dialog>
    );
  }

  // ===== RENDER: Finance mode (list view, unchanged) =====
  const groupedCategories = getGroupedCategories();
  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const manualCount = files.filter((f) => f.status === "manual").length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors flex-shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">Cliquez pour sélectionner des fichiers</p>
          <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG • Plusieurs fichiers autorisés</p>
          <input ref={fileInputRef} type="file" accept="application/pdf,image/jpeg,image/jpg,image/png" multiple onChange={handleFinanceFilesSelect} className="hidden" />
        </div>

        {files.length > 0 && (
          <div className="flex items-center gap-2 text-sm flex-shrink-0">
            <Badge variant="outline">{files.length} fichiers</Badge>
            {pendingCount > 0 && <Badge variant="secondary">{pendingCount} en attente</Badge>}
            {successCount > 0 && <Badge className="bg-green-100 text-green-700">{successCount} analysés</Badge>}
            {manualCount > 0 && <Badge className="bg-amber-100 text-amber-700">{manualCount} à compléter</Badge>}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto -mx-6 px-6">
          <div className="space-y-3">
            {files.map((f) => (
              <Card key={f.id} className={f.status === "manual" ? "border-amber-300" : ""}>
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="w-16 h-16 rounded bg-muted flex-shrink-0 overflow-hidden cursor-pointer" onClick={() => f.preview && setPreviewUrl(f.preview)}>
                      {f.preview && f.preview !== "/placeholder.svg" ? (
                        <img src={f.preview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><FileText className="h-6 w-6 text-muted-foreground" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{f.file.name}</p>
                          {f.status === "analyzing" && <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1"><Loader2 className="h-3 w-3 animate-spin" />Analyse...</div>}
                          {f.status === "success" && <div className="flex items-center gap-1 text-xs text-green-600 mt-1"><CheckCircle2 className="h-3 w-3" />Analysé</div>}
                          {f.status === "manual" && <div className="flex items-center gap-1 text-xs text-amber-600 mt-1"><AlertCircle className="h-3 w-3" />{f.error_message || "Saisie manuelle"}</div>}
                        </div>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground" onClick={() => handleRemoveFile(f.id)}><X className="h-4 w-4" /></Button>
                      </div>
                      {(f.status === "success" || f.status === "manual") && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div><Label className="text-xs">Montant TTC *</Label><Input type="number" step="0.01" value={f.montant_ttc || ""} onChange={(e) => updateFileField(f.id, "montant_ttc", parseFloat(e.target.value) || null)} className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Catégorie</Label>
                            <Select value={f.categorie || "autre"} onValueChange={(v) => updateFileField(f.id, "categorie", v)}>
                              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                              <SelectContent>{FINANCE_CATEGORIES.map((cat) => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div><Label className="text-xs">Date</Label><Input type="date" value={f.date || ""} onChange={(e) => updateFileField(f.id, "date", e.target.value)} className="h-8 text-sm" /></div>
                          <div><Label className="text-xs">Fournisseur</Label><Input value={f.fournisseur || ""} onChange={(e) => updateFileField(f.id, "fournisseur", e.target.value)} className="h-8 text-sm" /></div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={handleClose}>Annuler</Button>
          <div className="flex-1" />
          {pendingCount > 0 && (
            <Button variant="outline" onClick={handleAnalyzeAll} disabled={isAnalyzing}>
              {isAnalyzing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyse...</> : <>Analyser ({pendingCount})</>}
            </Button>
          )}
          {(successCount > 0 || manualCount > 0) && (
            <Button onClick={handleSaveAll} disabled={isSaving}>
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enregistrement...</> : <><Save className="h-4 w-4 mr-2" />Enregistrer ({successCount + manualCount})</>}
            </Button>
          )}
        </div>

        {previewUrl && (
          <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
            <DialogContent className="max-w-lg"><img src={previewUrl} alt="Preview" className="w-full rounded" /></DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
