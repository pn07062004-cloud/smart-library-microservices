import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    BookmarkPlus,
    BookOpen,
    Calendar,
    CheckCircle2,
    Eye,
    Globe2,
    Heart,
    MapPin,
    MessageSquareText,
    Share2,
    Star
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { Loading, Status } from '../components/UI';
import EBookReader from '../components/EBookReader';
import { showError, showSuccess } from '../utils/feedback';
import './BookDetail.css';

const EMPTY_RATING = {
    average: 0,
    count: 0,
    myRating: null,
    myComment: '',
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
};

export default function BookDetail() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const { isFavorite, toggleFavorite } = useFavorites();

    const [book, setBook] = useState(null);
    const [rating, setRating] = useState(EMPTY_RATING);
    const [reviews, setReviews] = useState([]);
    const [selectedStars, setSelectedStars] = useState(0);
    const [hoveredStar, setHoveredStar] = useState(0);
    const [comment, setComment] = useState('');
    const [reviewBusy, setReviewBusy] = useState(false);
    const [reviewMessage, setReviewMessage] = useState('');
    const [shareMessage, setShareMessage] = useState('');
    const [readerOpen, setReaderOpen] = useState(false);
    const [readerMode, setReaderMode] = useState('full');
    const [hasBorrowedEBookAccess, setHasBorrowedEBookAccess] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        loadDetail();
    }, [id, user?.id]);

    async function loadDetail() {
        try {
            const [bookData, ratingData, reviewData, loanData] = await Promise.all([
                api(`/api/books/${id}`),
                api(`/api/books/${id}/rating`),
                api(`/api/books/${id}/reviews`),
                user ? api('/api/loans/me?size=100').catch(() => null) : Promise.resolve(null)
            ]);

            const activeLoans = Array.isArray(loanData?.content) ? loanData.content : [];
            const hasActiveLoanForThisBook = activeLoans.some(loan =>
                Number(loan.bookId) === Number(id) && ['BORROWED', 'OVERDUE'].includes(loan.status)
            );

            setBook(bookData);
            setHasBorrowedEBookAccess(Boolean(bookData?.ebook?.publicAccess || hasActiveLoanForThisBook));
            applyRating(ratingData);
            setReviews(Array.isArray(reviewData) ? reviewData : []);
            setError('');
        } catch (requestError) {
            setError(requestError.message);
        }
    }

    function applyRating(data) {
        const nextRating = {
            average: Number(data?.average || 0),
            count: Number(data?.count || 0),
            myRating: data?.myRating ?? null,
            myComment: data?.myComment || '',
            distribution: data?.distribution || EMPTY_RATING.distribution
        };

        setRating(nextRating);
        setSelectedStars(nextRating.myRating || 0);
        setComment(nextRating.myComment);
    }

    async function reserve() {
        if (!user) {
            navigate('/login', { state: { from: location } });
            return;
        }

        try {
            await api('/api/reservations', {
                method: 'POST',
                body: JSON.stringify({
                    bookId: book.id,
                    bookTitle: book.title,
                })
            });

            showSuccess('Đặt trước thành công! Theo dõi trong Tủ sách của tôi.');
        } catch (requestError) {
            showError(requestError.message);
        }
    }

    async function submitReview(event) {
        event.preventDefault();

        if (!user) {
            navigate('/login', { state: { from: location } });
            return;
        }

        if (!selectedStars) {
            setReviewMessage('Bạn hãy chọn từ 1 đến 5 sao.');
            return;
        }

        setReviewBusy(true);
        setReviewMessage('');

        try {
            const ratingData = await api(`/api/books/${id}/rating`, {
                method: 'POST',
                body: JSON.stringify({
                    stars: selectedStars,
                    comment: comment.trim(),
                })
            });

            const reviewData = await api(`/api/books/${id}/reviews`);
            applyRating(ratingData);
            setReviews(Array.isArray(reviewData) ? reviewData : []);
            setReviewMessage(
                rating.myRating
                    ? 'Đã cập nhật đánh giá của bạn.'
                    : 'Cảm ơn bạn đã đánh giá cuốn sách.'
            );
        } catch (requestError) {
            setReviewMessage(requestError.message);
        } finally {
            setReviewBusy(false);
        }
    }

    async function copyToClipboard(text) {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return;
        }

        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }


    function openReader(mode = 'full') {
        setReaderMode(mode);
        setReaderOpen(true);
    }
    async function shareBook() {
        const url = window.location.href;
        const data = {
            title: book.title,
            text: `Xem cuốn “${book.title}” của ${book.authorName} tại Smart Library`,
            url
        };

        try {
            if (navigator.share) {
                await navigator.share(data);
                setShareMessage('Đã mở trình chia sẻ');
            } else {
                await copyToClipboard(url);
                setShareMessage('Đã sao chép liên kết');
            }
        } catch (shareError) {
            if (shareError?.name === 'AbortError') return;
            await copyToClipboard(url);
            setShareMessage('Đã sao chép liên kết');
        }

        window.setTimeout(() => setShareMessage(''), 2500);
    }

    if (error) {
        return <div className="container page"><h2>{error}</h2></div>;
    }

    if (!book) return <Loading />;

    const activeStars = hoveredStar || selectedStars;

    return (
        <section className="book-detail page">
            <div className="container">
                <Link to="/books" className="back">
                    <ArrowLeft /> Quay lại kho sách
                </Link>

                <div className="detail-grid">
                    <div className="detail-cover">
                        <img src={book.coverUrl || "/covers-real/fallback.svg"} alt={book.title} loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/covers-real/fallback.svg"; }} />
                        <span className={book.availableCopies ? 'available' : 'unavailable'}>
              {book.availableCopies ? (
                  <><CheckCircle2 /> Còn {book.availableCopies} bản có sẵn</>
              ) : 'Hiện đang hết sách'}
            </span>
                    </div>

                    <div className="detail-content">
                        <span className="eyebrow">{book.categoryName}</span>
                        <h1>{book.title}</h1>
                        <p className="detail-author">Tác giả <b>{book.authorName}</b></p>

                        <a className="book-rating-compact" href="#book-reviews">
                            <StarRow value={rating.average} />
                            <b>{rating.count ? rating.average.toFixed(1) : 'Chưa có điểm'}</b>
                            <span>({rating.count} đánh giá)</span>
                        </a>

                        <p className="description">{book.description}</p>

                        <div className="detail-meta">
                            {book.ebook && (
                                <Meta icon={<BookOpen />} label="E-book" value={hasBorrowedEBookAccess ? 'Đọc trực tuyến' : 'Xem trước'} />
                            )}
                            <Meta icon={<Calendar />} label="Năm xuất bản" value={book.publicationYear || '—'} />
                            <Meta icon={<Globe2 />} label="Ngôn ngữ" value={book.language || '—'} />
                            <Meta icon={<MapPin />} label="Vị trí kệ" value={book.shelfLocation || '—'} />
                        </div>

                        <div className="detail-actions">
                            <button className="btn btn-primary btn-lg" onClick={reserve}>
                                <BookmarkPlus /> {book.availableCopies ? 'Đặt giữ sách' : 'Đặt trước'}
                            </button>
                            <button
                                className={`btn btn-lg fav-btn ${isFavorite(book.id) ? 'fav-active' : 'btn-outline'}`}
                                onClick={() => toggleFavorite(book)}
                                title={isFavorite(book.id) ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                            >
                                <Heart className={isFavorite(book.id) ? 'heart-filled' : ''} />
                                {isFavorite(book.id) ? 'Đã yêu thích' : 'Yêu thích'}
                            </button>
                            {book.ebook && (
                                hasBorrowedEBookAccess ? (
                                    <button className="btn btn-outline btn-lg ebook-open-btn" onClick={() => openReader('full')}>
                                        <BookOpen /> Đọc e-book
                                    </button>
                                ) : (
                                    <button className="btn btn-outline btn-lg ebook-preview-btn" onClick={() => openReader('preview')}>
                                        <Eye /> Xem trước
                                    </button>
                                )
                            )}
                            <button className="btn btn-outline btn-lg" onClick={shareBook}>
                                <Share2 /> {shareMessage || 'Chia sẻ'}
                            </button>
                        </div>
                        <p className="loan-note">
                            Bạn nhận và trả sách tại quầy thủ thư. Thời hạn mượn mặc định 14 ngày.
                        </p>

                    </div>
                </div>

                <section className="reviews-section" id="book-reviews">
                    <div className="reviews-heading">
                        <div>
                            <span className="eyebrow">Cảm nhận độc giả</span>
                            <h2>Đánh giá và nhận xét</h2>
                        </div>
                        <span>{rating.count} lượt đánh giá</span>
                    </div>

                    <div className="review-overview">
                        <div className="rating-breakdown">
                            <div className="big-score">
                                <b>{rating.count ? rating.average.toFixed(1) : '—'}</b>
                                <span>trên 5</span>
                            </div>
                            <StarRow value={rating.average} large />
                            <small>{rating.count || 0} độc giả đã đánh giá</small>

                            <div className="rating-bars">
                                {[5, 4, 3, 2, 1].map(star => {
                                    const amount = Number(rating.distribution?.[star] || 0);
                                    const percent = rating.count ? (amount / rating.count) * 100 : 0;
                                    return (
                                        <div className="rating-bar-row" key={star}>
                                            <span>{star} <Star /></span>
                                            <div><i style={{ width: `${percent}%` }} /></div>
                                            <small>{amount}</small>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <form className="review-form" onSubmit={submitReview}>
                            <h3>{rating.myRating ? 'Chỉnh sửa đánh giá' : 'Viết đánh giá của bạn'}</h3>
                            <p>Chia sẻ cảm nhận để giúp những độc giả khác chọn sách phù hợp.</p>

                            <label>Chọn số sao</label>
                            <div className="review-star-picker" onMouseLeave={() => setHoveredStar(0)}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        type="button"
                                        key={star}
                                        className={star <= activeStars ? 'selected' : ''}
                                        onMouseEnter={() => setHoveredStar(star)}
                                        onClick={() => setSelectedStars(star)}
                                        aria-label={`${star} sao`}
                                    >
                                        <Star />
                                    </button>
                                ))}
                                <b>{activeStars ? `${activeStars}/5` : 'Chưa chọn'}</b>
                            </div>

                            <label htmlFor="review-comment">Nhận xét</label>
                            <textarea
                                id="review-comment"
                                value={comment}
                                maxLength={1000}
                                rows={4}
                                onChange={event => setComment(event.target.value)}
                                placeholder="Điều gì khiến bạn thích hoặc chưa hài lòng về cuốn sách?"
                            />
                            <div className="review-form-bottom">
                                <small>{comment.length}/1000 ký tự</small>
                                <button className="btn btn-primary" disabled={reviewBusy}>
                                    <MessageSquareText />
                                    {reviewBusy ? 'Đang gửi...' : rating.myRating ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
                                </button>
                            </div>
                            {reviewMessage && <div className="review-message">{reviewMessage}</div>}
                        </form>
                    </div>

                    <div className="review-list">
                        <h3>Nhận xét mới nhất</h3>
                        {reviews.length ? reviews.map(review => (
                            <article className={review.mine ? 'my-review' : ''} key={review.id}>
                                <div className="review-avatar">{review.userName?.charAt(0) || 'Đ'}</div>
                                <div className="review-body">
                                    <div className="review-meta">
                                        <div>
                                            <b>{review.userName}</b>
                                            {review.mine && <em>Đánh giá của bạn</em>}
                                        </div>
                                        <time>{formatReviewDate(review.createdAt)}</time>
                                    </div>
                                    <StarRow value={review.stars} />
                                    <p>{review.comment || 'Độc giả này chưa viết nhận xét.'}</p>
                                </div>
                            </article>
                        )) : (
                            <div className="no-reviews">
                                <MessageSquareText />
                                <b>Chưa có nhận xét nào</b>
                                <span>Hãy là người đầu tiên chia sẻ cảm nhận về cuốn sách.</span>
                            </div>
                        )}
                    </div>
                </section>

                {readerOpen && <EBookReader book={book} initialMode={readerMode} onClose={() => setReaderOpen(false)} />}

                <div className="copy-list">
                    <h2>Thông tin các bản sách</h2>
                    <div className="table-wrap">
                        <table>
                            <thead><tr><th>Mã vạch</th><th>Vị trí</th><th>Ngày nhập</th><th>Tình trạng</th></tr></thead>
                            <tbody>
                            {book.copies.map(copy => (
                                <tr key={copy.id}>
                                    <td><b>{copy.barcode}</b></td>
                                    <td>{book.shelfLocation}</td>
                                    <td>{copy.acquiredDate}</td>
                                    <td><Status>{copy.status}</Status></td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
}

function Meta({ icon, label, value }) {
    return <div>{icon}<span><small>{label}</small><b>{value}</b></span></div>;
}

function StarRow({ value, large = false }) {
    const rounded = Math.round(Number(value || 0));
    return (
        <div className={`star-row ${large ? 'large' : ''}`}>
            {[1, 2, 3, 4, 5].map(star => (
                <Star key={star} className={star <= rounded ? 'filled' : ''} />
            ))}
        </div>
    );
}

function formatReviewDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(value));
}
