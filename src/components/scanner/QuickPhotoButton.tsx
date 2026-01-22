import React, { useState, useRef } from "react";
import { Camera, Upload, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import imageCompression from "browser-image-compression";

export type PhotoCategory = "tableau_electrique" | "compteur" | "toiture" | "autre";

interface QuickPhotoButtonProps {
  clientId: string;
  category: PhotoCategory;
  label: string;
  onPhotoSaved?: () => void;
}

const categoryLabels: Record<PhotoCategory, string> = {
  tableau_electrique: "Tableau électrique",
  compteur: "Compteur électrique",
  toiture: "Toiture",
  autre: "Photo",
};

export function QuickPhotoButton({
  clientId,
  category,
  label,
  onPhotoSaved,
}: QuickPhotoButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [hasPhoto, setHasPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);

    try {
      // Compress image
      const compressedFile = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });

      // Generate unique filename
      const timestamp = Date.now();
      const extension = file.name.split(".").pop() || "jpg";
      const fileName = `${clientId}/${category}_${timestamp}.${extension}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, compressedFile, {
          contentType: compressedFile.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Save document reference in database
      const { error: dbError } = await supabase.from("documents").insert({
        user_id: user.id,
        client_id: clientId,
        nom: `${categoryLabels[category]} - ${new Date().toLocaleDateString("fr-FR")}`,
        type_document: "photo_chantier",
        url: urlData.publicUrl,
        taille_bytes: compressedFile.size,
        mime_type: compressedFile.type,
        context_source: category,
      });

      if (dbError) throw dbError;

      setHasPhoto(true);
      toast({
        title: "Photo enregistrée",
        description: `${categoryLabels[category]} ajouté au dossier client`,
      });

      onPhotoSaved?.();
    } catch (error) {
      console.error("Erreur upload photo:", error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'enregistrer la photo",
      });
    } finally {
      setIsUploading(false);
      // Reset input
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
      {/* Hidden file inputs */}
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

      {/* Camera button */}
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
        ) : (
          <Camera className="h-3.5 w-3.5" />
        )}
        {label}
      </Button>

      {/* Upload from gallery */}
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
        category="toiture"
        label="Toiture"
        onPhotoSaved={onPhotoSaved}
      />
      <QuickPhotoButton
        clientId={clientId}
        category="compteur"
        label="Compteur"
        onPhotoSaved={onPhotoSaved}
      />
      <QuickPhotoButton
        clientId={clientId}
        category="tableau_electrique"
        label="Tableau"
        onPhotoSaved={onPhotoSaved}
      />
    </div>
  );
}
