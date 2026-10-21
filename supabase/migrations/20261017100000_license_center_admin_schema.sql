-- License Center schema alignment: keep license secrets hashed and restrict all table access to Edge Functions.
CREATE TABLE IF NOT EXISTS public.propos_license_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.propos_licenses
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.propos_license_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS license_key_hint text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

-- Preserve existing customers while migrating old denormalized records.
INSERT INTO public.propos_license_customers (name, company_name)
SELECT DISTINCT customer_name, business_name
FROM public.propos_licenses
WHERE customer_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.propos_license_customers c
    WHERE c.name = propos_licenses.customer_name
      AND COALESCE(c.company_name, '') = COALESCE(propos_licenses.business_name, '')
  );

UPDATE public.propos_licenses l
SET customer_id = c.id
FROM public.propos_license_customers c
WHERE l.customer_id IS NULL
  AND c.name = l.customer_name
  AND COALESCE(c.company_name, '') = COALESCE(l.business_name, '');

UPDATE public.propos_licenses
SET license_key_hint = 'PROPOS-••••-••••-••••'
WHERE license_key_hint IS NULL;

CREATE INDEX IF NOT EXISTS idx_propos_licenses_customer_id ON public.propos_licenses(customer_id);
CREATE INDEX IF NOT EXISTS idx_propos_license_devices_license_id ON public.propos_license_devices(license_id);

ALTER TABLE public.propos_license_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propos_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propos_license_devices ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies. Service-role Edge Functions bypass RLS;
-- browser clients must never read/write license hashes or customer records directly.
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('propos_license_customers', 'propos_licenses', 'propos_license_devices')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;
