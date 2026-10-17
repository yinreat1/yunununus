import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { CopyButton } from './CopyButton';
import { Customer, LicenseStatus } from '@/lib/types';
import { createLicense, updateLicense } from '@/lib/api';
import { generateLicenseKey } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';

interface LicenseModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customers: Customer[];
  license?: {
    id: string;
    license_key: string;
    customer_id: string | null;
    status: LicenseStatus;
    max_devices: number;
    expires_at: string | null;
    notes: string | null;
  } | null;
}

export function LicenseModal({ open, onClose, onSaved, customers, license }: LicenseModalProps) {
  const isEdit = !!license;
  const [licenseKey, setLicenseKey] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [status, setStatus] = useState<LicenseStatus>('active');
  const [maxDevices, setMaxDevices] = useState(1);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      if (license) {
        setLicenseKey(license.license_key);
        setCustomerId(license.customer_id || '');
        setStatus(license.status);
        setMaxDevices(license.max_devices);
        setHasExpiry(!!license.expires_at);
        setExpiryDate(license.expires_at ? license.expires_at.slice(0, 10) : '');
        setNotes(license.notes || '');
      } else {
        setLicenseKey(generateLicenseKey());
        setCustomerId(customers[0]?.id || '');
        setStatus('active');
        setMaxDevices(1);
        setHasExpiry(false);
        setExpiryDate('');
        setNotes('');
      }
      setError(null);
    }
  }, [open, license, customers]);

  const handleSave = async () => {
    if (!customerId) {
      setError('Müşteri seçimi zorunludur.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const expiresAt = hasExpiry && expiryDate ? new Date(expiryDate + 'T23:59:59').toISOString() : null;
      if (isEdit && license) {
        await updateLicense(license.id, { customer_id: customerId, status, max_devices: maxDevices, expires_at: expiresAt, notes });
      } else {
        await createLicense({ license_key: licenseKey, customer_id: customerId, status, max_devices: maxDevices, expires_at: expiresAt, notes });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Lisans Düzenle' : 'Yeni Lisans Oluştur'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Lisans Anahtarı</label>
          <div className="flex items-center gap-2">
            <input
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              disabled={isEdit}
              className="input-base font-mono text-sm flex-1"
              placeholder="PROPOS-XXXX-XXXX-XXXX-XXXX"
            />
            {!isEdit && (
              <button
                onClick={() => setLicenseKey(generateLicenseKey())}
                className="p-2.5 rounded-lg border border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="Yeni kod üret"
              >
                <RefreshCw size={18} />
              </button>
            )}
          </div>
          {!isEdit && (
            <div className="mt-1.5">
              <CopyButton text={licenseKey} label="Anahtarı kopyala" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Müşteri</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input-base">
            <option value="">Müşteri seçin...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.company_name ? `— ${c.company_name}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Durum</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as LicenseStatus)} className="input-base">
              <option value="active">Aktif</option>
              <option value="suspended">Askıya Alındı</option>
              <option value="expired">Süresi Doldu</option>
              <option value="cancelled">İptal Edildi</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Maks. Cihaz</label>
            <input
              type="number"
              min={1}
              max={100}
              value={maxDevices}
              onChange={(e) => setMaxDevices(parseInt(e.target.value) || 1)}
              className="input-base"
            />
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5">
            <input
              type="checkbox"
              checked={hasExpiry}
              onChange={(e) => setHasExpiry(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
            />
            Süre belirle
          </label>
          {hasExpiry && (
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="input-base"
            />
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Notlar</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-base min-h-[60px] resize-y"
            placeholder="Ek bilgiler..."
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">İptal</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
