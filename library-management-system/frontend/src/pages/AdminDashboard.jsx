import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    BookCheck,
    BookOpen,
    ClockAlert,
    ChevronRight,
    Plus,
    Settings2,
    WalletCards
} from 'lucide-react';
import { api, date, money } from '../api';
import { useAuth } from '../context/AuthContext';
import AdminShell from '../components/AdminShell';
import { Loading, Status } from '../components/UI';

export default function AdminDashboard() {
    const [stats, setStats] = useState(null);
    const [loans, setLoans] = useState([]);
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    useEffect(() => {
        Promise.all([api('/api/dashboard'), api('/api/loans?size=6')]).then(
            ([statsResponse, loanResponse]) => {
                setStats(statsResponse);
                setLoans(loanResponse.content);
            }
        );
    }, []);

    return (
        <AdminShell
            title={isAdmin ? 'Tổng quan thư viện' : 'Tổng quan nghiệp vụ'}
            subtitle={
                isAdmin
                    ? 'Theo dõi hoạt động mượn trả và tình trạng vận hành của thư viện.'
                    : 'Theo dõi công việc mượn trả, đặt giữ và hỗ trợ độc giả trong ngày.'
            }
            action={(
                <Link className="btn btn-primary" to="/admin/loans">
                    <Plus /> Tạo phiếu mượn
                </Link>
            )}
        >
            {!stats ? (
                <Loading />
            ) : (
                <>
                    <div className="admin-stats">
                        <div><span className="stat-icon blue"><BookOpen /></span><p><small>Tổng lượt mượn</small><b>{stats.totalLoans}</b><em>Toàn thời gian</em></p></div>
                        <div><span className="stat-icon green"><BookCheck /></span><p><small>Đang mượn</small><b>{stats.activeLoans}</b><em>Đang lưu hành</em></p></div>
                        <div><span className="stat-icon amber"><ClockAlert /></span><p><small>Quá hạn</small><b>{stats.overdueLoans}</b><em>Cần xử lý</em></p></div>
                        <div><span className="stat-icon red"><WalletCards /></span><p><small>Phí chưa thu</small><b>{money(stats.unpaidAmount)}</b><em>{stats.unpaidFines} khoản</em></p></div>
                    </div>

                    <div className="admin-grid">
                        <div className="panel large">
                            <div className="panel-head">
                                <div><h2>Phiếu mượn gần đây</h2><p>Các giao dịch mới nhất tại quầy.</p></div>
                                <Link to="/admin/loans">Mở danh sách mượn <ChevronRight /></Link>
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead><tr><th>Độc giả</th><th>Sách</th><th>Ngày mượn</th><th>Hạn trả</th><th>Trạng thái</th></tr></thead>
                                    <tbody>
                                    {loans.map(loan => (
                                        <tr key={loan.id}>
                                            <td><b>{loan.userName}</b><small>{loan.memberCode}</small></td>
                                            <td>{loan.bookTitle}<small>{loan.barcode}</small></td>
                                            <td>{date(loan.borrowedDate)}</td>
                                            <td>{date(loan.dueDate)}</td>
                                            <td><Status>{loan.status}</Status></td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="panel quick-actions">
                            <h2>Thao tác nhanh</h2>
                            <Link to="/admin/books"><BookOpen />Thêm và quản lý sách<ChevronRight /></Link>
                            <Link to="/admin/loans"><BookCheck />Lập phiếu mượn<ChevronRight /></Link>
                            <Link to="/admin/users"><ClockAlert />Tra cứu độc giả<ChevronRight /></Link>
                            {isAdmin && <Link to="/admin/settings"><Settings2 />Cấu hình chính sách<ChevronRight /></Link>}
                            <div className="system-ok"><i /> Các dịch vụ đang sẵn sàng</div>
                        </div>
                    </div>
                </>
            )}
        </AdminShell>
    );
}
