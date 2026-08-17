import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    CreditCard,
    History,
    LoaderCircle,
    ReceiptText,
    ShieldCheck,
    WalletCards
} from 'lucide-react';
import { api, date, money } from '../api';
import { Empty, Loading } from '../components/UI';
import { confirmAction } from '../utils/feedback';
import './Payments.css';

function normalizeFines(rows) {
    return rows.map(item => ({
        fineId: item.fineId ?? item.id,
        loanId: item.loanId,
        bookTitle: item.bookTitle,
        type: item.type,
        reason: item.reason,
        amount: item.amount,
        createdAt: item.createdAt,
        status: item.status,
    }));
}
export default function PaymentFines() {
    const [fines, setFines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [busyFineId, setBusyFineId] = useState(null);
    const [error, setError] = useState('');
    const [serviceNotice, setServiceNotice] = useState('');

    const totalAmount = useMemo(
        () => fines.reduce((total, fine) => total + Number(fine.amount || 0), 0),
        [fines]
    );

    async function load() {
        setLoading(true);
        setError('');
        setServiceNotice('');

        try {
            const data = await api('/api/payments/fines/unpaid');
            setFines(normalizeFines(Array.isArray(data) ? data : []));
        } catch (requestError) {
            if (/404|503/.test(String(requestError.message))) {
                try {
                    const fallback = await api('/api/fines/me?size=50');
                    const rows = Array.isArray(fallback?.content) ? fallback.content : [];
                    setFines(normalizeFines(rows));
                    setServiceNotice('');
                } catch (fallbackError) {
                    setError(fallbackError.message);
                }
            } else {
                setError(requestError.message);
            }
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function pay(fine) {
        if (!await confirmAction(`Thanh toán ${money(fine.amount)} cho khoản phạt "${fine.bookTitle}" qua VNPay?`, { confirmText: 'Thanh toán' })) {
            return;
        }

        setBusyFineId(fine.fineId);
        setError('');

        try {
            const response = await api('/api/payments/transactions', {
                method: 'POST',
                body: JSON.stringify({ fineId: fine.fineId })
            });

            window.location.assign(response.paymentUrl);
        } catch (requestError) {
            setError(requestError.message);
            setBusyFineId(null);
        }
    }

    return (
        <section className="dashboard-page payment-page">
            <div className="container">
                <div className="payment-hero">
                    <div>
                        <span className="eyebrow">Thanh toán trực tuyến</span>
                        <h1>Khoản phạt thư viện</h1>
                        <p>Kiểm tra các khoản chưa thanh toán và xử lý qua VNPay sandbox.</p>
                    </div>

                    <Link className="btn btn-outline" to="/payments/history">
                        <History /> Lịch sử giao dịch
                    </Link>
                </div>

                <div className="payment-summary">
                    <div>
                        <span className="stat-icon red"><WalletCards /></span>
                        <p><small>Tổng cần thanh toán</small><b>{money(totalAmount)}</b></p>
                    </div>
                    <div>
                        <span className="stat-icon amber"><ReceiptText /></span>
                        <p><small>Số khoản phạt</small><b>{fines.length}</b></p>
                    </div>
                    <div>
                        <span className="stat-icon green"><ShieldCheck /></span>
                        <p><small>Cổng thanh toán</small><b>VNPay sandbox</b></p>
                    </div>
                </div>

                {error && <div className="alert error">{error}</div>}

                {loading ? (
                    <Loading />
                ) : fines.length ? (
                    <div className="payment-list">
                        {fines.map(fine => (
                            <article className="fine-payment-card" key={fine.fineId}>
                                <div className="fine-main">
                                    <span className="fine-icon"><ReceiptText /></span>
                                    <div>
                                        <h3>{fine.bookTitle}</h3>
                                        <p>{fine.reason || 'Khoản phạt thư viện'}</p>
                                        <small>Ngày tạo: {date(fine.createdAt)}</small>
                                    </div>
                                </div>

                                <div className="fine-amount">
                                    <small>Số tiền</small>
                                    <b>{money(fine.amount)}</b>
                                </div>

                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    disabled={busyFineId === fine.fineId}
                                    onClick={() => pay(fine)}
                                >
                                    {busyFineId === fine.fineId ? <LoaderCircle className="spin" /> : <CreditCard />}
                                    Thanh toán VNPay
                                </button>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="payment-empty-panel">
                        <Empty
                            title="Không có khoản phạt chưa thanh toán"
                            text="Khi có khoản phạt mới, bạn có thể thanh toán trực tuyến tại đây."
                        />
                        <Link className="btn btn-outline" to="/payments/history">
                            <History /> Xem lịch sử giao dịch
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}
