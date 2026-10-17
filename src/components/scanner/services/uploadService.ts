import { supabase } from "@/integrations/supabase/client";
import type { DocumentContext } from "../types";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks
const MAX_RETRIES = 3;

function normalizeStoragePath(path: string, bucket: string): string {
  const cleaned = decodeURIComponent(path).split("?")[0].replace(/^\/+/, "");
  return cleaned.startsWith(`${bucket}/`) ? cleaned.slice(bucket.length + 1) : cleaned;
}

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
    // POST with multipart/form-data is the supported way for the Supabase Storage REST API
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("x-upsert", "false");
    // IMPORTANT: do NOT set Content-Type — the browser must set the multipart boundary itself
    xhr.timeout = 5 * 60 * 1000; // 5 min timeout

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resp = JSON.parse(xhr.responseText);
          resolve({ path: resp.Key || resp.path || filePath });
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

    const form = new FormData();
    // Wrap the Blob in a File so a name + correct content-type are advertised
    const file = blob instanceof File
      ? blob
      : new File([blob], filePath.split("/").pop() || "upload.pdf", {
          type: blob.type || "application/pdf",
        });
    form.append("file", file);
    xhr.send(form);
  });
}

/**
 * Verify that an uploaded object is actually present and non-empty in storage.
 * Returns the real byte size from the bucket, or throws if not found / empty.
 */
async function verifyUploadedObject(
  bucket: string,
  filePath: string,
  expectedSize: number
): Promise<void> {
  // Try a few times — Cloudflare cache / replication can take a moment after upload
  let lastErr: string | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      const dir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";
      const name = filePath.includes("/") ? filePath.slice(filePath.lastIndexOf("/") + 1) : filePath;
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(dir, { search: name, limit: 1 });
      if (error) {
        lastErr = error.message;
      } else {
        const found = data?.find((f) => f.name === name);
        if (found) {
          const realSize = (found.metadata as any)?.size ?? 0;
          if (realSize > 0 && (expectedSize === 0 || realSize >= expectedSize * 0.9)) {
            return; // OK
          }
          lastErr = `Uploaded object is empty or truncated (got ${realSize} / expected ${expectedSize})`;
        } else {
          lastErr = "Uploaded object not found in bucket listing";
        }
      }
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error(lastErr || "Upload verification failed");
}

async function uploadWithRetry(
  fileName: string,
  pdfBlob: Blob,
  token: string,
  bucket: string
): Promise<{ path: string }> {
  const isLarge = pdfBlob.size > 6 * 1024 * 1024;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      let result: { path: string };
      if (isLarge) {
        // Use XHR for large files – avoids fetch body size limits on some mobile browsers
        console.log(`[uploadService] XHR upload attempt ${attempt}/${MAX_RETRIES}`);
        result = await uploadWithXHR(bucket, fileName, pdfBlob, token);
      } else {
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(fileName, pdfBlob, {
            contentType: "application/pdf",
            upsert: false,
          });
        if (error) throw error;
        result = data as { path: string };
      }

      // Post-upload verification: ensure the file is actually present and non-empty.
      // This catches silent failures where the API returns 200 but stores 0 bytes.
      await verifyUploadedObject(bucket, fileName, pdfBlob.size);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[uploadService] Attempt ${attempt} failed: ${msg}`);
      if (attempt === MAX_RETRIES) throw err;
      // Best-effort cleanup of any partial/empty object before retry
      try {
        await supabase.storage.from(bucket).remove([fileName]);
      } catch { /* ignore */ }
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
  const bucket = context === "client_docs" ? "documents" : "receipts";
  const fileName = `${currentUserId}/${context}/${timestamp}.pdf`;

  const sizeMB = (pdfBlob.size / (1024 * 1024)).toFixed(2);
  console.log(`[uploadService] Uploading document (${sizeMB} MB)`);

  const data = await uploadWithRetry(fileName, pdfBlob, session.access_token, bucket);
  const normalizedPath = normalizeStoragePath(data.path, bucket);

  console.log("[uploadService] Upload successful, path:", normalizedPath);

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(normalizedPath);

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
    let pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/(receipts|documents)\/(.+)/);
    // Fallback to public URL format
    if (!pathMatch) {
      pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(receipts|documents)\/(.+)/);
    }
    
    if (!pathMatch) {
      console.warn("Could not extract path from URL:", fileUrl);
      return;
    }

    const bucket = pathMatch[1];
    const filePath = decodeURIComponent(pathMatch[2].split("?")[0]);

    const { error } = await supabase.storage
      .from(bucket)
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
