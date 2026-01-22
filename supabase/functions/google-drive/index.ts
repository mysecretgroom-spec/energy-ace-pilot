import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_API_BASE = "https://www.googleapis.com/upload/drive/v3";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getUserIdFromAuth(req.headers.get("Authorization"));
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Google not connected", code: "GOOGLE_NOT_CONNECTED" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "list";

    let result;

    switch (action) {
      case "list": {
        // List files
        const pageSize = url.searchParams.get("pageSize") || "20";
        const folderId = url.searchParams.get("folderId");
        const mimeType = url.searchParams.get("mimeType");
        const pageToken = url.searchParams.get("pageToken");

        let query = "trashed = false";
        if (folderId) {
          query += ` and '${folderId}' in parents`;
        }
        if (mimeType) {
          query += ` and mimeType = '${mimeType}'`;
        }

        const params = new URLSearchParams({
          pageSize,
          q: query,
          fields: "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, thumbnailLink, parents)",
          orderBy: "modifiedTime desc",
        });
        if (pageToken) params.append("pageToken", pageToken);

        const response = await fetch(
          `${DRIVE_API_BASE}/files?${params}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Drive list error:", error);
          throw new Error("Failed to list files");
        }

        result = await response.json();
        break;
      }

      case "get": {
        // Get file metadata
        const fileId = url.searchParams.get("fileId");
        if (!fileId) {
          throw new Error("fileId is required");
        }

        const response = await fetch(
          `${DRIVE_API_BASE}/files/${fileId}?fields=*`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Drive get error:", error);
          throw new Error("Failed to get file");
        }

        result = await response.json();
        break;
      }

      case "download": {
        // Download file content
        const fileId = url.searchParams.get("fileId");
        if (!fileId) {
          throw new Error("fileId is required");
        }

        const response = await fetch(
          `${DRIVE_API_BASE}/files/${fileId}?alt=media`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Drive download error:", error);
          throw new Error("Failed to download file");
        }

        // Return the file with proper headers
        const contentType = response.headers.get("Content-Type") || "application/octet-stream";
        return new Response(response.body, {
          headers: {
            ...corsHeaders,
            "Content-Type": contentType,
          },
        });
      }

      case "upload": {
        // Upload a file
        const body = await req.json();
        const { name, mimeType, content, folderId } = body;

        // Create file metadata
        const metadata: any = { name, mimeType };
        if (folderId) {
          metadata.parents = [folderId];
        }

        // First, create the file with metadata
        const metadataRes = await fetch(
          `${UPLOAD_API_BASE}/files?uploadType=multipart`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "multipart/related; boundary=boundary",
            },
            body: [
              "--boundary",
              "Content-Type: application/json; charset=UTF-8",
              "",
              JSON.stringify(metadata),
              "--boundary",
              `Content-Type: ${mimeType}`,
              "Content-Transfer-Encoding: base64",
              "",
              content, // base64 encoded content
              "--boundary--",
            ].join("\r\n"),
          }
        );

        if (!metadataRes.ok) {
          const error = await metadataRes.text();
          console.error("Drive upload error:", error);
          throw new Error("Failed to upload file");
        }

        result = await metadataRes.json();
        break;
      }

      case "createFolder": {
        // Create a folder
        const body = await req.json();
        const { name, parentId } = body;

        const metadata: any = {
          name,
          mimeType: "application/vnd.google-apps.folder",
        };
        if (parentId) {
          metadata.parents = [parentId];
        }

        const response = await fetch(
          `${DRIVE_API_BASE}/files`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(metadata),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Drive createFolder error:", error);
          throw new Error("Failed to create folder");
        }

        result = await response.json();
        break;
      }

      case "delete": {
        // Delete a file
        const fileId = url.searchParams.get("fileId");
        if (!fileId) {
          throw new Error("fileId is required");
        }

        const response = await fetch(
          `${DRIVE_API_BASE}/files/${fileId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok && response.status !== 204) {
          const error = await response.text();
          console.error("Drive delete error:", error);
          throw new Error("Failed to delete file");
        }

        result = { success: true };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Google Drive error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
