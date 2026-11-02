// Supabase Edge Function: export-attendance
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

    const { data: rows } = await supabaseClient
      .from("attendance")
      .select("attendance_date, check_in_time, status, verification_method, profiles(full_name, employee_id, department)")
      .eq("organization_id", profile.organization_id)
      .order("attendance_date", { ascending: false });

    // Format as CSV
    let csv = "Date,Employee ID,Full Name,Department,Check-In Time,Status,Method\n";
    rows?.forEach((r) => {
      csv += `"${r.attendance_date}","${r.profiles?.employee_id || ''}","${r.profiles?.full_name || ''}","${r.profiles?.department || ''}","${r.check_in_time}","${r.status}","${r.verification_method}"\n`;
    });

    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="attendance_report.csv"',
      },
    });
  } catch (err) {
    return new Response(err.message, { status: 500, headers: corsHeaders });
  }
});
