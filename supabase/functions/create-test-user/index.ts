import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Create user
  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email: "mateo.claude26@gmail.com",
    password: "Nahmani2626",
    email_confirm: true,
    user_metadata: {
      first_name: "Lenny",
      last_name: "Nahmani",
    },
  });

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
  }

  const userId = user.user.id;

  // Update access_state to beta tester with no expiry
  await supabase.rpc("update_saas_access_state", { p_user_id: userId, p_app_access: "active" });

  // Set beta tester flag
  const { error: betaError } = await supabase
    .from("rpc")
    .select()
    .limit(0);

  // Direct SQL via service role
  const { error: updateError } = await supabase
    .rpc("get_saas_access_state", { p_user_id: userId });

  // Use direct table update via service role
  const res = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/rpc/update_saas_access_state`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      },
      body: JSON.stringify({ p_user_id: userId, p_app_access: "active" }),
    }
  );

  // Set beta tester directly
  const betaRes = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/rest/v1/access_state?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ is_beta_tester: true, beta_expires_at: null, app_access: "active" }),
    }
  );

  return new Response(JSON.stringify({ 
    success: true, 
    userId,
    email: "mateo.claude26@gmail.com",
    name: "Lenny Nahmani"
  }), { status: 200 });
});
