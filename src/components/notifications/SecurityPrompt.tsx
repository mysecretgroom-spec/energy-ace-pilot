import { useState, useEffect } from "react";
import { Shield, X, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "security_prompt_dismissed";

export function SecurityPrompt() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [biometricSupported, setBiometricSupported] = useState(false);

  useEffect(() => {
    const checkSecurityStatus = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Check if already dismissed
      const alreadyDismissed = localStorage.getItem(STORAGE_KEY);
      if (alreadyDismissed) {
        setIsLoading(false);
        return;
      }

      // Check biometric support
      let isBiometricSupported = false;
      try {
        if (window.PublicKeyCredential) {
          isBiometricSupported = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
      } catch {
        isBiometricSupported = false;
      }
      setBiometricSupported(isBiometricSupported);

      if (!isBiometricSupported) {
        setIsLoading(false);
        return;
      }

      // Check current security status from profiles
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("pin_code, biometric_enabled")
          .eq("user_id", user.id)
          .single();

        if (error) {
          console.error("Error fetching security status:", error);
          setIsLoading(false);
          return;
        }

        // Show prompt if PIN not set OR biometric not enabled
        const needsSecuritySetup = !data?.pin_code || !data?.biometric_enabled;

        if (needsSecuritySetup) {
          // Delay showing prompt to not overwhelm user
          const timer = setTimeout(() => {
            setShowPrompt(true);
            setIsLoading(false);
          }, 10000); // 10 seconds after login
          return () => clearTimeout(timer);
        }
      } catch (error) {
        console.error("Error checking security status:", error);
      }

      setIsLoading(false);
    };

    checkSecurityStatus();
  }, [user]);

  const handleSecure = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShowPrompt(false);
    navigate("/parametres/securite");
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShowPrompt(false);
  };

  if (!showPrompt || isLoading) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300 md:left-auto md:right-6 md:max-w-sm">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full">
            <Fingerprint className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">
              Sécurisez votre compte
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Activez le code PIN et la biométrie pour protéger l'accès à vos données sensibles.
            </p>
            
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleSecure}
                className="flex-1"
              >
                <Shield className="h-4 w-4 mr-1" />
                Sécuriser
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
                className="flex-1"
              >
                Plus tard
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
