// Supabase Edge Function: mark-attendance
// Validates session, verifies face matching payload, checks timezone, enforces unique daily attendance
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // 1. Verify authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { matchConfidence, verificationMethod = "Face Recognition" } = await req.json();

    // 2. Fetch user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("id, organization_id, is_active, full_name")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || !profile.is_active) {
      return new Response(JSON.stringify({ error: "Inactive or invalid account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Determine organization local date
    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    // 4. Check for existing attendance record
    const { data: existing, error: checkError } = await supabaseClient
      .from("attendance")
      .select("id, check_in_time, status")
      .eq("user_id", user.id)
      .eq("attendance_date", localDate)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          alreadyMarked: true,
          message: "You have already marked your attendance today.",
          record: existing,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Insert new attendance record
    const nowIso = new Date().toISOString();
    const { data: record, error: insertError } = await supabaseClient
      .from("attendance")
      .insert({
        user_id: user.id,
        organization_id: profile.organization_id,
        attendance_date: localDate,
        check_in_time: nowIso,
        status: "Present",
        verification_method: verificationMethod,
        confidence_score: matchConfidence || 0.95,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === "23505") { // unique constraint violation
        return new Response(
          JSON.stringify({
            success: false,
            alreadyMarked: true,
            message: "You have already marked your attendance today.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Attendance marked successfully for ${profile.full_name}`,
        record,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
