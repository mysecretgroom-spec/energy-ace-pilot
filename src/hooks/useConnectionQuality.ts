import { useState, useEffect } from "react";

/**
 * Detects whether the device has a usable internet connection.
 * Uses the Network Information API (when available) to detect weak connections
 * (2G, slow-2g) and automatically treats them as offline.
 * Falls back to navigator.onLine for browsers without Network Information API.
 */

interface NetworkInformation extends EventTarget {
  effectiveType: "slow-2g" | "2g" | "3g" | "4g";
  type?: "bluetooth" | "cellular" | "ethernet" | "none" | "wifi" | "wimax" | "other" | "unknown";
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

const WIFI_TYPES = new Set(["wifi", "ethernet", "wimax"]);

function checkEffectivelyOffline(): boolean {
  // If browser says offline, it's offline
  if (!navigator.onLine) return true;

  const conn = getConnection();
  if (conn) {
    // If connected via WiFi/Ethernet, trust it — don't flag as offline
    // even if effectiveType reports weak (some devices misreport over WiFi)
    if (conn.type && WIFI_TYPES.has(conn.type)) return false;

    // On cellular: weak effective type (2G or worse) → offline
    if (WEAK_TYPES.has(conn.effectiveType)) return true;
    // On cellular: very high RTT (>2s) or very low downlink (<0.1 Mbps)
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
