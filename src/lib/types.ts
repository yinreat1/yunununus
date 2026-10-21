export type LicenseStatus = 'active' | 'suspended' | 'expired' | 'cancelled';

export interface Customer {
  id: string;
  name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface License {
  id: string;
  license_key: string;
  license_key_available?: boolean;
  customer_id: string | null;
  status: LicenseStatus;
  max_devices: number;
  issued_at: string;
  expires_at: string | null;
  last_verified_at: string | null;
  notes: string | null;
  // Joined fields
  customer?: Customer | null;
  devices?: Device[];
}

export interface Device {
  id: string;
  license_id: string;
  device_fingerprint: string;
  device_name: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
}

export interface LicenseWithRelations extends License {
  customer: Customer | null;
  devices: Device[];
}

export interface VerifyResponse {
  valid: boolean;
  reason: string;
  license_key?: string;
  customer_name?: string;
  company_name?: string;
  expires_at?: string | null;
  max_devices?: number;
  active_devices?: number;
  server_time?: string;
}
