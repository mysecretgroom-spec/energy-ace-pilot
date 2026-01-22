import { supabase } from "@/integrations/supabase/client";
import type { DocumentContext } from "../AddDocumentFlow";

export async function uploadDocumentToStorage(
  pdfBlob: Blob,
  userId: string,
  context: DocumentContext
): Promise<string> {
  const timestamp = Date.now();
  const fileName = `${context}/${userId}/${timestamp}.pdf`;

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

  // Get the public URL or signed URL
  const { data: urlData } = await supabase.storage
    .from("receipts")
    .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year validity

  if (!urlData?.signedUrl) {
    throw new Error("Failed to generate document URL");
  }

  return urlData.signedUrl;
}

export async function deleteDocumentFromStorage(fileUrl: string): Promise<void> {
  // Extract the path from the URL
  const url = new URL(fileUrl);
  const pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/receipts\/(.+)/);
  
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
}
