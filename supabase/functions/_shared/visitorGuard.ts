// Visitor (demo, no-account) sessions must never reach AI features.
export const VISITOR_USER_ID = "15ed5718-7392-45a8-9d97-003c4871bf99";

export function isVisitorRequest(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const part = token.split(".")[1];
  if (!part) return false;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return json?.sub === VISITOR_USER_ID;
  } catch {
    return false;
  }
}

export function visitorGuard(req: Request, cors: Record<string, string> = {}): Response | null {
  if (!isVisitorRequest(req)) return null;
  return new Response(
    JSON.stringify({ error: "L'IA est désactivée en mode visiteur. Créez un compte pour l'utiliser." }),
    { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
  );
}
