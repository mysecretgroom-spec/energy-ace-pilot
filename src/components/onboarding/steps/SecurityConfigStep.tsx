import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Check, Loader2, Shield, SkipForward, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface SecurityConfigStepProps {
  onComplete: () => void;
}

export function SecurityConfigStep({ onComplete }: SecurityConfigStepProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasPin, setHasPin] = useState(false);
  const [step, setStep] = useState<"new" | "confirm">("new");
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    checkExistingPin();
  }, [user]);

  const checkExistingPin = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from("profiles")
        .select("pin_code")
        .eq("user_id", user.id)
        .maybeSingle();

      setHasPin(!!data?.pin_code);
    } catch (error) {
      console.error("Error checking PIN:", error);
    } finally {
      setLoading(false);
    }
  };

  const focusFirstInput = () => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const handlePinChange = (
    pin: string[],
    setPinFn: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    if (!/^\d*$/.test(value)) return;

    const newPinArray = [...pin];
    newPinArray[index] = value.slice(-1);
    setPinFn(newPinArray);
    setError("");

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent,
    pin: string[],
    setPinFn: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (step === "new") {
      const pinValue = newPin.join("");
      if (pinValue.length !== 4) {
        setError("Entrez 4 chiffres");
        return;
      }
      setStep("confirm");
      setConfirmPin(["", "", "", ""]);
      focusFirstInput();
      return;
    }

    if (step === "confirm") {
      const newPinValue = newPin.join("");
      const confirmPinValue = confirmPin.join("");

      if (newPinValue !== confirmPinValue) {
        setError("Les codes PIN ne correspondent pas");
        setConfirmPin(["", "", "", ""]);
        focusFirstInput();
        return;
      }

      setSaving(true);
      try {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ pin_code: newPinValue })
          .eq("user_id", user!.id);

        if (updateError) throw updateError;

        toast.success("Code PIN configuré ✓");
        onComplete();
      } catch (err) {
        console.error("Error setting PIN:", err);
        toast.error("Erreur lors de la configuration");
      } finally {
        setSaving(false);
      }
    }
  };

  const renderPinInputs = (
    pin: string[],
    setPinFn: React.Dispatch<React.SetStateAction<string[]>>
  ) => (
    <div className="flex justify-center gap-3">
      {pin.map((digit, i) => (
        <Input
          key={i}
          ref={(el) => (inputRefs.current[i] = el)}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handlePinChange(pin, setPinFn, i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e, pin, setPinFn)}
          className={`w-10 h-10 text-center text-lg font-bold ${
            error ? "border-destructive" : ""
          }`}
        />
      ))}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already has a PIN
  if (hasPin) {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="font-medium text-green-700 dark:text-green-400">
            Code PIN configuré
          </p>
          <p className="text-sm text-green-600/80 mt-1">
            Mode HEJJA protégé
          </p>
        </div>
        <Button
          onClick={onComplete}
          className="w-full h-10 gap-2 touch-manipulation active:scale-[0.98] transition-transform"
        >
          <Check className="h-4 w-4" />
          Terminer l'onboarding
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Le code PIN protège l'accès au mode HEJJA et aux données sensibles
          </p>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm font-medium mb-3">
          {step === "new" ? "Créez votre code PIN" : "Confirmez votre code PIN"}
        </p>
        {step === "new"
          ? renderPinInputs(newPin, setNewPin)
          : renderPinInputs(confirmPin, setConfirmPin)}
        {error && (
          <p className="text-xs text-destructive mt-2">{error}</p>
        )}
      </div>

      <Button
        onClick={handleSubmit}
        disabled={saving || (step === "new" ? newPin.join("").length !== 4 : confirmPin.join("").length !== 4)}
        className="w-full h-10 gap-2 touch-manipulation active:scale-[0.98] transition-transform"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : step === "new" ? (
          <>Continuer</>
        ) : (
          <>
            <Check className="h-4 w-4" />
            Confirmer et terminer
          </>
        )}
      </Button>

      <Button
        variant="ghost"
        onClick={onComplete}
        className="w-full h-9 text-muted-foreground gap-1 touch-manipulation"
      >
        <SkipForward className="h-3.5 w-3.5" />
        Configurer plus tard
      </Button>
    </div>
  );
}
