import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: user, error: createError } = await supabase.auth.admin.createUser({
    email: "mateo.claude26@gmail.com",
    password: "Nahmani2626",
    email_confirm: true,
    user_metadata: { first_name: "Lenny", last_name: "Nahmani" },
  });

  if (createError) {
    return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
  }

  return new Response(JSON.stringify({ success: true, userId: user.user.id }));
});
