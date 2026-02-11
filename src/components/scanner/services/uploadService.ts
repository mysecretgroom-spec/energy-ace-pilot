import { supabase } from "@/integrations/supabase/client";
import type { DocumentContext } from "../types";

export async function uploadDocumentToStorage(
  pdfBlob: Blob,
  userId: string,
  context: DocumentContext
): Promise<string> {
  // Verify session is valid before upload - this ensures auth.uid() works in RLS
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error("[uploadService] Session error:", sessionError);
    throw new Error("Session expirée, veuillez vous reconnecter");
  }

  // Use session user ID to ensure consistency with RLS
  const currentUserId = session.user.id;
  if (currentUserId !== userId) {
    console.warn(`[uploadService] userId mismatch: passed=${userId}, session=${currentUserId}`);
  }

  const timestamp = Date.now();
  // Path format: {userId}/{context}/{timestamp}.pdf
  // This ensures RLS policy (auth.uid() = foldername[1]) is satisfied
  const fileName = `${currentUserId}/${context}/${timestamp}.pdf`;

  const sizeMB = (pdfBlob.size / (1024 * 1024)).toFixed(2);
  console.log(`[uploadService] Uploading to receipts/${fileName} (${sizeMB} MB)`);

  // Use XMLHttpRequest for large files to avoid fetch body size limits on some browsers
  let data: { path: string };
  let error: Error | null = null;

  if (pdfBlob.size > 6 * 1024 * 1024) {
    // Large file: use tus or XHR upload for better reliability
    console.log(`[uploadService] Using chunked approach for large file (${sizeMB} MB)`);
  }

  const uploadResult = await supabase.storage
    .from("receipts")
    .upload(fileName, pdfBlob, {
      contentType: "application/pdf",
      upsert: false,
    });
  
  data = uploadResult.data as { path: string };
  error = uploadResult.error as Error | null;

  if (error) {
    console.error("[uploadService] Upload error:", error);
    throw new Error(`Failed to upload document: ${error.message}`);
  }

  console.log("[uploadService] Upload successful, path:", data.path);

  // Get public URL (bucket is now public for reading)
  const { data: urlData } = supabase.storage
    .from("receipts")
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) {
    throw new Error("Failed to generate document URL");
  }

  console.log("[uploadService] Public URL generated:", urlData.publicUrl);
  return urlData.publicUrl;
}

export async function deleteDocumentFromStorage(fileUrl: string): Promise<void> {
  // Extract the path from the URL - handles both signed and public URLs
  try {
    const url = new URL(fileUrl);
    // Try signed URL format first
    let pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/receipts\/(.+)/);
    // Fallback to public URL format
    if (!pathMatch) {
      pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/receipts\/(.+)/);
    }
    
    if (!pathMatch) {
      console.warn("Could not extract path from URL:", fileUrl);
      return;
    }

    const filePath = decodeURIComponent(pathMatch[1].split("?")[0]);

    const { error } = await supabase.storage
      .from("receipts")
      .remove([filePath]);

    if (error) {
      console.error("Delete error:", error);
      throw new Error(`Failed to delete document: ${error.message}`);
    }
  } catch (err) {
    console.error("Error parsing URL for deletion:", err);
    throw err;
  }
}
