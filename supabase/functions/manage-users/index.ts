import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const authHeader = req.headers.get("Authorization")!;

    // Verify the caller is an admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if caller is admin
    const { data: callerRole } = await adminClient.from("user_roles").select("role").eq("user_id", caller.id).single();
    if (!callerRole || callerRole.role !== "admin") {
      return new Response(JSON.stringify({ error: "صلاحية الأدمن مطلوبة" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { action, ...body } = await req.json();

    if (action === "create") {
      const { email, password, full_name, role, permissions } = body;

      // Create user with admin API
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const userId = newUser.user.id;

      // Ensure profile exists (trigger may or may not fire via admin API)
      await adminClient.from("profiles").upsert({
        user_id: userId,
        full_name: full_name,
        force_password_change: true,
      }, { onConflict: "user_id" });

      // Set role (trigger no longer creates default, but upsert for safety)
      await adminClient.from("user_roles").upsert({
        user_id: userId,
        role: role || "customized",
      }, { onConflict: "user_id" });

      // Set permissions if customized
      if (role === "customized" && permissions) {
        await adminClient.from("user_permissions").upsert({
          user_id: userId,
          permissions,
        }, { onConflict: "user_id" });
      }

      return new Response(JSON.stringify({ success: true, user_id: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { user_id, role, permissions, full_name } = body;

      // Update role
      await adminClient.from("user_roles").upsert({
        user_id,
        role: role || "customized",
      }, { onConflict: "user_id" });

      // Update permissions
      if (role === "customized" && permissions) {
        await adminClient.from("user_permissions").upsert({
          user_id,
          permissions,
        }, { onConflict: "user_id" });
      } else if (role === "admin") {
        await adminClient.from("user_permissions").delete().eq("user_id", user_id);
      }

      // Update profile name if provided
      if (full_name) {
        await adminClient.from("profiles").upsert({
          user_id,
          full_name,
        }, { onConflict: "user_id" });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      const { user_id } = body;
      
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "لا يمكنك حذف حسابك" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await adminClient.from("user_permissions").delete().eq("user_id", user_id);
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
      
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list") {
      const { data: { users }, error } = await adminClient.auth.admin.listUsers();
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: roles } = await adminClient.from("user_roles").select("*");
      const { data: perms } = await adminClient.from("user_permissions").select("*");
      const { data: profiles } = await adminClient.from("profiles").select("*");

      const enriched = users.map((u) => ({
        id: u.id,
        email: u.email,
        full_name: profiles?.find((p) => p.user_id === u.id)?.full_name || u.user_metadata?.full_name || u.email,
        role: roles?.find((r) => r.user_id === u.id)?.role || "customized",
        permissions: perms?.find((p) => p.user_id === u.id)?.permissions || {},
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      }));

      return new Response(JSON.stringify(enriched), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset_password") {
      const { user_id, new_password } = body;
      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await adminClient.from("profiles").upsert({
        user_id,
        force_password_change: true,
      }, { onConflict: "user_id" });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
