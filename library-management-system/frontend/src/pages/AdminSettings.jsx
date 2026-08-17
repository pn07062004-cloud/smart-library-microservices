import { useEffect, useState } from 'react';
import {
  Building2,
  CircleDollarSign,
  Clock3,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save
} from 'lucide-react';
import { api, money } from '../api';
import AdminShell from '../components/AdminShell';
import { Loading } from '../components/UI';
import './AdminSettings.css';

const EMPTY = {
  libraryName: '',
  email: '',
  phone: '',
  address: '',
  openingHours: '',
  defaultLoanDays: 14,
  renewalDays: 7,
  maxRenewals: 2,
  overdueFinePerDay: 5000,
  damagedFine: 50000,
  lostFine: 200000
};

export default function AdminSettings() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setError('');
    try {
      const response = await api('/api/settings');
      setForm({ ...EMPTY, ...response });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function update(name, value) {
    setForm(current => ({ ...current, [name]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          defaultLoanDays: Number(form.defaultLoanDays),
          renewalDays: Number(form.renewalDays),
          maxRenewals: Number(form.maxRenewals),
          overdueFinePerDay: Number(form.overdueFinePerDay),
          damagedFine: Number(form.damagedFine),
          lostFine: Number(form.lostFine)
        })
      });

      setForm(response);
      setMessage('Đã lưu cài đặt và áp dụng cho các giao dịch mới.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
      <AdminShell
          title="Cài đặt hệ thống"
          subtitle="Quản lý thông tin thư viện và chính sách mượn trả."
      >
        {loading ? (
            <Loading />
        ) : (
            <form className="settings-form" onSubmit={save}>
              {message && <div className="settings-alert success">{message}</div>}
              {error && <div className="settings-alert error">{error}</div>}

              <section className="settings-card">
                <div className="settings-card-title">
                  <span><Building2 /></span>
                  <div>
                    <h2>Thông tin thư viện</h2>
                    <p>Thông tin liên hệ và thời gian phục vụ độc giả.</p>
                  </div>
                </div>

                <div className="settings-grid two">
                  <SettingInput icon={<Building2 />} label="Tên thư viện" value={form.libraryName} onChange={value => update('libraryName', value)} required />
                  <SettingInput icon={<Mail />} label="Email" type="email" value={form.email} onChange={value => update('email', value)} />
                  <SettingInput icon={<Phone />} label="Số điện thoại" value={form.phone} onChange={value => update('phone', value)} />
                  <SettingInput icon={<MapPin />} label="Địa chỉ" value={form.address} onChange={value => update('address', value)} />
                </div>

                <SettingInput icon={<Clock3 />} label="Giờ mở cửa" value={form.openingHours} onChange={value => update('openingHours', value)} />
              </section>

              <section className="settings-card">
                <div className="settings-card-title">
                  <span><RotateCcw /></span>
                  <div>
                    <h2>Chính sách mượn và gia hạn</h2>
                    <p>Các giá trị này áp dụng cho phiếu mượn mới.</p>
                  </div>
                </div>

                <div className="settings-grid three">
                  <NumberInput label="Thời hạn mượn" suffix="ngày" min="1" max="90" value={form.defaultLoanDays} onChange={value => update('defaultLoanDays', value)} />
                  <NumberInput label="Mỗi lần gia hạn" suffix="ngày" min="1" max="30" value={form.renewalDays} onChange={value => update('renewalDays', value)} />
                  <NumberInput label="Số lần gia hạn tối đa" suffix="lần" min="0" max="10" value={form.maxRenewals} onChange={value => update('maxRenewals', value)} />
                </div>
              </section>

              <section className="settings-card">
                <div className="settings-card-title">
                  <span><CircleDollarSign /></span>
                  <div>
                    <h2>Chính sách tiền phạt</h2>
                    <p>Hệ thống tự tính khoản phạt khi thủ thư nhận trả sách.</p>
                  </div>
                </div>

                <div className="settings-grid three">
                  <MoneyInput label="Phí quá hạn mỗi ngày" value={form.overdueFinePerDay} onChange={value => update('overdueFinePerDay', value)} />
                  <MoneyInput label="Phí sách hư hỏng" value={form.damagedFine} onChange={value => update('damagedFine', value)} />
                  <MoneyInput label="Phí làm mất sách" value={form.lostFine} onChange={value => update('lostFine', value)} />
                </div>

                <div className="settings-preview">
                  Ví dụ quá hạn 3 ngày: <b>{money(Number(form.overdueFinePerDay || 0) * 3)}</b>
                </div>
              </section>

              <div className="settings-actions">
                <button type="button" className="btn btn-ghost" onClick={loadSettings}>Hoàn tác thay đổi</button>
                <button className="btn btn-primary" disabled={saving}>
                  <Save /> {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
                </button>
              </div>
            </form>
        )}
      </AdminShell>
  );
}

function SettingInput({ icon, label, value, onChange, type = 'text', required = false }) {
  return <label className="setting-field"><span>{label}</span><div>{icon}<input type={type} required={required} value={value || ''} onChange={event => onChange(event.target.value)} /></div></label>;
}

function NumberInput({ label, suffix, value, onChange, min, max }) {
  return <label className="setting-field"><span>{label}</span><div><input type="number" min={min} max={max} required value={value} onChange={event => onChange(event.target.value)} /><em>{suffix}</em></div></label>;
}

function MoneyInput({ label, value, onChange }) {
  return <label className="setting-field"><span>{label}</span><div><input type="number" min="0" step="1000" required value={value} onChange={event => onChange(event.target.value)} /><em>VNĐ</em></div></label>;
}