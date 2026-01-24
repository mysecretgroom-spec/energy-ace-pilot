import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session, AuthenticatorAssuranceLevels } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mfaRequired: boolean;
  currentLevel: AuthenticatorAssuranceLevels | null;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; mfaRequired?: boolean }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkMFAStatus: () => Promise<{ mfaRequired: boolean; currentLevel: AuthenticatorAssuranceLevels | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<AuthenticatorAssuranceLevels | null>(null);

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
    let mounted = true;
    
    // CRITICAL: Force loading to false after 1.5s no matter what (iOS PWA fix)
    const forceTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Auth: Force timeout reached");
        setLoading(false);
      }
    }, 1500);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        console.log("Auth state:", event);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Save Google tokens in background (non-blocking)
        if (event === "SIGNED_IN" && session?.provider_token) {
          setTimeout(() => saveGoogleTokens(session), 100);
        }
      }
    );

    // Check existing session with short timeout
    const checkSession = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 1000);
        
        const { data: { session } } = await supabase.auth.getSession();
        clearTimeout(timeout);
        
        if (mounted) {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          
          if (session?.provider_token) {
            setTimeout(() => saveGoogleTokens(session), 100);
          }
        }
      } catch (error) {
        console.warn("Session check failed:", error);
        if (mounted) setLoading(false);
      }
    };
    
    checkSession();

    return () => {
      mounted = false;
      clearTimeout(forceTimeout);
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

  const checkMFAStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error) throw error;
      
      const needsMFA = data.nextLevel === "aal2" && data.currentLevel === "aal1";
      setMfaRequired(needsMFA);
      setCurrentLevel(data.currentLevel);
      
      return { mfaRequired: needsMFA, currentLevel: data.currentLevel };
    } catch (error) {
      console.error("Error checking MFA status:", error);
      return { mfaRequired: false, currentLevel: null };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      // Check if MFA is required after sign in
      const mfaStatus = await checkMFAStatus();
      return { error: null, mfaRequired: mfaStatus.mfaRequired };
    } catch (error) {
      return { error: error as Error, mfaRequired: false };
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
    setMfaRequired(false);
    setCurrentLevel(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      loading, 
      mfaRequired, 
      currentLevel, 
      signUp, 
      signIn, 
      signInWithGoogle, 
      signOut,
      checkMFAStatus 
    }}>
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
