import { useEffect, useState } from 'react';
import { api, date } from '../api';
import { useAuth } from '../context/AuthContext';
import { showError, showSuccess } from '../utils/feedback';
import './Profile.css';

const roleName = {
    MEMBER: 'Độc giả',
    LIBRARIAN: 'Thủ thư',
    ADMIN: 'Quản trị'
};

export default function Profile() {
    const { user, setUser } = useAuth();

    const [form, setForm] = useState({
        fullName: '',
        phone: '',
        address: '',
        avatarUrl: ''
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [saving, setSaving] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);

    useEffect(() => {
        async function loadProfile() {
            try {
                const data = await api('/api/auth/me');

                setUser(data);
                setForm({
                    fullName: data.fullName || '',
                    phone: data.phone || '',
                    address: data.address || '',
                    avatarUrl: data.avatarUrl || ''
                });
            } catch (error) {
                showError(error.message);
            }
        }

        loadProfile();
    }, []);

    function changeField(event) {
        const { name, value } = event.target;

        setForm(current => ({
            ...current,
            [name]: value
        }));
    }

    async function saveProfile(event) {
        event.preventDefault();

        try {
            setSaving(true);

            const response = await api('/api/auth/me', {
                method: 'PUT',
                body: JSON.stringify(form)
            });

            localStorage.setItem('library_token', response.token);
            setUser(response.user);
            showSuccess('Cập nhật hồ sơ thành công');
        } catch (error) {
            showError(error.message);
        } finally {
            setSaving(false);
        }
    }

    async function changePassword(event) {
        event.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            showError('Mật khẩu xác nhận không khớp');
            return;
        }

        try {
            setChangingPassword(true);

            await api('/api/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                })
            });

            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });

            showSuccess('Đổi mật khẩu thành công');
        } catch (error) {
            showError(error.message);
        } finally {
            setChangingPassword(false);
        }
    }

    return (
        <section className="account-profile-page">
            <div className="container">
                <div className="account-profile-heading">
                    <p>THÔNG TIN TÀI KHOẢN</p>
                    <h1>Hồ sơ cá nhân</h1>
                </div>

                <div className="account-profile-layout">
                    <aside className="account-profile-card">
                        <div className="account-profile-avatar">
                            {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt={user.fullName} />
                            ) : (
                                <span>
                                    {user?.fullName?.charAt(0).toUpperCase()}
                                </span>
                            )}
                        </div>

                        <h2>{user?.fullName}</h2>
                        <p>{user?.email}</p>

                        <div className="account-profile-information">
                            <div>
                                <span>Vai trò</span>
                                <strong>{roleName[user?.role] || user?.role}</strong>
                            </div>

                            <div>
                                <span>Mã tài khoản</span>
                                <strong>{user?.memberCode || '—'}</strong>
                            </div>

                            <div>
                                <span>Ngày tham gia</span>
                                <strong>{date(user?.createdAt)}</strong>
                            </div>

                            <div>
                                <span>Trạng thái</span>
                                <strong>
                                    {user?.status === 'ACTIVE'
                                        ? 'Hoạt động'
                                        : 'Đã khóa'}
                                </strong>
                            </div>
                        </div>
                    </aside>

                    <div className="account-profile-content">
                        <form
                            className="account-profile-form"
                            onSubmit={saveProfile}
                        >
                            <h2>Thông tin cá nhân</h2>

                            <div className="account-profile-grid">
                                <label>
                                    Họ và tên
                                    <input
                                        name="fullName"
                                        value={form.fullName}
                                        onChange={changeField}
                                        required
                                    />
                                </label>

                                <label>
                                    Email
                                    <input
                                        value={user?.email || ''}
                                        disabled
                                    />
                                </label>

                                <label>
                                    Số điện thoại
                                    <input
                                        name="phone"
                                        value={form.phone}
                                        onChange={changeField}
                                    />
                                </label>

                                <label>
                                    Địa chỉ
                                    <input
                                        name="address"
                                        value={form.address}
                                        onChange={changeField}
                                    />
                                </label>

                                <label className="account-profile-full">
                                    Đường dẫn ảnh đại diện
                                    <input
                                        name="avatarUrl"
                                        value={form.avatarUrl}
                                        onChange={changeField}
                                        placeholder="https://..."
                                    />
                                </label>
                            </div>

                            <button
                                className="btn btn-primary"
                                type="submit"
                                disabled={saving}
                            >
                                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                        </form>

                        <form
                            className="account-profile-form"
                            onSubmit={changePassword}
                        >
                            <h2>Đổi mật khẩu</h2>

                            <div className="account-profile-grid">
                                <label>
                                    Mật khẩu hiện tại
                                    <input
                                        type="password"
                                        value={passwordForm.currentPassword}
                                        onChange={event =>
                                            setPasswordForm(current => ({
                                                ...current,
                                                currentPassword:
                                                event.target.value
                                            }))
                                        }
                                        required
                                    />
                                </label>

                                <label>
                                    Mật khẩu mới
                                    <input
                                        type="password"
                                        minLength={8}
                                        value={passwordForm.newPassword}
                                        onChange={event =>
                                            setPasswordForm(current => ({
                                                ...current,
                                                newPassword:
                                                event.target.value
                                            }))
                                        }
                                        required
                                    />
                                </label>

                                <label>
                                    Nhập lại mật khẩu mới
                                    <input
                                        type="password"
                                        minLength={8}
                                        value={passwordForm.confirmPassword}
                                        onChange={event =>
                                            setPasswordForm(current => ({
                                                ...current,
                                                confirmPassword:
                                                event.target.value
                                            }))
                                        }
                                        required
                                    />
                                </label>
                            </div>

                            <button
                                className="btn btn-primary"
                                type="submit"
                                disabled={changingPassword}
                            >
                                {changingPassword
                                    ? 'Đang cập nhật...'
                                    : 'Đổi mật khẩu'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </section>
    );
}