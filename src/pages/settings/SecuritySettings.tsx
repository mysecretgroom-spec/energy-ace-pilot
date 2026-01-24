import { useState, useEffect, useRef } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock, Fingerprint, Check, X, Trash2, KeyRound } from "lucide-react";
import { MFASetup } from "@/components/auth/MFASetup";

const SecuritySettings = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Current state from DB
  const [hasPin, setHasPin] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  
  // Dialog states
  const [showSetPinDialog, setShowSetPinDialog] = useState(false);
  const [showChangePinDialog, setShowChangePinDialog] = useState(false);
  const [showDeletePinDialog, setShowDeletePinDialog] = useState(false);
  
  // PIN input states
  const [currentPin, setCurrentPin] = useState(["", "", "", ""]);
  const [newPin, setNewPin] = useState(["", "", "", ""]);
  const [confirmPin, setConfirmPin] = useState(["", "", "", ""]);
  const [pinStep, setPinStep] = useState<"current" | "new" | "confirm">("new");
  const [pinError, setPinError] = useState("");
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Check biometric support
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setBiometricSupported(available))
        .catch(() => setBiometricSupported(false));
    }
    
    fetchSecuritySettings();
  }, [user]);

  const fetchSecuritySettings = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("pin_code, biometric_enabled")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      
      setHasPin(!!data?.pin_code);
      setBiometricEnabled(data?.biometric_enabled || false);
    } catch (error) {
      console.error("Error fetching security settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPinInputs = () => {
    setCurrentPin(["", "", "", ""]);
    setNewPin(["", "", "", ""]);
    setConfirmPin(["", "", "", ""]);
    setPinStep("new");
    setPinError("");
  };

  const handlePinChange = (
    pin: string[],
    setPinFn: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string,
    onComplete?: () => void
  ) => {
    if (!/^\d*$/.test(value)) return;
    
    const newPinArray = [...pin];
    newPinArray[index] = value.slice(-1);
    setPinFn(newPinArray);
    setPinError("");

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Call completion handler when all digits entered
    if (index === 3 && value) {
      setTimeout(() => onComplete?.(), 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent, pin: string[], setPinFn: React.Dispatch<React.SetStateAction<string[]>>) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const focusFirstInput = () => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  // Set new PIN (first time)
  const handleSetPin = async () => {
    if (pinStep === "new") {
      const pinValue = newPin.join("");
      if (pinValue.length !== 4) {
        setPinError("Entrez 4 chiffres");
        return;
      }
      setPinStep("confirm");
      setConfirmPin(["", "", "", ""]);
      focusFirstInput();
      return;
    }

    if (pinStep === "confirm") {
      const newPinValue = newPin.join("");
      const confirmPinValue = confirmPin.join("");
      
      if (newPinValue !== confirmPinValue) {
        setPinError("Les codes PIN ne correspondent pas");
        setConfirmPin(["", "", "", ""]);
        focusFirstInput();
        return;
      }

      setIsSaving(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ pin_code: newPinValue })
          .eq("user_id", user!.id);
        
        if (error) throw error;
        
        setHasPin(true);
        setShowSetPinDialog(false);
        resetPinInputs();
        toast.success("Code PIN configuré avec succès");
      } catch (error) {
        console.error("Error setting PIN:", error);
        toast.error("Erreur lors de la configuration du PIN");
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Change existing PIN
  const handleChangePin = async () => {
    if (pinStep === "current") {
      // Verify current PIN
      const currentPinValue = currentPin.join("");
      
      const { data, error } = await supabase
        .from("profiles")
        .select("pin_code")
        .eq("user_id", user!.id)
        .single();
      
      if (error || data?.pin_code !== currentPinValue) {
        setPinError("Code PIN actuel incorrect");
        setCurrentPin(["", "", "", ""]);
        focusFirstInput();
        return;
      }
      
      setPinStep("new");
      setNewPin(["", "", "", ""]);
      focusFirstInput();
      return;
    }

    if (pinStep === "new") {
      const pinValue = newPin.join("");
      if (pinValue.length !== 4) {
        setPinError("Entrez 4 chiffres");
        return;
      }
      setPinStep("confirm");
      setConfirmPin(["", "", "", ""]);
      focusFirstInput();
      return;
    }

    if (pinStep === "confirm") {
      const newPinValue = newPin.join("");
      const confirmPinValue = confirmPin.join("");
      
      if (newPinValue !== confirmPinValue) {
        setPinError("Les codes PIN ne correspondent pas");
        setConfirmPin(["", "", "", ""]);
        focusFirstInput();
        return;
      }

      setIsSaving(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ pin_code: newPinValue })
          .eq("user_id", user!.id);
        
        if (error) throw error;
        
        setShowChangePinDialog(false);
        resetPinInputs();
        toast.success("Code PIN modifié avec succès");
      } catch (error) {
        console.error("Error changing PIN:", error);
        toast.error("Erreur lors de la modification du PIN");
      } finally {
        setIsSaving(false);
      }
    }
  };

  // Delete PIN
  const handleDeletePin = async () => {
    const currentPinValue = currentPin.join("");
    
    const { data, error: fetchError } = await supabase
      .from("profiles")
      .select("pin_code")
      .eq("user_id", user!.id)
      .single();
    
    if (fetchError || data?.pin_code !== currentPinValue) {
      setPinError("Code PIN incorrect");
      setCurrentPin(["", "", "", ""]);
      focusFirstInput();
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ pin_code: null, biometric_enabled: false })
        .eq("user_id", user!.id);
      
      if (error) throw error;
      
      setHasPin(false);
      setBiometricEnabled(false);
      setShowDeletePinDialog(false);
      resetPinInputs();
      toast.success("Code PIN supprimé");
    } catch (error) {
      console.error("Error deleting PIN:", error);
      toast.error("Erreur lors de la suppression du PIN");
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle biometric
  const handleBiometricToggle = async (enabled: boolean) => {
    if (!hasPin) {
      toast.error("Configurez d'abord un code PIN");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ biometric_enabled: enabled })
        .eq("user_id", user!.id);
      
      if (error) throw error;
      
      setBiometricEnabled(enabled);
      toast.success(enabled ? "Biométrie activée" : "Biométrie désactivée");
    } catch (error) {
      console.error("Error toggling biometric:", error);
      toast.error("Erreur lors de la modification");
    } finally {
      setIsSaving(false);
    }
  };

  const renderPinInputs = (
    pin: string[],
    setPinFn: React.Dispatch<React.SetStateAction<string[]>>,
    onComplete?: () => void
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
          onChange={(e) => handlePinChange(pin, setPinFn, i, e.target.value, onComplete)}
          onKeyDown={(e) => handleKeyDown(i, e, pin, setPinFn)}
          className={`w-12 h-12 text-center text-lg font-bold ${
            pinError ? "border-destructive" : ""
          }`}
        />
      ))}
    </div>
  );

  if (isLoading) {
    return (
      <MobileLayout title="Sécurité" showBackButton>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout title="Sécurité" showBackButton>
      <div className="p-4 pb-8 space-y-4">
        {/* Status Card */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Protection mode interne
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Protégez l'accès au mode HEJJA et aux paramètres sensibles avec un code PIN et/ou la biométrie.
            </p>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <div className={`w-3 h-3 rounded-full ${hasPin ? "bg-green-500" : "bg-orange-500"}`} />
              <span className="text-sm font-medium">
                {hasPin ? "Protection activée" : "Protection non configurée"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PIN Configuration */}
        <Card className="shadow-card">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <KeyRound className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Code PIN</p>
                <p className="text-sm text-muted-foreground">
                  {hasPin ? "Code à 4 chiffres configuré" : "Non configuré"}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              {!hasPin ? (
                <Button 
                  className="flex-1" 
                  onClick={() => {
                    resetPinInputs();
                    setShowSetPinDialog(true);
                  }}
                >
                  Configurer le PIN
                </Button>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      resetPinInputs();
                      setPinStep("current");
                      setShowChangePinDialog(true);
                    }}
                  >
                    Modifier
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      resetPinInputs();
                      setShowDeletePinDialog(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Biometric Configuration */}
        {biometricSupported && (
          <Card className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Fingerprint className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Biométrie</p>
                    <p className="text-sm text-muted-foreground">
                      Face ID / Touch ID / Empreinte
                    </p>
                  </div>
                </div>
                <Switch
                  checked={biometricEnabled}
                  onCheckedChange={handleBiometricToggle}
                  disabled={!hasPin || isSaving}
                />
              </div>
              {!hasPin && (
                <p className="text-xs text-muted-foreground mt-2">
                  Configurez d'abord un code PIN pour activer la biométrie
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* MFA Setup */}
        <MFASetup />

        {/* Info */}
        <p className="text-xs text-muted-foreground text-center px-4">
          Le code PIN protège l'accès au mode interne HEJJA. Le MFA protège votre compte.
        </p>
      </div>

      {/* Set PIN Dialog */}
      <Dialog open={showSetPinDialog} onOpenChange={(open) => {
        setShowSetPinDialog(open);
        if (!open) resetPinInputs();
      }}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">
              {pinStep === "new" ? "Créer un code PIN" : "Confirmer le code PIN"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {pinStep === "new" 
                ? "Entrez un code à 4 chiffres" 
                : "Entrez à nouveau votre code PIN"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {pinStep === "new" && renderPinInputs(newPin, setNewPin)}
            {pinStep === "confirm" && renderPinInputs(confirmPin, setConfirmPin)}

            {pinError && (
              <p className="text-center text-sm text-destructive">{pinError}</p>
            )}

            <Button 
              className="w-full" 
              onClick={handleSetPin}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : pinStep === "new" ? (
                "Suivant"
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmer
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Change PIN Dialog */}
      <Dialog open={showChangePinDialog} onOpenChange={(open) => {
        setShowChangePinDialog(open);
        if (!open) resetPinInputs();
      }}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center">
              {pinStep === "current" && "Code PIN actuel"}
              {pinStep === "new" && "Nouveau code PIN"}
              {pinStep === "confirm" && "Confirmer le nouveau PIN"}
            </DialogTitle>
            <DialogDescription className="text-center">
              {pinStep === "current" && "Entrez votre code PIN actuel"}
              {pinStep === "new" && "Entrez votre nouveau code à 4 chiffres"}
              {pinStep === "confirm" && "Entrez à nouveau votre nouveau code"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {pinStep === "current" && renderPinInputs(currentPin, setCurrentPin)}
            {pinStep === "new" && renderPinInputs(newPin, setNewPin)}
            {pinStep === "confirm" && renderPinInputs(confirmPin, setConfirmPin)}

            {pinError && (
              <p className="text-center text-sm text-destructive">{pinError}</p>
            )}

            <Button 
              className="w-full" 
              onClick={handleChangePin}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : pinStep === "confirm" ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirmer
                </>
              ) : (
                "Suivant"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete PIN Dialog */}
      <Dialog open={showDeletePinDialog} onOpenChange={(open) => {
        setShowDeletePinDialog(open);
        if (!open) resetPinInputs();
      }}>
        <DialogContent className="sm:max-w-[320px]">
          <DialogHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-2">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">Supprimer le code PIN</DialogTitle>
            <DialogDescription className="text-center">
              Entrez votre code PIN actuel pour confirmer la suppression
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {renderPinInputs(currentPin, setCurrentPin)}

            {pinError && (
              <p className="text-center text-sm text-destructive">{pinError}</p>
            )}

            <Button 
              variant="destructive"
              className="w-full" 
              onClick={handleDeletePin}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer le PIN
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MobileLayout>
  );
};

export default SecuritySettings;
