import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value.trim()));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ valid: false, code: "method_not_allowed" }, 405);
  try {
    const body = await req.json();
    const licenseKey = typeof body.license_key === "string" ? body.license_key.trim() : "";
    const deviceId = typeof body.device_id === "string" ? body.device_id.trim() : "";
    const deviceLabel = typeof body.device_label === "string" ? body.device_label.trim().slice(0, 120) : null;
    if (licenseKey.length < 8 || licenseKey.length > 200 || deviceId.length < 8 || deviceId.length > 200) {
      return json({ valid: false, code: "invalid_input" }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ valid: false, code: "server_not_configured" }, 500);
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    // Retain compatibility with historical case-sensitive hashes and current uppercase keys.
    const exactHash = await sha256Hex(licenseKey);
    const normalizedHash = await sha256Hex(licenseKey.toUpperCase());
    const { data: exactMatch, error: exactError } = await supabase.from("propos_licenses")
      .select("id, customer_name, business_name, status, expires_at, max_devices")
      .eq("license_key_hash", exactHash).maybeSingle();
    if (exactError) return json({ valid: false, code: "verification_failed" }, 500);
    let license = exactMatch;
    if (!license && normalizedHash !== exactHash) {
      const { data: normalizedMatch, error: normalizedError } = await supabase.from("propos_licenses")
        .select("id, customer_name, business_name, status, expires_at, max_devices")
        .eq("license_key_hash", normalizedHash).maybeSingle();
      if (normalizedError) return json({ valid: false, code: "verification_failed" }, 500);
      license = normalizedMatch;
    }
    if (!license) return json({ valid: false, code: "license_not_found" });
    if (license.status !== "active") return json({ valid: false, code: "license_inactive" });
    if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) return json({ valid: false, code: "license_expired" });

    const { data: existing, error: existingError } = await supabase.from("propos_license_devices")
      .select("id, revoked_at").eq("license_id", license.id).eq("device_id", deviceId).maybeSingle();
    if (existingError) return json({ valid: false, code: "verification_failed" }, 500);
    if (existing?.revoked_at) return json({ valid: false, code: "device_revoked" });
    if (existing) {
      const { error } = await supabase.from("propos_license_devices")
        .update({ last_seen_at: new Date().toISOString(), device_label: deviceLabel }).eq("id", existing.id);
      if (error) return json({ valid: false, code: "activation_failed" }, 500);
    } else {
      const { count, error: countError } = await supabase.from("propos_license_devices")
        .select("id", { count: "exact", head: true }).eq("license_id", license.id).is("revoked_at", null);
      if (countError) return json({ valid: false, code: "verification_failed" }, 500);
      if ((count ?? 0) >= license.max_devices) return json({ valid: false, code: "device_limit_reached", max_devices: license.max_devices });
      const { error } = await supabase.from("propos_license_devices").insert({
        license_id: license.id, device_id: deviceId, device_label: deviceLabel,
      });
      if (error) return json({ valid: false, code: "activation_failed" }, 500);
    }
    const { error: updateError } = await supabase.from("propos_licenses")
      .update({ last_verified_at: new Date().toISOString() }).eq("id", license.id);
    if (updateError) return json({ valid: false, code: "verification_failed" }, 500);
    return json({ valid: true, customer_name: license.customer_name, business_name: license.business_name,
      expires_at: license.expires_at, max_devices: license.max_devices });
  } catch {
    return json({ valid: false, code: "invalid_request" }, 400);
  }
});
