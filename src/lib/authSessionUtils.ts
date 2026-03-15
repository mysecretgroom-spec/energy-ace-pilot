import type { Session } from "@supabase/supabase-js";

const AUTH_STORAGE_KEY_REGEX = /^sb-.*-auth-token$/;

const isInvalidTokenPlaceholder = (value: unknown): boolean => {
  if (typeof value !== "string") return true;
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || normalized === "undefined" || normalized === "null";
};

const isLikelyJwt = (value: unknown): boolean => {
  if (isInvalidTokenPlaceholder(value)) return false;
  return (value as string).split(".").length === 3;
};

export const hasMalformedAuthTokenError = (error: unknown): boolean => {
  const message =
    typeof error === "string"
      ? error
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: string }).message)
        : "";

  return /(invalid jwt|token is malformed|unable to parse or verify signature|bad_jwt)/i.test(message);
};

export const isCorruptedSession = (session: Session | null | undefined): boolean => {
  if (!session) return false;

  if (!isLikelyJwt(session.access_token)) {
    return true;
  }

  return isInvalidTokenPlaceholder(session.refresh_token);
};

export const clearCorruptedAuthStorage = (): number => {
  if (typeof window === "undefined") return 0;

  const keysToRemove: string[] = [];

  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key || !AUTH_STORAGE_KEY_REGEX.test(key)) continue;

    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      keysToRemove.push(key);
      continue;
    }

    try {
      const parsed = JSON.parse(rawValue) as { access_token?: unknown; refresh_token?: unknown };
      if (!isLikelyJwt(parsed.access_token) || isInvalidTokenPlaceholder(parsed.refresh_token)) {
        keysToRemove.push(key);
      }
    } catch {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  return keysToRemove.length;
};
