// Pure policy shared by custom OAuth and its regression tests.
export const UNIFIED_GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

export function googleServices(scopes: string[]) {
  return {
    gmail: scopes.includes("https://www.googleapis.com/auth/gmail.readonly") && scopes.includes("https://www.googleapis.com/auth/gmail.send"),
    drive: scopes.includes("https://www.googleapis.com/auth/drive.file"),
    calendar: scopes.includes("https://www.googleapis.com/auth/calendar.readonly") && scopes.includes("https://www.googleapis.com/auth/calendar.events"),
  };
}

export function googleReturnUri(origin: string): string {
  const url = new URL(origin);
  const allowed = new Set([
    "https://xn--dbalepro-b1a.app",
    "https://energy-ace-pilot.lovable.app",
    "https://id-preview--fdcd1698-fd4a-4278-bd39-8e8b51039a6a.lovable.app",
    "http://localhost:8080",
  ]);
  if (!allowed.has(url.origin) || url.href !== `${url.origin}/`) throw new Error("Adresse de retour Google non autorisée");
  return `${url.origin}/oauth/google-drive/return`;
}

export function validGoogleState(row: { user_id: string; expires_at: string } | null, userId: string, now: number) {
  return !!row && row.user_id === userId && Date.parse(row.expires_at) > now;
}