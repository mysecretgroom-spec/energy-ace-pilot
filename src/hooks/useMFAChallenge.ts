import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isMFASessionValid, storeMFAVerification } from "@/lib/mfaSessionCache";

// Re-export for backward compatibility
export { clearMFASession } from "@/lib/mfaSessionCache";

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

      // MFA verified successfully - get user ID and store in cache with 6h validity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        storeMFAVerification(user.id);
      }
      
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
