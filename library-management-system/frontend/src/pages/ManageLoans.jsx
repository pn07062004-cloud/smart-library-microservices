import { useEffect, useMemo, useState } from 'react';
import { Check, CornerDownLeft, Plus, Receipt, RotateCcw } from 'lucide-react';
import { api, date, money } from '../api';
import { useAuth } from '../context/AuthContext';
import AdminShell from '../components/AdminShell';
import { Empty, Modal, Status } from '../components/UI';
import { showError } from '../utils/feedback';

const EMPTY_LOAN_FORM = { userId: '', bookId: '', copyId: '', loanDays: 14 };
const EMPTY_RETURN_FORM = { condition: 'GOOD', note: 'Trả tại quầy' };

export default function ManageLoans() {
    const { user } = useAuth();
    const [tab, setTab] = useState('loans');
    const [loans, setLoans] = useState([]);
    const [reservations, setReservations] = useState([]);
    const [fines, setFines] = useState([]);
    const [users, setUsers] = useState([]);
    const [books, setBooks] = useState([]);
    const [openCheckout, setOpenCheckout] = useState(false);
    const [checkoutForm, setCheckoutForm] = useState(EMPTY_LOAN_FORM);
    const [returnTarget, setReturnTarget] = useState(null);
    const [returnForm, setReturnForm] = useState(EMPTY_RETURN_FORM);
    const [reservationTarget, setReservationTarget] = useState(null);
    const [reservationForm, setReservationForm] = useState({ copyId: '', loanDays: 14 });

    async function load() {
        const [loanData, reservationData, fineData, userData, bookData] = await Promise.all([
            api('/api/loans?size=100'),
            api('/api/reservations?size=100'),
            api('/api/fines?size=100'),
            api('/api/users?size=100'),
            api('/api/books?size=100'),
        ]);

        setLoans(loanData.content || []);
        setReservations(reservationData.content || []);
        setFines(fineData.content || []);
        setUsers((userData.content || []).filter(item => item.role === 'MEMBER' && item.status === 'ACTIVE'));
        setBooks(bookData.content || []);
    }

    useEffect(() => {
        load();
    }, []);

    const availableBooks = useMemo(
        () => books.filter(book => Number(book.availableCopies || 0) > 0),
        [books]
    );

    const selectedBook = books.find(book => String(book.id) === String(checkoutForm.bookId));
    const reservationBook = books.find(book => String(book.id) === String(reservationTarget?.bookId));
    const reservationUser = users.find(item => String(item.id) === String(reservationTarget?.userId));

    async function checkout(event) {
        event.preventDefault();
        const member = users.find(item => String(item.id) === String(checkoutForm.userId));
        const book = selectedBook;
        const copy = book?.copies.find(item => String(item.id) === String(checkoutForm.copyId));
        if (!member || !book || !copy) return;

        try {
            await api('/api/loans', {
                method: 'POST',
                body: JSON.stringify({
                    userId: member.id,
                    userName: member.fullName,
                    memberCode: member.memberCode,
                    bookId: book.id,
                    copyId: copy.id,
                    bookTitle: book.title,
                    barcode: copy.barcode,
                    loanDays: Number(checkoutForm.loanDays),
                    issuedBy: user?.fullName || 'Thủ thư',
                }),
            });
            setOpenCheckout(false);
            setCheckoutForm(EMPTY_LOAN_FORM);
            await load();
        } catch (error) {
            showError(error.message);
        }
    }

    async function submitReturn(event) {
        event.preventDefault();
        if (!returnTarget) return;

        try {
            await api(`/api/loans/${returnTarget.id}/return`, {
                method: 'POST',
                body: JSON.stringify(returnForm),
            });
            setReturnTarget(null);
            setReturnForm(EMPTY_RETURN_FORM);
            await load();
        } catch (error) {
            showError(error.message);
        }
    }

    async function renew(id) {
        try {
            await api(`/api/loans/${id}/renew`, { method: 'POST' });
            await load();
        } catch (error) {
            showError(error.message);
        }
    }

    async function changeReservation(id, status) {
        try {
            await api(`/api/reservations/${id}?status=${status}`, { method: 'PATCH' });
            await load();
        } catch (error) {
            showError(error.message);
        }
    }

    function openReservationCheckout(reservation) {
        setReservationTarget(reservation);
        setReservationForm({ copyId: '', loanDays: 14 });
    }

    async function checkoutReservation(event) {
        event.preventDefault();
        if (!reservationTarget) return;

        try {
            await api(`/api/reservations/${reservationTarget.id}/checkout`, {
                method: 'POST',
                body: JSON.stringify({
                    copyId: Number(reservationForm.copyId),
                    loanDays: Number(reservationForm.loanDays),
                    memberCode: reservationUser?.memberCode || '',
                    issuedBy: user?.fullName || 'Thủ thư',
                }),
            });
            setReservationTarget(null);
            await load();
        } catch (error) {
            showError(error.message);
        }
    }

    async function changeFine(id, status) {
        try {
            await api(`/api/fines/${id}?status=${status}`, { method: 'PATCH' });
            await load();
        } catch (error) {
            showError(error.message);
        }
    }

    return (
        <AdminShell
            title="Quản lý mượn trả"
            subtitle="Lập phiếu, nhận trả sách và xử lý đặt trước, tiền phạt."
            action={<button className="btn btn-primary" onClick={() => setOpenCheckout(true)}><Plus /> Tạo phiếu mượn</button>}
        >
            <div className="dash-tabs admin-tabs">
                <button className={tab === 'loans' ? 'active' : ''} onClick={() => setTab('loans')}>Phiếu mượn ({loans.length})</button>
                <button className={tab === 'reservations' ? 'active' : ''} onClick={() => setTab('reservations')}>Đặt trước ({reservations.length})</button>
                <button className={tab === 'fines' ? 'active' : ''} onClick={() => setTab('fines')}>Tiền phạt ({fines.length})</button>
            </div>

            <div className="panel">
                {tab === 'loans' && (
                    loans.length ? <LoanTable rows={loans} onRenew={renew} onReturn={(loan) => setReturnTarget(loan)} /> : <Empty />
                )}

                {tab === 'reservations' && (
                    reservations.length ? (
                        <ReservationsTable
                            rows={reservations}
                            onReady={(id) => changeReservation(id, 'READY')}
                            onCheckout={openReservationCheckout}
                            onCancel={(id) => changeReservation(id, 'CANCELLED')}
                        />
                    ) : <Empty />
                )}

                {tab === 'fines' && (
                    fines.length ? <FineTable rows={fines} onChange={changeFine} /> : <Empty />
                )}
            </div>

            {openCheckout && (
                <Modal title="Lập phiếu mượn sách" onClose={() => setOpenCheckout(false)}>
                    <form className="modal-form" onSubmit={checkout}>
                        <label>Độc giả *
                            <select required value={checkoutForm.userId} onChange={event => setCheckoutForm({ ...checkoutForm, userId: event.target.value })}>
                                <option value="">Chọn độc giả</option>
                                {users.map(item => <option key={item.id} value={item.id}>{item.memberCode} - {item.fullName}</option>)}
                            </select>
                        </label>
                        <label>Sách *
                            <select required value={checkoutForm.bookId} onChange={event => setCheckoutForm({ ...checkoutForm, bookId: event.target.value, copyId: '' })}>
                                <option value="">Chọn sách còn sẵn</option>
                                {availableBooks.map(item => <option key={item.id} value={item.id}>{item.title} ({item.availableCopies} bản)</option>)}
                            </select>
                        </label>
                        <label>Bản sách *
                            <select required value={checkoutForm.copyId} onChange={event => setCheckoutForm({ ...checkoutForm, copyId: event.target.value })}>
                                <option value="">Chọn mã vạch</option>
                                {selectedBook?.copies.filter(item => item.status === 'AVAILABLE').map(item => <option key={item.id} value={item.id}>{item.barcode}</option>)}
                            </select>
                        </label>
                        <label>Thời hạn mượn (ngày)
                            <input type="number" min="1" max="90" value={checkoutForm.loanDays} onChange={event => setCheckoutForm({ ...checkoutForm, loanDays: event.target.value })} />
                        </label>
                        <div className="modal-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setOpenCheckout(false)}>Hủy</button>
                            <button className="btn btn-primary">Xác nhận cho mượn</button>
                        </div>
                    </form>
                </Modal>
            )}

            {returnTarget && (
                <Modal title={`Nhận trả: ${returnTarget.bookTitle}`} onClose={() => setReturnTarget(null)}>
                    <form className="modal-form" onSubmit={submitReturn}>
                        <label>Tình trạng sách
                            <select value={returnForm.condition} onChange={event => setReturnForm({ ...returnForm, condition: event.target.value })}>
                                <option value="GOOD">Bình thường</option>
                                <option value="DAMAGED">Hư hỏng</option>
                                <option value="LOST">Mất sách</option>
                            </select>
                        </label>
                        <label>Ghi chú
                            <textarea rows="3" value={returnForm.note} onChange={event => setReturnForm({ ...returnForm, note: event.target.value })} />
                        </label>
                        <div className="modal-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setReturnTarget(null)}>Hủy</button>
                            <button className="btn btn-primary">Ghi nhận trả sách</button>
                        </div>
                    </form>
                </Modal>
            )}

            {reservationTarget && (
                <Modal title={`Cho mượn từ lượt đặt: ${reservationTarget.bookTitle}`} onClose={() => setReservationTarget(null)}>
                    <form className="modal-form" onSubmit={checkoutReservation}>
                        <label>Độc giả
                            <input disabled value={`${reservationUser?.memberCode || 'DG'} - ${reservationTarget.userName}`} />
                        </label>
                        <label>Bản sách *
                            <select required value={reservationForm.copyId} onChange={event => setReservationForm({ ...reservationForm, copyId: event.target.value })}>
                                <option value="">Chọn mã vạch còn sẵn</option>
                                {reservationBook?.copies.filter(item => item.status === 'AVAILABLE').map(item => <option key={item.id} value={item.id}>{item.barcode}</option>)}
                            </select>
                        </label>
                        <label>Thời hạn mượn (ngày)
                            <input type="number" min="1" max="90" value={reservationForm.loanDays} onChange={event => setReservationForm({ ...reservationForm, loanDays: event.target.value })} />
                        </label>
                        <div className="modal-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setReservationTarget(null)}>Hủy</button>
                            <button className="btn btn-primary">Tạo phiếu mượn</button>
                        </div>
                    </form>
                </Modal>
            )}
        </AdminShell>
    );
}

function LoanTable({ rows, onRenew, onReturn }) {
    return (
        <div className="table-wrap">
            <table>
                <thead><tr><th>Độc giả</th><th>Sách / Bản</th><th>Mượn - Hạn trả</th><th>Gia hạn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>
                {rows.map(loan => (
                    <tr key={loan.id}>
                        <td><b>{loan.userName}</b><small>{loan.memberCode}</small></td>
                        <td><b>{loan.bookTitle}</b><small>{loan.barcode}</small></td>
                        <td>{date(loan.borrowedDate)}<small>Hạn: {date(loan.dueDate)}</small></td>
                        <td>{loan.renewalCount}/2</td>
                        <td><Status>{loan.status}</Status></td>
                        <td>
                            <div className="row-actions text">
                                {loan.status === 'BORROWED' && <button onClick={() => onRenew(loan.id)}><RotateCcw /> Gia hạn</button>}
                                {['BORROWED', 'OVERDUE'].includes(loan.status) && <button className="success-action" onClick={() => onReturn(loan)}><CornerDownLeft /> Nhận trả</button>}
                            </div>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}

function ReservationsTable({ rows, onReady, onCheckout, onCancel }) {
    return (
        <div className="table-wrap">
            <table>
                <thead><tr><th>Độc giả</th><th>Sách</th><th>Ngày đặt</th><th>Hàng chờ</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
                <tbody>
                {rows.map(reservation => (
                    <tr key={reservation.id}>
                        <td><b>{reservation.userName}</b></td>
                        <td>{reservation.bookTitle}</td>
                        <td>{date(reservation.reservedAt)}<small>Hết hạn: {date(reservation.expiresAt)}</small></td>
                        <td>#{reservation.queuePosition}</td>
                        <td><Status>{reservation.status}</Status></td>
                        <td>
                            <div className="row-actions text">
                                {reservation.status === 'WAITING' && <button onClick={() => onReady(reservation.id)}><Check /> Sẵn sàng</button>}
                                {reservation.status === 'READY' && <button className="success-action" onClick={() => onCheckout(reservation)}><Check /> Cho mượn</button>}
                                {['WAITING', 'READY'].includes(reservation.status) && <button onClick={() => onCancel(reservation.id)}>Hủy</button>}
                            </div>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}

function FineTable({ rows, onChange }) {
    return (
        <div className="table-wrap">
            <table>
                <thead><tr><th>Độc giả</th><th>Sách</th><th>Lý do</th><th>Số tiền</th><th>Trạng thái</th><th /></tr></thead>
                <tbody>
                {rows.map(fine => (
                    <tr key={fine.id}>
                        <td><b>{fine.userName}</b></td>
                        <td>{fine.bookTitle}</td>
                        <td>{fine.reason}</td>
                        <td><b className="red-text">{money(fine.amount)}</b></td>
                        <td><Status>{fine.status}</Status></td>
                        <td>
                            {fine.status === 'UNPAID' && (
                                <div className="row-actions text">
                                    <button className="success-action" onClick={() => onChange(fine.id, 'PAID')}><Receipt /> Đã thu</button>
                                    <button onClick={() => onChange(fine.id, 'WAIVED')}>Miễn</button>
                                </div>
                            )}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
