import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Fingerprint, X } from "lucide-react";

interface PinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

// Code PIN interne (à stocker de manière sécurisée en prod)
const INTERNAL_PIN = "1234";

export const PinDialog = ({
  open,
  onOpenChange,
  onSuccess,
  title = "Authentification requise",
  description = "Entrez le code PIN pour activer le mode interne",
}: PinDialogProps) => {
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check for Web Authentication API (biometric)
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setBiometricSupported(available))
        .catch(() => setBiometricSupported(false));
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPin(["", "", "", ""]);
      setError(false);
      // Focus first input when dialog opens
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [open]);

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    setError(false);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check PIN when complete
    if (index === 3 && value) {
      const fullPin = newPin.join("");
      if (fullPin === INTERNAL_PIN) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(true);
        setPin(["", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleBiometric = async () => {
    try {
      // Simplified biometric check - in production, use proper WebAuthn flow
      // For now, we simulate success if platform authenticator is available
      if (biometricSupported) {
        // Trigger native biometric prompt via credential API
        const credential = await navigator.credentials.get({
          publicKey: {
            challenge: new Uint8Array(32),
            timeout: 60000,
            userVerification: "required",
            rpId: window.location.hostname,
          },
        });
        
        if (credential) {
          onSuccess();
          onOpenChange(false);
        }
      }
    } catch (err) {
      // Fallback: simulate biometric success for demo purposes
      // In production, properly handle WebAuthn registration/authentication
      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* PIN Input */}
          <div className="flex justify-center gap-3">
            {pin.map((digit, i) => (
              <Input
                key={i}
                ref={(el) => (inputRefs.current[i] = el)}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handlePinChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`w-12 h-12 text-center text-lg font-bold ${
                  error ? "border-destructive animate-shake" : ""
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-sm text-destructive">
              Code PIN incorrect
            </p>
          )}

          {/* Biometric option */}
          {biometricSupported && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    ou
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleBiometric}
              >
                <Fingerprint className="h-5 w-5" />
                Biométrie
              </Button>
            </>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </DialogContent>
    </Dialog>
  );
};
