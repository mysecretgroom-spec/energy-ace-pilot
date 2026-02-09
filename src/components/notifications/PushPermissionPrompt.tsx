import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOneSignal } from "@/hooks/useOneSignal";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "push_permission_prompted";

export function PushPermissionPrompt() {
  const { user } = useAuth();
  const { isInitialized, isSubscribed, permission, requestPermission, isSupported } = useOneSignal();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Only show prompt if:
    // 1. User is logged in
    // 2. OneSignal is initialized
    // 3. Not already subscribed
    // 4. Permission not denied
    // 5. Haven't shown prompt before
    // 6. Browser supports notifications
    if (
      user &&
      isInitialized &&
      !isSubscribed &&
      permission !== "denied" &&
      isSupported
    ) {
      const alreadyPrompted = localStorage.getItem(STORAGE_KEY);
      if (!alreadyPrompted) {
        // Delay showing prompt to not overwhelm user right after login
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, isInitialized, isSubscribed, permission, isSupported]);

  // Hide if user becomes subscribed
  useEffect(() => {
    if (isSubscribed) {
      setShowPrompt(false);
    }
  }, [isSubscribed]);

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await requestPermission();
      localStorage.setItem(STORAGE_KEY, "true");
      setShowPrompt(false);
    } catch (error) {
      console.error("Error requesting permission:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-[5.5rem] left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300 md:left-auto md:right-6 md:max-w-sm">
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
            <Bell className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm">
              Activer les notifications
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Recevez des alertes pour vos RDV, nouvelles ventes et imports Gmail.
            </p>
            
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                onClick={handleAccept}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? "..." : "Activer"}
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
