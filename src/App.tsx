import { useState, useEffect, useMemo } from 'react';
import { fetchAdminData, computeStats, deleteLicense } from '@/lib/api';
import { LicenseWithRelations, Customer, LicenseStatus } from '@/lib/types';
import { getEffectiveStatus, formatDate, formatRelativeDate } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { CustomerModal } from '@/components/CustomerModal';
import { LicenseModal } from '@/components/LicenseModal';
import { LicenseDetailModal } from '@/components/LicenseDetailModal';
import { VerifyTestModal } from '@/components/VerifyTestModal';
import { LoginScreen } from '@/components/LoginScreen';
import { useAuth } from '@/lib/useAuth';
import {
  ShieldCheck, KeyRound, Users, Monitor, Search, Plus, ChevronRight,
  TrendingUp, AlertTriangle, Building2, Trash2, Edit3,
  ShieldAlert, CheckCircle2, Activity, LogOut,
} from 'lucide-react';

type Tab = 'dashboard' | 'licenses' | 'customers';

export default function App() {
  const auth = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [licenses, setLicenses] = useState<LicenseWithRelations[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LicenseStatus | 'all'>('all');

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [editingLicense, setEditingLicense] = useState<LicenseWithRelations['license_key'] extends string ? any : null>(null);
  const [detailLicense, setDetailLicense] = useState<LicenseWithRelations | null>(null);
  const [showVerifyTest, setShowVerifyTest] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const { licenses: lic, customers: cust } = await fetchAdminData();
      setLicenses(lic);
      setCustomers(cust);
      setDetailLicense(current => current ? (lic.find(item => item.id === current.id) || current) : null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
      setError(/admin_only|yönetici yetkisi|yönetici olarak tanınmadı/i.test(message)
        ? 'Hesap yönetici yetkisiyle doğrulanamadı. Önce siteden çıkış yapıp tekrar giriş yapın.'
        : `Veriler yüklenemedi: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auth.session) loadData();
  }, [auth.session]);

  const stats = useMemo(() => computeStats(licenses, customers.length), [licenses, customers.length]);

  const filteredLicenses = useMemo(() => {
    let result = licenses;
    if (statusFilter !== 'all') {
      result = result.filter(l => getEffectiveStatus(l.status, l.expires_at) === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.license_key.toLowerCase().includes(q) ||
        l.customer?.name?.toLowerCase().includes(q) ||
        l.customer?.company_name?.toLowerCase().includes(q) ||
        l.customer?.email?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [licenses, search, statusFilter]);

  const handleDeleteLicense = async (id: string, key: string) => {
    if (!confirm(`Bu lisansı silmek istediğinizden emin misiniz?\n\n${key}`)) return;
    try {
      await deleteLicense(id);
      await loadData();
    } catch (err) {
      alert('Lisans silinemedi.');
    }
  };

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (!auth.session) {
    return <LoginScreen auth={auth} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-slate-900 text-white rounded-xl">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 leading-tight">ProPOS Lisans Merkezi</h1>
                <p className="text-xs text-slate-500">Lisans yönetim paneli</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVerifyTest(true)}
                className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ShieldAlert size={16} />
                Doğrulama Testi
              </button>
              <button
                onClick={() => { setEditingLicense(null); setShowLicenseModal(true); }}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Yeni Lisans</span>
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1" />
              <button
                onClick={() => auth.signOut()}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                title="Çıkış Yap"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Çıkış</span>
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-1 -mb-px">
            <TabButton active={tab === 'dashboard'} onClick={() => setTab('dashboard')} icon={<TrendingUp size={16} />}>Genel Bakış</TabButton>
            <TabButton active={tab === 'licenses'} onClick={() => setTab('licenses')} icon={<KeyRound size={16} />}>Lisanslar</TabButton>
            <TabButton active={tab === 'customers'} onClick={() => setTab('customers')} icon={<Users size={16} />}>Müşteriler</TabButton>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {tab === 'dashboard' && <Dashboard stats={stats} licenses={licenses} onSeeAll={() => setTab('licenses')} />}
            {tab === 'licenses' && (
              <LicensesTab
                licenses={filteredLicenses}
                totalCount={licenses.length}
                search={search}
                setSearch={setSearch}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onDetail={setDetailLicense}
                onEdit={(lic) => { setEditingLicense(lic); setShowLicenseModal(true); }}
                onDelete={handleDeleteLicense}
                onNewLicense={() => { setEditingLicense(null); setShowLicenseModal(true); }}
              />
            )}
            {tab === 'customers' && (
              <CustomersTab
                customers={customers}
                licenses={licenses}
                onAdd={() => { setEditingCustomer(null); setShowCustomerModal(true); }}
                onEdit={(c) => { setEditingCustomer(c); setShowCustomerModal(true); }}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <CustomerModal
        open={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        onSaved={loadData}
        customer={editingCustomer}
      />
      <LicenseModal
        open={showLicenseModal}
        onClose={() => setShowLicenseModal(false)}
        onSaved={loadData}
        customers={customers}
        license={editingLicense}
      />
      <LicenseDetailModal
        open={!!detailLicense}
        onClose={() => setDetailLicense(null)}
        license={detailLicense}
        onRefresh={loadData}
      />
      <VerifyTestModal
        open={showVerifyTest}
        onClose={() => setShowVerifyTest(false)}
      />
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-slate-900 text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ============ Dashboard ============

function Dashboard({ stats, licenses, onSeeAll }: { stats: ReturnType<typeof computeStats>; licenses: LicenseWithRelations[]; onSeeAll: () => void }) {
  const recentLicenses = licenses.slice(0, 5);
  const expiringSoon = licenses.filter(l => {
    const eff = getEffectiveStatus(l.status, l.expires_at);
    if (eff !== 'active' || !l.expires_at) return false;
    const days = (new Date(l.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 7;
  });

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle2 size={20} />} label="Aktif Lisans" value={stats.activeLicenses} color="emerald" />
        <StatCard icon={<KeyRound size={20} />} label="Toplam Lisans" value={stats.totalLicenses} color="slate" />
        <StatCard icon={<Users size={20} />} label="Müşteri" value={stats.totalCustomers} color="blue" />
        <StatCard icon={<Monitor size={20} />} label="Aktif Cihaz" value={stats.totalDevices} color="indigo" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat label="Süresi Dolmuş" value={stats.expiredLicenses} color="text-red-600" />
        <MiniStat label="Askıya Alınmış" value={stats.suspendedLicenses} color="text-amber-600" />
        <MiniStat label="İptal Edilmiş" value={stats.cancelledLicenses} color="text-gray-500" />
        <MiniStat label="7 Gün İçinde Dolacak" value={stats.expiringSoon} color="text-orange-600" />
      </div>

      {/* Recent + expiring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Activity size={16} className="text-slate-400" /> Son Lisanslar
            </h2>
            <button onClick={onSeeAll} className="text-xs font-medium text-slate-500 hover:text-slate-800 inline-flex items-center gap-1">
              Tümünü Gör <ChevronRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentLicenses.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">Henüz lisans yok</p>
            ) : (
              recentLicenses.map((lic) => (
                <div key={lic.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{lic.customer?.name || 'Müşterisiz'}</p>
                    <p className="text-xs text-slate-500 font-mono truncate">{lic.license_key}</p>
                  </div>
                  <StatusBadge status={lic.status} expiresAt={lic.expires_at} />
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" /> Süresi Yaklaşanlar
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {expiringSoon.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">Yaklaşan süre dolumu yok</p>
            ) : (
              expiringSoon.map((lic) => {
                const days = Math.ceil((new Date(lic.expires_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={lic.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{lic.customer?.name || 'Müşterisiz'}</p>
                      <p className="text-xs text-slate-500 truncate">{lic.customer?.company_name || lic.license_key}</p>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <p className={`text-sm font-semibold ${days <= 2 ? 'text-red-600' : 'text-amber-600'}`}>{days} gün</p>
                      <p className="text-xs text-slate-400">{formatDate(lic.expires_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: 'emerald' | 'slate' | 'blue' | 'indigo' }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-11 h-11 rounded-lg ${colors[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-slate-200">
      <span className="text-xs text-slate-500 font-medium">{label}</span>
      <span className={`text-lg font-bold ${color}`}>{value}</span>
    </div>
  );
}

// ============ Licenses Tab ============

function LicensesTab({
  licenses, totalCount, search, setSearch, statusFilter, setStatusFilter,
  onDetail, onEdit, onDelete, onNewLicense,
}: {
  licenses: LicenseWithRelations[];
  totalCount: number;
  search: string;
  setSearch: (s: string) => void;
  statusFilter: LicenseStatus | 'all';
  setStatusFilter: (s: LicenseStatus | 'all') => void;
  onDetail: (l: LicenseWithRelations) => void;
  onEdit: (l: any) => void;
  onDelete: (id: string, key: string) => void;
  onNewLicense: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Lisans anahtarı, müşteri adı veya e-posta ara..."
              className="input-base pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as LicenseStatus | 'all')}
            className="input-base w-auto"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="suspended">Askıya Alındı</option>
            <option value="expired">Süresi Doldu</option>
            <option value="cancelled">İptal Edildi</option>
          </select>
        </div>
        <button onClick={onNewLicense} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
          <Plus size={16} /> Yeni Lisans
        </button>
      </div>

      {/* Table */}
      {licenses.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <KeyRound size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400 mb-4">
            {totalCount === 0 ? 'Henüz lisans oluşturulmadı' : 'Aramanızla eşleşen lisans bulunamadı'}
          </p>
          {totalCount === 0 && (
            <button onClick={onNewLicense} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors">
              <Plus size={16} /> İlk Lisansı Oluştur
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Lisans</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 hidden md:table-cell">Müşteri</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">Cihaz</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3 hidden lg:table-cell">Süre Bitişi</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">Durum</th>
                  <th className="text-right text-xs font-semibold text-slate-500 uppercase tracking-wide px-5 py-3">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {licenses.map((lic) => {
                  const eff = getEffectiveStatus(lic.status, lic.expires_at);
                  const activeDevices = lic.devices?.filter(d => d.is_active).length || 0;
                  return (
                    <tr key={lic.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => onDetail(lic)}>
                      <td className="px-5 py-3">
                        <p className="font-mono text-sm font-medium text-slate-900">{lic.license_key}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatRelativeDate(lic.last_verified_at)} doğrulandı</p>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        {lic.customer ? (
                          <div>
                            <p className="text-sm font-medium text-slate-900">{lic.customer.name}</p>
                            <p className="text-xs text-slate-500">{lic.customer.company_name || '—'}</p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400 italic">Müşterisiz</span>
                        )}
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <span className={`text-sm font-medium ${activeDevices >= lic.max_devices ? 'text-amber-600' : 'text-slate-700'}`}>
                          {activeDevices} / {lic.max_devices}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden lg:table-cell">
                        <span className="text-sm text-slate-600">{lic.expires_at ? formatDate(lic.expires_at) : 'Sınırsız'}</span>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={lic.status} expiresAt={lic.expires_at} />
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onEdit(lic)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Düzenle"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            onClick={() => onDelete(lic.id, lic.license_key)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Customers Tab ============

function CustomersTab({
  customers, licenses, onAdd, onEdit,
}: {
  customers: Customer[];
  licenses: LicenseWithRelations[];
  onAdd: () => void;
  onEdit: (c: Customer) => void;
}) {
  const getCustomerLicenseCount = (customerId: string) =>
    licenses.filter(l => l.customer_id === customerId).length;
  const getCustomerDeviceCount = (customerId: string) =>
    licenses.filter(l => l.customer_id === customerId)
      .reduce((sum, l) => sum + (l.devices?.filter(d => d.is_active).length || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{customers.length} müşteri</p>
        <button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors">
          <Plus size={16} /> Yeni Müşteri
        </button>
      </div>

      {customers.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-slate-200">
          <Users size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm text-slate-400 mb-4">Henüz müşteri eklenmedi</p>
          <button onClick={onAdd} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors">
            <Plus size={16} /> İlk Müşteriyi Ekle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex-shrink-0">
                    <Building2 size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{c.name}</h3>
                    {c.company_name && <p className="text-xs text-slate-500 truncate">{c.company_name}</p>}
                  </div>
                </div>
                <button
                  onClick={() => onEdit(c)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                >
                  <Edit3 size={16} />
                </button>
              </div>
              <div className="space-y-1.5 text-sm text-slate-600">
                {c.email && <p className="truncate">{c.email}</p>}
                {c.phone && <p>{c.phone}</p>}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs">
                <span className="text-slate-500">
                  <KeyRound size={12} className="inline mr-1 text-slate-400" />
                  {getCustomerLicenseCount(c.id)} lisans
                </span>
                <span className="text-slate-500">
                  <Monitor size={12} className="inline mr-1 text-slate-400" />
                  {getCustomerDeviceCount(c.id)} cihaz
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
