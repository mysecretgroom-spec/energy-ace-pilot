import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Download,
  Smartphone,
  Share,
  Plus,
  CheckCircle2,
  Bell,
  Wifi,
  WifiOff,
} from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const { isSupported, permission, requestPermission } = usePushNotifications();

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    // Listen for app installed
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    });

    // Online/offline status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleEnableNotifications = async () => {
    await requestPermission();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background p-4">
      <div className="max-w-md mx-auto space-y-6 pt-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto bg-primary rounded-2xl flex items-center justify-center shadow-lg">
            <Smartphone className="h-10 w-10 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Installer SolarCRM</h1>
          <p className="text-muted-foreground">
            Accédez rapidement à votre espace commercial
          </p>
        </div>

        {/* Status Card */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-orange-500" />
              )}
              <span className="text-sm">
                {isOnline ? "Connecté" : "Mode hors-ligne"}
              </span>
            </div>

            {isInstalled && (
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">Application installée</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Install Section */}
        {!isInstalled && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" />
                Installation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {deferredPrompt ? (
                <Button className="w-full" size="lg" onClick={handleInstall}>
                  <Plus className="h-4 w-4 mr-2" />
                  Installer l'application
                </Button>
              ) : isIOS ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Pour installer sur iPhone/iPad :
                  </p>
                  <ol className="text-sm space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                        1
                      </span>
                      <span>
                        Appuyez sur{" "}
                        <Share className="h-4 w-4 inline text-primary" /> en bas
                        de Safari
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                        2
                      </span>
                      <span>
                        Faites défiler et appuyez sur "Sur l'écran d'accueil"
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="bg-primary/10 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                        3
                      </span>
                      <span>Appuyez sur "Ajouter"</span>
                    </li>
                  </ol>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Ouvrez cette page dans Chrome ou Safari pour installer
                  l'application.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notifications Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isSupported ? (
              <p className="text-sm text-muted-foreground">
                Les notifications ne sont pas supportées sur ce navigateur.
              </p>
            ) : permission === "granted" ? (
              <div className="flex items-center gap-3 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">
                  Notifications activées
                </span>
              </div>
            ) : permission === "denied" ? (
              <p className="text-sm text-orange-600">
                Notifications bloquées. Activez-les dans les paramètres de votre
                navigateur.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Recevez des alertes pour les nouveaux RDV importés.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleEnableNotifications}
                >
                  Activer les notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fonctionnalités</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Accès rapide depuis l'écran d'accueil
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Mode plein écran sans barre de navigateur
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Fonctionnement hors-ligne partiel
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Notifications pour les nouveaux RDV
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Scanner de documents intégré
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Back button */}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => window.history.back()}
        >
          Retour à l'application
        </Button>
      </div>
    </div>
  );
};

export default Install;
