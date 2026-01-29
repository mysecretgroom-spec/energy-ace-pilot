import { supabase } from "@/integrations/supabase/client";
import type { DocumentContext } from "../types";

export async function uploadDocumentToStorage(
  pdfBlob: Blob,
  userId: string,
  context: DocumentContext
): Promise<string> {
  const timestamp = Date.now();
  // Path format: {userId}/{context}/{timestamp}.pdf
  // This ensures RLS policy (auth.uid() = foldername[1]) is satisfied
  const fileName = `${userId}/${context}/${timestamp}.pdf`;

  console.log(`[uploadService] Uploading to receipts/${fileName}`);

  const { data, error } = await supabase.storage
    .from("receipts")
    .upload(fileName, pdfBlob, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    throw new Error(`Failed to upload document: ${error.message}`);
  }

  // Get signed URL with retry logic (sometimes there's propagation delay)
  let signedUrl: string | null = null;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      console.log(`[uploadService] Retrying signed URL (attempt ${attempt + 1}/3)...`);
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
    
    const { data: urlData, error } = await supabase.storage
      .from("receipts")
      .createSignedUrl(data.path, 60 * 60 * 24 * 365); // Use returned path
    
    if (!error && urlData?.signedUrl) {
      signedUrl = urlData.signedUrl;
      break;
    }
    
    console.warn(`[uploadService] Signed URL attempt ${attempt + 1} failed:`, error);
  }
  
  if (!signedUrl) {
    throw new Error("Failed to generate document URL after retries");
  }

  return signedUrl;
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
