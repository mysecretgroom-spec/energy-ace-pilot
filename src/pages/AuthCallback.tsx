import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connexion en cours...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get session which includes provider token on OAuth callback
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth error:", error);
          setStatus("Erreur de connexion");
          setTimeout(() => navigate("/login"), 2000);
          return;
        }

        if (session?.provider_token && session.user) {
          const provider = session.user.app_metadata?.provider;
          
          if (provider === "google") {
            console.log("Saving Google tokens from OAuth callback...");
            setStatus("Sauvegarde des autorisations Google...");
            
            // Save tokens to database
            const { error: upsertError } = await supabase
              .from("google_tokens")
              .upsert({
                user_id: session.user.id,
                access_token: session.provider_token,
                refresh_token: session.provider_refresh_token || null,
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
              console.log("Google tokens saved successfully");
            }
          }
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
