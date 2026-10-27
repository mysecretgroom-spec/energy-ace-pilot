import { useCallback, useEffect, useState } from "react";
import { callGoogleAccount, type GoogleConnectionStatus } from "@/lib/googleConnection";

export function useGoogleConnection() {
  const [status, setStatus] = useState<GoogleConnectionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { setStatus(await callGoogleAccount({ action: "status" })); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Google indisponible"); }
  }, []);
  useEffect(() => {
    void refresh();
    const changed = () => { void refresh(); };
    window.addEventListener("google-connection-changed", changed);
    return () => window.removeEventListener("google-connection-changed", changed);
  }, [refresh]);
  return { status, error, refresh };
}