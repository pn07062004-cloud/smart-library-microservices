import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, LoaderCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';

export function Loading() {
    return <div className="loading"><LoaderCircle className="spin" />Đang tải dữ liệu...</div>;
}

export function Empty({ title = 'Chưa có dữ liệu', text = 'Dữ liệu sẽ xuất hiện tại đây.' }) {
    return <div className="empty"><div className="empty-icon">⌁</div><h3>{title}</h3><p>{text}</p></div>;
}

export function Modal({ title, onClose, children, wide = false }) {
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = event => event.key === 'Escape' && onClose();

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return createPortal(
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
            <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
                <div className="modal-head">
                    <h2>{title}</h2>
                    <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng cửa sổ">
                        <X />
                    </button>
                </div>
                <div className="modal-content">{children}</div>
            </section>
        </div>,
        document.body
    );
}

export function Status({ children }) {
    const k = String(children).toLowerCase();
    const labels = {
        AVAILABLE: 'Có sẵn', BORROWED: 'Đang mượn', OVERDUE: 'Quá hạn', RETURNED: 'Đã trả',
        WAITING: 'Đang chờ', READY: 'Sẵn sàng', FULFILLED: 'Đã nhận', CANCELLED: 'Đã hủy',
        EXPIRED: 'Hết hạn', UNPAID: 'Chưa trả', PAID: 'Đã thanh toán', WAIVED: 'Đã miễn',
        PENDING: 'Đang xử lý', SUCCESS: 'Thành công', FAILED: 'Thất bại',
        ACTIVE: 'Hoạt động', LOCKED: 'Đã khóa', MEMBER: 'Độc giả', LIBRARIAN: 'Thủ thư',
        ADMIN: 'Quản trị', DAMAGED: 'Hư hỏng', LOST: 'Mất sách', MAINTENANCE: 'Bảo trì'
    };
    return <span className={`status s-${k}`}>{labels[children] || children}</span>;
}

export function Pagination({ page, total, onChange }) {
    if (total <= 1) return null;
    return <div className="pagination"><button disabled={page <= 0} onClick={() => onChange(page - 1)}><ChevronLeft /></button><span>Trang {page + 1}/{total}</span><button disabled={page >= total - 1} onClick={() => onChange(page + 1)}><ChevronRight /></button></div>;
}

export function SearchBox({ value, onChange, placeholder = 'Tìm kiếm...', suggestions = false, onPick }) {
    const [items, setItems] = useState([]);
    const [focused, setFocused] = useState(false);
    const requestId = useRef(0);

    useEffect(() => {
        if (!suggestions || !focused || !value.trim()) {
            setItems([]);
            return undefined;
        }

        const currentRequest = ++requestId.current;
        const timeoutId = window.setTimeout(async () => {
            try {
                const response = await api(`/api/books/suggestions?q=${encodeURIComponent(value.trim())}&limit=6`);
                if (currentRequest === requestId.current) {
                    setItems(Array.isArray(response) ? response : []);
                }
            } catch {
                if (currentRequest === requestId.current) setItems([]);
            }
        }, 160);

        return () => window.clearTimeout(timeoutId);
    }, [value, focused, suggestions]);

    const showSuggestions = suggestions && focused && value.trim() && items.length > 0;

    function pick(item) {
        onChange(item.title);
        setFocused(false);
        onPick?.(item);
    }

    return (
        <div className="searchbox searchbox-smart">
            <Search />
            <input
                value={value}
                onChange={event => onChange(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => window.setTimeout(() => setFocused(false), 120)}
                placeholder={placeholder}
            />
            {value && (
                <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Xóa nội dung tìm kiếm">
                    <X />
                </button>
            )}
            {showSuggestions && (
                <div className="search-suggestions" role="listbox">
                    {items.map(item => (
                        <button type="button" key={item.id} onMouseDown={event => { event.preventDefault(); pick(item); }}>
                            <img src={item.coverUrl || "/covers-real/fallback.svg"} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/covers-real/fallback.svg"; }} />
                            <span><b>{item.title}</b><small>{item.authorName} · {item.categoryName}</small></span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}