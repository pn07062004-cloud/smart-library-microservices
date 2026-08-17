import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock3, CreditCard, ReceiptText, WalletCards } from 'lucide-react';
import { api, date, money } from '../api';
import { Empty, Loading, Status } from '../components/UI';
import './Payments.css';

export default function PaymentHistory() {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const paidAmount = useMemo(
        () => payments
            .filter(payment => payment.status === 'SUCCESS')
            .reduce((total, payment) => total + Number(payment.amount || 0), 0),
        [payments]
    );

    useEffect(() => {
        async function load() {
            try {
                const data = await api('/api/payments/me/history');
                setPayments(Array.isArray(data) ? data : []);
            } catch (requestError) {
                setError(requestError.message);
            } finally {
                setLoading(false);
            }
        }

        load();
    }, []);

    return (
        <section className="dashboard-page payment-page">
            <div className="container">
                <Link to="/payments" className="back">
                    <ArrowLeft /> Quay lại thanh toán
                </Link>

                <div className="payment-hero compact">
                    <div>
                        <span className="eyebrow">Lịch sử thanh toán</span>
                        <h1>Giao dịch của tôi</h1>
                        <p>Theo dõi trạng thái các giao dịch VNPay đã tạo.</p>
                    </div>
                </div>

                <div className="payment-summary">
                    <div>
                        <span className="stat-icon green"><WalletCards /></span>
                        <p><small>Đã thanh toán</small><b>{money(paidAmount)}</b></p>
                    </div>
                    <div>
                        <span className="stat-icon blue"><CreditCard /></span>
                        <p><small>Tổng giao dịch</small><b>{payments.length}</b></p>
                    </div>
                    <div>
                        <span className="stat-icon amber"><Clock3 /></span>
                        <p><small>Đang xử lý</small><b>{payments.filter(item => item.status === 'PENDING').length}</b></p>
                    </div>
                </div>

                {error && <div className="alert error">{error}</div>}

                {loading ? (
                    <Loading />
                ) : payments.length ? (
                    <div className="panel payment-history-panel">
                        <div className="table-wrap">
                            <table>
                                <thead>
                                <tr>
                                    <th>Mã giao dịch</th>
                                    <th>Khoản phạt</th>
                                    <th>Số tiền</th>
                                    <th>Ngày tạo</th>
                                    <th>Ngày thanh toán</th>
                                    <th>Trạng thái</th>
                                </tr>
                                </thead>
                                <tbody>
                                {payments.map(payment => (
                                    <tr key={payment.id}>
                                        <td><b>{payment.transactionCode}</b></td>
                                        <td>#{payment.fineId}</td>
                                        <td><b>{money(payment.amount)}</b></td>
                                        <td>{date(payment.createdAt)}</td>
                                        <td>{date(payment.paidAt)}</td>
                                        <td><Status>{payment.status}</Status></td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="payment-empty-panel">
                        <Empty
                            title="Chưa có giao dịch"
                            text="Các giao dịch thanh toán VNPay sẽ được lưu lại tại đây."
                        />
                        <Link className="btn btn-primary" to="/payments">
                            <ReceiptText /> Kiểm tra khoản phạt
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
