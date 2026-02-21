import React, { useState, useCallback } from "react";
import { Download, Share2, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QualitySelector } from "./QualitySelector";
import type { ScanPage, ExportSettings, ExportFormat, PdfMode, CompressionQuality } from "../types";
import { QUALITY_MAP } from "../types";
import { generateMultiPagePdf } from "../utils/pdf";
import { loadImageToCanvas, canvasToBlob, releaseCanvas } from "../utils/image";
import { toast } from "sonner";

interface ExportPanelProps {
  pages: ScanPage[];
  settings: ExportSettings;
  onSettingsChange: (s: Partial<ExportSettings>) => void;
  onClose: () => void;
}

export function ExportPanel({ pages, settings, onSettingsChange, onClose }: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (pages.length === 0) return;
    setExporting(true);

    try {
      if (settings.format === "pdf") {
        const blob = await generateMultiPagePdf(pages, settings);
        downloadBlob(blob, `Scan_${formatDate()}.pdf`);
      } else {
        // Export first page as image
        const page = pages[0];
        const src = page.warpedPreviewUrl || page.normalizedBlobUrl || page.originalBlobUrl;
        const canvas = await loadImageToCanvas(src);
        const mime = settings.format === "png" ? "image/png" : "image/jpeg";
        const quality = QUALITY_MAP[settings.quality];
        const blob = await canvasToBlob(canvas, mime, quality);
        const ext = settings.format === "png" ? "png" : "jpg";
        downloadBlob(blob, `Scan_${formatDate()}.${ext}`);
        releaseCanvas(canvas);
      }
      toast.success("Export réussi !");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erreur export. Essayez une qualité inférieure.");
    } finally {
      setExporting(false);
    }
  }, [pages, settings]);

  const handleShare = useCallback(async () => {
    if (!navigator.share || pages.length === 0) return;
    setExporting(true);
    try {
      const blob = await generateMultiPagePdf(pages, settings);
      const file = new File([blob], `Scan_${formatDate()}.pdf`, { type: "application/pdf" });
      await navigator.share({ files: [file], title: "Document scanné" });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error("Partage échoué");
      }
    } finally {
      setExporting(false);
    }
  }, [pages, settings]);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Export</h3>

      {/* Format selector */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">Format</label>
        <div className="flex gap-2">
          {([
            { key: "pdf", label: "PDF", icon: FileText },
            { key: "jpeg", label: "JPEG", icon: Image },
            { key: "png", label: "PNG", icon: Image },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => onSettingsChange({ format: key })}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all ${
                settings.format === key
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* PDF Mode */}
      {settings.format === "pdf" && (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground font-medium">Mode PDF</label>
          <div className="flex gap-2">
            {([
              { key: "a4", label: "A4 (centré)" },
              { key: "original", label: "Taille originale" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => onSettingsChange({ pdfMode: key })}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all ${
                  settings.pdfMode === key
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quality */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground font-medium">Qualité</label>
        <QualitySelector value={settings.quality} onChange={(q) => onSettingsChange({ quality: q })} />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button onClick={handleExport} disabled={exporting} className="flex-1">
          <Download className="w-4 h-4 mr-2" />
          {exporting ? "Export..." : "Télécharger"}
        </Button>
        {typeof navigator.share === "function" && (
          <Button variant="outline" onClick={handleShare} disabled={exporting}>
            <Share2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
