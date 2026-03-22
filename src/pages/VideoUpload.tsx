import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, Upload, Copy, Check, Video, Trash2, Loader2, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";

interface UploadedVideo {
  name: string;
  url: string;
  size: number;
  path: string;
}

export default function VideoUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedVideos, setUploadedVideos] = useState<UploadedVideo[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleUpload = async (file: File) => {
    if (!user) {
      toast.error("Vous devez être connecté");
      return;
    }

    const maxSize = 500 * 1024 * 1024; // 500 MB
    if (file.size > maxSize) {
      toast.error("Fichier trop volumineux (max 500 MB)");
      return;
    }

    const allowedTypes = ["video/mp4", "video/quicktime", "video/webm", "video/avi", "video/mkv"];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm|avi|mkv)$/i)) {
      toast.error("Format vidéo non supporté");
      return;
    }

    setUploading(true);
    setProgress(0);

    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "mp4";
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${user.id}/${timestamp}_${sanitizedName}`;

    try {
      // Use XHR for progress tracking
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expirée");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/storage/v1/object/videos/${filePath}`;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
        xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.timeout = 10 * 60 * 1000; // 10 min

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Upload échoué (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error("Erreur réseau"));
        xhr.ontimeout = () => reject(new Error("Timeout (10 min)"));
        xhr.send(file);
      });

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("videos")
        .getPublicUrl(filePath);

      const newVideo: UploadedVideo = {
        name: file.name,
        url: urlData.publicUrl,
        size: file.size,
        path: filePath,
      };

      setUploadedVideos((prev) => [newVideo, ...prev]);
      toast.success("Vidéo uploadée avec succès !");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur d'upload";
      toast.error(msg);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success("Lien copié !");
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const deleteVideo = async (video: UploadedVideo) => {
    const { error } = await supabase.storage.from("videos").remove([video.path]);
    if (error) {
      toast.error("Erreur lors de la suppression");
      return;
    }
    setUploadedVideos((prev) => prev.filter((v) => v.path !== video.path));
    toast.success("Vidéo supprimée");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <MobileLayout
      title="Vidéos"
      showBack
      onBack={() => navigate(-1)}
    >
      <div className="p-4 space-y-4 pb-24">
        {/* Upload zone */}
        <Card>
          <CardContent className="p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/avi,.mp4,.mov,.webm,.avi,.mkv"
              className="hidden"
              onChange={handleFileChange}
            />

            {uploading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Upload en cours...
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground text-right">{progress}%</p>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-muted-foreground/30 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary/50 transition-colors"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">Choisir une vidéo</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    MP4, MOV, WebM, AVI • Max 500 MB
                  </p>
                </div>
              </button>
            )}
          </CardContent>
        </Card>

        {/* Uploaded videos */}
        {uploadedVideos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Vidéos uploadées</h3>
            {uploadedVideos.map((video) => (
              <Card key={video.path}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Video className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{video.name}</p>
                        <p className="text-xs text-muted-foreground">{formatSize(video.size)}</p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => deleteVideo(video)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Video preview */}
                  <video
                    src={video.url}
                    controls
                    className="w-full rounded-lg bg-black max-h-48"
                    preload="metadata"
                  />

                  {/* URL and actions */}
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={video.url}
                      className="text-xs h-9"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-9"
                      onClick={() => copyUrl(video.url)}
                    >
                      {copiedUrl === video.url ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 h-9"
                      asChild
                    >
                      <a href={video.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
