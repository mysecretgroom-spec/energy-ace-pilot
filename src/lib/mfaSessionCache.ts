/**
 * MFA Session Cache - Backend-persisted MFA verification for 6 hours
 * Sessions are stored in the database so they work across multiple devices/connections
 */

import { supabase } from "@/integrations/supabase/client";

// Local cache to avoid repeated DB calls within same session
let localCacheValid: boolean | null = null;
let localCacheCheckedAt: number = 0;
const LOCAL_CACHE_TTL_MS = 30000; // 30 seconds local cache to reduce DB calls

/**
 * Check if MFA is already verified and still valid (within 6 hours)
 * This checks the backend database for cross-device persistence
 */
export async function isMFASessionValid(): Promise<boolean> {
  try {
    // Use local cache if recent to avoid hammering the DB
    const now = Date.now();
    if (localCacheValid !== null && (now - localCacheCheckedAt) < LOCAL_CACHE_TTL_MS) {
      return localCacheValid;
    }

    const { data, error } = await supabase.rpc('check_mfa_session_valid');
    
    if (error) {
      console.error("Error checking MFA session:", error);
      return false;
    }

    localCacheValid = data === true;
    localCacheCheckedAt = now;
    return localCacheValid;
  } catch (error) {
    console.error("Error checking MFA session:", error);
    return false;
  }
}

/**
 * Synchronous check using local cache only (for initial render)
 * Falls back to false if no cache available
 */
export function isMFASessionValidSync(): boolean {
  const now = Date.now();
  if (localCacheValid !== null && (now - localCacheCheckedAt) < LOCAL_CACHE_TTL_MS) {
    return localCacheValid;
  }
  return false;
}

/**
 * Store MFA verification with 6-hour validity in the backend
 */
export async function storeMFAVerification(): Promise<void> {
  try {
    const { error } = await supabase.rpc('store_mfa_verification');
    
    if (error) {
      console.error("Error storing MFA verification:", error);
      return;
    }

    // Update local cache immediately
    localCacheValid = true;
    localCacheCheckedAt = Date.now();
  } catch (error) {
    console.error("Error storing MFA verification:", error);
  }
}

/**
 * Clear MFA session (e.g., on logout)
 */
export async function clearMFASession(): Promise<void> {
  try {
    await supabase.rpc('clear_mfa_session');
  } catch (error) {
    console.error("Error clearing MFA session:", error);
  } finally {
    // Always clear local cache
    localCacheValid = null;
    localCacheCheckedAt = 0;
  }
}

/**
 * Invalidate local cache (force re-check from backend)
 */
export function invalidateLocalCache(): void {
  localCacheValid = null;
  localCacheCheckedAt = 0;
}