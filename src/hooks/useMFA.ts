import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthMFAGetAuthenticatorAssuranceLevelResponse } from "@supabase/supabase-js";

interface MFAStatus {
  isEnabled: boolean;
  isVerified: boolean;
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  isLoading: boolean;
}

export const useMFA = () => {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>({
    isEnabled: false,
    isVerified: false,
    currentLevel: null,
    nextLevel: null,
    isLoading: true,
  });

  const checkMFAStatus = useCallback(async () => {
    try {
      // Check if user has enrolled MFA factors
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) {
        console.error("Error listing MFA factors:", factorsError);
        setMfaStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const hasVerifiedFactor = factors.totp.some(f => f.status === "verified");
      
      // Check current assurance level
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aalError) {
        console.error("Error getting AAL:", aalError);
        setMfaStatus(prev => ({ ...prev, isLoading: false }));
        return;
      }

      setMfaStatus({
        isEnabled: hasVerifiedFactor,
        isVerified: aalData.currentLevel === "aal2",
        currentLevel: aalData.currentLevel,
        nextLevel: aalData.nextLevel,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error checking MFA status:", error);
      setMfaStatus(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const unenrollMFA = async () => {
    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) throw factorsError;

      const totpFactor = factors.totp[0];
      if (!totpFactor) return { success: true };

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId: totpFactor.id,
      });

      if (unenrollError) throw unenrollError;

      await checkMFAStatus();
      return { success: true };
    } catch (error: any) {
      console.error("Error unenrolling MFA:", error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    checkMFAStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkMFAStatus();
    });

    return () => subscription.unsubscribe();
  }, [checkMFAStatus]);

  return {
    ...mfaStatus,
    checkMFAStatus,
    unenrollMFA,
  };
};

// Helper to check if MFA verification is required after login
export const requiresMFAVerification = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    
    if (error) return false;
    
    // MFA verification is required if:
    // - User has enrolled MFA (nextLevel is aal2)
    // - But hasn't verified yet in this session (currentLevel is aal1)
    return data.currentLevel === "aal1" && data.nextLevel === "aal2";
  } catch {
    return false;
  }
};
