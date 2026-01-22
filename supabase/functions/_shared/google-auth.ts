// Shared Google OAuth utilities for Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Required scopes for full Google integration
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  scopes?: string[];
}

// Create Supabase admin client
export function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// Get user ID from Authorization header
export async function getUserIdFromAuth(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null;
  
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!
  );
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  
  return user.id;
}

// Refresh Google access token
export async function refreshGoogleToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  
  if (!clientId || !clientSecret) {
    console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    return null;
  }
  
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error("Token refresh failed:", error);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Token refresh error:", error);
    return null;
  }
}

// Get valid Google access token (refresh if needed)
// First tries the google_tokens table, then falls back to Supabase Auth identities
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  // First, try to get tokens from our custom table
  const { data: tokens, error: tokensError } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();
  
  if (!tokensError && tokens?.access_token) {
    // Check if token is expired (with 5 min buffer)
    const expiresAt = tokens.expires_at ? new Date(tokens.expires_at) : null;
    const now = new Date();
    const buffer = 5 * 60 * 1000; // 5 minutes
    
    if (!expiresAt || now.getTime() > expiresAt.getTime() - buffer) {
      // Token expired or expiring soon, refresh it
      if (tokens.refresh_token) {
        const refreshed = await refreshGoogleToken(tokens.refresh_token);
        if (refreshed) {
          // Update tokens in database
          const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
          await supabase
            .from("google_tokens")
            .update({
              access_token: refreshed.access_token,
              expires_at: newExpiresAt.toISOString(),
            })
            .eq("user_id", userId);
          
          return refreshed.access_token;
        }
      }
    } else {
      return tokens.access_token;
    }
  }
  
  // Fallback: Try to get token from Supabase Auth user identities
  console.log("Trying to get token from Supabase Auth identities...");
  
  const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
  
  if (userError || !userData?.user) {
    console.error("Error getting user:", userError);
    return null;
  }
  
  // Find Google identity
  const googleIdentity = userData.user.identities?.find(
    (identity) => identity.provider === "google"
  );
  
  if (!googleIdentity?.identity_data) {
    console.error("No Google identity found for user");
    return null;
  }
  
  // The identity_data may contain the provider token info
  // But Supabase Auth manages refresh internally, we need to use the provider token from session
  // Unfortunately, provider_token is only available during the OAuth callback
  
  // Check if there's identity data we can use
  console.log("Google identity found, but provider_token needs to be captured during OAuth callback");
  console.log("User connected via Google, identity provider:", googleIdentity.provider);
  
  // Since we can't access the token directly, return null and handle appropriately
  return null;
}

// CORS headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
