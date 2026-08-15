// supabase/functions/create-user/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { fullName, email, username, role, password } = await req.json();

    // 1. Verify the caller is logged in and is a super_admin, using their OWN token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) throw new Error("Not authenticated");

    const { data: callerProfile } = await callerClient
      .from("profiles").select("role").eq("id", caller.id).single();
    if (callerProfile?.role !== "super_admin") throw new Error("Only super_admin can create users");

    // 2. Now do the actual privileged work, using the service_role key
    //    (never exposed to the browser — this only exists inside this function)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // generate a secure temporary password if one wasn't provided
    function genPassword(len = 12) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
      let out = "";
      const rnd = crypto.getRandomValues(new Uint32Array(len));
      for (let i = 0; i < len; i++) {
        out += chars[rnd[i] % chars.length];
      }
      return out;
    }
    const finalPassword = password || genPassword(12);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      throw new Error(createError?.message || "Could not create auth user");
    }

   const { error: profileError } = await adminClient.from("profiles").upsert({
  id: created.user.id,
  full_name: fullName,
  username,
  email,
  role,
  status: "active",
});
    if (profileError) {
      // roll back the auth account so we don't leave an orphaned login with no profile
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw new Error(profileError.message);
    }

    return new Response(JSON.stringify({ ok: true, password: finalPassword, userId: created.user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-user error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});