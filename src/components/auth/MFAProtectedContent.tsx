import { useState, useEffect, ReactNode } from "react";
import { useMFAChallenge } from "@/hooks/useMFAChallenge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Shield, Lock, Loader2, Eye } from "lucide-react";

interface MFAProtectedContentProps {
  children: ReactNode;
  /** Placeholder content to show before MFA verification */
  placeholder?: ReactNode;
  /** Title for the MFA prompt */
  title?: string;
  /** Description for the MFA prompt */
  description?: string;
  /** If true, shows a button to reveal instead of auto-triggering */
  requireExplicitAction?: boolean;
  /** Button text for explicit action */
  actionButtonText?: string;
  /** Callback when MFA is verified */
  onVerified?: () => void;
}

/**
 * Wrapper component that requires MFA verification before showing content.
 * Used for sensitive areas like:
 * - Commission statistics
 * - Profile/account modifications
 */
export function MFAProtectedContent({
  children,
  placeholder,
  title = "Vérification requise",
  description = "Ce contenu nécessite une vérification MFA.",
  requireExplicitAction = false,
  actionButtonText = "Afficher",
  onVerified,
}: MFAProtectedContentProps) {
  const {
    isMFARequired,
    isVerifying,
    verifyCode,
    setVerifyCode,
    checkMFARequired,
    verifyMFA,
    factorId,
    isAlreadyVerified,
  } = useMFAChallenge();

  const [isVerified, setIsVerified] = useState(false);
  const [hasMFA, setHasMFA] = useState<boolean | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has MFA enabled and if already verified within 6h window
    const checkMFA = async () => {
      // If already verified within valid timeframe, grant access immediately
      if (isAlreadyVerified) {
        setHasMFA(true);
        setIsVerified(true);
        return;
      }

      const required = await checkMFARequired();
      setHasMFA(required);
      
      // If MFA is not enabled, content is accessible
      if (!required) {
        setIsVerified(true);
      } else if (!requireExplicitAction) {
        setShowPrompt(true);
      }
    };
    checkMFA();
  }, [checkMFARequired, requireExplicitAction, isAlreadyVerified]);

  const handleVerify = async () => {
    setError(null);
    const success = await verifyMFA();
    if (success) {
      setIsVerified(true);
      setShowPrompt(false);
      onVerified?.();
    } else {
      setError("Code invalide. Veuillez réessayer.");
    }
  };

  const handleRevealClick = () => {
    setShowPrompt(true);
  };

  // Still loading MFA status
  if (hasMFA === null) {
    return placeholder || (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // User doesn't have MFA enabled, show content directly
  if (!hasMFA || isVerified) {
    return <>{children}</>;
  }

  // Require explicit action to reveal
  if (requireExplicitAction && !showPrompt) {
    return (
      <div className="relative">
        {placeholder || (
          <div className="bg-muted/50 backdrop-blur-sm rounded-lg p-6 flex flex-col items-center justify-center gap-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Contenu protégé
            </p>
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
          <Button onClick={handleRevealClick} variant="outline" className="gap-2">
            <Eye className="h-4 w-4" />
            {actionButtonText}
          </Button>
        </div>
      </div>
    );
  }

  // Show MFA verification prompt
  if (showPrompt && isMFARequired) {
    return (
      <Card className="max-w-sm mx-auto">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <InputOTP
              value={verifyCode}
              onChange={setVerifyCode}
              maxLength={6}
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

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            onClick={handleVerify}
            disabled={verifyCode.length !== 6 || isVerifying}
            className="w-full"
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Vérification...
              </>
            ) : (
              "Vérifier"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Entrez le code de votre application d'authentification
          </p>
        </CardContent>
      </Card>
    );
  }

  // Fallback: show placeholder
  return placeholder || null;
}
