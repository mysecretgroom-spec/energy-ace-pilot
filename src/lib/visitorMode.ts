import { supabase } from "@/integrations/supabase/client";

/** Shared read-only demo account used by the no-account visitor mode (fictitious data). */
export const VISITOR_USER_ID = "15ed5718-7392-45a8-9d97-003c4871bf99";

/** Routes a visitor may open: studies, planning and CRM only. */
const VISITOR_ALLOWED = [/^\/planning/, /^\/crm/, /^\/clients\//, /^\/ventes\//, /^\/etude\//];

export const isVisitorUser = (userId?: string | null) => userId === VISITOR_USER_ID;

export const isVisitorPathAllowed = (pathname: string) => VISITOR_ALLOWED.some((r) => r.test(pathname));

export const VISITOR_NAV_PATHS = ["/planning", "/crm"];

export async function startVisitorSession(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("visitor-session");
  if (error || !data?.token_hash) throw new Error("Mode visiteur indisponible");
  const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
  if (otpError) throw otpError;
}
