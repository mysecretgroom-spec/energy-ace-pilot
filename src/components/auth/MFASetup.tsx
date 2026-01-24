import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Shield, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

interface MFASetupProps {
  onComplete?: () => void;
}

export function MFASetup({ onComplete }: MFASetupProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isMFAEnabled, setIsMFAEnabled] = useState(false);
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [enrollmentData, setEnrollmentData] = useState<{
    id: string;
    totp: { qr_code: string; secret: string; uri: string };
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    checkMFAStatus();
  }, []);

  const checkMFAStatus = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const totpFactor = data.totp.find((f) => f.status === "verified");
      setIsMFAEnabled(!!totpFactor);
      setFactorId(totpFactor?.id || null);
    } catch (error) {
      console.error("Error checking MFA status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "DébalePro Authenticator",
      });

      if (error) throw error;
      setEnrollmentData(data);
      setShowEnrollDialog(true);
    } catch (error: any) {
      console.error("Enroll error:", error);
      toast.error(error.message || "Erreur lors de l'activation MFA");
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6 || !enrollmentData) return;

    setIsVerifying(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollmentData.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollmentData.id,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      setIsMFAEnabled(true);
      setFactorId(enrollmentData.id);
      setShowEnrollDialog(false);
      setEnrollmentData(null);
      setVerifyCode("");
      toast.success("MFA activé avec succès !");
      onComplete?.();
    } catch (error: any) {
      console.error("Verify error:", error);
      toast.error(error.message || "Code invalide");
      setVerifyCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable = async () => {
    if (disableCode.length !== 6 || !factorId) return;

    setIsVerifying(true);
    try {
      // Challenge first
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: disableCode,
      });

      if (verifyError) throw verifyError;

      // Unenroll the factor
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });

      if (unenrollError) throw unenrollError;

      setIsMFAEnabled(false);
      setFactorId(null);
      setShowDisableDialog(false);
      setDisableCode("");
      toast.success("MFA désactivé");
      onComplete?.();
    } catch (error: any) {
      console.error("Disable error:", error);
      toast.error(error.message || "Code invalide");
      setDisableCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  const copySecret = () => {
    if (enrollmentData?.totp.secret) {
      navigator.clipboard.writeText(enrollmentData.totp.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Authentification à deux facteurs (MFA)
          </CardTitle>
          <CardDescription>
            Protégez votre compte avec une application d'authentification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
            {isMFAEnabled ? (
              <>
                <ShieldCheck className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">
                  MFA activé
                </span>
              </>
            ) : (
              <>
                <ShieldOff className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  MFA non activé
                </span>
              </>
            )}
          </div>

          {isMFAEnabled ? (
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={() => setShowDisableDialog(true)}
            >
              Désactiver MFA
            </Button>
          ) : (
            <Button className="w-full" onClick={handleEnroll}>
              Activer MFA
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Enrollment Dialog */}
      <Dialog open={showEnrollDialog} onOpenChange={setShowEnrollDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Configurer MFA
            </DialogTitle>
            <DialogDescription>
              Scannez le QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {enrollmentData?.totp.qr_code && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img
                  src={enrollmentData.totp.qr_code}
                  alt="QR Code MFA"
                  className="w-48 h-48"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Ou entrez cette clé manuellement :
              </Label>
              <div className="flex gap-2">
                <Input
                  value={enrollmentData?.totp.secret || ""}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={copySecret}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Entrez le code à 6 chiffres</Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={verifyCode}
                  onChange={setVerifyCode}
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
            </div>

            <Button
              className="w-full"
              onClick={handleVerify}
              disabled={verifyCode.length !== 6 || isVerifying}
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Vérifier et activer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disable Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              Désactiver MFA
            </DialogTitle>
            <DialogDescription>
              Entrez le code de votre application d'authentification pour désactiver MFA
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={disableCode}
                onChange={setDisableCode}
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
              variant="destructive"
              className="w-full"
              onClick={handleDisable}
              disabled={disableCode.length !== 6 || isVerifying}
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Désactiver MFA
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
