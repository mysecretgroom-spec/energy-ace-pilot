import React, { useState, useCallback } from "react";
import { ArrowLeft, Layers, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraCapture } from "./CameraCapture";
import { CropEditor } from "@/components/scanner/CropEditor";
import { FiltersPanel } from "./FiltersPanel";
import { PagesTray } from "./PagesTray";
import { ExportPanel } from "./ExportPanel";
import { OCRPanel } from "./OCRPanel";
import { useScanSession } from "../hooks/useScanSession";
import { useWorkerPipeline } from "../hooks/useWorkerPipeline";
import { normalizeOrientation } from "../utils/exif";
import { downscale, canvasToBlob, releaseCanvas, loadImageToCanvas, pixelsToCanvas, generateThumbnail, getImageData } from "../utils/image";
import { defaultQuad, rescaleQuad } from "../utils/quad";
import type { Quad, FilterPreset, ScanPage } from "../types";
import { MAX_ANALYSIS_DIM, MAX_PREVIEW_DIM } from "../types";
import { useNavigate } from "react-router-dom";

type Step = "camera" | "crop" | "edit" | "export";

export default function DocScannerPage() {
  const navigate = useNavigate();
  const session = useScanSession();
  const { warpImage } = useWorkerPipeline();
  const [step, setStep] = useState<Step>("camera");
  const [pendingImage, setPendingImage] = useState<{
    blobUrl: string;
    size: { w: number; h: number };
    quad: Quad | null;
  } | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [scanNet, setScanNet] = useState(false);

  const activePage = session.pages.find((p) => p.id === session.activePageId) || null;

  // Handle capture from camera
  const handleCapture = useCallback(async (canvas: HTMLCanvasElement, quad: Quad | null, enhance = false) => {
    setScanNet(enhance);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    const blobUrl = URL.createObjectURL(blob);

    // Scale quad from analysis dim to original if present
    let scaledQuad = quad;
    if (quad) {
      const analysisScale = Math.min(MAX_ANALYSIS_DIM / canvas.width, MAX_ANALYSIS_DIM / canvas.height, 1);
      const analysisW = Math.round(canvas.width * analysisScale);
      const analysisH = Math.round(canvas.height * analysisScale);
      scaledQuad = rescaleQuad(quad, { w: analysisW, h: analysisH }, { w: canvas.width, h: canvas.height });
    }

    setPendingImage({
      blobUrl,
      size: { w: canvas.width, h: canvas.height },
      quad: scaledQuad,
    });
    releaseCanvas(canvas);
    setStep("crop");
  }, []);

  // Handle import from file
  const handleImport = useCallback(async (file: File) => {
    setScanNet(false);
    const { canvas, width, height } = await normalizeOrientation(file);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
    const blobUrl = URL.createObjectURL(blob);

    setPendingImage({
      blobUrl,
      size: { w: width, h: height },
      quad: null,
    });
    releaseCanvas(canvas);
    setStep("crop");
  }, []);

  // Handle filter change
  const handleFilterChange = useCallback(async (preset: FilterPreset) => {
    if (!activePage) return;
    session.updatePage(activePage.id, { filterPreset: preset });
  }, [activePage, session]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (step === "crop") {
      setPendingImage(null);
      if (session.pages.length > 0) setStep("edit");
      else setStep("camera");
    } else if (step === "edit" && session.pages.length === 0) {
      setStep("camera");
    } else {
      navigate(-1);
    }
  }, [step, session.pages.length, navigate]);

  // Camera step
  if (step === "camera") {
    return (
      <CameraCapture
        onCapture={handleCapture}
        onImport={handleImport}
        onCancel={handleCancel}
        pageCount={session.pages.length}
      />
    );
  }

  // Crop step
  if (step === "crop" && pendingImage) {
    return (
      <CropEditor
        imageData={pendingImage.blobUrl}
        initialEnhance
        initialCorners={pendingImage.quad ? {
          topLeft: { x: pendingImage.quad.topLeft.x / pendingImage.size.w, y: pendingImage.quad.topLeft.y / pendingImage.size.h },
          topRight: { x: pendingImage.quad.topRight.x / pendingImage.size.w, y: pendingImage.quad.topRight.y / pendingImage.size.h },
          bottomRight: { x: pendingImage.quad.bottomRight.x / pendingImage.size.w, y: pendingImage.quad.bottomRight.y / pendingImage.size.h },
          bottomLeft: { x: pendingImage.quad.bottomLeft.x / pendingImage.size.w, y: pendingImage.quad.bottomLeft.y / pendingImage.size.h },
        } : undefined}
        onComplete={async (processedImage) => {
          const canvas = await loadImageToCanvas(processedImage);
          const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
          const url = URL.createObjectURL(blob);
          const size = { w: canvas.width, h: canvas.height };
          session.addPage({ id: crypto.randomUUID(), originalBlobUrl: pendingImage.blobUrl,
            originalSize: pendingImage.size, normalizedBlobUrl: url, warpedPreviewUrl: url,
            quad: defaultQuad(size.w, size.h), filterPreset: "original", rotation: 0 });
          releaseCanvas(canvas);
          setPendingImage(null);
          setStep("edit");
        }}
        onCancel={() => {
          setPendingImage(null);
          if (session.pages.length > 0) setStep("edit");
          else setStep("camera");
        }}
      />
    );
  }

  // Edit step (main view with pages, filters, export)
  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b">
        <Button variant="ghost" size="sm" onClick={handleCancel}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Retour
        </Button>
        <span className="text-sm font-medium text-foreground">
          {session.pages.length} page{session.pages.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowOCR(!showOCR)}>
            OCR
          </Button>
          <Button size="sm" onClick={() => setShowExport(!showExport)}>
            Export
          </Button>
        </div>
      </div>

      {/* Main content: active page preview */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {activePage ? (
          <img
            src={activePage.warpedPreviewUrl || activePage.normalizedBlobUrl || activePage.originalBlobUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
          />
        ) : (
          <div className="text-muted-foreground text-sm">Aucune page</div>
        )}
      </div>

      {/* Filters */}
      {activePage && !showExport && !showOCR && (
        <FiltersPanel
          imageSrc={activePage.warpedPreviewUrl || activePage.normalizedBlobUrl || activePage.originalBlobUrl}
          activeFilter={activePage.filterPreset}
          onSelectFilter={handleFilterChange}
        />
      )}

      {/* Export panel */}
      {showExport && (
        <div className="border-t bg-card">
          <ExportPanel
            pages={session.pages}
            settings={session.exportSettings}
            onSettingsChange={session.setExportSettings}
            onClose={() => setShowExport(false)}
          />
        </div>
      )}

      {/* OCR panel */}
      {showOCR && (
        <div className="border-t bg-card">
          <OCRPanel
            page={activePage}
            onFieldsExtracted={(pageId, text, fields) => {
              session.updatePage(pageId, { ocrText: text, ocrFields: fields });
            }}
          />
        </div>
      )}

      {/* Pages tray */}
      <PagesTray
        pages={session.pages}
        activePageId={session.activePageId}
        onSelectPage={session.setActivePageId}
        onAddPage={() => setStep("camera")}
        onRemovePage={session.removePage}
        onReorder={session.reorderPages}
      />
    </div>
  );
}
