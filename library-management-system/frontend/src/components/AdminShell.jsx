import { NavLink } from 'react-router-dom';
import {
    BarChart2,
    BookCopy,
    Home,
    QrCode,
    Repeat2,
    Settings,
    UsersRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AdminShell({ title, subtitle, action, toolbar, children }) {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    return (
        <section className="admin-page">
            <div className="container admin-layout">
                <aside className="admin-sidebar">
                    <div className="staff-identity">
                        <span className="staff-monogram">{isAdmin ? 'QT' : 'TT'}</span>
                        <span>
                            <b>{isAdmin ? 'Quản trị hệ thống' : 'Không gian thủ thư'}</b>
                            <small>{user?.fullName}</small>
                        </span>
                    </div>

                    <NavLink to="/admin/stats">
                        <BarChart2 /> Thống kê & Biểu đồ
                    </NavLink>

                    <NavLink to="/admin/books">
                        <BookCopy /> Sách và bản sách
                    </NavLink>

                    <NavLink to="/admin/loans">
                        <Repeat2 /> Mượn trả
                    </NavLink>

                    <NavLink to="/admin/quick-borrow">
                        <QrCode /> Quầy mượn/trả nhanh
                    </NavLink>

                    <NavLink to="/admin/users">
                        <UsersRound /> {isAdmin ? 'Tài khoản & phân quyền' : 'Tra cứu độc giả'}
                    </NavLink>

                    {isAdmin && (
                        <NavLink to="/admin/settings">
                            <Settings /> Cài đặt
                        </NavLink>
                    )}

                    <div className="admin-sidebar-separator" />

                    <NavLink end to="/" className="admin-home-link">
                        <Home /> Về trang chủ
                    </NavLink>
                </aside>

                <div className="admin-main">
                    <div className="admin-sticky-head">
                        <div className="admin-title">
                            <div>
                                <span className={`workspace-chip ${isAdmin ? 'admin' : 'librarian'}`}>
                                    {isAdmin ? 'KHU VỰC QUẢN TRỊ' : 'KHU VỰC THỦ THƯ'}
                                </span>
                                <h1>{title}</h1>
                                <p>{subtitle}</p>
                            </div>
                            {action}
                        </div>

                        {toolbar && toolbar}
                    </div>

                    {children}
                </div>
            </div>
        </section>
    );
}