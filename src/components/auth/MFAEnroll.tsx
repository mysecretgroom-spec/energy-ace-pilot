import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Smartphone, Check, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface MFAEnrollProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const MFAEnroll = ({ open, onOpenChange, onSuccess }: MFAEnrollProps) => {
  const [step, setStep] = useState<"qr" | "verify">("qr");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleOpen = async () => {
    if (!open) return;
    
    setIsLoading(true);
    setStep("qr");
    setVerifyCode("");
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "DébalePro Authenticator",
      });

      if (error) throw error;

      if (data.totp) {
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
        setFactorId(data.id);
      }
    } catch (error: any) {
      console.error("Error enrolling MFA:", error);
      toast.error(error.message || "Erreur lors de la configuration MFA");
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      toast.error("Entrez un code à 6 chiffres");
      return;
    }

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

      toast.success("Authentification à deux facteurs activée !");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      toast.error(error.message || "Code invalide");
      setVerifyCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Clé copiée");
  };

  // Trigger enrollment when dialog opens
  if (open && !qrCode && !isLoading) {
    handleOpen();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">
            {step === "qr" ? "Configurer l'authentification à deux facteurs" : "Vérifier le code"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === "qr" 
              ? "Scannez ce QR code avec Google Authenticator ou Authy" 
              : "Entrez le code affiché dans votre application"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : step === "qr" ? (
          <div className="space-y-4 py-4">
            {qrCode && (
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-lg">
                  <img src={qrCode} alt="QR Code MFA" className="w-48 h-48" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                Ou entrez cette clé manuellement :
              </p>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <code className="flex-1 text-xs font-mono break-all">{secret}</code>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={copySecret}
                  className="shrink-0"
                >
                  {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button className="w-full" onClick={() => setStep("verify")}>
              Suivant
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-widest font-mono"
              autoFocus
            />

            <Button 
              className="w-full" 
              onClick={handleVerify}
              disabled={verifyCode.length !== 6 || isVerifying}
            >
              {isVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Activer la MFA
            </Button>

            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={() => setStep("qr")}
            >
              Retour au QR code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
