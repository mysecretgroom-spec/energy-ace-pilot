import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper function to save Google tokens
  const saveGoogleTokens = async (session: Session) => {
    if (!session?.provider_token || !session?.user) return;
    
    const provider = session.user.app_metadata?.provider;
    if (provider !== "google") return;

    try {
      console.log("Saving Google tokens for user:", session.user.id);
      const { error } = await supabase
        .from("google_tokens")
        .upsert({
          user_id: session.user.id,
          access_token: session.provider_token,
          refresh_token: session.provider_refresh_token || null,
          expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
          scopes: ["calendar", "gmail.readonly", "drive.file"],
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });
      
      if (error) {
        console.error("Error saving Google tokens:", error);
      } else {
        console.log("Google tokens saved successfully");
      }
    } catch (err) {
      console.error("Error saving Google tokens:", err);
    }
  };

  useEffect(() => {
    // Safety timeout to prevent infinite loading on iOS PWA
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth loading timeout - forcing completion");
        setLoading(false);
      }
    }, 5000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state change:", event, "provider_token:", !!session?.provider_token);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Save Google tokens when user signs in with Google
        if (event === "SIGNED_IN" && session?.provider_token) {
          // Use setTimeout to avoid blocking the auth flow
          setTimeout(() => saveGoogleTokens(session), 0);
        }
      }
    );

    // THEN check for existing session - this catches OAuth callback
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log("Initial session check, provider_token:", !!session?.provider_token);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Also try to save tokens from initial session (OAuth callback)
      if (session?.provider_token) {
        setTimeout(() => saveGoogleTokens(session), 0);
      }
    }).catch((error) => {
      console.error("Error getting session:", error);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: {
            first_name: firstName,
            last_name: lastName,
          },
        },
      });

      if (error) throw error;

      // Update profile with name after signup
      if (firstName || lastName) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("profiles")
            .update({ first_name: firstName, last_name: lastName })
            .eq("user_id", user.id);
        }
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.file",
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
