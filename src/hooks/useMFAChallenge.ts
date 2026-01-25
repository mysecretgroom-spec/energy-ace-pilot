import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  isMFASessionValid, 
  isMFASessionValidSync, 
  storeMFAVerification,
  invalidateLocalCache 
} from "@/lib/mfaSessionCache";

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
  isCheckingSession: boolean;
}

/**
 * Hook for MFA challenges on sensitive operations (security settings, account changes)
 * MFA verification is cached in backend for 6 hours to work across devices
 */
export function useMFAChallenge(): UseMFAChallengeReturn {
  const [isMFARequired, setIsMFARequired] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  // Use sync check for initial value, will be updated async
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(() => isMFASessionValidSync());

  // Check backend session on mount
  useEffect(() => {
    const checkSession = async () => {
      const valid = await isMFASessionValid();
      setIsAlreadyVerified(valid);
    };
    checkSession();
  }, []);

  const checkMFARequired = useCallback(async (): Promise<boolean> => {
    setIsCheckingSession(true);
    try {
      // Check backend for valid MFA session (works across devices)
      const sessionValid = await isMFASessionValid();
      if (sessionValid) {
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
    } finally {
      setIsCheckingSession(false);
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

      // MFA verified successfully - store in backend with 6h validity
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
    invalidateLocalCache();
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
    isCheckingSession,
  };
}