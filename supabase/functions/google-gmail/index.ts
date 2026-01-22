import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, getUserIdFromAuth, getValidAccessToken } from "../_shared/google-auth.ts";

const GMAIL_API_BASE = "https://www.googleapis.com/gmail/v1";

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
        // List recent emails
        const maxResults = url.searchParams.get("maxResults") || "20";
        const query = url.searchParams.get("q") || "";
        const labelIds = url.searchParams.get("labelIds") || "INBOX";

        const params = new URLSearchParams({
          maxResults,
          labelIds,
        });
        if (query) params.append("q", query);

        const response = await fetch(
          `${GMAIL_API_BASE}/users/me/messages?${params}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Gmail list error:", error);
          throw new Error("Failed to fetch emails");
        }

        const data = await response.json();
        
        // Fetch message details for each message
        const messages = await Promise.all(
          (data.messages || []).slice(0, 10).map(async (msg: { id: string }) => {
            const detailRes = await fetch(
              `${GMAIL_API_BASE}/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
              {
                headers: { Authorization: `Bearer ${accessToken}` },
              }
            );
            if (!detailRes.ok) return null;
            return detailRes.json();
          })
        );

        result = {
          messages: messages.filter(Boolean).map((msg: any) => {
            const headers = msg.payload?.headers || [];
            return {
              id: msg.id,
              threadId: msg.threadId,
              snippet: msg.snippet,
              subject: headers.find((h: any) => h.name === "Subject")?.value,
              from: headers.find((h: any) => h.name === "From")?.value,
              date: headers.find((h: any) => h.name === "Date")?.value,
            };
          }),
          resultSizeEstimate: data.resultSizeEstimate,
        };
        break;
      }

      case "get": {
        // Get a specific email
        const messageId = url.searchParams.get("messageId");
        if (!messageId) {
          throw new Error("messageId is required");
        }

        const response = await fetch(
          `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Gmail get error:", error);
          throw new Error("Failed to fetch email");
        }

        result = await response.json();
        break;
      }

      case "send": {
        // Send an email
        const body = await req.json();
        const { to, subject, message } = body;

        // Build raw email
        const email = [
          `To: ${to}`,
          `Subject: ${subject}`,
          "Content-Type: text/html; charset=utf-8",
          "",
          message,
        ].join("\r\n");

        // Base64 URL encode
        const encodedEmail = btoa(unescape(encodeURIComponent(email)))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");

        const response = await fetch(
          `${GMAIL_API_BASE}/users/me/messages/send`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: encodedEmail }),
          }
        );

        if (!response.ok) {
          const error = await response.text();
          console.error("Gmail send error:", error);
          throw new Error("Failed to send email");
        }

        result = await response.json();
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
    console.error("Gmail error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
