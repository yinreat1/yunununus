import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

interface VerifyRequestBody {
  license_key: string;
  device_fingerprint: string;
  device_name?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ valid: false, reason: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body: VerifyRequestBody = await req.json();

    if (!body.license_key || !body.device_fingerprint) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Eksik bilgi: lisans anahtarı ve cihaz parmak izi zorunludur." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Look up the license with customer info
    const { data: license, error: licError } = await supabase
      .from("licenses")
      .select(`
        id,
        license_key,
        status,
        max_devices,
        expires_at,
        customer_id,
        customers (
          id,
          name,
          company_name
        )
      `)
      .eq("license_key", body.license_key)
      .maybeSingle();

    if (licError) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Lisans doğrulama hatası." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!license) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Geçersiz lisans anahtarı." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check status — only active licenses pass
    if (license.status !== "active") {
      return new Response(
        JSON.stringify({
          valid: false,
          reason: `Lans durumu geçersiz: ${license.status}.`,
          license_key: license.license_key,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (license.expires_at) {
      const now = new Date();
      const expiry = new Date(license.expires_at);
      if (now > expiry) {
        // Auto-update status to expired
        await supabase
          .from("licenses")
          .update({ status: "expired" })
          .eq("id", license.id);

        return new Response(
          JSON.stringify({
            valid: false,
            reason: "Lisans süresi dolmuş.",
            license_key: license.license_key,
            expires_at: license.expires_at,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check device binding
    const { data: devices, error: devError } = await supabase
      .from("devices")
      .select("*")
      .eq("license_id", license.id)
      .eq("is_active", true);

    if (devError) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Cihaz kontrolü hatası." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const existingDevice = devices?.find(
      (d) => d.device_fingerprint === body.device_fingerprint
    );

    if (!existingDevice) {
      // New device — check if we have room
      const activeCount = devices?.length || 0;
      if (activeCount >= license.max_devices) {
        return new Response(
          JSON.stringify({
            valid: false,
            reason: `Cihaz limiti aşıldı. Maksimum ${license.max_devices} cihaz, aktif ${activeCount} cihaz.`,
            license_key: license.license_key,
            max_devices: license.max_devices,
            active_devices: activeCount,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Register the new device
      const { error: insertErr } = await supabase
        .from("devices")
        .insert({
          license_id: license.id,
          device_fingerprint: body.device_fingerprint,
          device_name: body.device_name || null,
          is_active: true,
        });

      if (insertErr) {
        return new Response(
          JSON.stringify({ valid: false, reason: "Cihaz kaydı yapılamadı." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Existing device — update last_seen
      await supabase
        .from("devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", existingDevice.id);
    }

    // Update last_verified_at on the license
    await supabase
      .from("licenses")
      .update({ last_verified_at: new Date().toISOString() })
      .eq("id", license.id);

    const customer = license.customers as any;

    return new Response(
      JSON.stringify({
        valid: true,
        reason: "Lisans geçerli.",
        license_key: license.license_key,
        customer_name: customer?.name || null,
        company_name: customer?.company_name || null,
        expires_at: license.expires_at,
        max_devices: license.max_devices,
        active_devices: existingDevice ? devices.length : (devices?.length || 0) + 1,
        server_time: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, reason: "Sunucu hatası." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
