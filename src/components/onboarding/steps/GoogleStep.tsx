import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Calendar, 
  Mail, 
  HardDrive, 
  CheckCircle, 
  Loader2,
  ArrowRight,
} from "lucide-react";

export function GoogleStep() {
  const { user, signInWithGoogle } = useAuth();
  const [isGoogleConnected, setIsGoogleConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    checkConnection();
  }, [user]);

  const checkConnection = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Check if user has Google provider or tokens
    const provider = user.app_metadata?.provider;
    const providers = user.app_metadata?.providers as string[] | undefined;
    const hasGoogleProvider = provider === "google" || providers?.includes("google");

    const { data: tokens } = await supabase
      .from("google_tokens")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    setIsGoogleConnected(!!hasGoogleProvider || !!tokens);
    setLoading(false);
  };

  const handleConnect = async () => {
    setConnecting(true);
    const { error } = await signInWithGoogle();
    if (error) {
      console.error("Google connection error:", error);
    }
    setConnecting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - compact on mobile */}
      <div className="text-center">
        <div className="mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-blue-500/10 flex items-center justify-center mb-2 sm:mb-4">
          <svg viewBox="0 0 24 24" className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        </div>
        <h2 className="text-lg sm:text-xl font-bold">Connexion Google</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
          Agenda et emails synchronisés
        </p>
      </div>

      {/* Services - compact on mobile */}
      <div className="space-y-2 sm:space-y-3">
        <ServiceCard
          icon={Calendar}
          title="Calendar"
          description="Sync bidirectionnelle RDV"
          connected={isGoogleConnected}
        />
        <ServiceCard
          icon={Mail}
          title="Gmail"
          description="Import auto des leads"
          connected={isGoogleConnected}
        />
        <ServiceCard
          icon={HardDrive}
          title="Drive"
          description="Stockage documents"
          connected={isGoogleConnected}
        />
      </div>

      {/* Action - touch-friendly */}
      {isGoogleConnected ? (
        <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-green-500/10 border border-green-500/20 text-center">
          <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 mx-auto mb-1.5 sm:mb-2" />
          <p className="font-medium text-sm sm:text-base text-green-700">Compte connecté</p>
          <p className="text-[10px] sm:text-xs text-green-600/80 mt-0.5 sm:mt-1">
            Services prêts à l'emploi
          </p>
        </div>
      ) : (
        <Button
          onClick={handleConnect}
          disabled={connecting}
          className="w-full h-11 sm:h-12 gap-2 sm:gap-3 touch-manipulation active:scale-[0.98] transition-transform"
          size="lg"
        >
          {connecting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span className="text-sm sm:text-base">Connecter Google</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      )}

      <p className="text-[10px] sm:text-xs text-center text-muted-foreground">
        Configurable plus tard dans les paramètres
      </p>
    </div>
  );
}

function ServiceCard({
  icon: Icon,
  title,
  description,
  connected,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-md sm:rounded-lg bg-muted/50">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg bg-background flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-xs sm:text-sm">{title}</h4>
        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{description}</p>
      </div>
      {connected && (
        <Badge variant="outline" className="text-green-600 border-green-500/30 text-[10px] sm:text-xs px-1.5 sm:px-2 shrink-0">
          <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
          OK
        </Badge>
      )}
    </div>
  );
}
