import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("Notification" in window && "serviceWorker" in navigator);
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === "granted";
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      return false;
    }
  }, [isSupported]);

  const sendNotification = useCallback(
    (title: string, options?: NotificationOptions) => {
      if (permission !== "granted") return;

      try {
        // Try service worker notification first (works in background)
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              icon: "/pwa-icons/icon-192x192.png",
              badge: "/pwa-icons/icon-72x72.png",
              ...options,
            });
          });
        } else {
          // Fallback to regular notification
          new Notification(title, {
            icon: "/pwa-icons/icon-192x192.png",
            ...options,
          });
        }
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    },
    [permission]
  );

  const notifyNewRdv = useCallback(
    (rdv: { nom_client: string; date_heure: string; adresse?: string }) => {
      const date = new Date(rdv.date_heure);
      const formattedDate = date.toLocaleDateString("fr-FR", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      sendNotification("📅 Nouveau RDV importé", {
        body: `${rdv.nom_client}\n${formattedDate}${rdv.adresse ? `\n📍 ${rdv.adresse}` : ""}`,
        tag: `rdv-${Date.now()}`,
        requireInteraction: true,
        data: { type: "new_rdv", rdv },
      });
    },
    [sendNotification]
  );

  // Subscribe to new RDVs via Supabase Realtime
  useEffect(() => {
    if (!user || permission !== "granted") return;

    const channel = supabase
      .channel("rdv-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "rdv",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newRdv = payload.new as {
            nom_client: string;
            date_heure: string;
            adresse?: string;
          };
          notifyNewRdv(newRdv);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, permission, notifyNewRdv]);

  return {
    isSupported,
    permission,
    requestPermission,
    sendNotification,
    notifyNewRdv,
  };
}
