import React, { useState, useCallback } from "react";
import { DocumentMethodModal } from "./DocumentMethodModal";
import { CameraScanner } from "./CameraScanner";
import { CropEditor } from "./CropEditor";
import { PageManager } from "./PageManager";
import { BatchCropReview } from "./BatchCropReview";
import { NativeBurstCapture } from "./NativeBurstCapture";
import { ReviewDocument } from "./ReviewDocument";
import type { DocumentContext, ScanPage } from "./types";
import type { DetectedQuad } from "./hooks/useRealtimeEdgeDetection";

interface AddDocumentFlowProps {
  context: DocumentContext;
  relatedClientId?: string;
  relatedProjectId?: string;
  relatedEtudeId?: string;
  startWithCamera?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  isOpen: boolean;
}

type FlowStep = "method" | "native" | "camera" | "crop" | "batch" | "pages" | "review";

export function AddDocumentFlow({
  context,
  relatedClientId,
  relatedProjectId,
  relatedEtudeId,
  startWithCamera = false,
  onSuccess,
  onCancel,
  isOpen,
}: AddDocumentFlowProps) {
  const [step, setStep] = useState<FlowStep>(startWithCamera ? "native" : "method");
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [currentCapture, setCurrentCapture] = useState<string | null>(null);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  // Photos prises en rafale, en attente de validation du rognage une par une.
  const [cropQueue, setCropQueue] = useState<string[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  const [batchImages, setBatchImages] = useState<string[]>([]);

  const resetFlow = useCallback(() => {
    setStep("method");
    setPages([]);
    setCurrentCapture(null);
    setImportedFile(null);
  }, []);

  const handleClose = useCallback(() => {
    resetFlow();
    onCancel?.();
  }, [resetFlow, onCancel]);

  const handleMethodSelect = useCallback((method: "scan" | "native" | "import") => {
    if (method === "native") {
      setStep("native");
    } else if (method === "scan") {
      setStep("camera");
    }
    // Import is handled directly via file input in DocumentMethodModal
  }, []);

  const handleFileImport = useCallback((file: File) => {
    setImportedFile(file);
    setStep("review");
  }, []);

  const handleCapture = useCallback((imageData: string, detectedQuad?: DetectedQuad) => {
    setCurrentCapture(imageData);
    setStep("crop");
  }, []);

  /** New: receive auto-cropped pages directly from CameraScanner */
  const handleMultiCapture = useCallback((capturedPages: Array<{ id: string; imageData: string; thumbnailData: string }>) => {
    if (capturedPages.length === 0) return;
    // Toutes les photos sont pré-rognées puis revues ensemble dans un carrousel.
    setBatchImages(capturedPages.map((p) => p.imageData));
    setStep("batch");
  }, []);

  const handleBatchDone = useCallback((newPages: ScanPage[]) => {
    setPages((prev) => [...prev, ...newPages]);
    setBatchImages([]);
    // Moins d'étapes : après « Tout valider », on passe directement à l'enregistrement.
    setStep("review");
  }, []);

  /** Passe à la photo suivante de la rafale, ou à la liste des pages quand tout est validé. */
  const advanceQueue = useCallback(() => {
    if (cropQueue.length > 0) {
      setCurrentCapture(cropQueue[0]);
      setCropQueue((q) => q.slice(1));
    } else {
      setCurrentCapture(null);
      setQueueTotal(0);
      setStep("pages");
    }
  }, [cropQueue]);

  const handleSkipCrop = useCallback((original: string, thumbnail: string) => {
    setPages((prev) => [...prev, { id: crypto.randomUUID(), imageData: original, thumbnailData: thumbnail, rotation: 0, cropped: false }]);
    advanceQueue();
  }, [advanceQueue]);

  const handleCropComplete = useCallback((croppedImage: string, thumbnail: string) => {
    const newPage: ScanPage = {
      id: crypto.randomUUID(),
      imageData: croppedImage,
      thumbnailData: thumbnail,
      rotation: 0,
      cropped: true,
    };
    setPages((prev) => [...prev, newPage]);
    if (queueTotal > 0) { advanceQueue(); return; }
    setCurrentCapture(null);
    setStep("pages");
  }, [queueTotal, advanceQueue]);

  const handleSplitPages = useCallback((splitPages: Array<{ croppedImage: string; thumbnail: string }>) => {
    const newPages: ScanPage[] = splitPages.map((p) => ({
      id: crypto.randomUUID(),
      imageData: p.croppedImage,
      thumbnailData: p.thumbnail,
      rotation: 0,
      cropped: true,
    }));
    setPages((prev) => [...prev, ...newPages]);
    if (queueTotal > 0) { advanceQueue(); return; }
    setCurrentCapture(null);
    setStep("pages");
  }, [queueTotal, advanceQueue]);

  const handleCropCancel = useCallback(() => {
    setCurrentCapture(null);
    setStep("camera");
  }, []);

  const handleAddPage = useCallback(() => {
    setStep("native");
  }, []);

  const handleFinishScan = useCallback(() => {
    setStep("review");
  }, []);

  const handlePagesUpdate = useCallback((updatedPages: ScanPage[]) => {
    setPages(updatedPages);
  }, []);

  const handleSuccess = useCallback(() => {
    resetFlow();
    onSuccess?.();
  }, [resetFlow, onSuccess]);

  const handleBackToPages = useCallback(() => {
    if (pages.length > 0) {
      setStep("pages");
    } else {
      setStep("method");
    }
  }, [pages.length]);

  if (!isOpen) return null;

  switch (step) {
    case "method":
      return (
        <DocumentMethodModal
          isOpen={true}
          context={context}
          onSelectMethod={handleMethodSelect}
          onFileImport={handleFileImport}
          onClose={handleClose}
        />
      );
    case "native":
      return (
        <NativeBurstCapture
          onDone={(imgs) => { setBatchImages(imgs); setStep("batch"); }}
          onCancel={pages.length > 0 ? () => setStep("review") : handleClose}
        />
      );
    case "camera":
      return (
        <CameraScanner
          onCapture={handleCapture}
          onCancel={pages.length > 0 ? () => setStep("pages") : handleClose}
          pageCount={pages.length}
          onMultiCapture={handleMultiCapture}
        />
      );
    case "crop":
      return currentCapture ? (
        <CropEditor
          imageData={currentCapture}
          onComplete={handleCropComplete}
          onSplitPages={handleSplitPages}
          onCancel={queueTotal > 0 ? advanceQueue : handleCropCancel}
          onSkipCrop={queueTotal > 0 ? handleSkipCrop : undefined}
          progressLabel={queueTotal > 1 ? `Photo ${queueTotal - cropQueue.length} / ${queueTotal}` : undefined}
        />
      ) : null;
    case "batch":
      return (
        <BatchCropReview
          images={batchImages}
          onDone={handleBatchDone}
          onCancel={() => { setBatchImages([]); setStep(pages.length > 0 ? "review" : "native"); }}
        />
      );
    case "pages":
      return (
        <PageManager
          pages={pages}
          onPagesChange={handlePagesUpdate}
          onAddPage={handleAddPage}
          onFinish={handleFinishScan}
          onCancel={handleClose}
        />
      );
    case "review":
      return (
        <ReviewDocument
          context={context}
          pages={pages}
          importedFile={importedFile}
          relatedClientId={relatedClientId}
          relatedProjectId={relatedProjectId}
          relatedEtudeId={relatedEtudeId}
          onSuccess={handleSuccess}
          onCancel={pages.length > 0 ? handleBackToPages : handleClose}
          onAddPage={pages.length > 0 ? handleAddPage : undefined}
        />
      );
    default:
      return null;
  }
}
