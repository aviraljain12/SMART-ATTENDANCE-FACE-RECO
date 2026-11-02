// Supabase Edge Function: manage-users
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

    const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();
    if (profile.role !== "admin") return new Response("Forbidden", { status: 403 });

    const body = await req.json();
    const { action, payload } = body;

    if (action === "list_users") {
      const { data: users, error } = await supabaseClient
        .from("profiles")
        .select("*, face_registrations(is_active, created_at)")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return new Response(JSON.stringify({ users }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "toggle_active") {
      const { userId, isActive } = payload;
      const { data, error } = await supabaseClient
        .from("profiles")
        .update({ is_active: isActive })
        .eq("id", userId)
        .eq("organization_id", profile.organization_id)
        .select()
        .single();

      if (error) throw error;
      return new Response(JSON.stringify({ user: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
