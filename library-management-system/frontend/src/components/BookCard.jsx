import { Link } from 'react-router-dom';
import { BookOpen, Heart, MapPin } from 'lucide-react';
import { useFavorites } from '../context/FavoritesContext';

export default function BookCard({ book }) {
    const { isFavorite, toggleFavorite } = useFavorites();
    const fav = isFavorite(book.id);

    return (
        <article className="book-card">
            <Link to={`/books/${book.id}`} className="book-cover">
                <img src={book.coverUrl || '/covers-real/fallback.svg'} alt={book.title} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/covers-real/fallback.svg'; }} />
                <span className={`availability ${book.availableCopies ? 'yes' : 'no'}`}>
                    {book.availableCopies ? `${book.availableCopies} bản có sẵn` : 'Đang hết'}
                </span>
            </Link>

            <button
                type="button"
                className={`book-fav-btn ${fav ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); toggleFavorite(book); }}
                title={fav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
                aria-label={fav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            >
                <Heart />
            </button>

            <div className="book-info">
                <span className="eyebrow">{book.categoryName}</span>
                <Link to={`/books/${book.id}`}><h3>{book.title}</h3></Link>
                <p className="author">{book.authorName}</p>
                <div className="book-meta">
                    <span><BookOpen /> {book.pageCount || '—'} trang</span>
                    <span><MapPin /> {book.shelfLocation || '—'}</span>
                </div>
            </div>
        </article>
    );
}
