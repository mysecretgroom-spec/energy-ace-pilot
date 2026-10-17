import React, { useState, useCallback } from "react";
import { DocumentMethodModal } from "./DocumentMethodModal";
import { CameraScanner } from "./CameraScanner";
import { CropEditor } from "./CropEditor";
import { PageManager } from "./PageManager";
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

type FlowStep = "method" | "camera" | "crop" | "pages" | "review";

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
  const [step, setStep] = useState<FlowStep>(startWithCamera ? "camera" : "method");
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [currentCapture, setCurrentCapture] = useState<string | null>(null);
  const [importedFile, setImportedFile] = useState<File | null>(null);

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

  const handleMethodSelect = useCallback((method: "scan" | "import") => {
    if (method === "scan") {
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
    const newPages: ScanPage[] = capturedPages.map((p) => ({
      id: p.id,
      imageData: p.imageData,
      thumbnailData: p.thumbnailData,
      rotation: 0,
      cropped: true,
    }));
    setPages((prev) => [...prev, ...newPages]);
    setStep("pages");
  }, []);

  const handleCropComplete = useCallback((croppedImage: string, thumbnail: string) => {
    const newPage: ScanPage = {
      id: crypto.randomUUID(),
      imageData: croppedImage,
      thumbnailData: thumbnail,
      rotation: 0,
      cropped: true,
    };
    setPages((prev) => [...prev, newPage]);
    setCurrentCapture(null);
    setStep("pages");
  }, []);

  const handleSplitPages = useCallback((splitPages: Array<{ croppedImage: string; thumbnail: string }>) => {
    const newPages: ScanPage[] = splitPages.map((p) => ({
      id: crypto.randomUUID(),
      imageData: p.croppedImage,
      thumbnailData: p.thumbnail,
      rotation: 0,
      cropped: true,
    }));
    setPages((prev) => [...prev, ...newPages]);
    setCurrentCapture(null);
    setStep("pages");
  }, []);

  const handleCropCancel = useCallback(() => {
    setCurrentCapture(null);
    setStep("camera");
  }, []);

  const handleAddPage = useCallback(() => {
    setStep("camera");
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
          onCancel={handleCropCancel}
        />
      ) : null;
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
