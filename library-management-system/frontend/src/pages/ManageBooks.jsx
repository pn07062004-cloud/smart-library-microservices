import { useEffect, useState } from 'react';
import { Copy, Download, FileText, Pencil, Plus, Printer, QrCode, Search, Trash2, UploadCloud, X } from 'lucide-react';
import QRCode from 'qrcode';
import { api } from '../api';
import AdminShell from '../components/AdminShell';
import { Empty, Modal, Status } from '../components/UI';
import { confirmAction, showError, showSuccess } from '../utils/feedback';

const empty = {
    isbn: '',
    title: '',
    description: '',
    publicationYear: new Date().getFullYear(),
    language: 'Tiếng Việt',
    pageCount: 200,
    coverUrl: '',
    shelfLocation: '',
    authorId: '',
    categoryId: '',
    publisherId: '',
    featured: false
};

export default function ManageBooks() {
    const [books, setBooks] = useState([]);
    const [lookups, setLookups] = useState({ authors: [], categories: [], publishers: [] });
    const [q, setQ] = useState('');
    const [editing, setEditing] = useState(null);
    const [copies, setCopies] = useState(null);
    const [ebookBook, setEbookBook] = useState(null);
    const [ebookFile, setEbookFile] = useState(null);
    const [ebookPublic, setEbookPublic] = useState(false);
    const [ebookBusy, setEbookBusy] = useState(false);
    const [copyQr, setCopyQr] = useState(null);
    const [form, setForm] = useState(empty);
    async function load() {
        const [bookData, authors, categories, publishers] = await Promise.all([
            api('/api/books?size=100' + (q ? '&q=' + encodeURIComponent(q) : '')),
            api('/api/authors'),
            api('/api/categories'),
            api('/api/publishers')
        ]);

        setBooks(bookData.content);
        setLookups({ authors, categories, publishers });
    }

    useEffect(() => {
        const timer = setTimeout(load, 200);
        return () => clearTimeout(timer);
    }, [q]);

    useEffect(() => () => {
        if (copyQr?.url) {
            URL.revokeObjectURL(copyQr.url);
        }
    }, [copyQr]);

    function open(book) {
        setEditing(book || {});
        setForm(book ? { ...book, publisherId: book.publisherId || '' } : empty);
    }

    async function save(event) {
        event.preventDefault();

        try {
            await api(editing.id ? `/api/books/${editing.id}` : '/api/books', {
                method: editing.id ? 'PUT' : 'POST',
                body: JSON.stringify({
                    ...form,
                    authorId: Number(form.authorId),
                    categoryId: Number(form.categoryId),
                    publisherId: form.publisherId ? Number(form.publisherId) : null
                })
            });
            setEditing(null);
            load();
        } catch (error) {
            showError(error.message);
        }
    }

    async function del(id) {
        if (!await confirmAction('Xóa đầu sách này và toàn bộ bản sách?', { confirmText: 'Xóa sách' })) return;

        try {
            await api('/api/books/' + id, { method: 'DELETE' });
            load();
        } catch (error) {
            showError(error.message);
        }
    }


    function openEBook(book) {
        setEbookBook(book);
        setEbookFile(null);
        setEbookPublic(Boolean(book.ebook?.publicAccess));
    }

    async function saveEBook(event) {
        event.preventDefault();
        setEbookBusy(true);

        try {
            if (ebookFile) {
                const formData = new FormData();
                formData.append('file', ebookFile);
                formData.append('publicAccess', String(ebookPublic));
                await api(`/api/books/${ebookBook.id}/ebook?publicAccess=${ebookPublic}`, {
                    method: ebookBook.ebook ? 'PUT' : 'POST',
                    body: formData
                });
            } else {
                if (!ebookBook.ebook) {
                    showError('Bạn hãy chọn file PDF trước khi lưu.');
                    return;
                }

                await api(`/api/books/${ebookBook.id}/ebook/access?publicAccess=${ebookPublic}`, {
                    method: 'POST'
                });
            }

            const updated = await api('/api/books/' + ebookBook.id);
            setEbookBook(updated);
            setEbookFile(null);
            setEbookPublic(Boolean(updated.ebook?.publicAccess));
            await load();
        } catch (error) {
            showError(error.message);
        } finally {
            setEbookBusy(false);
        }
    }

    async function deleteEBook() {
        if (!await confirmAction('Xóa file e-book của sách này?', { confirmText: 'Xóa e-book' })) return;
        setEbookBusy(true);

        try {
            await api(`/api/books/${ebookBook.id}/ebook`, { method: 'DELETE' });
            const updated = await api('/api/books/' + ebookBook.id);
            setEbookBook(updated);
            setEbookFile(null);
            setEbookPublic(false);
            await load();
        } catch (error) {
            showError(error.message);
        } finally {
            setEbookBusy(false);
        }
    }

    async function openCopyQr(copy) {
        setCopyQr({ loading: true, copy, url: '' });

        try {
            const url = await QRCode.toDataURL(String(copy.id), {
                errorCorrectionLevel: 'M',
                margin: 1,
                width: 360
            });
            setCopyQr({
                loading: false,
                copy,
                url,
                fileName: `book-copy-${copy.barcode || copy.id}.png`
            });
        } catch (error) {
            showError(error.message);
            setCopyQr(null);
        }
    }

    function closeCopyQr() {
        setCopyQr(current => {
            if (current?.url) {
                URL.revokeObjectURL(current.url);
            }
            return null;
        });
    }

    function downloadCopyQr() {
        if (!copyQr?.url) return;
        const link = document.createElement('a');
        link.href = copyQr.url;
        link.download = copyQr.fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
    }

    function printCopyQr() {
        if (!copyQr?.url) return;
        const preview = window.open('', '_blank', 'width=640,height=760');
        if (!preview) {
            showError('Trình duyệt đang chặn cửa sổ in.');
            return;
        }

        preview.document.write(`<!doctype html><html><head><title>${copyQr.copy.barcode || copyQr.copy.id}</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh;font-family:sans-serif;background:#f6f8f7}img{width:360px;max-width:80vw;border:1px solid #dbe3df;border-radius:24px;background:#fff;padding:24px;box-shadow:0 18px 40px rgba(0,0,0,.12)}</style></head><body><img src="${copyQr.url}" alt="QR"></body></html>`);
        preview.document.close();
        preview.focus();
        preview.onload = () => preview.print();
    }

    async function addCopy(event) {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);

        try {
            await api(`/api/books/${copies.id}/copies`, {
                method: 'POST',
                body: JSON.stringify(Object.fromEntries(formData))
            });
            setCopies(await api('/api/books/' + copies.id));
            load();
        } catch (error) {
            showError(error.message);
        }
    }

    async function changeCopy(id, status) {
        await api(`/api/copies/${id}/status?status=${status}`, {
            method: 'PATCH'
        });

        setCopies(await api('/api/books/' + copies.id));
        load();
    }

    return (
        <AdminShell
            title="Sách & bản sách"
            subtitle="Quản lý danh mục, thông tin và tồn kho từng bản sách."
            action={<button className="btn btn-primary" onClick={() => open()}><Plus /> Thêm sách</button>}
            toolbar={(
                <div className="admin-toolbar">
                    <div className="searchbox">
                        <Search />
                        <input value={q} onChange={event => setQ(event.target.value)} placeholder="Tìm tên sách hoặc ISBN..." />
                        {q && (
                            <button type="button" className="search-clear" onClick={() => setQ('')} aria-label="Xóa nội dung tìm kiếm">
                                <X />
                            </button>
                        )}
                    </div>
                    <span>{books.length} đầu sách</span>
                </div>
            )}
        >
            <div className="panel">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Sách</th>
                                <th>ISBN / Vị trí</th>
                                <th>Thể loại</th>
                                <th>Bản sách</th>
                                <th>Có sẵn</th>
                                <th>E-book</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {books.map(book => (
                                <tr key={book.id}>
                                    <td>
                                        <div className="book-cell">
                                            <img src={book.coverUrl || "/covers-real/fallback.svg"} alt="" loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/covers-real/fallback.svg"; }} />
                                            <span>
                                                <b>{book.title}</b>
                                                <small>{book.authorName}</small>
                                            </span>
                                        </div>
                                    </td>
                                    <td>
                                        {book.isbn}
                                        <small>Kệ {book.shelfLocation}</small>
                                    </td>
                                    <td>{book.categoryName}</td>
                                    <td>{book.totalCopies}</td>
                                    <td><b className={book.availableCopies ? 'green-text' : 'red-text'}>{book.availableCopies}</b></td>
                                    <td>{book.ebook ? (book.ebook.publicAccess ? 'Công khai' : 'Giới hạn') : 'Chưa có'}</td>
                                    <td>
                                        <div className="row-actions">
                                            <button title="Bản sách" onClick={() => setCopies(book)}><Copy /></button>
                                            <button title="E-book" onClick={() => openEBook(book)}><FileText /></button>
                                            <button title="Sửa" onClick={() => open(book)}><Pencil /></button>
                                            <button title="Xóa" onClick={() => del(book.id)}><Trash2 /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!books.length && <Empty />}
            </div>

            {editing && (
                <Modal title={editing.id ? 'Chỉnh sửa sách' : 'Thêm đầu sách mới'} onClose={() => setEditing(null)} wide>
                    <form className="modal-form" onSubmit={save}>
                        <div className="form-row">
                            <label>
                                Tên sách *
                                <input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} />
                            </label>
                            <label>
                                ISBN *
                                <input required value={form.isbn} onChange={event => setForm({ ...form, isbn: event.target.value })} />
                            </label>
                        </div>

                        <label>
                            Mô tả
                            <textarea rows="4" value={form.description || ''} onChange={event => setForm({ ...form, description: event.target.value })} />
                        </label>

                        <div className="form-row three">
                            <label>
                                Tác giả *
                                <select required value={form.authorId} onChange={event => setForm({ ...form, authorId: event.target.value })}>
                                    <option value="">Chọn tác giả</option>
                                    {lookups.authors.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                                </select>
                            </label>
                            <label>
                                Thể loại *
                                <select required value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })}>
                                    <option value="">Chọn thể loại</option>
                                    {lookups.categories.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                                </select>
                            </label>
                            <label>
                                Nhà xuất bản
                                <select value={form.publisherId} onChange={event => setForm({ ...form, publisherId: event.target.value })}>
                                    <option value="">Không chọn</option>
                                    {lookups.publishers.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
                                </select>
                            </label>
                        </div>

                        <div className="form-row three">
                            <label>
                                Năm xuất bản
                                <input type="number" value={form.publicationYear || ''} onChange={event => setForm({ ...form, publicationYear: Number(event.target.value) })} />
                            </label>
                            <label>
                                Số trang
                                <input type="number" value={form.pageCount || ''} onChange={event => setForm({ ...form, pageCount: Number(event.target.value) })} />
                            </label>
                            <label>
                                Vị trí kệ
                                <input value={form.shelfLocation || ''} onChange={event => setForm({ ...form, shelfLocation: event.target.value })} />
                            </label>
                        </div>

                        <label>
                            URL ảnh bìa
                            <input value={form.coverUrl || ''} onChange={event => setForm({ ...form, coverUrl: event.target.value })} placeholder="https://..." />
                        </label>

                        <label className="check">
                            <input type="checkbox" checked={form.featured} onChange={event => setForm({ ...form, featured: event.target.checked })} />
                            <span />
                            Hiển thị nổi bật ở trang chủ
                        </label>

                        <div className="modal-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Hủy</button>
                            <button className="btn btn-primary">Lưu sách</button>
                        </div>
                    </form>
                </Modal>
            )}



            {copyQr && (
                <Modal title={copyQr.loading ? 'Đang tải QR bản sách' : `QR bản sách: ${copyQr.copy.barcode || copyQr.copy.id}`} onClose={closeCopyQr} wide>
                    <div className="qr-modal">
                        <div className="qr-preview">
                            {copyQr.loading ? (
                                <div className="loading">Đang tải QR...</div>
                            ) : (
                                <img src={copyQr.url} alt="QR bản sách" />
                            )}
                        </div>
                        <div className="qr-meta">
                            <h3>{copyQr.copy.title}</h3>
                            <p>Mã bản sách: <b>{copyQr.copy.barcode || copyQr.copy.id}</b></p>
                            <p>Dùng mã này để quét tại quầy mượn/trả.</p>
                            <div className="modal-actions qr-actions">
                                <button type="button" className="btn btn-outline" onClick={downloadCopyQr} disabled={!copyQr.url}><Download /> Tải xuống</button>
                                <button type="button" className="btn btn-outline" onClick={printCopyQr} disabled={!copyQr.url}><Printer /> In QR</button>
                                <button type="button" className="btn btn-ghost" onClick={closeCopyQr}>Đóng</button>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {ebookBook && (
                <Modal title={`E-book: ${ebookBook.title}`} onClose={() => setEbookBook(null)} wide>
                    <form className="modal-form ebook-admin-form" onSubmit={saveEBook}>
                        <div className="ebook-admin-current">
                            <FileText />
                            <span>
                                <b>{ebookBook.ebook ? ebookBook.ebook.originalFilename : 'Chưa có file e-book'}</b>
                                <small>
                                    {ebookBook.ebook
                                        ? `${Math.round((ebookBook.ebook.sizeBytes || 0) / 1024 / 1024 * 10) / 10} MB · ${ebookBook.ebook.publicAccess ? 'Đọc công khai' : 'Chỉ độc giả đã mượn'}`
                                        : 'Chỉ nhận PDF, dung lượng tối đa 50MB.'}
                                </small>
                            </span>
                        </div>

                        <label>
                            File PDF
                            <input
                                type="file"
                                accept="application/pdf,.pdf"
                                onChange={event => setEbookFile(event.target.files?.[0] || null)}
                            />
                        </label>

                        <label className="check">
                            <input
                                type="checkbox"
                                checked={ebookPublic}
                                onChange={event => setEbookPublic(event.target.checked)}
                            />
                            <span />
                            Cho phép độc giả đăng nhập đọc e-book này
                        </label>
                        <small className="ebook-help">Công khai: đọc đầy đủ. Không công khai: chỉ xem trước 4 trang đầu.</small>

                        <div className="modal-actions">
                            {ebookBook.ebook && (
                                <button type="button" className="btn btn-outline danger-outline" disabled={ebookBusy} onClick={deleteEBook}>
                                    <Trash2 /> Xóa e-book
                                </button>
                            )}
                            <button type="button" className="btn btn-ghost" onClick={() => setEbookBook(null)}>Đóng</button>
                            <button className="btn btn-primary" disabled={ebookBusy}>
                                <UploadCloud /> {ebookFile ? (ebookBook.ebook ? 'Thay thế e-book' : 'Upload e-book') : 'Lưu thay đổi'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
            {copies && (
                <Modal title={`Bản sách: ${copies.title}`} onClose={() => setCopies(null)} wide>
                    <form className="copy-form" onSubmit={addCopy}>
                        <input name="barcode" required placeholder="Mã vạch (VD: BC1005)" />
                        <select name="status">
                            <option value="AVAILABLE">Có sẵn</option>
                            <option value="MAINTENANCE">Bảo trì</option>
                            <option value="DAMAGED">Hư hỏng</option>
                        </select>
                        <input name="conditionNote" placeholder="Ghi chú tình trạng" />
                        <button className="btn btn-primary"><Plus /> Thêm bản</button>
                    </form>

                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Mã vạch</th>
                                    <th>Ngày nhập</th>
                                    <th>Ghi chú</th>
                                    <th>Trạng thái</th>
                                    <th>Đổi trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {copies.copies.map(copy => (
                                    <tr key={copy.id}>
                                        <td><b>{copy.barcode}</b></td>
                                        <td>{copy.acquiredDate}</td>
                                        <td>{copy.conditionNote}</td>
                                        <td><Status>{copy.status}</Status></td>
                                        <td>
                                            <select value={copy.status} disabled={copy.status === 'BORROWED'} onChange={event => changeCopy(copy.id, event.target.value)}>
                                                <option>AVAILABLE</option>
                                                <option>MAINTENANCE</option>
                                                <option>DAMAGED</option>
                                                <option>LOST</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button type="button" className="row-qr-btn" title="Xem / in QR bản sách" onClick={() => openCopyQr(copy)}>
                                                <QrCode />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Modal>
            )}
        </AdminShell>
    );
}


