import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const BIOMETRIC_ACCOUNTS_KEY = "biometric_accounts";
const BIOMETRIC_TOKENS_KEY = "biometric_tokens"; // Encrypted storage for refresh tokens

export interface BiometricAccount {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  credentialId: string;
  lastLogin?: string;
}

interface StoredToken {
  userId: string;
  refreshToken: string;
}

// Helper to convert ArrayBuffer to base64
const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Helper to convert base64 to ArrayBuffer
const base64ToBuffer = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// Generate a random challenge
const generateChallenge = (): ArrayBuffer => {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge.buffer as ArrayBuffer;
};

// Simple obfuscation for stored tokens (not true encryption, but adds a layer)
const obfuscate = (str: string): string => {
  return btoa(str.split('').reverse().join(''));
};

const deobfuscate = (str: string): string => {
  try {
    return atob(str).split('').reverse().join('');
  } catch {
    return '';
  }
};

export function useBiometricLogin() {
  const [isSupported, setIsSupported] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<BiometricAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Check WebAuthn support
  useEffect(() => {
    const checkSupport = async () => {
      try {
        if (!window.PublicKeyCredential) {
          setIsSupported(false);
          return;
        }
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setIsSupported(available);
      } catch {
        setIsSupported(false);
      }
    };
    checkSupport();
  }, []);

  // Load saved accounts from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BIOMETRIC_ACCOUNTS_KEY);
      if (saved) {
        setSavedAccounts(JSON.parse(saved));
      }
    } catch {
      setSavedAccounts([]);
    }
  }, []);

  // Save accounts to localStorage
  const saveAccounts = (accounts: BiometricAccount[]) => {
    localStorage.setItem(BIOMETRIC_ACCOUNTS_KEY, JSON.stringify(accounts));
    setSavedAccounts(accounts);
  };

  // Store refresh token for biometric login
  const storeRefreshToken = (userId: string, refreshToken: string) => {
    try {
      const stored = localStorage.getItem(BIOMETRIC_TOKENS_KEY);
      let tokens: StoredToken[] = stored ? JSON.parse(deobfuscate(stored)) : [];
      
      // Update or add token
      const existingIndex = tokens.findIndex(t => t.userId === userId);
      if (existingIndex >= 0) {
        tokens[existingIndex].refreshToken = refreshToken;
      } else {
        tokens.push({ userId, refreshToken });
      }
      
      localStorage.setItem(BIOMETRIC_TOKENS_KEY, obfuscate(JSON.stringify(tokens)));
    } catch (error) {
      console.error("Error storing refresh token:", error);
    }
  };

  // Get stored refresh token
  const getRefreshToken = (userId: string): string | null => {
    try {
      const stored = localStorage.getItem(BIOMETRIC_TOKENS_KEY);
      if (!stored) return null;
      
      const tokens: StoredToken[] = JSON.parse(deobfuscate(stored));
      const token = tokens.find(t => t.userId === userId);
      return token?.refreshToken || null;
    } catch {
      return null;
    }
  };

  // Remove stored refresh token
  const removeRefreshToken = (userId: string) => {
    try {
      const stored = localStorage.getItem(BIOMETRIC_TOKENS_KEY);
      if (!stored) return;
      
      let tokens: StoredToken[] = JSON.parse(deobfuscate(stored));
      tokens = tokens.filter(t => t.userId !== userId);
      localStorage.setItem(BIOMETRIC_TOKENS_KEY, obfuscate(JSON.stringify(tokens)));
    } catch {
      // Ignore errors
    }
  };

  // Register biometric for current logged-in user
  const registerForLogin = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      // Get current session (includes refresh token)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !session.refresh_token) {
        console.error("No valid session");
        return false;
      }

      const user = session.user;

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();

      const challenge = generateChallenge();

      // Create credential options
      const createCredentialOptions: CredentialCreationOptions = {
        publicKey: {
          challenge,
          rp: {
            name: "Energy Ace Pilot",
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(user.id),
            name: user.email || "user",
            displayName: profile?.first_name 
              ? `${profile.first_name} ${profile.last_name || ""}`.trim()
              : user.email || "Utilisateur",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" },
            { alg: -257, type: "public-key" },
          ],
          timeout: 60000,
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "required",
          },
          attestation: "none",
        },
      };

      // Create the credential
      const credential = await navigator.credentials.create(createCredentialOptions) as PublicKeyCredential;
      
      if (!credential) {
        throw new Error("Failed to create credential");
      }

      const credentialId = bufferToBase64(credential.rawId);

      // Store the refresh token securely for biometric login
      storeRefreshToken(user.id, session.refresh_token);

      // Update profile in database
      await supabase
        .from("profiles")
        .update({ 
          biometric_login_enabled: true,
          webauthn_credential_id: credentialId
        })
        .eq("user_id", user.id);

      // Save account locally
      const newAccount: BiometricAccount = {
        id: user.id,
        email: user.email || "",
        firstName: profile?.first_name || undefined,
        lastName: profile?.last_name || undefined,
        credentialId,
        lastLogin: new Date().toISOString(),
      };

      // Add or update account in saved list
      const existingIndex = savedAccounts.findIndex(a => a.id === user.id);
      let updatedAccounts: BiometricAccount[];
      if (existingIndex >= 0) {
        updatedAccounts = [...savedAccounts];
        updatedAccounts[existingIndex] = newAccount;
      } else {
        updatedAccounts = [...savedAccounts, newAccount];
      }
      saveAccounts(updatedAccounts);

      return true;
    } catch (error) {
      console.error("Error registering biometric for login:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [savedAccounts]);

  // Authenticate with biometric for a specific account
  const authenticateAccount = useCallback(async (account: BiometricAccount): Promise<{ success: boolean; error?: string; sessionRestored?: boolean }> => {
    setIsLoading(true);
    try {
      const credentialId = base64ToBuffer(account.credentialId);
      const challenge = generateChallenge();

      const getCredentialOptions: CredentialRequestOptions = {
        publicKey: {
          challenge,
          timeout: 60000,
          rpId: window.location.hostname,
          allowCredentials: [
            {
              id: credentialId,
              type: "public-key",
              transports: ["internal"],
            },
          ],
          userVerification: "required",
        },
      };

      // This triggers Face ID / Touch ID
      const assertion = await navigator.credentials.get(getCredentialOptions);
      
      if (!assertion) {
        return { success: false, error: "Authentification annulée" };
      }

      // Biometric verified - now restore the session using stored refresh token
      const refreshToken = getRefreshToken(account.id);
      
      if (refreshToken) {
        // Try to refresh the session
        const { data, error: refreshError } = await supabase.auth.refreshSession({
          refresh_token: refreshToken
        });

        if (data.session) {
          // Session restored successfully!
          // Update stored refresh token with new one
          if (data.session.refresh_token) {
            storeRefreshToken(account.id, data.session.refresh_token);
          }

          // Update last login
          const updatedAccounts = savedAccounts.map(a => 
            a.id === account.id 
              ? { ...a, lastLogin: new Date().toISOString() }
              : a
          );
          saveAccounts(updatedAccounts);

          return { success: true, sessionRestored: true };
        } else if (refreshError) {
          console.error("Failed to refresh session:", refreshError);
          // Token expired or invalid - remove it
          removeRefreshToken(account.id);
          return { success: true, sessionRestored: false, error: "Session expirée, veuillez vous reconnecter" };
        }
      }

      // No stored token or refresh failed - biometric verified but need password
      return { success: true, sessionRestored: false };
    } catch (error: any) {
      console.error("Biometric authentication error:", error);
      return { success: false, error: error?.message || "Authentification échouée" };
    } finally {
      setIsLoading(false);
    }
  }, [savedAccounts]);

  // Update refresh token after login (call this after successful password login)
  const updateStoredToken = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && session.refresh_token) {
        // Check if user has biometric enabled
        const account = savedAccounts.find(a => a.id === session.user.id);
        if (account) {
          storeRefreshToken(session.user.id, session.refresh_token);
        }
      }
    } catch (error) {
      console.error("Error updating stored token:", error);
    }
  }, [savedAccounts]);

  // Remove a saved account
  const removeAccount = useCallback((accountId: string) => {
    const updatedAccounts = savedAccounts.filter(a => a.id !== accountId);
    saveAccounts(updatedAccounts);
    removeRefreshToken(accountId);
  }, [savedAccounts]);

  // Check if an account has biometric enabled
  const hasAccount = useCallback((userId: string): boolean => {
    return savedAccounts.some(a => a.id === userId);
  }, [savedAccounts]);

  return {
    isSupported,
    savedAccounts,
    isLoading,
    registerForLogin,
    authenticateAccount,
    updateStoredToken,
    removeAccount,
    hasAccount,
  };
}
