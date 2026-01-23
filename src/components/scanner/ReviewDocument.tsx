import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Save,
  Plus,
  Download,
  Share2,
  Loader2,
  FileSearch,
  Sparkles,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { DocumentContext, ScanPage } from "./AddDocumentFlow";
import { generatePdfFromPages, generatePdfFromFile } from "./services/pdfGenerator";
import { uploadDocumentToStorage } from "./services/uploadService";

// AI OCR result type from edge function
interface AIExtractedData {
  montant_ttc: number | null;
  montant_ht: number | null;
  tva: number | null;
  taux_tva: number | null;
  date: string | null;
  categorie: string | null;
  description: string | null;
  commercant: string | null;
  raw_text?: string;
}

interface ReviewDocumentProps {
  context: DocumentContext;
  pages: ScanPage[];
  importedFile: File | null;
  relatedClientId?: string;
  relatedProjectId?: string;
  onSuccess: () => void;
  onCancel: () => void;
  onAddPage?: () => void;
}

const FINANCE_CATEGORIES = [
  { value: "carburant", label: "Carburant" },
  { value: "peage", label: "Péage" },
  { value: "repas", label: "Repas" },
  { value: "hotel", label: "Hôtel" },
  { value: "parking", label: "Parking" },
  { value: "autre", label: "Autre" },
];

// Import categories from centralized lib
import { CLIENT_DOC_CATEGORIES, getGroupedCategories } from "@/lib/documentCategories";

export function ReviewDocument({
  context,
  pages,
  importedFile,
  relatedClientId,
  relatedProjectId,
  onSuccess,
  onCancel,
  onAddPage,
}: ReviewDocumentProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfSize, setPdfSize] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);

  // OCR state
  const [enableOcr, setEnableOcr] = useState(context === "finance");
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrResult, setOcrResult] = useState<AIExtractedData | null>(null);

  // Common fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  // Finance-specific fields
  const [montantTTC, setMontantTTC] = useState("");
  const [montantHT, setMontantHT] = useState("");
  const [tva, setTva] = useState("");
  const [tauxTva, setTauxTva] = useState("20");
  const [fournisseur, setFournisseur] = useState("");

  

  // Generate PDF on mount
  useEffect(() => {
    const generatePdf = async () => {
      setIsLoading(true);
      try {
        let result: { blob: Blob; thumbnails: string[] };

        if (importedFile) {
          result = await generatePdfFromFile(importedFile);
          // Set default title from filename
          const fileName = importedFile.name.replace(/\.[^/.]+$/, "");
          setTitle(fileName);
        } else if (pages.length > 0) {
          result = await generatePdfFromPages(pages);
          setTitle(`Scan ${new Date().toLocaleDateString("fr-FR")}`);
        } else {
          throw new Error("No content to process");
        }

        setPdfBlob(result.blob);
        setPdfSize(result.blob.size);
        setThumbnails(result.thumbnails);
      } catch (error) {
        console.error("PDF generation error:", error);
        toast({
          title: "Erreur",
          description: "Impossible de générer le PDF",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    generatePdf();
  }, [pages, importedFile]);

  // Run AI OCR via edge function
  const runOcr = useCallback(async () => {
    if (!enableOcr) return;

    // Need either pages or imported file
    if (pages.length === 0 && !importedFile) return;

    setIsOcrProcessing(true);

    try {
      let imageBase64: string;

      if (pages.length > 0) {
        // Use the first scanned page
        imageBase64 = pages[0].imageData;
      } else if (importedFile) {
        // For imported files, convert to base64
        if (importedFile.type === "application/pdf") {
          // For PDFs, try to get thumbnail from pdfGenerator
          if (thumbnails.length > 0 && !thumbnails[0].includes("PDF")) {
            imageBase64 = thumbnails[0];
          } else {
            // Use raw PDF data
            imageBase64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(importedFile);
            });
          }
        } else {
          // For images, convert directly
          imageBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(importedFile);
          });
        }
      } else {
        throw new Error("No content for OCR");
      }
      
      // Call the AI-powered edge function
      const { data, error } = await supabase.functions.invoke("ocr-receipt", {
        body: { image_base64: imageBase64 },
      });

      if (error) throw error;

      const result = data as AIExtractedData;
      setOcrResult(result);

      // Auto-fill fields from AI extraction
      if (result.montant_ttc) {
        setMontantTTC(result.montant_ttc.toFixed(2).replace(".", ","));
      }
      if (result.montant_ht) {
        setMontantHT(result.montant_ht.toFixed(2).replace(".", ","));
      }
      if (result.tva) {
        setTva(result.tva.toFixed(2).replace(".", ","));
      }
      if (result.taux_tva) {
        setTauxTva(result.taux_tva.toString());
      }
      if (result.date) {
        setDate(result.date);
      }
      if (result.commercant) {
        setFournisseur(result.commercant);
      }
      if (result.categorie && !category) {
        setCategory(result.categorie);
      }
      if (result.description && !title) {
        setTitle(result.description);
      }

      toast({
        title: "Extraction IA terminée",
        description: result.commercant 
          ? `${result.commercant} - ${result.montant_ttc?.toFixed(2) || "?"} €`
          : "Données extraites avec succès",
      });
    } catch (error) {
      console.error("AI OCR error:", error);
      toast({
        title: "Erreur d'extraction",
        description: "Impossible d'analyser la facture",
        variant: "destructive",
      });
    } finally {
      setIsOcrProcessing(false);
    }
  }, [enableOcr, pages, importedFile, thumbnails, category, title]);

  const handleDownload = useCallback(() => {
    if (!pdfBlob) return;

    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "document"}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [pdfBlob, title]);

  const handleShare = useCallback(async () => {
    if (!pdfBlob || !navigator.share) return;

    try {
      const file = new File([pdfBlob], `${title || "document"}.pdf`, {
        type: "application/pdf",
      });
      await navigator.share({
        files: [file],
        title: title || "Document",
      });
    } catch (error) {
      // User cancelled or share not supported
      console.log("Share cancelled or not supported");
    }
  }, [pdfBlob, title]);

  const handleSave = useCallback(async () => {
    if (!pdfBlob || !user) return;

    if (!title.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un nom de document",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une catégorie",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      // Upload PDF to storage
      const fileUrl = await uploadDocumentToStorage(pdfBlob, user.id, context);

      // Create document record
      const montant = montantTTC ? parseFloat(montantTTC.replace(",", ".")) : null;
      const tvaAmount = tva ? parseFloat(tva.replace(",", ".")) : null;
      
      const { data: docData, error: docError } = await supabase
        .from("documents")
        .insert([{
          user_id: user.id,
          client_id: relatedClientId || "00000000-0000-0000-0000-000000000000",
          type_document: context === "finance" ? "facture_frais" : (category as any),
          nom: title,
          url: fileUrl,
          context_source: context,
          page_count: pages.length || 1,
          thumbnails_urls: thumbnails.length > 0 ? thumbnails : null,
          extracted_text: ocrResult?.raw_text || null,
          metadata: {
            originalFileName: importedFile?.name,
            category,
            notes,
            montant: montant,
            montant_ht: montantHT ? parseFloat(montantHT.replace(",", ".")) : null,
            tva: tvaAmount,
            taux_tva: tauxTva ? parseFloat(tauxTva) : null,
            fournisseur: fournisseur || ocrResult?.commercant || null,
          },
        }])
        .select()
        .single();

      if (docError) throw docError;

      // If finance context, create frais record
      if (context === "finance" && montant) {

        const { error: fraisError } = await supabase.from("frais").insert([{
          user_id: user.id,
          montant,
          date_frais: date,
          categorie: category as any,
          description: fournisseur || title,
          document_id: docData.id,
          justificatif_url: fileUrl,
          ocr_data: ocrResult ? {
            montant_ttc: ocrResult.montant_ttc,
            montant_ht: ocrResult.montant_ht,
            tva: ocrResult.tva,
            taux_tva: ocrResult.taux_tva,
            date: ocrResult.date,
            categorie: ocrResult.categorie,
            commercant: ocrResult.commercant,
            description: ocrResult.description,
          } : null,
        }]);

        if (fraisError) throw fraisError;

        toast({
          title: "Facture enregistrée",
          description: `${title} - ${montant.toFixed(2)} €`,
        });
      } else {
        toast({
          title: "Document enregistré",
          description: title,
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le document",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    pdfBlob,
    user,
    title,
    category,
    date,
    notes,
    context,
    pages.length,
    thumbnails,
    importedFile,
    relatedClientId,
    montantTTC,
    tva,
    fournisseur,
    ocrResult,
    onSuccess,
  ]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Génération du PDF...</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="font-semibold">
            {context === "finance" ? "Nouvelle facture" : "Nouveau document"}
          </h2>
          {pdfSize > 0 && (
            <p className="text-xs text-muted-foreground">
              PDF • {formatFileSize(pdfSize)} • {pages.length || 1} page{(pages.length || 1) > 1 ? "s" : ""}
            </p>
          )}
        </div>
        {pdfBlob && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            {navigator.share && (
              <Button variant="ghost" size="icon" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Thumbnails preview */}
          {thumbnails.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {thumbnails.map((thumb, index) => (
                <div
                  key={index}
                  className="relative w-16 h-20 bg-muted rounded overflow-hidden flex-shrink-0 border"
                >
                  <img
                    src={thumb}
                    alt={`Page ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-0.5">
                    {index + 1}
                  </div>
                </div>
              ))}
              {onAddPage && (
                <button
                  onClick={onAddPage}
                  className="w-16 h-20 border-2 border-dashed border-muted-foreground/30 rounded flex items-center justify-center flex-shrink-0 hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </button>
              )}
            </div>
          )}

          {/* OCR Toggle - only for finance context with scanned pages */}
          {context === "finance" && pages.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-primary" />
                  <Label htmlFor="ocr-toggle" className="font-medium">
                    Extraction automatique (OCR)
                  </Label>
                </div>
                <Switch
                  id="ocr-toggle"
                  checked={enableOcr}
                  onCheckedChange={setEnableOcr}
                  disabled={isOcrProcessing}
                />
              </div>
              
              {enableOcr && !ocrResult && !isOcrProcessing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={runOcr}
                  className="w-full"
                >
                  <FileSearch className="h-4 w-4 mr-2" />
                  Lancer l'extraction
                </Button>
              )}

              {isOcrProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    Analyse IA en cours...
                  </div>
                </div>
              )}

              {ocrResult && (
                <div className="text-xs text-green-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Extraction IA terminée
                  {ocrResult.commercant && ` • ${ocrResult.commercant}`}
                </div>
              )}
            </div>
          )}

          {/* Common fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Nom du document *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Facture carburant janvier"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Catégorie *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent className="z-[70] bg-popover max-h-80">
                  {context === "finance" ? (
                    // Simple list for finance categories
                    FINANCE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))
                  ) : (
                    // Grouped categories for client documents
                    Array.from(getGroupedCategories().entries()).map(([groupName, cats]) => (
                      <SelectGroup key={groupName}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">
                          {groupName}
                        </SelectLabel>
                        {cats.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Finance-specific fields */}
            {context === "finance" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="montant">Montant TTC (€)</Label>
                    <Input
                      id="montant"
                      type="text"
                      inputMode="decimal"
                      value={montantTTC}
                      onChange={(e) => setMontantTTC(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tva">TVA (€)</Label>
                    <Input
                      id="tva"
                      type="text"
                      inputMode="decimal"
                      value={tva}
                      onChange={(e) => setTva(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fournisseur">Fournisseur</Label>
                  <Input
                    id="fournisseur"
                    value={fournisseur}
                    onChange={(e) => setFournisseur(e.target.value)}
                    placeholder="Nom du fournisseur"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes additionnelles..."
                rows={3}
              />
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 pb-20 border-t bg-background">
        <Button
          className="w-full"
          size="lg"
          onClick={handleSave}
          disabled={isSaving || !pdfBlob}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Enregistrer
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
