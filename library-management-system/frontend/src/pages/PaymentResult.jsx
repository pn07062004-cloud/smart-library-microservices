import { Link, useLocation } from 'react-router-dom';
import { CheckCircle2, Clock3, CreditCard, ReceiptText, XCircle } from 'lucide-react';
import { money } from '../api';
import './Payments.css';

export default function PaymentResult() {
    const location = useLocation();
    const params = new URLSearchParams(location.search);
    const status = params.get('status') || 'PENDING';
    const transactionCode = params.get('transactionCode') || '';
    const message = params.get('message') || defaultMessage(status);
    const amount = Number(params.get('amount') || 0);
    const fineId = params.get('fineId');
    const isSuccess = status === 'SUCCESS';
    const isPending = status === 'PENDING';
    const canRetry = !isSuccess;

    return (
        <section className="dashboard-page payment-page">
            <div className="container">
                <div className={`payment-result-card ${isSuccess ? 'success' : isPending ? 'pending' : 'failed'}`}>
                    <span className="result-icon">
                        {isSuccess ? <CheckCircle2 /> : isPending ? <Clock3 /> : <XCircle />}
                    </span>

                    <span className="eyebrow">Kết quả thanh toán</span>
                    <h1>{isSuccess ? 'Thanh toán thành công' : isPending ? 'Giao dịch đang xử lý' : 'Thanh toán chưa thành công'}</h1>
                    <p>{message}</p>

                    <dl className="payment-result-details">
                        <div>
                            <dt>Mã giao dịch</dt>
                            <dd>{transactionCode || 'Chưa có'}</dd>
                        </div>
                        {fineId && (
                            <div>
                                <dt>Khoản phạt</dt>
                                <dd>#{fineId}</dd>
                            </div>
                        )}
                        {amount > 0 && (
                            <div>
                                <dt>Số tiền</dt>
                                <dd>{money(amount)}</dd>
                            </div>
                        )}
                    </dl>

                    <div className="payment-result-actions">
                        {canRetry && (
                            <Link className="btn btn-primary" to="/payments">
                                <CreditCard /> Thanh toán lại
                            </Link>
                        )}
                        <Link className={canRetry ? 'btn btn-outline' : 'btn btn-primary'} to="/payments">
                            <ReceiptText /> Danh sách khoản phạt
                        </Link>
                        <Link className="btn btn-outline" to="/payments/history">
                            Lịch sử giao dịch
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

function defaultMessage(status) {
    if (status === 'SUCCESS') return 'Khoản phạt đã được cập nhật là đã thanh toán.';
    if (status === 'FAILED') return 'Giao dịch bị hủy hoặc không được VNPay xác nhận.';
    return 'Hệ thống đang chờ kết quả xác nhận từ VNPay.';
}
