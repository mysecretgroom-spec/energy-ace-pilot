import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MFASetup } from "@/components/auth/MFASetup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield, ShieldAlert, Key, Clock } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface AdminMFAGateProps {
  children: React.ReactNode;
}

const ADMIN_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ADMIN_SESSION_KEY = "admin_mfa_verified_at";

export function AdminMFAGate({ children }: AdminMFAGateProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [isMFAEnabled, setIsMFAEnabled] = useState<boolean | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeoutExpired, setTimeoutExpired] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const timeoutCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Check if session is still valid based on last activity
  const isSessionValid = useCallback(() => {
    const verifiedAt = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!verifiedAt) return false;
    
    const verifiedTime = parseInt(verifiedAt, 10);
    const now = Date.now();
    const timeSinceVerification = now - verifiedTime;
    const timeSinceActivity = now - lastActivityRef.current;
    
    // Session expires if:
    // 1. More than 30 min since verification AND
    // 2. More than 30 min of inactivity
    return timeSinceActivity < ADMIN_SESSION_TIMEOUT_MS;
  }, []);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Handle activity events
  useEffect(() => {
    if (!isVerified) return;

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    
    const handleActivity = () => {
      updateActivity();
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isVerified, updateActivity]);

  // Check for session timeout periodically
  useEffect(() => {
    if (!isVerified) return;

    const checkTimeout = () => {
      if (!isSessionValid()) {
        setIsVerified(false);
        setTimeoutExpired(true);
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        toast.warning("Session admin expirée", {
          description: "Veuillez vous re-authentifier pour continuer."
        });
      }
    };

    // Check every minute
    timeoutCheckRef.current = setInterval(checkTimeout, 60 * 1000);

    return () => {
      if (timeoutCheckRef.current) {
        clearInterval(timeoutCheckRef.current);
      }
    };
  }, [isVerified, isSessionValid]);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      // First check if we have a valid session in sessionStorage
      if (isSessionValid()) {
        // Also verify AAL2 is still active
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel === "aal2") {
          setIsVerified(true);
          setIsMFAEnabled(true);
          updateActivity();
          setIsLoading(false);
          return;
        }
      }

      // Clear expired session
      sessionStorage.removeItem(ADMIN_SESSION_KEY);

      // Check if MFA is enrolled
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactor = data.totp.find((f) => f.status === "verified");
      setIsMFAEnabled(!!totpFactor);
      setFactorId(totpFactor?.id || null);
    } catch (error) {
      console.error("Error checking MFA status:", error);
      setIsMFAEnabled(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6 || !factorId) return;

    setIsVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) throw verifyError;

      // Store verification timestamp in sessionStorage
      sessionStorage.setItem(ADMIN_SESSION_KEY, Date.now().toString());
      lastActivityRef.current = Date.now();
      
      setIsVerified(true);
      setTimeoutExpired(false);
      toast.success("Accès admin vérifié");
    } catch (error: any) {
      console.error("MFA verify error:", error);
      toast.error(error.message || "Code invalide");
      setCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-verify when code is complete
  useEffect(() => {
    if (code.length === 6 && factorId) {
      handleVerify();
    }
  }, [code]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // MFA not enabled - show setup
  if (!isMFAEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md space-y-6">
          <Card className="border-destructive/50">
            <CardHeader className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-xl">Configuration requise</CardTitle>
                <CardDescription>
                  L'accès admin nécessite l'authentification à deux facteurs (MFA).
                  Configurez Google Authenticator pour continuer.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>

          <MFASetup onComplete={checkMFAStatus} />
        </div>
      </div>
    );
  }

  // MFA enabled but not verified this session - show verification
  if (!isVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Key className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-xl flex items-center justify-center gap-2">
                <Shield className="h-5 w-5" />
                Vérification Admin
              </CardTitle>
              <CardDescription>
                {timeoutExpired ? (
                  <span className="flex items-center justify-center gap-1 text-orange-600">
                    <Clock className="h-4 w-4" />
                    Session expirée après 30 min d'inactivité
                  </span>
                ) : (
                  "Entrez le code de votre application d'authentification"
                )}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={isVerifying}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={code.length !== 6 || isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Vérification...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  Vérifier et accéder
                </>
              )}
            </Button>

            <div className="text-xs text-center text-muted-foreground space-y-1">
              <p>Utilisez Google Authenticator ou une application TOTP</p>
              <p className="flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" />
                Session limitée à 30 min d'inactivité
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MFA verified - show admin content
  return <>{children}</>;
}
