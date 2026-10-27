import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type GoogleConnectionStatus = { connected: boolean; email?: string | null; reconnectRequired?: boolean; configured?: boolean; services?: { gmail: boolean; drive: boolean; calendar: boolean } };

export async function callGoogleAccount<T = GoogleConnectionStatus>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("google-account", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const details = await error.context.json().catch(() => null);
      throw new Error(details?.error ?? "Connexion Google indisponible");
    }
    throw new Error(error.message);
  }
  return data as T;
}

export async function connectGoogleAccount(): Promise<void> {
  const popup = window.open("", "debalepro-google", "width=600,height=720");
  if (!popup) throw new Error("Autorise l'ouverture de la fenêtre Google, puis réessaie.");
  let cleanup = () => {};
  try {
    const { authorizationUrl } = await callGoogleAccount<{ authorizationUrl: string }>({ action: "start", origin: window.location.origin });
    await new Promise<void>((resolve, reject) => {
      let timer: number;
      const listener = (event: MessageEvent) => {
        if (event.origin !== window.location.origin || event.source !== popup || event.data?.type !== "googleAccountComplete") return;
        cleanup();
        if (event.data.ok === true) resolve();
        else reject(new Error(event.data.error ?? "Connexion Google annulée"));
      };
      cleanup = () => { window.removeEventListener("message", listener); window.clearInterval(timer); };
      window.addEventListener("message", listener);
      const deadline = Date.now() + 600_000;
      timer = window.setInterval(() => {
        if (!popup.closed && Date.now() < deadline) return;
        cleanup(); reject(new Error("Connexion Google interrompue. Réessaie."));
      }, 500);
      popup.location.href = authorizationUrl;
    });
    window.dispatchEvent(new Event("google-connection-changed"));
  } finally { cleanup(); popup.close(); }
}