import { useEffect, useState, useRef } from "react";

interface UserPosition {
  latitude: number;
  longitude: number;
}

type GeolocationPermission = "granted" | "prompt" | "denied" | "unknown";

interface UseUserGeolocationResult {
  position: UserPosition | null;
  permission: GeolocationPermission;
  error: string | null;
}

/**
 * Demande l'accès à la localisation de l'appareil et suit la position
 * du commercial en temps réel (watchPosition) pour calculer la distance
 * vers son prochain RDV.
 */
export function useUserGeolocation(enabled: boolean = true): UseUserGeolocationResult {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [permission, setPermission] = useState<GeolocationPermission>("unknown");
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("denied");
      setError("Géolocalisation non supportée par cet appareil");
      return;
    }

    let cancelled = false;

    // Suivi du statut de permission (si l'API est disponible)
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((status) => {
          if (!cancelled) setPermission(status.state as GeolocationPermission);
          status.onchange = () => {
            if (!cancelled) setPermission(status.state as GeolocationPermission);
          };
        })
        .catch(() => {
          /* API Permissions non disponible, on continue quand même */
        });
    }

    // watchPosition déclenche la demande d'accès à la localisation
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setPermission("granted");
        setError(null);
      },
      (err) => {
        if (cancelled) return;
        if (err.code === err.PERMISSION_DENIED) {
          setPermission("denied");
          setError("Accès à la localisation refusé");
        } else if (err.code === err.TIMEOUT) {
          setError("Localisation indisponible (délai dépassé)");
        } else {
          setError("Position indisponible");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 60000, // cache 1 min pour économiser la batterie
      }
    );

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [enabled]);

  return { position, permission, error };
}
