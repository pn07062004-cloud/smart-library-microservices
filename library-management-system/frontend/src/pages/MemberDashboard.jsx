import { useEffect, useState } from 'react';
import {
    Bell,
    BookOpen,
    Bookmark,
    CheckCheck,
    Clock3,
    Heart,
    History,
    RotateCcw,
    Save,
    Trash2,
    WalletCards,
    X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, date, money } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { Empty, Loading, Status } from '../components/UI';
import { confirmAction, showError, showSuccess } from '../utils/feedback';

export default function MemberDashboard() {
    const { user, setUser } = useAuth();
    const { favorites, removeFavorite } = useFavorites();
    const [tab, setTab] = useState('loans');
    const [loans, setLoans] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [fines, setFines] = useState([]);
    const [notices, setNotices] = useState([]);
    const [showNotices, setShowNotices] = useState(false);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState(() => user ?? {});

    async function load() {
        setLoading(true);

        try {
            const [loanData, reservationData, fineData, noticeData] =
                await Promise.all([
                    api('/api/loans/me?size=50'),
                    api('/api/reservations/me?size=50'),
                    api('/api/fines/me?size=50'),
                    api('/api/dashboard/notifications')
                ]);

            setLoans(Array.isArray(loanData?.content) ? loanData.content : []);
            setReservations(
                Array.isArray(reservationData?.content) ? reservationData.content : []
            );
            setFines(Array.isArray(fineData?.content) ? fineData.content : []);
            setNotices(Array.isArray(noticeData) ? noticeData : []);
        } catch (error) {
            console.error('Không tải được tủ sách:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    useEffect(() => {
        setProfile(user ?? {});
    }, [user]);

    async function renew(id) {
        try {
            await api(`/api/loans/${id}/renew`, { method: 'POST' });
            await load();
        } catch (error) {
            showError(error.message);
        }
    }

    async function cancelReservation(id) {
        if (!await confirmAction('Hủy lượt đặt trước này?', { confirmText: 'Hủy đặt trước' })) {
            return;
        }

        try {
            await api(`/api/reservations/${id}?status=CANCELLED`, {
                method: 'PATCH'
            });
            await load();
        } catch (error) {
            showError(error.message);
        }
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

            setNotices(current =>
                current.map(item => ({ ...item, isRead: true }))
            );
        } catch (error) {
            showError(error.message);
        }
    }

    async function saveProfile(event) {
        event.preventDefault();

        try {
            const response = await api('/api/auth/me', {
                method: 'PUT',
                body: JSON.stringify(profile)
            });

            setUser(response);
            showSuccess('Đã cập nhật hồ sơ');
        } catch (error) {
            showError(error.message);
        }
    }

    const activeLoans = loans.filter(item =>
        ['BORROWED', 'OVERDUE'].includes(item.status)
    );

    const unreadCount = notices.filter(item => !item.isRead).length;

    return (
        <section className="dashboard-page">
            <div className="container">
                <div className="welcome">
                    <div>
                        <span>Tủ sách của tôi</span>
                        <h1>Xin chào, {user?.fullName ? user.fullName.split(' ').slice(-1)[0] : 'bạn'}!</h1>
                        <p>
                            Mã độc giả: <b>{user?.memberCode || '—'}</b>
                        </p>
                    </div>

                    <div className="notice-wrap">
                        <button
                            type="button"
                            className={`notice-bell ${showNotices ? 'active' : ''}`}
                            onClick={() => setShowNotices(current => !current)}
                            aria-label="Mở thông báo"
                        >
                            <Bell />
                            {unreadCount > 0 && <i>{unreadCount}</i>}
                        </button>

                        {showNotices && (
                            <div className="notice-panel">
                                <div className="notice-head">
                                    <div>
                                        <h3>Thông báo</h3>
                                        <p>{unreadCount} thông báo chưa đọc</p>
                                    </div>

                                    <button
                                        type="button"
                                        className="notice-close"
                                        onClick={() => setShowNotices(false)}
                                        aria-label="Đóng thông báo"
                                    >
                                        <X />
                                    </button>
                                </div>

                                {unreadCount > 0 && (
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
                                                className={`notice-item ${
                                                    notification.isRead ? 'read' : 'unread'
                                                }`}
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
                                            <span>Các thông báo mới sẽ xuất hiện tại đây.</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="member-stats">
                    <div>
                        <span className="stat-icon blue"><BookOpen /></span>
                        <p><b>{activeLoans.length}</b><small>Đang mượn</small></p>
                    </div>

                    <div>
                        <span className="stat-icon amber"><Clock3 /></span>
                        <p>
                            <b>{activeLoans.filter(item => item.status === 'OVERDUE').length}</b>
                            <small>Quá hạn</small>
                        </p>
                    </div>

                    <div>
                        <span className="stat-icon purple"><Bookmark /></span>
                        <p>
                            <b>{reservations.filter(item => item.status === 'WAITING').length}</b>
                            <small>Đang đặt trước</small>
                        </p>
                    </div>

                    <div>
                        <span className="stat-icon red"><WalletCards /></span>
                        <p>
                            <b>
                                {money(
                                    fines
                                        .filter(item => item.status === 'UNPAID')
                                        .reduce((total, item) => total + item.amount, 0)
                                )}
                            </b>
                            <small>Phí chưa trả</small>
                        </p>
                    </div>

                    <div>
                        <span className="stat-icon green"><Heart /></span>
                        <p>
                            <b>{favorites.length}</b>
                            <small>Yêu thích</small>
                        </p>
                    </div>
                </div>

                <div className="dash-tabs">
                    <button className={tab === 'loans' ? 'active' : ''} onClick={() => setTab('loans')}>Sách đang mượn</button>
                    <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Lịch sử</button>
                    <button className={tab === 'reservations' ? 'active' : ''} onClick={() => setTab('reservations')}>Đặt trước</button>
                    <button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>
                        <Heart style={{width:14,height:14,marginRight:5,verticalAlign:'middle'}} />
                        Yêu thích {favorites.length > 0 && <span className="fav-tab-count">{favorites.length}</span>}
                    </button>
                    <button className={tab === 'fines' ? 'active' : ''} onClick={() => setTab('fines')}>Khoản phạt</button>
                    <button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}>Hồ sơ</button>
                </div>

                {loading ? (
                    <Loading />
                ) : (
                    <div className="dash-content">
                        {tab === 'loans' && (
                            activeLoans.length ? (
                                <div className="loan-cards">
                                    {activeLoans.map(loan => (
                                        <article key={loan.id}>
                                            <div className="loan-book">
                                                <div className="mini-cover">
                                                    {loan.bookTitle?.charAt(0)}
                                                </div>
                                                <div>
                                                    <span>{loan.barcode}</span>
                                                    <h3>{loan.bookTitle}</h3>
                                                    <p>Mượn ngày {date(loan.borrowedDate)}</p>
                                                </div>
                                            </div>

                                            <div className="due">
                                                <small>Hạn trả</small>
                                                <b>{date(loan.dueDate)}</b>
                                                <Status>{loan.status}</Status>
                                            </div>

                                            <button
                                                className="btn btn-outline"
                                                disabled={loan.status === 'OVERDUE'}
                                                onClick={() => renew(loan.id)}
                                            >
                                                <RotateCcw /> Gia hạn ({loan.renewalCount}/2)
                                            </button>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <Empty
                                    title="Bạn chưa mượn sách"
                                    text="Khám phá kho sách và đến quầy để mượn cuốn yêu thích."
                                />
                            )
                        )}

                        {tab === 'history' && <LoanHistory rows={loans} />}

                        {tab === 'favorites' && (
                            favorites.length ? (
                                <div className="favorites-grid">
                                    {favorites.map(book => (
                                        <article key={book.id} className="fav-card">
                                            <Link to={`/books/${book.id}`} className="fav-cover">
                                                <img
                                                    src={book.coverUrl || 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400'}
                                                    alt={book.title}
                                                />
                                                <span className={`availability ${book.availableCopies ? 'yes' : 'no'}`}>
                                                    {book.availableCopies ? `${book.availableCopies} bản có sẵn` : 'Đang hết'}
                                                </span>
                                            </Link>
                                            <div className="fav-info">
                                                <span className="eyebrow">{book.categoryName}</span>
                                                <Link to={`/books/${book.id}`}><h3>{book.title}</h3></Link>
                                                <p>{book.authorName}</p>
                                                <small>Thêm lúc {date(book.addedAt)}</small>
                                                <div className="fav-actions">
                                                    <Link to={`/books/${book.id}`} className="btn btn-primary">
                                                        Xem chi tiết
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline fav-remove-btn"
                                                        onClick={() => removeFavorite(book.id)}
                                                        title="Bỏ yêu thích"
                                                    >
                                                        <Trash2 />
                                                    </button>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <Empty
                                    title="Chưa có sách yêu thích"
                                    text="Hãy nhấn biểu tượng trái tim ♥ trên trang sách để lưu vào đây."
                                />
                            )
                        )}

                        {tab === 'reservations' && (
                            reservations.length ? (
                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                        <tr>
                                            <th>Sách</th>
                                            <th>Ngày đặt</th>
                                            <th>Vị trí hàng chờ</th>
                                            <th>Trạng thái</th>
                                            <th />
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {reservations.map(reservation => (
                                            <tr key={reservation.id}>
                                                <td><b>{reservation.bookTitle}</b></td>
                                                <td>{date(reservation.reservedAt)}</td>
                                                <td>#{reservation.queuePosition}</td>
                                                <td><Status>{reservation.status}</Status></td>
                                                <td>
                                                    {reservation.status === 'WAITING' && (
                                                        <button
                                                            className="link-danger"
                                                            onClick={() => cancelReservation(reservation.id)}
                                                        >
                                                            Hủy đặt
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <Empty title="Chưa có lượt đặt trước" />
                            )
                        )}

                        {tab === 'fines' && (
                            <>
                                <div className="admin-toolbar">
                                    <span><WalletCards /> Thanh toán khoản phạt trực tuyến</span>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <Link className="btn btn-primary" to="/payments"><WalletCards /> Thanh toán</Link>
                                        <Link className="btn btn-outline" to="/payments/history"><History /> Lịch sử thanh toán</Link>
                                    </div>
                                </div>

                                {fines.length ? (
                                    <div className="table-wrap">
                                    <table>
                                        <thead>
                                        <tr>
                                            <th>Sách</th>
                                            <th>Lý do</th>
                                            <th>Số tiền</th>
                                            <th>Ngày tạo</th>
                                            <th>Trạng thái</th>
                                        </tr>
                                        </thead>
                                        <tbody>
                                        {fines.map(fine => (
                                            <tr key={fine.id}>
                                                <td><b>{fine.bookTitle}</b></td>
                                                <td>{fine.reason}</td>
                                                <td><b className="red-text">{money(fine.amount)}</b></td>
                                                <td>{date(fine.createdAt)}</td>
                                                <td><Status>{fine.status}</Status></td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                                ) : (
                                    <Empty
                                        title="Không có khoản phạt"
                                        text="Tuyệt vời! Bạn luôn trả sách đúng hạn."
                                    />
                                )}
                            </>
                        )}

                        {tab === 'profile' && (
                            <form className="profile-form" onSubmit={saveProfile}>
                                <div className="profile-title">
                                    <span className="avatar big">{user?.fullName?.charAt(0) || 'D'}</span>
                                    <div>
                                        <h2>Thông tin độc giả</h2>
                                        <p>Cập nhật thông tin liên hệ của bạn.</p>
                                    </div>
                                </div>

                                <div className="form-row">
                                    <label>
                                        Họ và tên
                                        <input
                                            required
                                            value={profile?.fullName || ''}
                                            onChange={event =>
                                                setProfile({ ...profile, fullName: event.target.value })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Email
                                        <input disabled value={profile?.email || ''} />
                                    </label>
                                </div>

                                <div className="form-row">
                                    <label>
                                        Số điện thoại
                                        <input
                                            value={profile?.phone || ''}
                                            onChange={event =>
                                                setProfile({ ...profile, phone: event.target.value })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Địa chỉ
                                        <input
                                            value={profile.address || ''}
                                            onChange={event =>
                                                setProfile({ ...profile, address: event.target.value })
                                            }
                                        />
                                    </label>
                                </div>

                                <button className="btn btn-primary">
                                    <Save /> Lưu thay đổi
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

function LoanHistory({ rows }) {
    if (!rows.length) {
        return <Empty />;
    }

    return (
        <div className="table-wrap">
            <table>
                <thead>
                <tr>
                    <th>Sách</th>
                    <th>Mã bản</th>
                    <th>Ngày mượn</th>
                    <th>Hạn trả</th>
                    <th>Ngày trả</th>
                    <th>Trạng thái</th>
                </tr>
                </thead>
                <tbody>
                {rows.map(loan => (
                    <tr key={loan.id}>
                        <td><b>{loan.bookTitle}</b></td>
                        <td>{loan.barcode}</td>
                        <td>{date(loan.borrowedDate)}</td>
                        <td>{date(loan.dueDate)}</td>
                        <td>{date(loan.returnedDate)}</td>
                        <td><Status>{loan.status}</Status></td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
