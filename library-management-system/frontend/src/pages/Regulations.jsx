import { useEffect, useState } from 'react';
import { AlertTriangle, BookOpen, Clock, RefreshCw } from 'lucide-react';
import { api, money } from '../api';

export default function Regulations() {
    const [settings, setSettings] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        api('/api/settings/public')
            .then(setSettings)
            .catch(() =>
                setError('Không tải được quy định thư viện. Bạn thử tải lại trang nhé.')
            );
    }, []);

    return (
        <section className="page">
            <div className="about-hero">
                <div className="container">
                    <span className="eyebrow light-text">QUY ĐỊNH THƯ VIỆN</span>
                    <h1>Mượn - trả sách rõ ràng, minh bạch</h1>
                    <p>
                        Các mốc thời gian và mức phí dưới đây luôn khớp với cấu hình
                        hiện hành của thư viện.
                    </p>
                </div>
            </div>

            <div className="container about-content">
                {error && <p>{error}</p>}
                {!settings && !error && <p>Đang tải quy định...</p>}

                {settings && (
                    <div className="values">
                        <div>
                            <BookOpen />
                            <h3>Thời hạn mượn</h3>
                            <p>
                                Mặc định {settings.defaultLoanDays} ngày cho mỗi lượt mượn,
                                tính từ ngày nhận sách.
                            </p>
                        </div>

                        <div>
                            <RefreshCw />
                            <h3>Gia hạn</h3>
                            <p>
                                Tối đa {settings.maxRenewals} lần, mỗi lần thêm{' '}
                                {settings.renewalDays} ngày — chỉ áp dụng khi sách chưa có
                                độc giả khác đặt trước.
                            </p>
                        </div>

                        <div>
                            <AlertTriangle />
                            <h3>Phí phạt</h3>
                            <p>
                                Quá hạn {money(settings.overdueFinePerDay)}/ngày/cuốn. Sách
                                hư hỏng {money(settings.damagedFine)}. Làm mất sách{' '}
                                {money(settings.lostFine)}.
                            </p>
                        </div>

                        <div>
                            <Clock />
                            <h3>Giờ mở cửa</h3>
                            <p>{settings.openingHours || 'Đang được cập nhật.'}</p>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
