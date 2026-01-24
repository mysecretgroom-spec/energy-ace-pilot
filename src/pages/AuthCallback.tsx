import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Calendar, CheckCircle, Mail } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Connexion en cours...");
  const [syncStatus, setSyncStatus] = useState<"idle" | "calendar" | "gmail" | "done" | "error">("idle");
  const [syncResults, setSyncResults] = useState({ calendar: 0, gmail: 0 });
  const [needsRegieSetup, setNeedsRegieSetup] = useState(false);

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
          // Check if user has Google linked
          const provider = session.user.app_metadata?.provider;
          const providers = session.user.app_metadata?.providers as string[] | undefined;
          const hasGoogleLinked = provider === "google" || providers?.includes("google");
          
          if (hasGoogleLinked) {
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
              
              // Auto-sync Google Calendar after successful connection
              setStatus("Synchronisation du calendrier...");
              setSyncStatus("calendar");
              
              let calendarImported = 0;
              let gmailImported = 0;
              
              try {
                const syncParams = new URLSearchParams({
                  action: "sync",
                  daysAhead: "30",
                  daysBefore: "7",
                });

                const syncResponse = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-google-calendar?${syncParams}`,
                  {
                    headers: {
                      Authorization: `Bearer ${session.access_token}`,
                      "Content-Type": "application/json",
                    },
                  }
                );

                const syncResult = await syncResponse.json();
                
                if (syncResponse.ok) {
                  console.log("Calendar sync result:", syncResult);
                  calendarImported = syncResult.imported || 0;
                }
              } catch (syncError) {
                console.error("Calendar sync error:", syncError);
              }

              // Auto-sync Gmail after Calendar
              setStatus("Synchronisation des emails...");
              setSyncStatus("gmail");
              
              let gmailNeedsRegie = false;
              
              try {
                const gmailResponse = await fetch(
                  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-gmail-rdv`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${session.access_token}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ days: 7 }),
                  }
                );

                const gmailResult = await gmailResponse.json();
                
                if (gmailResponse.ok) {
                  console.log("Gmail sync result:", gmailResult);
                  gmailImported = gmailResult.imported || 0;
                } else {
                  // Check if Gmail sync failed due to missing authorized emails (no Régie configured)
                  if (gmailResult.code === "NO_AUTHORIZED_EMAILS") {
                    console.log("No authorized emails configured, checking if Régie setup needed");
                    
                    // Check if user has any Régie configured
                    const { data: regies } = await supabase
                      .from("regies")
                      .select("id")
                      .eq("user_id", session.user.id)
                      .limit(1);
                    
                    if (!regies || regies.length === 0) {
                      gmailNeedsRegie = true;
                      setNeedsRegieSetup(true);
                    }
                  }
                }
              } catch (gmailError) {
                console.error("Gmail sync error:", gmailError);
              }

              setSyncResults({ calendar: calendarImported, gmail: gmailImported });
              setSyncStatus("done");
              
              if (gmailNeedsRegie) {
                setStatus("Configuration requise");
                // Redirect to Régie settings
                setTimeout(() => {
                  setStatus("Redirection vers la configuration...");
                  navigate("/parametres/regies", { replace: true });
                }, 1500);
                return; // Exit early, don't fall through to normal redirect
              } else {
                const parts = [];
                if (calendarImported > 0) parts.push(`${calendarImported} RDV agenda`);
                if (gmailImported > 0) parts.push(`${gmailImported} RDV email`);
                setStatus(parts.length > 0 ? parts.join(" • ") : "Synchronisation terminée");
              }
            }
          }
        } else {
          console.log("No provider token available to save");
        }

        // Small delay to show sync result before redirect
        setTimeout(() => {
          setStatus("Redirection...");
          navigate("/", { replace: true });
        }, syncStatus === "done" ? 1500 : 500);
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
      {syncStatus === "calendar" ? (
        <div className="relative">
          <Calendar className="h-8 w-8 text-primary animate-pulse" />
          <Loader2 className="h-4 w-4 animate-spin text-primary absolute -bottom-1 -right-1" />
        </div>
      ) : syncStatus === "gmail" ? (
        <div className="relative">
          <Mail className="h-8 w-8 text-primary animate-pulse" />
          <Loader2 className="h-4 w-4 animate-spin text-primary absolute -bottom-1 -right-1" />
        </div>
      ) : syncStatus === "done" ? (
        <CheckCircle className="h-8 w-8 text-green-500" />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      )}
      <p className="text-muted-foreground">{status}</p>
      {syncStatus === "calendar" && (
        <p className="text-xs text-muted-foreground">Import des RDV Google Calendar...</p>
      )}
      {syncStatus === "gmail" && (
        <p className="text-xs text-muted-foreground">Import des RDV depuis Gmail...</p>
      )}
    </div>
  );
}
