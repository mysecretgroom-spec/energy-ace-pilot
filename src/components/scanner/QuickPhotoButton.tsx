import React, { useState, useRef, useEffect, useCallback } from "react";
import { Camera, Upload, Loader2, WifiOff } from "lucide-react";
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
  /** N'affiche que les icônes (gain de place dans l'outil d'étude) */
  iconOnly?: boolean;
}

/** Maximum de photos par catégorie et par étude : elles doivent tenir sur une page du PDF. */
const MAX_PHOTOS_PER_CATEGORY = 9;

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
export async function mergeStudyPhotosIntoPdf(
  userId: string,
  clientId: string,
  etudeId: string
): Promise<Blob | null> {
  // 1. Fetch all individual photo documents for this study
  // Inclut aussi les photos prises pour ce client SANS etude_id (prises avant la création de l'étude)
  const { data: photoDocs, error: fetchError } = await supabase
    .from("documents")
    .select("id, url, nom, type_document, context_source, created_at, etude_id")
    .eq("client_id", clientId)
    .or(`etude_id.eq.${etudeId},etude_id.is.null`)
    .in("type_document", ["photo_toiture", "photo_compteur", "photo_tableau", "photo_chantier"])
    .not("context_source", "in", "(merged_photos,simulation_ia_satellite,simulation_ia_photo)")
    .order("created_at", { ascending: true });

  if (fetchError || !photoDocs || photoDocs.length === 0) return null;

  // Rattache rétroactivement les photos orphelines à l'étude courante
  const orphanIds = photoDocs.filter((d) => !d.etude_id).map((d) => d.id);
  if (orphanIds.length > 0) {
    await supabase.from("documents").update({ etude_id: etudeId }).in("id", orphanIds);
  }

  // 2. Download all images and build combined PDF
  const pdfDoc = await PDFDocument.create();
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const MARGIN = 40;

  const categoryLabels: Record<string, string> = {
    photo_toiture: "Toiture",
    photo_compteur: "Compteur",
    photo_tableau: "Tableau électrique",
    photo_chantier: "Autre photo",
  };

  // 2a. Download and embed all images first
  const embedded: { image: any; label: string }[] = [];
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

      const label =
        doc.context_source === "simulation_pv"
          ? "Projection panneaux solaires (simulation)"
          : categoryLabels[doc.type_document] || doc.nom;

      embedded.push({ image, label });
    } catch (err) {
      console.warn(`Skipping photo ${doc.nom}:`, err);
    }
  }

  // 2b. Adaptive grid layout: max 9 photos per A4 page
  // 1 -> 1x1, 2 -> 2x1, 3-4 -> 2x2, 5-6 -> 3x2, 7-9 -> 3x3
  // NB: les photos de toiture sont limitées à 9 au total côté saisie
  const MAX_PER_PAGE = 9;
  const gridFor = (n: number): { cols: number; rows: number } => {
    if (n <= 1) return { cols: 1, rows: 1 };
    if (n === 2) return { cols: 2, rows: 1 };
    if (n <= 4) return { cols: 2, rows: 2 };
    if (n <= 6) return { cols: 3, rows: 2 };
    return { cols: 3, rows: 3 };
  };

  const GAP = 8;
  const CELL_LABEL = 12;

  for (let start = 0; start < embedded.length; start += MAX_PER_PAGE) {
    const chunk = embedded.slice(start, start + MAX_PER_PAGE);
    const { cols, rows } = gridFor(chunk.length);
    const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

    const availWidth = A4_WIDTH - MARGIN * 2;
    const availHeight = A4_HEIGHT - MARGIN * 2;
    const cellW = (availWidth - GAP * (cols - 1)) / cols;
    const cellH = (availHeight - GAP * (rows - 1)) / rows;

    chunk.forEach(({ image, label }, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cellX = MARGIN + col * (cellW + GAP);
      // PDF y-axis is bottom-up: row 0 is the top
      const cellY = A4_HEIGHT - MARGIN - (row + 1) * cellH - row * GAP;

      // Label at top of the cell
      page.drawText(label, {
        x: cellX,
        y: cellY + cellH - CELL_LABEL + 2,
        size: 8,
      });

      const imgAreaH = cellH - CELL_LABEL;
      const scale = Math.min(cellW / image.width, imgAreaH / image.height, 1);
      const imgWidth = image.width * scale;
      const imgHeight = image.height * scale;
      const x = cellX + (cellW - imgWidth) / 2;
      const y = cellY + (imgAreaH - imgHeight) / 2;

      page.drawImage(image, { x, y, width: imgWidth, height: imgHeight });
    });
  }

  if (pdfDoc.getPageCount() === 0) return null;

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
    return null;
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

  return pdfBlob;
}

export function QuickPhotoButton({
  clientId,
  category,
  label,
  etudeId,
  onPhotoSaved,
  iconOnly = false,
}: QuickPhotoButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isOnline, savePendingDocument } = useOfflineDocuments();

  const refreshCount = useCallback(async () => {
    if (!user) return;
    const docType = (["photo_toiture", "photo_compteur", "photo_tableau"] as const).includes(category as any)
      ? category
      : "photo_chantier";
    let query = supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("type_document", docType)
      .eq("context_source", category);
    if (etudeId) query = query.eq("etude_id", etudeId);
    const { count } = await query;
    const n = count ?? 0;
    setPhotoCount(n);
    setHasPhoto(n > 0);
  }, [user, clientId, category, etudeId]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Limite : 9 photos de toiture maximum par étude
    if (photoCount >= MAX_PHOTOS_PER_CATEGORY) {
      toast({
        variant: "destructive",
        title: "Limite atteinte",
        description: `Maximum ${MAX_PHOTOS_PER_CATEGORY} photos « ${QUICK_PHOTO_LABELS[category]} » par étude (elles doivent tenir sur une page du rapport).`,
      });
      if (e.target) e.target.value = "";
      return;
    }

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
          refreshCount();
          // Individual download only if not in study (study gets merged PDF)
          if (!etudeId) {
            triggerBlobDownload(compressedBlob, `${QUICK_PHOTO_LABELS[category]}_${new Date().toISOString().slice(0, 10)}.jpg`);
          }
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

      refreshCount();

      // If not in study, download individual photo
      if (!etudeId) {
        triggerBlobDownload(compressedBlob, `${QUICK_PHOTO_LABELS[category]}_${new Date().toISOString().slice(0, 10)}.jpg`);
      }

      toast({
        title: "Photo enregistrée",
        description: `${QUICK_PHOTO_LABELS[category]} ajoutée au dossier`,
      });

      onPhotoSaved?.();

      // Merge all study photos into a single combined PDF in storage (no auto-download).
      // The download is triggered manually from the EtudeForm classification section.
      if (etudeId) {
        mergeStudyPhotosIntoPdf(user.id, clientId, etudeId)
          .catch((err) => console.warn("Background merge failed:", err));
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

  const toitureFull = photoCount >= MAX_PHOTOS_PER_CATEGORY;

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
        size={iconOnly ? "icon" : "sm"}
        aria-label={label}
        title={toitureFull ? `Maximum ${MAX_PHOTOS_PER_CATEGORY} photos` : label}
        className={`relative ${iconOnly ? "h-8 w-8" : "gap-1.5 text-xs h-8"} ${hasPhoto ? "border-status-signed text-status-signed" : "border-primary/30"} ${toitureFull ? "opacity-50" : ""}`}
        onClick={toitureFull ? () =>
          toast({
            variant: "destructive",
            title: "Limite atteinte",
            description: `Maximum ${MAX_PHOTOS_PER_CATEGORY} photos « ${QUICK_PHOTO_LABELS[category]} » par étude (elles doivent tenir sur une page du rapport).`,
          })
        : handleCameraClick}
        disabled={isUploading}
      >
        {isUploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : !isOnline ? (
          <WifiOff className="h-3.5 w-3.5" />
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
        {!iconOnly && label}
        {photoCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-signed px-1 text-[10px] font-semibold text-primary-foreground">
            {photoCount}
          </span>
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`h-8 w-8 ${toitureFull ? "opacity-50" : ""}`}
        onClick={toitureFull ? () =>
          toast({
            variant: "destructive",
            title: "Limite atteinte",
            description: `Maximum ${MAX_PHOTOS_PER_CATEGORY} photos « ${QUICK_PHOTO_LABELS[category]} » par étude (elles doivent tenir sur une page du rapport).`,
          })
        : handleUploadClick}
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
