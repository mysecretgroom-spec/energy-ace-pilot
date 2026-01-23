import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

interface MFAVerifyProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const MFAVerify = ({ onSuccess, onCancel }: MFAVerifyProps) => {
  const [verifyCode, setVerifyCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      setError("Entrez un code à 6 chiffres");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) throw factorsError;

      const totpFactor = factors.totp[0];
      
      if (!totpFactor) {
        throw new Error("Aucun facteur TOTP trouvé");
      }

      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      onSuccess();
    } catch (error: any) {
      console.error("Error verifying MFA:", error);
      setError(error.message || "Code invalide");
      setVerifyCode("");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && verifyCode.length === 6) {
      handleVerify();
    }
  };

  return (
    <Card className="w-full max-w-md shadow-card">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <div>
          <CardTitle className="text-2xl font-display">Vérification en deux étapes</CardTitle>
          <CardDescription>
            Entrez le code affiché dans votre application d'authentification
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={verifyCode}
          onChange={(e) => {
            setVerifyCode(e.target.value.replace(/\D/g, ""));
            setError("");
          }}
          onKeyDown={handleKeyDown}
          className={`text-center text-2xl tracking-widest font-mono ${
            error ? "border-destructive" : ""
          }`}
          autoFocus
        />

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button 
          className="w-full bg-gradient-hero" 
          onClick={handleVerify}
          disabled={verifyCode.length !== 6 || isVerifying}
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

        <Button 
          variant="ghost" 
          className="w-full" 
          onClick={onCancel}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour à la connexion
        </Button>
      </CardContent>
    </Card>
  );
};
