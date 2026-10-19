import { supabase } from "@/integrations/supabase/client";

export interface PreviewMedia {
  id: string;
  nom: string;
  url: string;
  mime_type?: string | null;
  type_document?: string;
  thumbnails_urls?: string[] | null;
  initial_page?: number;
}

export function previewKind(item: PreviewMedia): "pdf" | "image" | "unknown" {
  const value = `${item.mime_type ?? ""} ${item.url.split("?")[0]}`.toLowerCase();
  if (value.includes("application/pdf") || /\.pdf(?:$|\s)/.test(value)) return "pdf";
  if (value.includes("image/") || /\.(jpe?g|png|webp|gif|avif|heic)(?:$|\s)/.test(value)) return "image";
  if (item.url.startsWith("blob:")) return "image";
  return "unknown";
}

export async function resolvePreviewUrl(url: string): Promise<string> {
  if (/^(data:|blob:|\/)/.test(url)) return url;
  const match = url.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
  if (match) {
    const { data, error } = await supabase.storage.from(match[1]).createSignedUrl(decodeURIComponent(match[2]), 3600);
    if (data?.signedUrl) return data.signedUrl;
    if (match[1] !== "documents" && error) throw error;
    return url;
  }
  if (!url.startsWith("http")) return supabase.storage.from("documents").getPublicUrl(url).data.publicUrl;
  return url;
}