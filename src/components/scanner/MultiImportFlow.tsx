import React, { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Trash2,
  Eye,
  Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { generatePdfFromFile } from "./services/pdfGenerator";
import { uploadDocumentToStorage } from "./services/uploadService";
import { CLIENT_DOC_CATEGORIES, getGroupedCategories, type DocumentType } from "@/lib/documentCategories";

export type MultiImportContext = "finance" | "client_docs";

interface ImportedFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "analyzing" | "success" | "error" | "manual";
  // Finance fields
  montant_ttc?: number | null;
  montant_ht?: number | null;
  tva?: number | null;
  taux_tva?: number | null;
  date?: string | null;
  fournisseur?: string | null;
  description?: string | null;
  categorie?: string | null;
  // Client doc fields
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
  const [files, setFiles] = useState<ImportedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const title = context === "finance" 
    ? "Importer des factures" 
    : "Importer des documents";

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const newFiles: ImportedFile[] = await Promise.all(
      selectedFiles.map(async (file) => {
        let preview = "";
        if (file.type.startsWith("image/")) {
          preview = URL.createObjectURL(file);
        } else if (file.type === "application/pdf") {
          preview = "/placeholder.svg"; // PDF placeholder
        }

        return {
          id: crypto.randomUUID(),
          file,
          preview,
          status: "pending" as const,
        };
      })
    );

    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const analyzeFile = async (importedFile: ImportedFile): Promise<ImportedFile> => {
    try {
      // Convert file directly to base64 - Gemini can handle PDFs natively
      // No need to generate thumbnails first, which was causing blocking
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(importedFile.file);
      });
      
      console.log("Sending to analyze-document:", importedFile.file.name, "size:", base64.length);

      const { data, error } = await supabase.functions.invoke("analyze-document", {
        body: { image_base64: base64, context },
      });

      if (error) throw error;

      if (data.success) {
        if (context === "finance") {
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
        } else {
          return {
            ...importedFile,
            status: "success",
            document_type: data.document_type as DocumentType,
            confidence: data.confidence,
            description: data.description,
          };
        }
      } else {
        return {
          ...importedFile,
          status: "manual",
          error_message: data.error_message || "L'IA n'a pas pu analyser ce document",
        };
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      return {
        ...importedFile,
        status: "manual",
        error_message: error.message || "Erreur lors de l'analyse",
      };
    }
  };

  const handleAnalyzeAll = async () => {
    if (files.length === 0) return;

    setIsAnalyzing(true);

    // Mark all as analyzing
    setFiles((prev) =>
      prev.map((f) => (f.status === "pending" ? { ...f, status: "analyzing" as const } : f))
    );

    // Analyze in parallel with limited concurrency
    const pendingFiles = files.filter((f) => f.status === "analyzing");
    const results = await Promise.all(pendingFiles.map(analyzeFile));

    setFiles((prev) =>
      prev.map((f) => {
        const result = results.find((r) => r.id === f.id);
        return result || f;
      })
    );

    setIsAnalyzing(false);

    const successCount = results.filter((r) => r.status === "success").length;
    const manualCount = results.filter((r) => r.status === "manual").length;

    if (manualCount > 0) {
      toast.info(`${successCount} analysés avec succès, ${manualCount} nécessitent une saisie manuelle`);
    } else {
      toast.success(`${successCount} documents analysés avec succès`);
    }
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileField = (id: string, field: string, value: any) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f))
    );
  };

  const handleSaveAll = async () => {
    if (!user) return;

    const validFiles = files.filter(
      (f) => f.status === "success" || f.status === "manual"
    );

    if (validFiles.length === 0) {
      toast.error("Aucun document à enregistrer");
      return;
    }

    // Validate required fields
    for (const f of validFiles) {
      if (context === "finance" && !f.montant_ttc) {
        toast.error(`Montant TTC requis pour ${f.file.name}`);
        return;
      }
      if (context === "client_docs" && !f.document_type) {
        toast.error(`Type de document requis pour ${f.file.name}`);
        return;
      }
    }

    setSaving(true);

    try {
      for (const importedFile of validFiles) {
        // Generate PDF from file
        const pdfResult = await generatePdfFromFile(importedFile.file);

        // Upload to storage - returns signedUrl string directly
        const signedUrl = await uploadDocumentToStorage(
          pdfResult.blob,
          user.id,
          context
        );

        if (context === "finance") {
          // Save to frais table
          const { error } = await supabase.from("frais").insert({
            user_id: user.id,
            montant: importedFile.montant_ttc!,
            date_frais: importedFile.date || new Date().toISOString().split("T")[0],
            categorie: (importedFile.categorie || "autre") as "carburant" | "peage" | "repas" | "hotel" | "parking" | "autre",
            description: importedFile.description || importedFile.fournisseur,
            justificatif_url: signedUrl,
            ocr_data: {
              montant_ttc: importedFile.montant_ttc,
              montant_ht: importedFile.montant_ht,
              tva: importedFile.tva,
              taux_tva: importedFile.taux_tva,
              fournisseur: importedFile.fournisseur,
            },
          });

          if (error) throw error;
        } else {
          // Save to documents table
          if (!clientId) {
            toast.error("Client ID requis pour les documents clients");
            continue;
          }

          const { error } = await supabase.from("documents").insert({
            user_id: user.id,
            client_id: clientId,
            nom: importedFile.description || importedFile.file.name,
            url: signedUrl,
            type_document: importedFile.document_type || "autre",
            mime_type: "application/pdf",
            taille_bytes: pdfResult.blob.size,
            thumbnails_urls: pdfResult.thumbnails,
            context_source: "multi_import",
          });

          if (error) throw error;
        }
      }

      toast.success(`${validFiles.length} documents enregistrés`);
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
    setPreviewUrl(null);
    onClose();
  };

  const groupedCategories = getGroupedCategories();

  const pendingCount = files.filter((f) => f.status === "pending").length;
  const successCount = files.filter((f) => f.status === "success").length;
  const manualCount = files.filter((f) => f.status === "manual").length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {context === "finance" ? (
              <Receipt className="h-5 w-5 text-primary" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Upload zone */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">
              Cliquez pour sélectionner des fichiers
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, JPG, PNG • Plusieurs fichiers autorisés
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png"
              multiple
              onChange={handleFilesSelect}
              className="hidden"
            />
          </div>

          {/* Files status */}
          {files.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{files.length} fichiers</Badge>
              {pendingCount > 0 && (
                <Badge variant="secondary">{pendingCount} en attente</Badge>
              )}
              {successCount > 0 && (
                <Badge className="bg-green-100 text-green-700">{successCount} analysés</Badge>
              )}
              {manualCount > 0 && (
                <Badge className="bg-amber-100 text-amber-700">{manualCount} à compléter</Badge>
              )}
            </div>
          )}

          {/* Files list */}
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3">
              {files.map((f) => (
                <Card key={f.id} className={f.status === "manual" ? "border-amber-300" : ""}>
                  <CardContent className="p-3">
                    <div className="flex gap-3">
                      {/* Thumbnail */}
                      <div
                        className="w-16 h-16 rounded bg-muted flex-shrink-0 overflow-hidden cursor-pointer"
                        onClick={() => f.preview && setPreviewUrl(f.preview)}
                      >
                        {f.preview && f.preview !== "/placeholder.svg" ? (
                          <img
                            src={f.preview}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {f.file.name}
                            </p>
                            {f.status === "analyzing" && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Analyse en cours...
                              </div>
                            )}
                            {f.status === "success" && (
                              <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Analysé avec succès
                              </div>
                            )}
                            {f.status === "manual" && (
                              <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                                <AlertCircle className="h-3 w-3" />
                                {f.error_message || "Saisie manuelle requise"}
                              </div>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground"
                            onClick={() => handleRemoveFile(f.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Editable fields for finance */}
                        {context === "finance" && (f.status === "success" || f.status === "manual") && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div>
                              <Label className="text-xs">Montant TTC *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={f.montant_ttc || ""}
                                onChange={(e) => updateFileField(f.id, "montant_ttc", parseFloat(e.target.value) || null)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Catégorie</Label>
                              <Select
                                value={f.categorie || "autre"}
                                onValueChange={(v) => updateFileField(f.id, "categorie", v)}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FINANCE_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                      {cat.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">Date</Label>
                              <Input
                                type="date"
                                value={f.date || ""}
                                onChange={(e) => updateFileField(f.id, "date", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Fournisseur</Label>
                              <Input
                                value={f.fournisseur || ""}
                                onChange={(e) => updateFileField(f.id, "fournisseur", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                        )}

                        {/* Editable fields for client docs */}
                        {context === "client_docs" && (f.status === "success" || f.status === "manual") && (
                          <div className="mt-2">
                            <Label className="text-xs">Type de document *</Label>
                            <Select
                              value={f.document_type || ""}
                              onValueChange={(v) => updateFileField(f.id, "document_type", v)}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Sélectionner le type" />
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
                            {f.confidence !== undefined && f.confidence > 0 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Confiance IA: {f.confidence}%
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={handleClose}>
            Annuler
          </Button>
          <div className="flex-1" />
          {pendingCount > 0 && (
            <Button
              variant="outline"
              onClick={handleAnalyzeAll}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyse...
                </>
              ) : (
                <>Analyser ({pendingCount})</>
              )}
            </Button>
          )}
          {(successCount > 0 || manualCount > 0) && (
            <Button onClick={handleSaveAll} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer ({successCount + manualCount})
                </>
              )}
            </Button>
          )}
        </div>

        {/* Preview dialog */}
        {previewUrl && (
          <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
            <DialogContent className="max-w-lg">
              <img src={previewUrl} alt="Preview" className="w-full rounded" />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
