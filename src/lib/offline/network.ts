import { kvGet, kvSet } from "./store";

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === "string" ? err : (err as { message?: string }).message || String(err);
  return /Failed to fetch|Load failed|NetworkError|network request failed|fetch failed|timeout|ERR_INTERNET|ERR_NETWORK/i.test(msg);
}

export function isDeviceOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

type QueryResult<T> = { data: T | null; error: unknown };

const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T> =>
  Promise.race([Promise.resolve(p), new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/**
 * Lecture réseau avec repli sur le dernier résultat enregistré.
 * Toute lecture réussie met à jour le cache ; une coupure réseau renvoie le cache.
 */
export async function cachedQuery<T>(
  key: string,
  runQuery: () => PromiseLike<QueryResult<T>>,
  timeoutMs = 8000,
): Promise<QueryResult<T> & { fromCache: boolean }> {
  const fromCache = async () => {
    const cached = await kvGet<{ data: T }>(`q:${key}`);
    return { data: cached ? cached.data : null, error: null, fromCache: true };
  };
  if (isDeviceOffline()) return fromCache();
  try {
    const res = await withTimeout(runQuery(), timeoutMs);
    if (res.error) {
      if (isNetworkError(res.error)) return fromCache();
      return { ...res, fromCache: false };
    }
    await kvSet(`q:${key}`, { data: res.data, at: Date.now() });
    return { data: res.data, error: null, fromCache: false };
  } catch (err) {
    if (isNetworkError(err)) return fromCache();
    throw err;
  }
}
