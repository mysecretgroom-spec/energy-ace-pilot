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
import { Lock, Fingerprint, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWebAuthn } from "@/hooks/useWebAuthn";

interface PinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
  useHejjaActivation?: boolean;
}

export const PinDialog = ({
  open,
  onOpenChange,
  onSuccess,
  title = "Authentification requise",
  description = "Entrez le code PIN pour activer le mode interne",
  useHejjaActivation = false,
}: PinDialogProps) => {
  const { user } = useAuth();
  const { isSupported: biometricSupported, authenticate, checkRegistration } = useWebAuthn();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [biometricTriggered, setBiometricTriggered] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Fetch user's PIN and biometric settings when dialog opens
  useEffect(() => {
    const fetchSettings = async () => {
      if (!open || !user) return;
      
      setIsLoading(true);
      setBiometricTriggered(false);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("pin_code, biometric_enabled, webauthn_credential_id")
          .eq("user_id", user.id)
          .single();
        
        if (!error && data) {
          setStoredPin(data.pin_code);
          // Only enable biometric if credential is registered
          setBiometricEnabled(data.biometric_enabled && !!data.webauthn_credential_id);
        }
      } catch (err) {
        console.error("Error fetching PIN settings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [open, user]);

  useEffect(() => {
    if (open) {
      setPin(["", "", "", ""]);
      setError(false);
      // Focus first input when dialog opens
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [open]);

  // Auto-trigger biometric when dialog opens and biometric is enabled
  const triggerBiometric = async () => {
    if (!biometricSupported || !biometricEnabled || biometricTriggered) return;
    
    setBiometricTriggered(true);
    
    try {
      const success = await authenticate();
      
      if (success) {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        onSuccess();
        onOpenChange(false);
      } else {
        // Fallback to PIN
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      console.log("Biometric failed, fallback to PIN");
      inputRefs.current[0]?.focus();
    }
  };

  useEffect(() => {
    if (open && biometricEnabled && biometricSupported && storedPin && !isLoading && !biometricTriggered) {
      // Small delay to let the dialog render
      const timer = setTimeout(() => {
        triggerBiometric();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open, biometricEnabled, biometricSupported, storedPin, isLoading, biometricTriggered]);

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
      
      // Check against stored PIN or fallback to default
      const validPin = storedPin || "1234";
      
      if (fullPin === validPin) {
        // Haptic feedback on success
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        onSuccess();
        onOpenChange(false);
      } else {
        // Haptic feedback on error
        if (navigator.vibrate) {
          navigator.vibrate([50, 50, 50]);
        }
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
    if (!biometricSupported || !biometricEnabled) return;
    
    try {
      const success = await authenticate();
      
      if (success) {
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        onSuccess();
        onOpenChange(false);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Biometric authentication failed:", err);
      setError(true);
    }
  };

  const showBiometricOption = biometricSupported && biometricEnabled;

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

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !storedPin ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Aucun code PIN configuré. Configurez-le dans les paramètres de sécurité.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        ) : (
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
            {showBiometricOption && (
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
        )}

        {/* No manual close button - DialogContent already has one */}
      </DialogContent>
    </Dialog>
  );
};
