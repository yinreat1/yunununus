import { useState } from 'react';
import { Modal } from './Modal';
import { VerifyResponse } from '@/lib/types';

interface VerifyTestModalProps {
  open: boolean;
  onClose: () => void;
}

export function VerifyTestModal({ open, onClose }: VerifyTestModalProps) {
  const [licenseKey, setLicenseKey] = useState('');
  const [fingerprint, setFingerprint] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!licenseKey.trim() || !fingerprint.trim()) {
      setError('Lisans anahtarı ve cihaz parmak izi zorunludur.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-propos-license`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          license_key: licenseKey.trim(),
          device_id: fingerprint.trim(),
          device_label: deviceName.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setError(`Sunucu hatası (${res.status})`);
        return;
      }
      const raw = await res.json();
      const reasons: Record<string, string> = { license_not_found: 'Lisans bulunamadı.', license_inactive: 'Lisans aktif değil.', license_expired: 'Lisans süresi dolmuş.', device_revoked: 'Bu cihazın erişimi iptal edilmiş.', device_limit_reached: 'Cihaz limiti dolmuş.', verification_failed: 'Doğrulama sırasında sunucu hatası oluştu.', activation_failed: 'Cihaz kaydedilemedi.' };
      const data: VerifyResponse = { valid: !!raw.valid, reason: raw.valid ? 'Lisans geçerli.' : (reasons[raw.code] || 'Lisans doğrulanamadı.'), license_key: licenseKey.trim(), customer_name: raw.customer_name, company_name: raw.business_name, expires_at: raw.expires_at, max_devices: raw.max_devices };
      setResult(data);
    } catch (err) {
      setError('Bağlantı hatası — merkez ulaşılamaz durumda.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLicenseKey('');
    setFingerprint('');
    setDeviceName('');
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Lisans Doğrulama Testi" maxWidth="max-w-xl">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Bu araç, ProPOS uygulamasının lisans merkezine nasıl sorduğunu simüle eder.
          Bir lisans anahtarı ve cihaz parmak izi girerek doğrulama sonucunu görebilirsiniz.
        </p>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Lisans Anahtarı</label>
          <input
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            className="input-base font-mono text-sm"
            placeholder="PROPOS-XXXX-XXXX-XXXX-XXXX"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Cihaz Parmak İzi</label>
          <input
            value={fingerprint}
            onChange={(e) => setFingerprint(e.target.value)}
            className="input-base font-mono text-sm"
            placeholder="MAC-veya-hardware-id"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Cihaz Adı (opsiyonel)</label>
          <input
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            className="input-base"
            placeholder="KASA-1"
          />
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className={`px-4 py-4 rounded-lg border ${result.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full ${result.valid ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className={`font-semibold ${result.valid ? 'text-emerald-800' : 'text-red-800'}`}>
                {result.valid ? 'Geçerli' : 'Geçersiz'}
              </span>
            </div>
            <p className="text-sm text-slate-700 mb-3">{result.reason}</p>
            {result.license_key && (
              <div className="space-y-1 text-xs text-slate-600">
                {result.customer_name && <p><strong>Müşteri:</strong> {result.customer_name}</p>}
                {result.company_name && <p><strong>İşletme:</strong> {result.company_name}</p>}
                {result.expires_at && <p><strong>Süre Bitişi:</strong> {new Date(result.expires_at).toLocaleDateString('tr-TR')}</p>}
                {result.max_devices !== undefined && <p><strong>Maks. Cihaz:</strong> {result.max_devices}</p>}
                {result.active_devices !== undefined && <p><strong>Aktif Cihaz:</strong> {result.active_devices}</p>}
                {result.server_time && <p><strong>Sunucu Zamanı:</strong> {new Date(result.server_time).toLocaleString('tr-TR')}</p>}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={handleClose} className="btn-secondary">Kapat</button>
          <button onClick={handleVerify} disabled={loading} className="btn-primary">
            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
