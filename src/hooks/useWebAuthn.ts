import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
const generateChallenge = (): Uint8Array => {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
};

export function useWebAuthn() {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Check if WebAuthn is supported
  const checkSupport = useCallback(async (): Promise<boolean> => {
    try {
      if (!window.PublicKeyCredential) {
        setIsSupported(false);
        return false;
      }
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setIsSupported(available);
      return available;
    } catch {
      setIsSupported(false);
      return false;
    }
  }, []);

  // Check if user has a registered credential
  const checkRegistration = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("webauthn_credential_id")
        .eq("user_id", user.id)
        .single();
      
      if (error) {
        console.error("Error checking WebAuthn registration:", error);
        return false;
      }
      
      const registered = !!data?.webauthn_credential_id;
      setIsRegistered(registered);
      return registered;
    } catch {
      return false;
    }
  }, [user]);

  // Register a new credential (called when user enables biometric)
  const register = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    setIsLoading(true);
    try {
      const challenge = generateChallenge();
      
      // Create credential options
      const createCredentialOptions: CredentialCreationOptions = {
        publicKey: {
          challenge: challenge.buffer as ArrayBuffer,
          rp: {
            name: "Energy Ace Pilot",
            id: window.location.hostname,
          },
          user: {
            id: new TextEncoder().encode(user.id),
            name: user.email || "user",
            displayName: user.email || "Utilisateur",
          },
          pubKeyCredParams: [
            { alg: -7, type: "public-key" }, // ES256
            { alg: -257, type: "public-key" }, // RS256
          ],
          timeout: 60000,
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Use device biometric (Face ID, Touch ID)
            userVerification: "required",
            residentKey: "preferred",
          },
          attestation: "none",
        },
      };

      // Create the credential
      const credential = await navigator.credentials.create(createCredentialOptions) as PublicKeyCredential;
      
      if (!credential) {
        throw new Error("Failed to create credential");
      }

      // Store the credential ID in the database
      const credentialId = bufferToBase64(credential.rawId);
      
      const { error } = await supabase
        .from("profiles")
        .update({ 
          webauthn_credential_id: credentialId,
          biometric_enabled: true 
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      setIsRegistered(true);
      return true;
    } catch (error) {
      console.error("WebAuthn registration error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Authenticate with biometric (called when user wants to access protected feature)
  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    setIsLoading(true);
    try {
      // Get the stored credential ID
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("webauthn_credential_id")
        .eq("user_id", user.id)
        .single();
      
      if (fetchError || !data?.webauthn_credential_id) {
        console.error("No credential found for authentication");
        return false;
      }

      const credentialId = base64ToBuffer(data.webauthn_credential_id);
      const challenge = generateChallenge();

      // Authentication options
      const getCredentialOptions: CredentialRequestOptions = {
        publicKey: {
          challenge: challenge.buffer as ArrayBuffer,
          timeout: 60000,
          rpId: window.location.hostname,
          allowCredentials: [
            {
              id: credentialId,
              type: "public-key",
              transports: ["internal"], // Platform authenticator
            },
          ],
          userVerification: "required",
        },
      };

      // Get the credential (triggers Face ID / Touch ID)
      const assertion = await navigator.credentials.get(getCredentialOptions);
      
      if (!assertion) {
        return false;
      }

      // Authentication successful
      return true;
    } catch (error) {
      console.error("WebAuthn authentication error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Unregister (called when user disables biometric)
  const unregister = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          webauthn_credential_id: null,
          biometric_enabled: false 
        })
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      setIsRegistered(false);
      return true;
    } catch (error) {
      console.error("WebAuthn unregister error:", error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    isRegistered,
    isLoading,
    checkSupport,
    checkRegistration,
    register,
    authenticate,
    unregister,
  };
}
