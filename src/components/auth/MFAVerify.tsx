import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Shield, Clock, AlertCircle } from "lucide-react";
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    getFactorId();
    
    // Update time every second to show sync
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
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
      setFailedAttempts(prev => prev + 1);
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

  // Format time for display (HH:MM:SS)
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false 
    });
  };

  // Calculate seconds remaining in current TOTP window (30s cycles)
  const secondsRemaining = 30 - (Math.floor(currentTime.getTime() / 1000) % 30);

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
          {/* Time sync indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg py-2 px-3">
            <Clock className="h-4 w-4" />
            <span>Heure : {formatTime(currentTime)}</span>
            <span className="text-xs">•</span>
            <span className={secondsRemaining <= 5 ? "text-orange-500 font-medium" : ""}>
              {secondsRemaining}s
            </span>
          </div>

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

          {/* Show sync help after failed attempts */}
          {failedAttempts >= 2 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-sm">
              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="text-muted-foreground">
                <p className="font-medium text-foreground">Problème de synchronisation ?</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li>• Vérifiez que l'heure de votre téléphone est automatique</li>
                  <li>• Dans Google Authenticator : ⋮ → Paramètres → Correction horaire pour les codes</li>
                  <li>• Attendez que le compteur repasse à 30s avant d'entrer le code</li>
                </ul>
              </div>
            </div>
          )}

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
