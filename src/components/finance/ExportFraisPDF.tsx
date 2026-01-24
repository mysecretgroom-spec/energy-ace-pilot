import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { FileDown, Loader2, FileText, Image } from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as pdfjs from "pdfjs-dist";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface FraisItem {
  id: string;
  montant: number;
  date_frais: string;
  categorie: string;
  description?: string | null;
  justificatif_url?: string | null;
}

interface ExportFraisPDFProps {
  frais: FraisItem[];
  periode: string;
}

const categoryLabels: Record<string, string> = {
  carburant: "Carburant",
  peage: "Péage",
  repas: "Repas",
  hotel: "Hôtel",
  parking: "Parking",
  train: "Trains",
  location_vehicule: "Location Véhicule",
  autre: "Autre",
};

async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const blob = await response.blob();
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Error fetching image:", err);
    return null;
  }
}

async function convertPdfPagesToImages(url: string): Promise<string[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Load PDF with timeout
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("PDF loading timeout")), 30000)
    );
    
    const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
    const numPages = pdf.numPages;
    const images: string[] = [];
    
    // Convert each page to an image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Render at high resolution for quality
      const scale = 2;
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext("2d");
      if (!context) continue;
      
      await page.render({
        canvasContext: context,
        viewport,
      }).promise;
      
      // Convert to JPEG for smaller file size
      images.push(canvas.toDataURL("image/jpeg", 0.85));
    }
    
    return images;
  } catch (err) {
    console.error("Error converting PDF to images:", err);
    return [];
  }
}

async function getPublicUrl(signedUrl: string): Promise<string> {
  // Extract the path from signed URL and create a fresh signed URL
  try {
    const url = new URL(signedUrl);
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/(.+)/);
    if (pathMatch) {
      const bucketPath = pathMatch[1];
      const [bucket, ...pathParts] = bucketPath.split('/');
      const filePath = pathParts.join('/');
      
      const { data } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 3600); // 1 hour validity
      
      if (data?.signedUrl) {
        return data.signedUrl;
      }
    }
  } catch (err) {
    console.error("Error creating signed URL:", err);
  }
  return signedUrl;
}

export function ExportFraisPDF({ frais, periode }: ExportFraisPDFProps) {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [includeReceipts, setIncludeReceipts] = useState(false);

  const fraisWithReceipts = frais.filter(f => f.justificatif_url);
  const hasReceipts = fraisWithReceipts.length > 0;

  const handleExport = async () => {
    if (!user || frais.length === 0) {
      toast.error("Aucun frais à exporter");
      return;
    }

    setExporting(true);
    setDialogOpen(false);

    try {
      const total = frais.reduce((sum, f) => sum + f.montant, 0);
      
      // Create PDF document
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFillColor(26, 26, 46); // Primary dark color
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Note de Frais", 14, 22);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(periode.charAt(0).toUpperCase() + periode.slice(1), 14, 32);
      
      // Date export
      doc.setFontSize(10);
      doc.text(`Exporté le ${new Date().toLocaleDateString("fr-FR")}`, pageWidth - 14, 32, { align: "right" });
      
      // Stats summary
      doc.setTextColor(51, 51, 51);
      doc.setFontSize(11);
      let yPos = 55;
      
      doc.setFont("helvetica", "bold");
      doc.text("Résumé", 14, yPos);
      yPos += 8;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`• Nombre de frais : ${frais.length}`, 14, yPos);
      yPos += 6;
      doc.text(`• Justificatifs : ${fraisWithReceipts.length}/${frais.length}`, 14, yPos);
      yPos += 6;
      
      // Total box
      doc.setFillColor(16, 185, 129, 20); // Green tint
      doc.roundedRect(pageWidth - 70, 48, 56, 20, 3, 3, 'F');
      doc.setFontSize(10);
      doc.setTextColor(16, 100, 70);
      doc.text("Total", pageWidth - 42, 55, { align: "center" });
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${total.toFixed(2)} €`, pageWidth - 42, 63, { align: "center" });
      
      yPos += 10;
      
      // Table of expenses
      const tableData = frais.map((f, idx) => [
        (idx + 1).toString(),
        new Date(f.date_frais).toLocaleDateString("fr-FR"),
        categoryLabels[f.categorie] || f.categorie,
        f.description || "-",
        `${f.montant.toFixed(2)} €`,
        f.justificatif_url ? "✓" : "-"
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [["#", "Date", "Catégorie", "Description", "Montant", "Justif."]],
        body: tableData,
        theme: "striped",
        headStyles: {
          fillColor: [26, 26, 46],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 9,
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [51, 51, 51],
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 25 },
          2: { cellWidth: 30 },
          3: { cellWidth: "auto" },
          4: { cellWidth: 25, halign: "right" },
          5: { cellWidth: 15, halign: "center" },
        },
        foot: [[
          "", "", "", "Total",
          `${total.toFixed(2)} €`,
          ""
        ]],
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [26, 26, 46],
          fontStyle: "bold",
          fontSize: 10,
        },
        margin: { left: 14, right: 14 },
      });

      // Add receipts if requested
      if (includeReceipts && hasReceipts) {
        let receiptIndex = 0;
        
        for (const fraisItem of fraisWithReceipts) {
          if (!fraisItem.justificatif_url) continue;
          
          receiptIndex++;
          doc.addPage();
          
          // Header for receipt page
          doc.setFillColor(241, 245, 249);
          doc.rect(0, 0, pageWidth, 25, 'F');
          
          doc.setTextColor(51, 51, 51);
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`Justificatif ${receiptIndex}/${fraisWithReceipts.length}`, 14, 16);
          
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          const receiptInfo = `${new Date(fraisItem.date_frais).toLocaleDateString("fr-FR")} - ${categoryLabels[fraisItem.categorie] || fraisItem.categorie} - ${fraisItem.montant.toFixed(2)} €`;
          doc.text(receiptInfo, pageWidth - 14, 16, { align: "right" });
          
          // Try to embed the receipt (image or PDF)
          const isPdf = fraisItem.justificatif_url.toLowerCase().includes('.pdf');
          
          try {
            const freshUrl = await getPublicUrl(fraisItem.justificatif_url);
            
            if (isPdf) {
              // Convert all PDF pages to images
              const pdfImages = await convertPdfPagesToImages(freshUrl);
              
              if (pdfImages.length > 0) {
                // First page already has header, add image
                const maxWidth = pageWidth - 28;
                const maxHeight = 230;
                
                doc.addImage(pdfImages[0], "JPEG", 14, 35, maxWidth, maxHeight, undefined, "MEDIUM");
                
                if (pdfImages.length > 1) {
                  doc.setFontSize(8);
                  doc.setTextColor(150, 150, 150);
                  doc.text(`(Page 1/${pdfImages.length} du PDF)`, pageWidth / 2, 270, { align: "center" });
                }
                
                // Add remaining pages
                for (let pdfPageIdx = 1; pdfPageIdx < pdfImages.length; pdfPageIdx++) {
                  doc.addPage();
                  
                  // Mini header for continuation pages
                  doc.setFillColor(241, 245, 249);
                  doc.rect(0, 0, pageWidth, 20, 'F');
                  
                  doc.setTextColor(100, 100, 100);
                  doc.setFontSize(10);
                  doc.text(`Justificatif ${receiptIndex} - Page ${pdfPageIdx + 1}/${pdfImages.length}`, 14, 13);
                  
                  doc.addImage(pdfImages[pdfPageIdx], "JPEG", 14, 28, maxWidth, maxHeight, undefined, "MEDIUM");
                }
              } else {
                doc.setTextColor(150, 150, 150);
                doc.setFontSize(11);
                doc.text("Aperçu PDF non disponible", pageWidth / 2, 100, { align: "center" });
              }
            } else {
              // Fetch image directly
              const base64 = await fetchImageAsBase64(freshUrl);
              
              if (base64) {
                const imgFormat = base64.includes("image/png") ? "PNG" : "JPEG";
                const maxWidth = pageWidth - 28;
                const maxHeight = 230;
                
                doc.addImage(base64, imgFormat, 14, 35, maxWidth, maxHeight, undefined, "MEDIUM");
              } else {
                doc.setTextColor(150, 150, 150);
                doc.setFontSize(11);
                doc.text("Image non disponible", pageWidth / 2, 100, { align: "center" });
                
                if (fraisItem.description) {
                  doc.setFontSize(10);
                  doc.text(`Description : ${fraisItem.description}`, pageWidth / 2, 115, { align: "center" });
                }
              }
            }
          } catch (imgErr) {
            console.error("Error adding receipt:", imgErr);
            doc.setTextColor(150, 150, 150);
            doc.text("Erreur lors du chargement du justificatif", pageWidth / 2, 100, { align: "center" });
          }
        }
      }

      // Footer on all pages
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i}/${pageCount} - Généré par DébalePro`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" }
        );
      }

      // Save the PDF
      const filename = `note-de-frais-${periode.replace(/\s/g, "-")}.pdf`;
      doc.save(filename);

      toast.success("PDF généré avec succès");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  if (frais.length === 0) {
    return (
      <Button variant="outline" size="icon" disabled>
        <FileDown className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" disabled={exporting}>
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Exporter la note de frais
          </DialogTitle>
          <DialogDescription>
            Générez un PDF récapitulatif de vos frais
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="p-3 bg-muted rounded-lg space-y-1">
            <p className="text-sm font-medium">{periode}</p>
            <p className="text-xs text-muted-foreground">
              {frais.length} frais • Total : {frais.reduce((s, f) => s + f.montant, 0).toFixed(2)} €
            </p>
          </div>
          
          {hasReceipts && (
            <div className="flex items-start space-x-3 p-3 border rounded-lg">
              <Checkbox
                id="include-receipts"
                checked={includeReceipts}
                onCheckedChange={(checked) => setIncludeReceipts(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="include-receipts" className="flex items-center gap-2 cursor-pointer">
                  <Image className="h-4 w-4" />
                  Inclure les justificatifs
                </Label>
                <p className="text-xs text-muted-foreground">
                  {fraisWithReceipts.length} justificatif{fraisWithReceipts.length > 1 ? "s" : ""} disponible{fraisWithReceipts.length > 1 ? "s" : ""}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <Button onClick={handleExport} disabled={exporting} className="w-full gap-2">
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Télécharger le PDF
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
