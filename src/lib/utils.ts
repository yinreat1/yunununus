import { LicenseStatus } from './types';

export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  const parts = Array.from({ length: 4 }, (_, part) =>
    Array.from(bytes.slice(part * 4, part * 4 + 4), byte => chars[byte % chars.length]).join(''));
  return `PROPOS-${parts.join('-')}`;
}

export function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeDate(date: string | null): string {
  if (!date) return 'Hiç';
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'Az önce';
  if (diffMin < 60) return `${diffMin} dk önce`;
  if (diffHr < 24) return `${diffHr} saat önce`;
  if (diffDay < 30) return `${diffDay} gün önce`;
  return formatDate(date);
}

export function isExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  return new Date() > new Date(expiresAt);
}

export function getEffectiveStatus(status: LicenseStatus, expiresAt: string | null): LicenseStatus {
  if (status === 'active' && isExpired(expiresAt)) return 'expired';
  return status;
}

export const STATUS_CONFIG: Record<LicenseStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  active: { label: 'Aktif', color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500' },
  suspended: { label: 'Askıya Alındı', color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200', dotColor: 'bg-amber-500' },
  expired: { label: 'Süresi Doldu', color: 'text-red-700', bgColor: 'bg-red-50 border-red-200', dotColor: 'bg-red-500' },
  cancelled: { label: 'İptal Edildi', color: 'text-gray-600', bgColor: 'bg-gray-100 border-gray-300', dotColor: 'bg-gray-400' },
};

export function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text);
}
