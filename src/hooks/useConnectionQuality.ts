import { useEffect, useState } from "react";

/**
 * Source unique de vérité pour l'état de connexion.
 *
 * Objectif : ne JAMAIS afficher "hors ligne" pour un simple micro-coupure.
 * - `navigator.onLine` est indicatif uniquement (très bruyant sur mobile).
 * - Un passage hors ligne n'est confirmé qu'après plusieurs sondes réseau ratées.
 * - Le retour en ligne est immédiat dès qu'une sonde réussit.
 * - Une connexion lente n'est PAS considérée comme hors ligne.
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

const PROBE_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ""}/auth/v1/health`;
const PROBE_TIMEOUT_MS = 6000;
/** Nombre de sondes ratées consécutives avant de déclarer l'app hors ligne. */
const FAILURES_BEFORE_OFFLINE = 2;
/** Fréquence des sondes de récupération quand on est hors ligne. */
const OFFLINE_RECHECK_MS = 5000;

type Listener = (offline: boolean) => void;

let offlineConfirmed = false;
let consecutiveFailures = 0;
let probeInFlight: Promise<boolean> | null = null;
let recheckTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(offlineConfirmed));
}

function setOffline(next: boolean) {
  if (offlineConfirmed === next) return;
  offlineConfirmed = next;
  emit();
}

/** Sonde réseau réelle (GET léger vers le backend). */
async function probe(): Promise<boolean> {
  if (probeInFlight) return probeInFlight;

  probeInFlight = (async () => {
    if (!PROBE_URL.startsWith("http")) return navigator.onLine;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
      await fetch(`${PROBE_URL}?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      return true; // Toute réponse HTTP prouve que le réseau répond
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  })();

  try {
    return await probeInFlight;
  } finally {
    probeInFlight = null;
  }
}

function scheduleRecheck() {
  if (recheckTimer) clearTimeout(recheckTimer);
  recheckTimer = setTimeout(() => {
    recheckTimer = null;
    void evaluate();
  }, OFFLINE_RECHECK_MS);
}

async function evaluate() {
  const reachable = await probe();

  if (reachable) {
    consecutiveFailures = 0;
    if (recheckTimer) {
      clearTimeout(recheckTimer);
      recheckTimer = null;
    }
    setOffline(false);
    return;
  }

  consecutiveFailures += 1;
  if (consecutiveFailures >= FAILURES_BEFORE_OFFLINE) {
    setOffline(true);
  }
  scheduleRecheck();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  const onOffline = () => {
    // On ne croit pas l'OS sur parole : on vérifie avant d'alerter l'utilisateur.
    void evaluate();
  };
  const onOnline = () => {
    consecutiveFailures = 0;
    void evaluate();
  };

  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onOnline);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") onOnline();
  });

  const conn = getConnection();
  conn?.addEventListener("change", () => {
    if (offlineConfirmed) void evaluate();
  });

  if (!navigator.onLine) void evaluate();
}

export function useConnectionQuality() {
  const [isEffectivelyOffline, setIsEffectivelyOffline] = useState(offlineConfirmed);

  useEffect(() => {
    start();
    listeners.add(setIsEffectivelyOffline);
    setIsEffectivelyOffline(offlineConfirmed);
    return () => {
      listeners.delete(setIsEffectivelyOffline);
    };
  }, []);

  return {
    isEffectivelyOffline,
    isOnline: !isEffectivelyOffline,
  };
}

/** Vérification ponctuelle (avant une action réseau critique). */
export async function verifyConnectivity(): Promise<boolean> {
  start();
  const reachable = await probe();
  if (reachable) {
    consecutiveFailures = 0;
    setOffline(false);
  }
  return reachable;
}

/** État confirmé (hors React) : utilisé par l'intercepteur réseau. */
export function isOfflineConfirmed(): boolean {
  return offlineConfirmed;
}
