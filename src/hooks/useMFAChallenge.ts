import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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
function isMFASessionValid(): boolean {
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
async function storeMFAVerification(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = Date.now();
    const data: MFAVerifiedData = {
      userId: user.id,
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

interface UseMFAChallengeReturn {
  isMFARequired: boolean;
  isVerifying: boolean;
  verifyCode: string;
  setVerifyCode: (code: string) => void;
  checkMFARequired: () => Promise<boolean>;
  verifyMFA: () => Promise<boolean>;
  resetMFA: () => void;
  factorId: string | null;
  isAlreadyVerified: boolean;
}

/**
 * Hook for MFA challenges on sensitive operations (security settings, account changes)
 * MFA verification is cached for 6 hours to avoid repeated prompts
 */
export function useMFAChallenge(): UseMFAChallengeReturn {
  const [isMFARequired, setIsMFARequired] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(() => isMFASessionValid());

  const checkMFARequired = useCallback(async (): Promise<boolean> => {
    try {
      // First check if we have a valid cached MFA session
      if (isMFASessionValid()) {
        setIsAlreadyVerified(true);
        setIsMFARequired(false);
        return false; // MFA not required, already verified
      }

      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactor = data.totp.find((f) => f.status === "verified");
      if (totpFactor) {
        setFactorId(totpFactor.id);
        setIsMFARequired(true);
        setIsAlreadyVerified(false);
        return true;
      }
      
      setIsMFARequired(false);
      return false;
    } catch (error) {
      console.error("Error checking MFA status:", error);
      setIsMFARequired(false);
      return false;
    }
  }, []);

  const verifyMFA = useCallback(async (): Promise<boolean> => {
    if (!factorId || verifyCode.length !== 6) return false;

    setIsVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // MFA verified successfully - store in cache with 6h validity
      await storeMFAVerification();
      setIsAlreadyVerified(true);
      setIsMFARequired(false);
      setVerifyCode("");
      return true;
    } catch (error) {
      console.error("MFA verification error:", error);
      setVerifyCode("");
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [factorId, verifyCode]);

  const resetMFA = useCallback(() => {
    setIsMFARequired(false);
    setVerifyCode("");
    setIsVerifying(false);
  }, []);

  return {
    isMFARequired,
    isVerifying,
    verifyCode,
    setVerifyCode,
    checkMFARequired,
    verifyMFA,
    resetMFA,
    factorId,
    isAlreadyVerified,
  };
}
