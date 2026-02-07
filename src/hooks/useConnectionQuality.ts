import { useState, useEffect } from "react";

/**
 * Detects whether the device has a usable internet connection.
 * Uses the Network Information API (when available) to detect weak connections
 * (2G, slow-2g) and automatically treats them as offline.
 * Falls back to navigator.onLine for browsers without Network Information API.
 */

interface NetworkInformation extends EventTarget {
  effectiveType: "slow-2g" | "2g" | "3g" | "4g";
  downlink: number;
  rtt: number;
  saveData: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

function getConnection(): NetworkInformation | undefined {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection;
}

const WEAK_TYPES = new Set(["slow-2g", "2g"]);

function checkEffectivelyOffline(): boolean {
  // If browser says offline, it's offline
  if (!navigator.onLine) return true;

  // Check Network Information API for weak connection
  const conn = getConnection();
  if (conn) {
    // Weak effective type (2G or worse)
    if (WEAK_TYPES.has(conn.effectiveType)) return true;
    // Very high RTT (>2s) or very low downlink (<0.1 Mbps)
    if (conn.rtt > 2000 || conn.downlink < 0.1) return true;
  }

  return false;
}

export function useConnectionQuality() {
  const [isEffectivelyOffline, setIsEffectivelyOffline] = useState(checkEffectivelyOffline);

  useEffect(() => {
    const update = () => setIsEffectivelyOffline(checkEffectivelyOffline());

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    const conn = getConnection();
    if (conn) {
      conn.addEventListener("change", update);
    }

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      if (conn) {
        conn.removeEventListener("change", update);
      }
    };
  }, []);

  return {
    isEffectivelyOffline,
    isOnline: !isEffectivelyOffline,
  };
}
