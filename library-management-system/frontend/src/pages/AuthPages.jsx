import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    BookMarked,
    BookOpenCheck,
    CheckCircle2,
    Eye,
    EyeOff,
    GraduationCap,
    LockKeyhole,
    Mail,
    MapPin,
    Phone,
    ShieldCheck,
    UserRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { api } from '../api';

const SHOW_DEMO_ACCOUNTS =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== 'false';

const DEMO_ACCOUNTS = [
    {
        label: 'Quản trị viên',
        hint: 'Toàn quyền hệ thống',
        email: 'admin@library.vn',
        icon: ShieldCheck,
        tone: 'admin'
    },
    {
        label: 'Thủ thư',
        hint: 'Vận hành mượn trả',
        email: 'librarian@library.vn',
        icon: BookOpenCheck,
        tone: 'librarian'
    },
    {
        label: 'Độc giả',
        hint: 'Tra cứu và đặt sách',
        email: 'member@library.vn',
        icon: GraduationCap,
        tone: 'reader'
    }
];

export default function AuthPages({ mode }) {
    const [form, setForm] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        phone: '',
        address: ''
    });
    const [show, setShow] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [resetUrl, setResetUrl] = useState('');
    const [requestSent, setRequestSent] = useState(false);
    const [busy, setBusy] = useState(false);
    const { login, loginWithGoogle, register } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const queryToken = new URLSearchParams(location.search).get('token');
    const hashToken = new URLSearchParams(location.hash.replace(/^#/, '')).get('token');
    // Accept the old query form for already-delivered emails, but new emails use a fragment.
    const resetToken = hashToken || queryToken || '';

    const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

    function useDemoAccount(email) {
        setForm(current => ({ ...current, email, password: 'Library@123' }));
        setError('');
    }

    function navigateAfterLogin(user) {
        navigate(
            location.state?.from?.pathname ||
            (['ADMIN', 'LIBRARIAN'].includes(user.role) ? '/admin' : '/my-library')
        );
    }

    async function handleGoogleCredential(credential) {
        setError('');
        setMessage('');
        setBusy(true);
        try {
            const user = await loginWithGoogle(credential);
            navigateAfterLogin(user);
        } catch (googleError) {
            setError(googleError.message || 'Không thể đăng nhập bằng Google.');
        } finally {
            setBusy(false);
        }
    }

    async function submit(event) {
        event.preventDefault();
        setError('');
        setMessage('');
        setResetUrl('');

        if (mode === 'reset' && form.password !== form.confirmPassword) {
            setError('Mật khẩu xác nhận chưa khớp.');
            return;
        }

        setBusy(true);
        try {
            if (mode === 'login') {
                const user = await login(form.email.trim(), form.password);
                navigateAfterLogin(user);
            } else if (mode === 'register') {
                await register({ ...form, email: form.email.trim() });
                navigate('/my-library');
            } else if (mode === 'forgot') {
                const result = await api('/api/auth/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify({ email: form.email.trim() })
                });
                setRequestSent(true);
                setMessage(result?.message || 'Nếu email đã được đăng ký, bạn sẽ nhận được liên kết đặt lại mật khẩu trong ít phút.');
                setResetUrl(result?.resetUrl || '');
            } else if (mode === 'reset') {
                if (!resetToken) throw new Error('Liên kết đặt lại mật khẩu không hợp lệ.');
                await api('/api/auth/reset-password', {
                    method: 'POST',
                    body: JSON.stringify({ token: resetToken, newPassword: form.password })
                });
                setMessage('Mật khẩu đã được cập nhật. Bạn có thể đăng nhập ngay bây giờ.');
                window.setTimeout(() => navigate('/login', { replace: true }), 1300);
            }
        } catch (submitError) {
            setError(submitError.message);
        } finally {
            setBusy(false);
        }
    }

    const title = mode === 'login'
        ? 'Chào mừng trở lại'
        : mode === 'register'
            ? 'Tạo tài khoản độc giả'
            : mode === 'reset'
                ? 'Đặt mật khẩu mới'
                : 'Khôi phục mật khẩu';

    const description = mode === 'login'
        ? 'Đăng nhập vào không gian dành riêng cho vai trò của bạn.'
        : mode === 'register'
            ? 'Chỉ mất một phút để bắt đầu hành trình đọc.'
            : mode === 'reset'
                ? 'Tạo mật khẩu mới an toàn cho tài khoản của bạn.'
                : 'Nhập email đã đăng ký để nhận liên kết khôi phục.';

    const showGoogle = mode === 'login' || mode === 'register';
    const showForm = !requestSent && (mode !== 'reset' || resetToken);

    return (
        <section className="auth-page">
            <div className="auth-image">
                <div className="auth-overlay">
                    <Link className="brand light" to="/">
                        <span className="brand-icon"><BookMarked /></span>
                        <span>Smart <b>Library</b></span>
                    </Link>

                    <div className="auth-quote">
                        <span className="auth-quote-mark">“</span>
                        <blockquote>
                            Sách là phép màu<br />có thể mang theo bên mình.
                        </blockquote>
                        <span>— Stephen King</span>
                    </div>

                    <div className="auth-proof">
                        <span><b>36+</b> đầu sách chọn lọc</span>
                        <span><b>24/7</b> trợ lý tra cứu</span>
                    </div>
                </div>
            </div>

            <div className="auth-form-wrap">
                <div className="auth-form">
                    <span className="eyebrow">
                        {mode === 'register' ? 'THAM GIA CỘNG ĐỒNG' : 'SMART LIBRARY'}
                    </span>
                    <h1>{title}</h1>
                    <p>{description}</p>

                    {error && <div className="alert error">{error}</div>}
                    {message && (
                        <div className="alert success auth-success-message">
                            <CheckCircle2 />
                            <span>{message}</span>
                        </div>
                    )}

                    {mode === 'reset' && !resetToken && (
                        <div className="reset-invalid">
                            <p>Liên kết đặt lại mật khẩu thiếu mã xác thực hoặc đã bị thay đổi.</p>
                            <Link className="btn btn-outline" to="/forgot-password">Yêu cầu liên kết mới</Link>
                        </div>
                    )}

                    {showForm && (
                        <form onSubmit={submit}>
                            {mode === 'register' && (
                                <label>
                                    Họ và tên
                                    <div className="input-icon">
                                        <UserRound />
                                        <input
                                            required
                                            autoComplete="name"
                                            value={form.fullName}
                                            onChange={event => set('fullName', event.target.value)}
                                            placeholder="Nguyễn Văn An"
                                        />
                                    </div>
                                </label>
                            )}

                            {mode !== 'reset' && (
                                <label>
                                    Email
                                    <div className="input-icon">
                                        <Mail />
                                        <input
                                            required
                                            type="email"
                                            autoComplete="email"
                                            value={form.email}
                                            onChange={event => set('email', event.target.value)}
                                            placeholder="ban@email.com"
                                        />
                                    </div>
                                </label>
                            )}

                            {['login', 'register', 'reset'].includes(mode) && (
                                <label>
                                    {mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
                                    <div className="input-icon">
                                        <LockKeyhole />
                                        <input
                                            required
                                            minLength="8"
                                            type={show ? 'text' : 'password'}
                                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                                            value={form.password}
                                            onChange={event => set('password', event.target.value)}
                                            placeholder="Tối thiểu 8 ký tự"
                                        />
                                        <button
                                            type="button"
                                            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                            onClick={() => setShow(current => !current)}
                                        >
                                            {show ? <EyeOff /> : <Eye />}
                                        </button>
                                    </div>
                                </label>
                            )}

                            {mode === 'reset' && (
                                <label>
                                    Xác nhận mật khẩu mới
                                    <div className="input-icon">
                                        <LockKeyhole />
                                        <input
                                            required
                                            minLength="8"
                                            type={show ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            value={form.confirmPassword}
                                            onChange={event => set('confirmPassword', event.target.value)}
                                            placeholder="Nhập lại mật khẩu mới"
                                        />
                                    </div>
                                </label>
                            )}

                            {mode === 'register' && (
                                <div className="form-row">
                                    <label>
                                        Số điện thoại
                                        <div className="input-icon">
                                            <Phone />
                                            <input
                                                autoComplete="tel"
                                                value={form.phone}
                                                onChange={event => set('phone', event.target.value)}
                                                placeholder="09..."
                                            />
                                        </div>
                                    </label>
                                    <label>
                                        Địa chỉ
                                        <div className="input-icon">
                                            <MapPin />
                                            <input
                                                autoComplete="street-address"
                                                value={form.address}
                                                onChange={event => set('address', event.target.value)}
                                                placeholder="Hà Nội"
                                            />
                                        </div>
                                    </label>
                                </div>
                            )}

                            {mode === 'login' && (
                                <div className="forgot-row forgot-only">
                                    <Link to="/forgot-password">Quên mật khẩu?</Link>
                                </div>
                            )}

                            <button className="btn btn-primary btn-block" disabled={busy}>
                                {busy
                                    ? 'Đang xử lý...'
                                    : mode === 'login'
                                        ? 'Đăng nhập'
                                        : mode === 'register'
                                            ? 'Đăng ký tài khoản'
                                            : mode === 'reset'
                                                ? 'Cập nhật mật khẩu'
                                                : 'Gửi liên kết khôi phục'}
                            </button>
                        </form>
                    )}

                    {requestSent && (
                        <div className="auth-after-forgot">
                            {resetUrl && (
                                <a className="btn btn-primary btn-block" href={resetUrl}>
                                    Mở trang đặt lại mật khẩu
                                </a>
                            )}
                            <button
                                type="button"
                                className="btn btn-outline btn-block"
                                onClick={() => {
                                    setRequestSent(false);
                                    setMessage('');
                                    setResetUrl('');
                                }}
                            >
                                Gửi lại với email khác
                            </button>
                        </div>
                    )}

                    {showGoogle && (
                        <>
                            <div className="auth-divider"><span>hoặc tiếp tục với</span></div>
                            <GoogleSignInButton
                                disabled={busy}
                                onCredential={handleGoogleCredential}
                            />
                        </>
                    )}

                    {mode === 'login' && SHOW_DEMO_ACCOUNTS && (
                        <div className="demo-account">
                            <div className="demo-heading">
                                <b>Trải nghiệm theo vai trò</b>
                                <span>Mật khẩu chung: Library@123</span>
                            </div>
                            <div className="demo-grid">
                                {DEMO_ACCOUNTS.map(account => {
                                    const Icon = account.icon;
                                    return (
                                        <button
                                            type="button"
                                            className={`demo-role ${account.tone}`}
                                            key={account.email}
                                            onClick={() => useDemoAccount(account.email)}
                                        >
                                            <Icon />
                                            <span><b>{account.label}</b><small>{account.hint}</small></span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="auth-switch">
                        {mode === 'login' ? (
                            <>Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></>
                        ) : mode === 'register' ? (
                            <>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></>
                        ) : (
                            <Link className="auth-back-link" to="/login"><ArrowLeft /> Quay lại đăng nhập</Link>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
