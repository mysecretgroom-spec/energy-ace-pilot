import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Connexion en cours...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Log URL params for debugging
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const providerToken = hashParams.get("provider_token");
        const providerRefreshToken = hashParams.get("provider_refresh_token");
        
        console.log("Auth callback - URL hash params:", {
          hasAccessToken: !!accessToken,
          hasProviderToken: !!providerToken,
          hasProviderRefreshToken: !!providerRefreshToken,
        });

        // Wait a bit for Supabase to process the tokens
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get session which includes provider token on OAuth callback
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log("Auth callback - Session:", {
          hasSession: !!session,
          hasUser: !!session?.user,
          hasProviderToken: !!session?.provider_token,
          hasProviderRefreshToken: !!session?.provider_refresh_token,
          provider: session?.user?.app_metadata?.provider,
          error: error?.message,
        });

        if (error) {
          console.error("Auth error:", error);
          setStatus("Erreur de connexion");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        if (!session) {
          console.log("No session found, redirecting to login");
          navigate("/login");
          return;
        }

        // Try to get provider token from URL hash if not in session
        const googleAccessToken = session.provider_token || providerToken;
        const googleRefreshToken = session.provider_refresh_token || providerRefreshToken;

        if (googleAccessToken && session.user) {
          const provider = session.user.app_metadata?.provider;
          
          if (provider === "google") {
            console.log("Saving Google tokens from OAuth callback...");
            setStatus("Sauvegarde des autorisations Google...");
            
            // Save tokens to database
            const { error: upsertError } = await supabase
              .from("google_tokens")
              .upsert({
                user_id: session.user.id,
                access_token: googleAccessToken,
                refresh_token: googleRefreshToken || null,
                expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
                scopes: [
                  "https://www.googleapis.com/auth/calendar",
                  "https://www.googleapis.com/auth/gmail.readonly",
                  "https://www.googleapis.com/auth/drive.file"
                ],
                updated_at: new Date().toISOString(),
              }, {
                onConflict: "user_id",
              });

            if (upsertError) {
              console.error("Error saving Google tokens:", upsertError);
            } else {
              console.log("Google tokens saved successfully!");
            }
          }
        } else {
          console.log("No provider token available to save");
        }

        setStatus("Redirection...");
        navigate("/", { replace: true });
      } catch (err) {
        console.error("Callback error:", err);
        setStatus("Erreur de connexion");
        setTimeout(() => navigate("/login"), 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground">{status}</p>
    </div>
  );
}
