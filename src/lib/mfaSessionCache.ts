/**
 * MFA Session Cache - Stores MFA verification status for 6 hours
 * This is separated to avoid circular dependencies between useAuth and useMFAChallenge
 */

const MFA_VERIFIED_KEY = "debalepro_mfa_verified";
const MFA_VALIDITY_HOURS = 6;

interface MFAVerifiedData {
  userId: string;
  verifiedAt: number;
  expiresAt: number;
}

/**
 * Check if MFA is already verified and still valid (within 6 hours)
 */
export function isMFASessionValid(): boolean {
  try {
    const stored = localStorage.getItem(MFA_VERIFIED_KEY);
    if (!stored) return false;

    const data: MFAVerifiedData = JSON.parse(stored);
    const now = Date.now();

    // Check if session is still valid
    if (data.expiresAt > now) {
      return true;
    }

    // Session expired, clear it
    localStorage.removeItem(MFA_VERIFIED_KEY);
    return false;
  } catch {
    localStorage.removeItem(MFA_VERIFIED_KEY);
    return false;
  }
}

/**
 * Store MFA verification with 6-hour validity
 */
export function storeMFAVerification(userId: string): void {
  try {
    const now = Date.now();
    const data: MFAVerifiedData = {
      userId,
      verifiedAt: now,
      expiresAt: now + (MFA_VALIDITY_HOURS * 60 * 60 * 1000), // 6 hours
    };

    localStorage.setItem(MFA_VERIFIED_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Error storing MFA verification:", error);
  }
}

/**
 * Clear MFA session (e.g., on logout)
 */
export function clearMFASession(): void {
  localStorage.removeItem(MFA_VERIFIED_KEY);
}
