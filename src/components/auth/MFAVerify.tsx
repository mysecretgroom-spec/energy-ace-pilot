import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface MFAVerifyProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MFAVerify({ onSuccess, onCancel }: MFAVerifyProps) {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getFactorId();
  }, []);

  const getFactorId = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactor = data.totp.find((f) => f.status === "verified");
      if (totpFactor) {
        setFactorId(totpFactor.id);
      }
    } catch (error) {
      console.error("Error getting MFA factors:", error);
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

      onSuccess();
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
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Vérification requise</CardTitle>
            <CardDescription>
              Entrez le code à 6 chiffres de votre application d'authentification
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
              "Vérifier"
            )}
          </Button>

          {onCancel && (
            <Button
              variant="ghost"
              className="w-full"
              onClick={onCancel}
            >
              Annuler
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
