import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Bell,
    BookMarked,
    CheckCheck,
    ChevronDown,
    UserRound,
    Library,
    LogOut,
    Menu,
    X
} from 'lucide-react';
import {
    Link,
    NavLink,
    useLocation,
    useNavigate
} from 'react-router-dom';
import { api, date } from '../api';
import { useAuth } from '../context/AuthContext';
import ChatWidget from './ChatWidget';
import VisualEffects from './VisualEffects';
import { showError } from '../utils/feedback';

export default function Layout({ children }) {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [noticeOpen, setNoticeOpen] = useState(false);
    const [notices, setNotices] = useState([]);
    const [scrollProgress, setScrollProgress] = useState(0);

    const profileRef = useRef(null);
    const noticeRef = useRef(null);
    const routeRef = useRef(null);
    const location = useLocation();
    const isAdminRoute = location.pathname.startsWith('/admin');
    const navigate = useNavigate();
    const { user, logout, isStaff } = useAuth();
    const unreadNoticeCount = notices.filter(item => !item.isRead).length;
    const displayName = user?.fullName || user?.email || 'Bạn đọc';
    const displayRole = user?.role === 'MEMBER' ? 'Độc giả' : user?.role === 'ADMIN' ? 'Quản trị' : user?.role === 'LIBRARIAN' ? 'Thủ thư' : 'Tài khoản';

    useLayoutEffect(() => {
        document.body.classList.add('app-body');
        document.documentElement.classList.add('app-html');
        document.body.classList.toggle('admin-body', isAdminRoute);
        document.documentElement.classList.toggle('admin-html', isAdminRoute);

        return () => {
            document.body.classList.remove('app-body');
            document.documentElement.classList.remove('app-html');
            document.body.classList.remove('admin-body');
            document.documentElement.classList.remove('admin-html');
        };
    }, [isAdminRoute]);
    useEffect(() => {
        setProfileOpen(false);
        setNoticeOpen(false);
        setMobileMenuOpen(false);
    }, [location.pathname, location.search]);

    useEffect(() => {
        function handleOutsideClick(event) {
            if (
                profileOpen &&
                profileRef.current &&
                !profileRef.current.contains(event.target)
            ) {
                setProfileOpen(false);
            }

            if (
                noticeOpen &&
                noticeRef.current &&
                !noticeRef.current.contains(event.target)
            ) {
                setNoticeOpen(false);
            }
        }

        function handleEscape(event) {
            if (event.key === 'Escape') {
                setProfileOpen(false);
                setNoticeOpen(false);
                setMobileMenuOpen(false);
            }
        }

        document.addEventListener('pointerdown', handleOutsideClick);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('pointerdown', handleOutsideClick);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [profileOpen, noticeOpen]);

    useEffect(() => {
        const scrollTarget = routeRef.current;
        let frameId = 0;

        function updateScrollProgress() {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(() => {
                if (!scrollTarget || isAdminRoute) {
                    setScrollProgress(0);
                    return;
                }

                const maxScroll = scrollTarget.scrollHeight - scrollTarget.clientHeight;
                setScrollProgress(maxScroll > 0 ? scrollTarget.scrollTop / maxScroll : 0);
            });
        }

        if (scrollTarget && !isAdminRoute) {
            scrollTarget.scrollTo({ top: 0, left: 0 });
        }

        updateScrollProgress();
        scrollTarget?.addEventListener('scroll', updateScrollProgress, { passive: true });
        window.addEventListener('resize', updateScrollProgress);

        return () => {
            window.cancelAnimationFrame(frameId);
            scrollTarget?.removeEventListener('scroll', updateScrollProgress);
            window.removeEventListener('resize', updateScrollProgress);
        };
    }, [location.pathname, isAdminRoute]);

    useEffect(() => {
        if (!user || !isStaff) {
            setNotices([]);
            setNoticeOpen(false);
            return undefined;
        }

        let cancelled = false;

        async function loadNotices() {
            try {
                const data = await api('/api/dashboard/notifications');
                if (!cancelled) {
                    setNotices(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Không tải được thông báo:', error);
                    setNotices([]);
                }
            }
        }

        loadNotices();
        const timerId = window.setInterval(loadNotices, 60000);

        return () => {
            cancelled = true;
            window.clearInterval(timerId);
        };
    }, [user, isStaff, location.pathname]);

    function closeMenus() {
        setProfileOpen(false);
        setNoticeOpen(false);
        setMobileMenuOpen(false);
    }

    async function markNotificationRead(notification) {
        if (notification.isRead) {
            return;
        }

        try {
            await api(`/api/dashboard/notifications/${notification.id}/read`, {
                method: 'PATCH'
            });

            setNotices(current =>
                current.map(item =>
                    item.id === notification.id ? { ...item, isRead: true } : item
                )
            );
        } catch (error) {
            showError(error.message);
        }
    }

    async function markAllNotificationsRead() {
        const unreadNotices = notices.filter(item => !item.isRead);

        if (unreadNotices.length === 0) {
            return;
        }

        try {
            await Promise.all(
                unreadNotices.map(item =>
                    api(`/api/dashboard/notifications/${item.id}/read`, {
                        method: 'PATCH'
                    })
                )
            );

            setNotices(current => current.map(item => ({ ...item, isRead: true })));
        } catch (error) {
            showError(error.message);
        }
    }

    function signOut() {
        closeMenus();
        logout();
        navigate('/');
    }

    return (
        <>
            <VisualEffects routeKey={location.pathname} />
            <header className="header">
        <span
            className="scroll-progress"
            style={{ transform: `scaleX(${scrollProgress})` }}
        />
                <div className="nav container">
                    <Link className="brand" to="/" onClick={closeMenus}>
                        <span className="brand-icon"><BookMarked /></span>
                        <span>Smart <b>Library</b></span>
                    </Link>

                    <nav className={mobileMenuOpen ? 'navlinks open' : 'navlinks'}>
                        <NavLink to="/" onClick={closeMenus}>Trang chủ</NavLink>
                        <NavLink to="/books" onClick={closeMenus}>Kho sách</NavLink>

                        {isStaff && (
                            <NavLink to="/admin/stats" onClick={closeMenus}>
                                {user?.role === 'ADMIN' ? 'Quản trị' : 'Thủ thư'}
                            </NavLink>
                        )}

                        <NavLink to="/quy-dinh" onClick={closeMenus}>Quy định</NavLink>
                        <NavLink to="/about" onClick={closeMenus}>Giới thiệu</NavLink>
                    </nav>

                    <div className="nav-actions">
                        {user ? (
                            <>
                                {isStaff && (
                                    <div className="notice-wrap nav-notice" ref={noticeRef}>
                                        <button
                                            type="button"
                                            className={`notice-bell ${noticeOpen ? 'active' : ''}`}
                                            onClick={() => {
                                                setNoticeOpen(current => !current);
                                                setProfileOpen(false);
                                            }}
                                            aria-label="Mở thông báo hệ thống"
                                        >
                                            <Bell />
                                            {unreadNoticeCount > 0 && <i>{unreadNoticeCount}</i>}
                                        </button>

                                        {noticeOpen && (
                                            <div className="notice-panel nav-notice-panel">
                                                <div className="notice-head">
                                                    <div>
                                                        <h3>Thông báo hệ thống</h3>
                                                        <p>{unreadNoticeCount} thông báo chưa đọc</p>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className="notice-close"
                                                        onClick={() => setNoticeOpen(false)}
                                                        aria-label="Đóng thông báo"
                                                    >
                                                        <X />
                                                    </button>
                                                </div>

                                                {unreadNoticeCount > 0 && (
                                                    <button
                                                        type="button"
                                                        className="read-all"
                                                        onClick={markAllNotificationsRead}
                                                    >
                                                        <CheckCheck /> Đánh dấu tất cả đã đọc
                                                    </button>
                                                )}

                                                <div className="notice-list">
                                                    {notices.length > 0 ? (
                                                        notices.map(notification => (
                                                            <button
                                                                type="button"
                                                                key={notification.id}
                                                                className={`notice-item ${notification.isRead ? 'read' : 'unread'}`}
                                                                onClick={() => markNotificationRead(notification)}
                                                            >
                                                                <span className="notice-dot" />
                                                                <span className="notice-content">
                                                                    <b>{notification.title}</b>
                                                                    <span>{notification.message}</span>
                                                                    <small>{date(notification.createdAt)}</small>
                                                                </span>
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <div className="notice-empty">
                                                            <Bell />
                                                            <b>Chưa có thông báo</b>
                                                            <span>Cảnh báo quá hạn sẽ xuất hiện tại đây.</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="profile-wrap" ref={profileRef}>
                                    <button
                                        type="button"
                                        className="profile-btn"
                                        aria-expanded={profileOpen}
                                        aria-haspopup="menu"
                                        onClick={() => setProfileOpen(current => !current)}
                                    >
                  <span className="avatar">
                    {displayName.charAt(0).toUpperCase()}
                  </span>

                                        <span className="profile-name">
                    {displayName}
                                            <small>
                      {displayRole}
                    </small>
                  </span>

                                        <ChevronDown
                                            className={profileOpen ? 'chevron-open' : ''}
                                        />
                                    </button>

                                    {profileOpen && (
                                        <div className="profile-menu" role="menu">
                                            <Link
                                                to="/profile"
                                                role="menuitem"
                                                onClick={closeMenus}
                                            >
                                                <UserRound /> Hồ sơ cá nhân
                                            </Link>

                                            {!isStaff && (
                                                <Link
                                                    to="/my-library"
                                                    role="menuitem"
                                                    onClick={closeMenus}
                                                >
                                                    <Library /> Tủ sách của tôi
                                                </Link>
                                            )}

                                            <button
                                                type="button"
                                                role="menuitem"
                                                onClick={signOut}
                                            >
                                                <LogOut /> Đăng xuất
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <Link
                                    className="btn btn-ghost hide-mobile"
                                    to="/login"
                                    onClick={closeMenus}
                                >
                                    Đăng nhập
                                </Link>

                                <Link
                                    className="btn btn-primary hide-mobile"
                                    to="/register"
                                    onClick={closeMenus}
                                >
                                    Đăng ký
                                </Link>
                            </>
                        )}

                        <button
                            type="button"
                            className="menu-btn"
                            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
                            onClick={() => {
                                setMobileMenuOpen(current => !current);
                                setProfileOpen(false);
                                setNoticeOpen(false);
                            }}
                        >
                            {mobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>
                </div>
            </header>

            <main ref={routeRef} className={`route-stage ${isAdminRoute ? 'admin-route' : ''}`} key={location.pathname}>
                {children}

                {!isAdminRoute && (
                    <footer className="footer">
                    <div className="container footer-grid">
                        <div>
                            <Link className="brand light" to="/" onClick={closeMenus}>
                                <span className="brand-icon"><BookMarked /></span>
                                Smart <b>Library</b>
                            </Link>
                            <p>
                                Không gian tri thức hiện đại, kết nối độc giả với hàng nghìn đầu
                                sách và trải nghiệm mượn trả thuận tiện.
                            </p>
                        </div>

                        <div>
                            <h4>Khám phá</h4>
                            <Link to="/books">Kho sách</Link>
                            <Link to="/quy-dinh">Quy định thư viện</Link>
                            <Link to="/about">Về thư viện</Link>
                            <Link to="/books?available=true">Sách đang có sẵn</Link>
                        </div>

                        <div>
                            <h4>Hỗ trợ</h4>
                            <span>Hotline: 1900 2026</span>
                            <span>Email: hello@library.vn</span>
                            <span>07:30–20:00, T2–T7</span>
                        </div>
                    </div>

                    <div className="copyright">
                        © 2026 Smart Library · Đồ án chuyên ngành
                    </div>
                    </footer>
                )}
            </main>

            <ChatWidget />
        </>
    );
}
