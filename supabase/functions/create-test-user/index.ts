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

  // Set beta tester with unlimited access via SQL
  const { error: sqlError } = await supabase.rpc("update_saas_access_state", {
    p_user_id: userId,
    p_app_access: "active",
  });

  // Also need to set is_beta_tester - use admin SQL
  const { data, error } = await supabase.auth.admin.listUsers();
  
  // Use the postgrest endpoint with service role to update saas.access_state
  // Since saas schema isn't exposed via PostgREST, use pg function approach
  // Let's call a raw query via the SQL endpoint
  
  return new Response(JSON.stringify({ 
    success: true, 
    userId,
    accessUpdate: sqlError ? sqlError.message : "ok",
    note: "User created, need to set beta_tester via migration"
  }), { status: 200 });
});
