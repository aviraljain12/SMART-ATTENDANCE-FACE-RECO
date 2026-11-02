// Supabase Edge Function: get-dashboard-stats
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
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();

    if (profile.role === "admin") {
      const { count: totalUsers } = await supabaseClient
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("role", "employee");

      const { data: todayAttendance, count: presentToday } = await supabaseClient
        .from("attendance")
        .select("*", { count: "exact" })
        .eq("organization_id", profile.organization_id)
        .eq("attendance_date", today);

      return new Response(
        JSON.stringify({
          totalUsers: totalUsers || 0,
          presentToday: presentToday || 0,
          absentToday: Math.max(0, (totalUsers || 0) - (presentToday || 0)),
          todayAttendance: todayAttendance || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      const { data: userRecords } = await supabaseClient
        .from("attendance")
        .select("*")
        .eq("user_id", user.id)
        .order("attendance_date", { ascending: false });

      const todayRecord = userRecords?.find((r) => r.attendance_date === today);

      return new Response(
        JSON.stringify({
          todayRecord,
          totalPresent: userRecords?.length || 0,
          records: userRecords || [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
