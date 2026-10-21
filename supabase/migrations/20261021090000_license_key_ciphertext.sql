-- Full license keys are encrypted at rest for display to authenticated administrators.
-- The SHA-256 hash remains the value used for license verification.
ALTER TABLE public.propos_licenses
  ADD COLUMN IF NOT EXISTS license_key_ciphertext text;
