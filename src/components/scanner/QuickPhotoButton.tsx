import React, { useState, useRef } from "react";
import { Camera, Upload, Check, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useOfflineDocuments } from "@/hooks/useOfflineDocuments";
import { generatePdfFromFile } from "@/components/scanner/services/pdfGenerator";

import { QuickPhotoCategory, QUICK_PHOTO_LABELS, PhotoCategory } from "@/lib/documentCategories";

// Re-export for backward compatibility
export type { PhotoCategory };

interface QuickPhotoButtonProps {
  clientId: string;
  category: QuickPhotoCategory;
  label: string;
  etudeId?: string | null;
  onPhotoSaved?: () => void;
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
      // Convertir l'image en PDF
      const { blob: pdfBlob, thumbnails } = await generatePdfFromFile(file);
      
      // If offline, save to IndexedDB
      if (!isOnline) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const pdfData = event.target?.result as string;
          await savePendingDocument({
            clientId,
            nom: `${QUICK_PHOTO_LABELS[category]} - ${new Date().toLocaleDateString("fr-FR")}.pdf`,
            typeDocument: "photo_chantier",
            imageData: pdfData,
            mimeType: "application/pdf",
            contextSource: category,
          });
          setHasPhoto(true);
          onPhotoSaved?.();
        };
        reader.readAsDataURL(pdfBlob);
        setIsUploading(false);
        if (e.target) e.target.value = "";
        return;
      }

      // Online: upload PDF directly
      // Le chemin doit commencer par user.id pour respecter la politique RLS
      const timestamp = Date.now();
      const fileName = `${user.id}/${clientId}/${category}_${timestamp}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Use the actual category as type_document (photo_toiture, photo_compteur, photo_tableau)
      // Fallback to "photo_chantier" only for unknown categories
      const docType = (["photo_toiture", "photo_compteur", "photo_tableau"] as const).includes(category as any) 
        ? category 
        : "photo_chantier";

      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        client_id: clientId,
        etude_id: etudeId || null,
        nom: `${QUICK_PHOTO_LABELS[category]} - ${new Date().toLocaleDateString("fr-FR")}.pdf`,
        type_document: docType,
        url: urlData.publicUrl,
        taille_bytes: pdfBlob.size,
        mime_type: "application/pdf",
        context_source: category,
        thumbnails_urls: thumbnails.length > 0 ? thumbnails : null,
      });

      if (dbError) {
        console.error("Database insert error:", dbError);
        throw dbError;
      }

      setHasPhoto(true);
      toast({
        title: "Photo enregistrée",
        description: `${QUICK_PHOTO_LABELS[category]} converti en PDF et ajouté au dossier`,
      });

      onPhotoSaved?.();
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
