import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void>;
    OneSignal?: any;
  }
}

export function useOneSignal() {
  const { user } = useAuth();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<"default" | "granted" | "denied">("default");
  const [appId, setAppId] = useState<string | null>(null);
  const initAttempted = useRef(false);

  // Fetch OneSignal App ID from backend
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-onesignal-config");
        if (error) {
          console.error("Error fetching OneSignal config:", error);
          return;
        }
        if (data?.appId) {
          setAppId(data.appId);
        }
      } catch (error) {
        console.error("Error fetching OneSignal config:", error);
      }
    };

    fetchConfig();
  }, []);

  // Load OneSignal SDK
  useEffect(() => {
    if (!appId || initAttempted.current) return;
    initAttempted.current = true;

    // Check if already loaded
    if (window.OneSignal) {
      setIsInitialized(true);
      return;
    }

    // Initialize OneSignal
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    
    // Load the SDK script
    const script = document.createElement("script");
    script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    script.defer = true;
    document.head.appendChild(script);

    window.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerParam: { scope: "/" },
          serviceWorkerPath: "/OneSignalSDKWorker.js",
          notifyButton: {
            enable: false, // We'll use our own UI
          },
        });
        
        setIsInitialized(true);
        
        // Check current permission state
        const currentPermission = await OneSignal.Notifications.permission;
        setPermission(currentPermission ? "granted" : "default");
        
        // Check subscription status
        const subscribed = await OneSignal.User.PushSubscription.optedIn;
        setIsSubscribed(subscribed);

        // Listen for subscription changes
        OneSignal.User.PushSubscription.addEventListener("change", (event: any) => {
          setIsSubscribed(event.current.optedIn);
        });

        console.log("✅ OneSignal initialized successfully");
      } catch (error) {
        console.error("OneSignal initialization error:", error);
      }
    });
  }, [appId]);

  // Set external user ID when user logs in
  useEffect(() => {
    if (!isInitialized || !user || !window.OneSignal) return;

    window.OneSignalDeferred?.push(async (OneSignal: any) => {
      try {
        // Set external user ID for targeting
        await OneSignal.login(user.id);
        
        // Add user tags for segmentation
        await OneSignal.User.addTags({
          user_id: user.id,
          email: user.email || "",
        });
        
        console.log("✅ OneSignal user identified:", user.id);
      } catch (error) {
        console.error("Error setting OneSignal user:", error);
      }
    });
  }, [isInitialized, user]);

  // Request permission and subscribe
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isInitialized || !window.OneSignal) {
      console.warn("OneSignal not initialized");
      return false;
    }

    return new Promise((resolve) => {
      window.OneSignalDeferred?.push(async (OneSignal: any) => {
        try {
          // Request permission
          await OneSignal.Notifications.requestPermission();
          
          const granted = OneSignal.Notifications.permission;
          setPermission(granted ? "granted" : "denied");
          
          if (granted) {
            // Opt in to push
            await OneSignal.User.PushSubscription.optIn();
            setIsSubscribed(true);
          }
          
          resolve(granted);
        } catch (error) {
          console.error("Error requesting permission:", error);
          resolve(false);
        }
      });
    });
  }, [isInitialized]);

  // Unsubscribe from push
  const unsubscribe = useCallback(async () => {
    if (!isInitialized || !window.OneSignal) return;

    window.OneSignalDeferred?.push(async (OneSignal: any) => {
      try {
        await OneSignal.User.PushSubscription.optOut();
        setIsSubscribed(false);
      } catch (error) {
        console.error("Error unsubscribing:", error);
      }
    });
  }, [isInitialized]);

  // Send a tag (for segmentation)
  const addTag = useCallback(async (key: string, value: string) => {
    if (!isInitialized || !window.OneSignal) return;

    window.OneSignalDeferred?.push(async (OneSignal: any) => {
      try {
        await OneSignal.User.addTag(key, value);
      } catch (error) {
        console.error("Error adding tag:", error);
      }
    });
  }, [isInitialized]);

  return {
    isInitialized,
    isSubscribed,
    permission,
    requestPermission,
    unsubscribe,
    addTag,
    isSupported: "Notification" in window && "serviceWorker" in navigator,
  };
}
