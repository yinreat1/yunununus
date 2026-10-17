import { Modal } from './Modal';
import { CopyButton } from './CopyButton';
import { LicenseWithRelations } from '@/lib/types';
import { STATUS_CONFIG, getEffectiveStatus, formatDate, formatRelativeDate, isExpired } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { Monitor, Trash2, Power, User, Building2, Mail, Phone, Calendar, Clock, Key } from 'lucide-react';
import { deleteDevice, toggleDeviceActive } from '@/lib/api';

interface LicenseDetailModalProps {
  open: boolean;
  onClose: () => void;
  license: LicenseWithRelations | null;
  onRefresh: () => void;
}

export function LicenseDetailModal({ open, onClose, license, onRefresh }: LicenseDetailModalProps) {
  if (!license) return null;

  const effective = getEffectiveStatus(license.status, license.expires_at);
  const activeDevices = license.devices?.filter(d => d.is_active) || [];
  const expiringSoon = effective === 'active' && license.expires_at && !isExpired(license.expires_at) &&
    new Date(license.expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm('Bu cihazı kaldırmak istediğinizden emin misiniz?')) return;
    try {
      await deleteDevice(deviceId);
      onRefresh();
    } catch (err) {
      alert('Cihaz silinemedi.');
    }
  };

  const handleToggleDevice = async (deviceId: string, isActive: boolean) => {
    try {
      await toggleDeviceActive(deviceId, isActive);
      onRefresh();
    } catch (err) {
      alert('Cihaz durumu değiştirilemedi.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Lisans Detayı" maxWidth="max-w-2xl">
      <div className="space-y-5">
        {/* License key section */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wide mb-1.5">
                <Key size={14} /> Lisans Anahtarı
              </div>
              <p className="font-mono text-lg font-semibold text-slate-900 break-all">{license.license_key}</p>
            </div>
            <StatusBadge status={license.status} expiresAt={license.expires_at} />
          </div>
          <div className="mt-2">
            <CopyButton text={license.license_key} label="Kopyala" />
          </div>
        </div>

        {/* Expiry warning */}
        {expiringSoon && (
          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <Calendar size={16} />
            <span>Lisans süresi yakında doluyor: {formatDate(license.expires_at)}</span>
          </div>
        )}
        {effective === 'expired' && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            <Calendar size={16} />
            <span>Bu lisansın süresi dolmuş.</span>
          </div>
        )}

        {/* Customer info */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Müşteri Bilgileri</h3>
          {license.customer ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow icon={<User size={16} />} label="Ad" value={license.customer.name} />
              <InfoRow icon={<Building2 size={16} />} label="İşletme" value={license.customer.company_name} />
              <InfoRow icon={<Mail size={16} />} label="E-posta" value={license.customer.email} />
              <InfoRow icon={<Phone size={16} />} label="Telefon" value={license.customer.phone} />
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">Müşteri bilgisi yok</p>
          )}
        </div>

        {/* License details */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Lisans Bilgileri</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoRow icon={<Calendar size={16} />} label="Düzenlenme" value={formatDate(license.issued_at)} />
            <InfoRow icon={<Calendar size={16} />} label="Süre Bitişi" value={license.expires_at ? formatDate(license.expires_at) : 'Sınırsız'} />
            <InfoRow icon={<Clock size={16} />} label="Son Doğrulama" value={formatRelativeDate(license.last_verified_at)} />
            <InfoRow icon={<Monitor size={16} />} label="Cihaz Kullanımı" value={`${activeDevices.length} / ${license.max_devices}`} />
          </div>
          {license.notes && (
            <div className="mt-3 px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs font-medium text-slate-500 mb-1">Notlar</p>
              <p className="text-sm text-slate-700">{license.notes}</p>
            </div>
          )}
        </div>

        {/* Devices */}
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
            Bağlı Cihazlar ({activeDevices.length}/{license.max_devices})
          </h3>
          {license.devices && license.devices.length > 0 ? (
            <div className="space-y-2">
              {license.devices.map((device) => (
                <div
                  key={device.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${device.is_active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg ${device.is_active ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-500'}`}>
                      <Monitor size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">
                        {device.device_name || 'İsimsiz Cihaz'}
                      </p>
                      <p className="text-xs text-slate-500 font-mono truncate">{device.device_fingerprint}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Son görülme: {formatRelativeDate(device.last_seen_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleDevice(device.id, device.is_active)}
                      className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title={device.is_active ? 'Pasifleştir' : 'Aktifleştir'}
                    >
                      <Power size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteDevice(device.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Kaldır"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 px-4 bg-slate-50 rounded-lg border border-dashed border-slate-300">
              <Monitor size={24} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">Henüz cihaz bağlanmamış</p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 bg-slate-50 rounded-lg">
      <span className="text-slate-400 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900 truncate">{value || '—'}</p>
      </div>
    </div>
  );
}
