// Mutualise les requêtes GET identiques lancées en même temps vers le backend
// (profil, planning, régies demandés par plusieurs écrans au démarrage).
// Une seule requête réseau part ; chaque appelant reçoit une copie de la réponse.
const inflight = new Map<string, Promise<Response>>();

export function installFetchDedupe() {
  if (typeof window === "undefined" || (window as any).__fetchDedupe) return;
  (window as any).__fetchDedupe = true;
  const original = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method !== "GET" || !url.includes(".supabase.co/rest/v1/") || init?.signal) {
      return original(input, init);
    }
    const h = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
    const key = `${url}|${h.get("authorization") || ""}|${h.get("accept") || ""}|${h.get("range") || ""}`;
    const existing = inflight.get(key);
    if (existing) return existing.then((r) => r.clone());
    const p = original(input, init).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p.then((r) => r.clone());
  };
}
