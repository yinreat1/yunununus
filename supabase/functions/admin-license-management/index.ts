import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
async function hashKey(key: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key.trim().toUpperCase()));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, "0")).join("");
}
function newKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const part = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), b => alphabet[b % alphabet.length]).join("");
  return `PROPOS-${part()}-${part()}-${part()}-${part()}`;
}
function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string) {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) throw new Error("invalid_hex");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}
let encryptionKeyPromise: Promise<CryptoKey> | null = null;
function getEncryptionKey() {
  if (!encryptionKeyPromise) {
    encryptionKeyPromise = (async () => {
      const serviceSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (!serviceSecret) throw new Error("license_encryption_not_configured");
      const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("ProPOS-license-key-encryption-v1:" + serviceSecret));
      return await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    })();
  }
  return encryptionKeyPromise;
}
async function encryptKey(key: string) {
  const aesKey = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(key));
  return "v1." + toHex(iv) + "." + toHex(new Uint8Array(ciphertext));
}
async function decryptKey(encoded: string | null | undefined): Promise<string | null> {
  if (!encoded) return null;
  try {
    const [version, ivHex, ciphertextHex] = encoded.split(".");
    if (version !== "v1" || !ivHex || !ciphertextHex) return null;
    const aesKey = await getEncryptionKey();
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromHex(ivHex) }, aesKey, fromHex(ciphertextHex));
    return new TextDecoder().decode(plaintext);
  } catch { return null; }
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const bearer = req.headers.get("Authorization") || "";
  if (!url || !service || !bearer.startsWith("Bearer ")) return reply({ error: "unauthorized" }, 401);
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  if (!anon) return reply({ error: "auth_not_configured" }, 500);
  const auth = createClient(url, anon, {
    global: { headers: { Authorization: bearer } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: ud, error: ue } = await auth.auth.getUser();
  if (ue || !ud.user || ud.user.app_metadata?.role !== "admin") {
    return reply({ error: "admin_only", code: "admin_only", message: "Bu hesap için yönetici yetkisi tanımlı değil. Çıkış yapıp yeniden giriş yapın." }, 403);
  }
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const b = await req.json();
    const action = String(b.action || "");
    if (action === "list") {
      const [lr, cr, dr] = await Promise.all([
        db.from("propos_licenses").select("*").order("created_at", { ascending: false }),
        db.from("propos_license_customers").select("*").order("created_at", { ascending: false }),
        db.from("propos_license_devices").select("*").order("first_activated_at", { ascending: false }),
      ]);
      if (lr.error || cr.error || dr.error) throw lr.error || cr.error || dr.error;
      const customers = cr.data || [];
      const customerMap = new Map(customers.map(c => [c.id, c]));
      const licenses = await Promise.all((lr.data || []).map(async l => {
        const fullKey = await decryptKey(l.license_key_ciphertext);
        return {
          id: l.id,
          license_key: fullKey || l.license_key_hint || "PROPOS-••••-••••-••••",
          license_key_available: Boolean(fullKey),
          customer_id: l.customer_id,
          status: l.status,
          max_devices: l.max_devices,
          issued_at: l.created_at,
          expires_at: l.expires_at,
          last_verified_at: l.last_verified_at,
          notes: l.notes,
          customer: customerMap.get(l.customer_id) || {
            id: l.customer_id, name: l.customer_name, company_name: l.business_name,
            email: null, phone: null, notes: null, created_at: l.created_at,
          },
          devices: (dr.data || []).filter(d => d.license_id === l.id).map(d => ({
            id: d.id, license_id: d.license_id, device_fingerprint: d.device_id,
            device_name: d.device_label, first_seen_at: d.first_activated_at,
            last_seen_at: d.last_seen_at, is_active: !d.revoked_at,
          })),
        };
      }));
      return reply({ licenses, customers });
    }
    if (action === "create_customer" || action === "update_customer") {
      const values = {
        name: String(b.name || "").trim(), company_name: b.company_name || null,
        email: b.email || null, phone: b.phone || null, notes: b.notes || null,
        updated_at: new Date().toISOString(),
      };
      if (!values.name) return reply({ error: "customer_name_required", message: "Müşteri adı zorunludur." }, 400);
      const q = action === "create_customer"
        ? db.from("propos_license_customers").insert(values)
        : db.from("propos_license_customers").update(values).eq("id", b.id);
      const { data, error } = await q.select().single();
      if (error) throw error;
      if (action === "update_customer") {
        const { error: updateError } = await db.from("propos_licenses")
          .update({ customer_name: data.name, business_name: data.company_name }).eq("customer_id", data.id);
        if (updateError) throw updateError;
      }
      return reply({ data });
    }
    if (action === "create_license") {
      const { data: c, error: ce } = await db.from("propos_license_customers")
        .select("id,name,company_name").eq("id", b.customer_id).single();
      if (ce) throw ce;
      const rawKey = typeof b.license_key === "string" ? b.license_key : newKey();
      const key = rawKey.trim().toUpperCase();
      if (!/^PROPOS-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(key)) {
        return reply({ error: "invalid_license_key", message: "Lisans anahtarı PROPOS-XXXX-XXXX-XXXX-XXXX biçiminde olmalıdır." }, 400);
      }
      const { data, error } = await db.from("propos_licenses").insert({
        customer_id: c.id, customer_name: c.name, business_name: c.company_name,
        license_key_hash: await hashKey(key), license_key_ciphertext: await encryptKey(key),
        license_key_hint: "PROPOS-••••-••••-" + key.slice(-4), status: b.status || "active",
        max_devices: Math.max(1, Math.min(100, Number(b.max_devices) || 1)),
        expires_at: b.expires_at || null, notes: b.notes || null,
      }).select().single();
      if (error) throw error;
      return reply({ data: {
        id: data.id, license_key: key, license_key_available: true, customer_id: data.customer_id,
        status: data.status, max_devices: data.max_devices, expires_at: data.expires_at,
        notes: data.notes, issued_at: data.created_at,
      } });
    }
    if (action === "rotate_license_key") {
      const id = String(b.id || "");
      if (!id) return reply({ error: "license_id_required" }, 400);
      const requestedKey = typeof b.license_key === "string" ? b.license_key.trim() : "";
      const key = (requestedKey || newKey()).toUpperCase();
      if (!/^PROPOS-[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/.test(key)) {
        return reply({ error: "invalid_license_key", message: "Lisans anahtarı PROPOS-XXXX-XXXX-XXXX-XXXX biçiminde olmalıdır." }, 400);
      }
      const { data, error } = await db.from("propos_licenses").update({
        license_key_hash: await hashKey(key), license_key_ciphertext: await encryptKey(key),
        license_key_hint: "PROPOS-••••-••••-" + key.slice(-4), updated_at: new Date().toISOString(),
      }).eq("id", id).select("id,customer_id,status,max_devices,expires_at,notes,created_at").single();
      if (error) throw error;
      return reply({ data: {
        id: data.id, license_key: key, license_key_available: true, customer_id: data.customer_id,
        status: data.status, max_devices: data.max_devices, expires_at: data.expires_at,
        notes: data.notes, issued_at: data.created_at,
      } });
    }
    if (action === "update_license") {
      const patch: Record<string, unknown> = {};
      for (const k of ["status", "max_devices", "expires_at", "notes", "customer_id"] as const) {
        if (b[k] !== undefined) patch[k] = b[k];
      }
      if (b.customer_id) {
        const { data: c, error } = await db.from("propos_license_customers")
          .select("name,company_name").eq("id", b.customer_id).single();
        if (error) throw error;
        patch.customer_name = c.name;
        patch.business_name = c.company_name;
      }
      patch.updated_at = new Date().toISOString();
      const { data, error } = await db.from("propos_licenses").update(patch).eq("id", b.id).select().single();
      if (error) throw error;
      return reply({ data });
    }
    if (action === "delete_license") {
      const { error } = await db.from("propos_licenses").delete().eq("id", b.id);
      if (error) throw error;
      return reply({ ok: true });
    }
    if (action === "toggle_device") {
      const { data: d, error: de } = await db.from("propos_license_devices").select("revoked_at").eq("id", b.id).single();
      if (de) throw de;
      const { error } = await db.from("propos_license_devices")
        .update(d.revoked_at ? { revoked_at: null } : { revoked_at: new Date().toISOString() }).eq("id", b.id);
      if (error) throw error;
      return reply({ ok: true });
    }
    if (action === "delete_device") {
      const { error } = await db.from("propos_license_devices").delete().eq("id", b.id);
      if (error) throw error;
      return reply({ ok: true });
    }
    return reply({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error(e);
    return reply({ error: "operation_failed", message: e instanceof Error ? e.message : "İşlem başarısız." }, 400);
  }
});
