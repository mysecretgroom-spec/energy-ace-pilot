import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MFASetup } from "@/components/auth/MFASetup";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield, ShieldAlert, Key } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface AdminMFAGateProps {
  children: React.ReactNode;
}

export function AdminMFAGate({ children }: AdminMFAGateProps) {
  const [isVerified, setIsVerified] = useState(false);
  const [isMFAEnabled, setIsMFAEnabled] = useState<boolean | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    try {
      // Check if user already has AAL2 (already verified MFA in this session)
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      
      if (aalData?.currentLevel === "aal2") {
        setIsVerified(true);
        setIsMFAEnabled(true);
        setIsLoading(false);
        return;
      }

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

      setIsVerified(true);
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
                Entrez le code de votre application d'authentification pour accéder au panneau admin
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

            <p className="text-xs text-center text-muted-foreground">
              Utilisez Google Authenticator ou une application compatible TOTP
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MFA verified - show admin content
  return <>{children}</>;
}
