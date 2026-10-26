import { createClient } from "npm:@supabase/supabase-js@2";

export async function getAuthUser(req: Request) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
