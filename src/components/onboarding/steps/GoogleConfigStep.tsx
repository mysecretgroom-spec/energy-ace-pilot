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
  SkipForward,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GoogleConfigStepProps {
  onComplete: () => void;
}

export function GoogleConfigStep({ onComplete }: GoogleConfigStepProps) {
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Services list */}
      <div className="space-y-2">
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

      {/* Action */}
      {isGoogleConnected ? (
        <>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-1" />
            <p className="font-medium text-sm text-green-700 dark:text-green-400">Compte connecté</p>
          </div>
          <Button
            onClick={onComplete}
            className="w-full h-10 gap-2 touch-manipulation active:scale-[0.98] transition-transform"
          >
            <ArrowRight className="h-4 w-4" />
            Continuer
          </Button>
        </>
      ) : (
        <>
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full h-10 gap-2 touch-manipulation active:scale-[0.98] transition-transform"
            size="default"
          >
            {connecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Connecter Google
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onComplete}
            className="w-full h-9 text-muted-foreground gap-1 touch-manipulation"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Passer cette étape
          </Button>
        </>
      )}
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
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50">
      <div className="w-8 h-8 rounded-md bg-background flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-xs">{title}</h4>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      {connected && (
        <Badge variant="outline" className="text-green-600 border-green-500/30 text-xs px-1.5 shrink-0">
          <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
          OK
        </Badge>
      )}
    </div>
  );
}
