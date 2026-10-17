import { LicenseStatus, LicenseWithRelations } from './types';
import { supabase } from './supabase';
import { isExpired } from './utils';

async function adminAction<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-license-management', { body: { action, ...payload } });
  if (error) throw new Error(error.message || 'Supabase bağlantı hatası.');
  if (data?.error) throw new Error(data.message || data.error);
  return data as T;
}

export async function fetchLicenses(): Promise<LicenseWithRelations[]> {
  const result = await adminAction<{ licenses: LicenseWithRelations[] }>('list');
  return result.licenses || [];
}
export async function fetchCustomers() {
  const result = await adminAction<{ customers: any[] }>('list');
  return result.customers || [];
}
export async function createCustomer(params: { name: string; company_name?: string; email?: string; phone?: string; notes?: string }) {
  const result = await adminAction<{ data: any }>('create_customer', params);
  return result.data;
}
export async function updateCustomer(id: string, params: { name?: string; company_name?: string; email?: string; phone?: string; notes?: string }) {
  const result = await adminAction<{ data: any }>('update_customer', { id, ...params });
  return result.data;
}
export async function createLicense(params: { license_key: string; customer_id: string; status: LicenseStatus; max_devices: number; expires_at: string | null; notes?: string }) {
  const result = await adminAction<{ data: any }>('create_license', params);
  return result.data;
}
export async function updateLicense(id: string, params: { customer_id?: string; status?: LicenseStatus; max_devices?: number; expires_at?: string | null; notes?: string }) {
  const result = await adminAction<{ data: any }>('update_license', { id, ...params });
  return result.data;
}
export async function deleteLicense(id: string) { await adminAction('delete_license', { id }); }
export async function deleteDevice(id: string) { await adminAction('delete_device', { id }); }
export async function toggleDeviceActive(id: string, isActive: boolean) { await adminAction('toggle_device', { id, is_active: isActive }); }

export interface DashboardStats {
  totalLicenses: number; activeLicenses: number; expiredLicenses: number; suspendedLicenses: number;
  cancelledLicenses: number; totalCustomers: number; totalDevices: number; expiringSoon: number;
}
export function computeStats(licenses: LicenseWithRelations[], customerCount: number): DashboardStats {
  let active = 0, expired = 0, suspended = 0, cancelled = 0, expiringSoon = 0; let totalDevices = 0;
  const now = new Date(); const soonThreshold = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  for (const lic of licenses) {
    totalDevices += lic.devices?.filter(d => d.is_active).length || 0;
    if (lic.status === 'active' && isExpired(lic.expires_at)) expired++;
    else if (lic.status === 'active') { active++; if (lic.expires_at && new Date(lic.expires_at) <= soonThreshold) expiringSoon++; }
    else if (lic.status === 'suspended') suspended++;
    else if (lic.status === 'expired') expired++;
    else if (lic.status === 'cancelled') cancelled++;
  }
  return { totalLicenses: licenses.length, activeLicenses: active, expiredLicenses: expired, suspendedLicenses: suspended, cancelledLicenses: cancelled, totalCustomers: customerCount, totalDevices, expiringSoon };
}
