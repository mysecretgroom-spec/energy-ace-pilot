import { supabase } from "@/integrations/supabase/client";
import type { DocumentContext } from "../types";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
const MAX_RETRIES = 3;

async function uploadWithXHR(
  bucket: string,
  filePath: string,
  blob: Blob,
  token: string
): Promise<{ path: string }> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "false");
    // Let the browser set Content-Type with boundary for FormData,
    // or set it explicitly for raw blob
    xhr.setRequestHeader("Content-Type", blob.type || "application/pdf");
    xhr.timeout = 5 * 60 * 1000; // 5 min timeout

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          resolve({ path: resp.Key || filePath });
        } catch {
          resolve({ path: filePath });
        }
      } else {
        let errMsg = `Upload failed (${xhr.status})`;
        try {
          const errBody = JSON.parse(xhr.responseText);
          errMsg = errBody.message || errBody.error || errMsg;
        } catch { /* ignore */ }
        reject(new Error(errMsg));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out (5 min)"));

    xhr.send(blob);
  });
}

async function uploadWithRetry(
  fileName: string,
  pdfBlob: Blob,
  token: string
): Promise<{ path: string }> {
  const isLarge = pdfBlob.size > 6 * 1024 * 1024;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (isLarge) {
        // Use XHR for large files – avoids fetch body size limits on some mobile browsers
        console.log(`[uploadService] XHR upload attempt ${attempt}/${MAX_RETRIES}`);
        return await uploadWithXHR("receipts", fileName, pdfBlob, token);
      } else {
        const { data, error } = await supabase.storage
          .from("receipts")
          .upload(fileName, pdfBlob, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (error) throw error;
        return data as { path: string };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[uploadService] Attempt ${attempt} failed: ${msg}`);
      if (attempt === MAX_RETRIES) throw err;
      // Exponential backoff: 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error("Upload failed after retries");
}

export async function uploadDocumentToStorage(
  pdfBlob: Blob,
  userId: string,
  context: DocumentContext
): Promise<string> {
  // Verify session is valid before upload
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error("[uploadService] Session error:", sessionError);
    throw new Error("Session expirée, veuillez vous reconnecter");
  }

  const currentUserId = session.user.id;
  if (currentUserId !== userId) {
    console.warn(`[uploadService] userId mismatch: passed=${userId}, session=${currentUserId}`);
  }

  const timestamp = Date.now();
  const fileName = `${currentUserId}/${context}/${timestamp}.pdf`;

  const sizeMB = (pdfBlob.size / (1024 * 1024)).toFixed(2);
  console.log(`[uploadService] Uploading to receipts/${fileName} (${sizeMB} MB)`);

  const data = await uploadWithRetry(fileName, pdfBlob, session.access_token);

  console.log("[uploadService] Upload successful, path:", data.path);

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
