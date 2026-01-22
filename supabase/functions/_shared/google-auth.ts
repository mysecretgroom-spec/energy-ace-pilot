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
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  
  const { data: tokens, error } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();
  
  if (error || !tokens) {
    console.error("No tokens found for user:", userId);
    return null;
  }
  
  // Check if token is expired (with 5 min buffer)
  const expiresAt = tokens.expires_at ? new Date(tokens.expires_at) : null;
  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minutes
  
  if (!expiresAt || now.getTime() > expiresAt.getTime() - buffer) {
    // Token expired or expiring soon, refresh it
    if (!tokens.refresh_token) {
      console.error("No refresh token available");
      return null;
    }
    
    const refreshed = await refreshGoogleToken(tokens.refresh_token);
    if (!refreshed) return null;
    
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
  
  return tokens.access_token;
}

// CORS headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
