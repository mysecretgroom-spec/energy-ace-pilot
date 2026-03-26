import React, { useState, useRef } from "react";
import { Camera, Upload, Check, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineDocuments } from "@/hooks/useOfflineDocuments";
import imageCompression from "browser-image-compression";
import { PDFDocument } from "pdf-lib";

import { QuickPhotoCategory, QUICK_PHOTO_LABELS, PhotoCategory } from "@/lib/documentCategories";

// Re-export for backward compatibility
export type { PhotoCategory };

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.8,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/jpeg" as const,
};

interface QuickPhotoButtonProps {
  clientId: string;
  category: QuickPhotoCategory;
  label: string;
  etudeId?: string | null;
  onPhotoSaved?: () => void;
}

/** Auto-download a blob to device Downloads folder */
function triggerBlobDownload(blob: Blob, fileName: string) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    }, 200);
  } catch (e) {
    console.warn("Auto-download failed:", e);
  }
}

/**
 * Merges all study photo documents into a single PDF.
 * Called after each photo upload to maintain one combined PDF.
 */
async function mergeStudyPhotosIntoPdf(
  userId: string,
  clientId: string,
  etudeId: string
): Promise<void> {
  // 1. Fetch all individual photo documents for this study
  const { data: photoDocs, error: fetchError } = await supabase
    .from("documents")
    .select("id, url, nom, type_document, context_source, created_at")
    .eq("client_id", clientId)
    .eq("etude_id", etudeId)
    .in("type_document", ["photo_toiture", "photo_compteur", "photo_tableau", "photo_chantier"])
    .neq("context_source", "merged_photos")
    .order("created_at", { ascending: true });

  if (fetchError || !photoDocs || photoDocs.length === 0) return;

  // 2. Download all images and build combined PDF
  const pdfDoc = await PDFDocument.create();
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const MARGIN = 40;
  const LABEL_HEIGHT = 20;

  const categoryLabels: Record<string, string> = {
    photo_toiture: "Toiture",
    photo_compteur: "Compteur",
    photo_tableau: "Tableau électrique",
    photo_chantier: "Photo chantier",
  };

  for (const doc of photoDocs) {
    try {
      // Get signed URL for private bucket
      const urlPath = doc.url.includes("/documents/")
        ? doc.url.split("/documents/").pop()
        : null;

      let imageBytes: Uint8Array | null = null;

      if (urlPath) {
        // Try signed URL first
        const { data: signedData } = await supabase.storage
          .from("documents")
          .createSignedUrl(decodeURIComponent(urlPath), 60);

        if (signedData?.signedUrl) {
          const resp = await fetch(signedData.signedUrl);
          if (resp.ok) {
            imageBytes = new Uint8Array(await resp.arrayBuffer());
          }
        }
      }

      // Fallback: try public URL directly
      if (!imageBytes) {
        try {
          const resp = await fetch(doc.url);
          if (resp.ok) {
            imageBytes = new Uint8Array(await resp.arrayBuffer());
          }
        } catch {
          console.warn(`Could not fetch photo: ${doc.nom}`);
          continue;
        }
      }

      if (!imageBytes || imageBytes.length < 100) continue;

      // Detect image type and embed
      let image;
      // Check magic bytes for PNG (89 50 4E 47)
      if (imageBytes[0] === 0x89 && imageBytes[1] === 0x50) {
        image = await pdfDoc.embedPng(imageBytes);
      } else {
        image = await pdfDoc.embedJpg(imageBytes);
      }

      // Create A4 page
      const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

      // Add label at top
      const label = categoryLabels[doc.type_document] || doc.nom;
      page.drawText(label, {
        x: MARGIN,
        y: A4_HEIGHT - MARGIN,
        size: 14,
      });

      // Scale image to fit within margins
      const availWidth = A4_WIDTH - MARGIN * 2;
      const availHeight = A4_HEIGHT - MARGIN * 2 - LABEL_HEIGHT;
      const scale = Math.min(availWidth / image.width, availHeight / image.height, 1);
      const imgWidth = image.width * scale;
      const imgHeight = image.height * scale;

      // Center horizontally, place below label
      const x = (A4_WIDTH - imgWidth) / 2;
      const y = A4_HEIGHT - MARGIN - LABEL_HEIGHT - imgHeight;

      page.drawImage(image, { x, y, width: imgWidth, height: imgHeight });
    } catch (err) {
      console.warn(`Skipping photo ${doc.nom}:`, err);
    }
  }

  if (pdfDoc.getPageCount() === 0) return;

  // 3. Save combined PDF
  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
  const timestamp = Date.now();
  const fileName = `${userId}/${clientId}/photos_etude_${etudeId.slice(0, 8)}_${timestamp}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(fileName, pdfBlob, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (uploadError) {
    console.error("Failed to upload merged PDF:", uploadError);
    return;
  }

  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(fileName);

  // 4. Delete old merged PDF if exists, then insert new one
  await supabase
    .from("documents")
    .delete()
    .eq("client_id", clientId)
    .eq("etude_id", etudeId)
    .eq("context_source", "merged_photos");

  await supabase.from("documents").insert({
    user_id: userId,
    client_id: clientId,
    etude_id: etudeId,
    nom: `Photos visite technique - ${new Date().toLocaleDateString("fr-FR")}.pdf`,
    type_document: "photo_chantier",
    url: urlData.publicUrl,
    taille_bytes: pdfBlob.size,
    mime_type: "application/pdf",
    context_source: "merged_photos",
    page_count: pdfDoc.getPageCount(),
  });
}

export function QuickPhotoButton({
  clientId,
  category,
  label,
  etudeId,
  onPhotoSaved,
}: QuickPhotoButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isOnline, savePendingDocument } = useOfflineDocuments();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);

    try {
      // Compress the image (avoids I/O errors with large files on mobile)
      let compressedBlob: Blob;
      try {
        compressedBlob = await imageCompression(file, COMPRESSION_OPTIONS);
      } catch (compressionError) {
        console.warn("Compression failed, using original:", compressionError);
        compressedBlob = file;
      }

      // If offline, save to IndexedDB
      if (!isOnline) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageData = event.target?.result as string;
          await savePendingDocument({
            clientId,
            nom: `${QUICK_PHOTO_LABELS[category]} - ${new Date().toLocaleDateString("fr-FR")}.jpg`,
            typeDocument: category as "photo_chantier",
            imageData,
            mimeType: "image/jpeg",
            contextSource: category,
            etudeId: etudeId || null,
          });
          setHasPhoto(true);
          // Auto-download to device even offline
          triggerPhotoDownload(compressedBlob, category);
          onPhotoSaved?.();
        };
        reader.readAsDataURL(compressedBlob);
        setIsUploading(false);
        if (e.target) e.target.value = "";
        return;
      }

      // Online: upload compressed image directly (no PDF wrapping)
      const timestamp = Date.now();
      const fileName = `${user.id}/${clientId}/${category}_${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, compressedBlob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Save individual photo document
      const docType = (["photo_toiture", "photo_compteur", "photo_tableau"] as const).includes(category as any)
        ? category
        : "photo_chantier";

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        client_id: clientId,
        etude_id: etudeId || null,
        nom: `${QUICK_PHOTO_LABELS[category]} - ${new Date().toLocaleDateString("fr-FR")}.jpg`,
        type_document: docType,
        url: urlData.publicUrl,
        taille_bytes: compressedBlob.size,
        mime_type: "image/jpeg",
        context_source: category,
      });

      if (dbError) {
        console.error("Database insert error:", dbError);
        throw dbError;
      }

      setHasPhoto(true);
      // Auto-download to device
      triggerPhotoDownload(compressedBlob, category);
      toast({
        title: "Photo enregistrée",
        description: `${QUICK_PHOTO_LABELS[category]} ajoutée au dossier`,
      });

      onPhotoSaved?.();

      // Merge all study photos into a single PDF (background, non-blocking)
      if (etudeId) {
        mergeStudyPhotosIntoPdf(user.id, clientId, etudeId).catch((err) =>
          console.warn("Background merge failed:", err)
        );
      }
    } catch (error) {
      console.error("Erreur upload photo:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'enregistrer la photo",
      });
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        className={`gap-1.5 text-xs h-8 ${hasPhoto ? "border-status-signed text-status-signed" : "border-primary/30"}`}
        onClick={handleCameraClick}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : hasPhoto ? (
          <Check className="h-3.5 w-3.5" />
        ) : !isOnline ? (
          <WifiOff className="h-3.5 w-3.5" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={handleUploadClick}
        disabled={isUploading}
      >
        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </div>
  );
}

interface QuickPhotoGroupProps {
  clientId: string;
  onPhotoSaved?: () => void;
}

export function QuickPhotoGroup({ clientId, onPhotoSaved }: QuickPhotoGroupProps) {
  return (
    <div className="flex flex-wrap gap-2 py-2">
      <QuickPhotoButton
        clientId={clientId}
        category="photo_toiture"
        label="Toiture"
        onPhotoSaved={onPhotoSaved}
      />
      <QuickPhotoButton
        clientId={clientId}
        category="photo_compteur"
        label="Compteur"
        onPhotoSaved={onPhotoSaved}
      />
      <QuickPhotoButton
        clientId={clientId}
        category="photo_tableau"
        label="Tableau"
        onPhotoSaved={onPhotoSaved}
      />
    </div>
  );
}
