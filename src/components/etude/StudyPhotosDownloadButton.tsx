import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { mergeStudyPhotosIntoPdf } from "@/components/scanner/QuickPhotoButton";
import { useToast } from "@/hooks/use-toast";

interface StudyPhotosDownloadButtonProps {
  clientId: string;
  etudeId: string | null;
  className?: string;
}

function triggerBlobDownload(blob: Blob, fileName: string) {
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
}

export function StudyPhotosDownloadButton({
  clientId,
  etudeId,
  className,
}: StudyPhotosDownloadButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    if (!user || !etudeId) {
      toast({
        variant: "destructive",
        title: "Étude non enregistrée",
        description: "Enregistrez l'étude avant de télécharger les photos.",
      });
      return;
    }

    setLoading(true);
    try {
      // Check if a merged PDF already exists in DB; if yes, download it directly
      const { data: existing } = await supabase
        .from("documents")
        .select("url, nom")
        .eq("client_id", clientId)
        .eq("etude_id", etudeId)
        .eq("context_source", "merged_photos")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let blob: Blob | null = null;
      let fileName = `Photos_visite_${new Date().toLocaleDateString("fr-FR").replace(/\//g, "-")}.pdf`;

      if (existing?.url) {
        try {
          const resp = await fetch(existing.url);
          if (resp.ok) {
            blob = await resp.blob();
            if (existing.nom) fileName = existing.nom;
          }
        } catch (err) {
          console.warn("Existing merged PDF fetch failed, regenerating:", err);
        }
      }

      // Fallback: regenerate the merged PDF on the fly
      if (!blob) {
        blob = await mergeStudyPhotosIntoPdf(user.id, clientId, etudeId);
      }

      if (!blob) {
        toast({
          variant: "destructive",
          title: "Aucune photo",
          description: "Aucune photo d'étude n'a été enregistrée pour ce dossier.",
        });
        return;
      }

      triggerBlobDownload(blob, fileName);
      toast({
        title: "Téléchargement lancé",
        description: "Le PDF des photos d'étude a été téléchargé.",
      });
    } catch (err) {
      console.error("Download study photos error:", err);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de générer le PDF des photos.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleDownload}
      disabled={loading || !etudeId}
      className={className}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Camera className="h-4 w-4" />
          <Download className="h-4 w-4" />
        </>
      )}
      Photos d'études
    </Button>
  );
}
