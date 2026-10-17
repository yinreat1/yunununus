import { useState } from 'react';
import { Modal } from './Modal';
import { Customer } from '@/lib/types';
import { createCustomer, updateCustomer } from '@/lib/api';

interface CustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  customer?: Customer | null;
}

export function CustomerModal({ open, onClose, onSaved, customer }: CustomerModalProps) {
  const isEdit = !!customer;
  const [name, setName] = useState(customer?.name || '');
  const [companyName, setCompanyName] = useState(customer?.company_name || '');
  const [email, setEmail] = useState(customer?.email || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Müşteri adı zorunludur.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && customer) {
        await updateCustomer(customer.id, { name, company_name: companyName, email, phone, notes });
      } else {
        await createCustomer({ name, company_name: companyName, email, phone, notes });
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
    <Modal open={open} onClose={onClose} title={isEdit ? 'Müşteri Düzenle' : 'Yeni Müşteri'}>
      <div className="space-y-4">
        <Field label="Müşteri Adı" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-base"
            placeholder="Ahmet Yılmaz"
          />
        </Field>
        <Field label="İşletme Adı">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="input-base"
            placeholder="Yılmaz Market"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="E-posta">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              placeholder="ahmet@example.com"
            />
          </Field>
          <Field label="Telefon">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-base"
              placeholder="05XX XXX XX XX"
            />
          </Field>
        </div>
        <Field label="Notlar">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input-base min-h-[80px] resize-y"
            placeholder="Ek bilgiler..."
          />
        </Field>
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}
