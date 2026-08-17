import { memo, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowUpRight,
    BookOpen,
    Clock3,
    Quote,
    Search,
    X,
    ShieldCheck,
    Sparkles
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import BookCard from '../components/BookCard';

const DISCOVERY_ITEMS = [
    'TRA CỨU THÔNG MINH',
    'MƯỢN TRẢ MINH BẠCH',
    'ĐẶT GIỮ TRỰC TUYẾN',
    'TRỢ LÝ LIBBY 24/7',
    'KHÔNG GIAN TRI THỨC',
    'ĐỌC SÁCH MỖI NGÀY',
    'KẾT NỐI CỘNG ĐỒNG ĐỌC'
];

function getLibraryCta(user) {
    if (!user) return { to: '/register', label: 'Bắt đầu hành trình đọc' };
    if (user.role === 'ADMIN') return { to: '/admin', label: 'Mở bảng quản trị' };
    if (user.role === 'LIBRARIAN') return { to: '/admin', label: 'Mở khu vực thủ thư' };
    return { to: '/my-library', label: 'Vào tủ sách của tôi' };
}

const DiscoveryMarquee = memo(function DiscoveryMarquee() {
    const trackRef = useRef(null);
    const pausedRef = useRef(false);

    useEffect(() => {
        const track = trackRef.current;
        if (!track) return undefined;

        let frameId = 0;
        let offset = -90;
        let previousTime = performance.now();

        function move(now) {
            const elapsed = Math.min(now - previousTime, 80);
            previousTime = now;

            if (!pausedRef.current) {
                offset -= elapsed * 0.028;

                // Move the item that has left the viewport to the end of the
                // same track, preserving a seamless, non-repeating sequence.
                let firstItem = track.firstElementChild;
                let movedItems = 0;
                const maxMoves = track.children.length;

                // Layout can briefly report a zero width while the route is
                // mounting. Never allow that state to create an endless loop.
                while (firstItem && movedItems < maxMoves) {
                    const itemWidth = firstItem.getBoundingClientRect().width;
                    if (!Number.isFinite(itemWidth) || itemWidth <= 0 || offset > -itemWidth) break;

                    offset += itemWidth;
                    track.appendChild(firstItem);
                    firstItem = track.firstElementChild;
                    movedItems += 1;
                }

                track.style.transform = `translate3d(${offset}px, 0, 0)`;
            }

            frameId = window.requestAnimationFrame(move);
        }

        frameId = window.requestAnimationFrame(move);

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    return (
        <section
            className="discovery-marquee"
            aria-label="Dịch vụ nổi bật"
            onMouseEnter={() => { pausedRef.current = true; }}
            onMouseLeave={() => { pausedRef.current = false; }}
        >
            <div className="marquee-track" ref={trackRef}>
                {DISCOVERY_ITEMS.map(label => (
                    <span key={label}>
                        {label}<i>✦</i>
                    </span>
                ))}
            </div>
        </section>
    );
});

export default function Home() {
    const { user } = useAuth();
    const [books, setBooks] = useState([]);
    const [categories, setCategories] = useState([]);
    const [query, setQuery] = useState('');
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [searchFocused, setSearchFocused] = useState(false);
    const navigate = useNavigate();
    const libraryCta = getLibraryCta(user);

    useEffect(() => {
        Promise.all([
            api('/api/books?size=4&sort=createdAt,desc'),
            api('/api/categories')
        ])
            .then(([bookResponse, categoryResponse]) => {
                setBooks(Array.isArray(bookResponse?.content) ? bookResponse.content : []);
                setCategories(Array.isArray(categoryResponse) ? categoryResponse : []);
            })
            .catch(error => {
                console.error('Không tải được dữ liệu trang chủ:', error);
                setBooks([]);
                setCategories([]);
            });
    }, []);

    useEffect(() => {
        if (!searchFocused || !query.trim()) {
            setSearchSuggestions([]);
            return undefined;
        }

        const timeoutId = window.setTimeout(async () => {
            try {
                const response = await api(`/api/books/suggestions?q=${encodeURIComponent(query.trim())}&limit=6`);
                setSearchSuggestions(Array.isArray(response) ? response : []);
            } catch {
                setSearchSuggestions([]);
            }
        }, 160);

        return () => window.clearTimeout(timeoutId);
    }, [query, searchFocused]);
    function handleSearch(event) {
        event.preventDefault();

        const value = query.trim();
        navigate(value ? `/books?q=${encodeURIComponent(value)}` : '/books');
    }

    return (
        <>
            <section className="hero">
                <div className="hero-shape a" />
                <div className="hero-shape b" />

                <div className="container hero-grid">
                    <div className="hero-copy">
            <span className="hero-tag">
              <Sparkles /> Thư viện thông minh thế hệ mới
            </span>

                        <h1>
                            Mỗi trang sách,
                            <br />
                            <em>một chân trời mới.</em>
                        </h1>

                        <p>
                            Khám phá kho tri thức phong phú, mượn trả thuận tiện và nhận hỗ
                            trợ tức thì từ trợ lý Libby.
                        </p>

                        <form className="hero-search" onSubmit={handleSearch}>
                            <Search />

                            <input
                                value={query}
                                onChange={event => setQuery(event.target.value)}
                                onFocus={() => setSearchFocused(true)}
                                onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
                                placeholder="Tìm theo tên sách, tác giả hoặc ISBN..."
                            />

                            {query && (
                                <button type="button" className="hero-search-clear" onClick={() => setQuery('')} aria-label="Xóa nội dung tìm kiếm">
                                    <X />
                                </button>
                            )}

                            {searchFocused && query.trim() && searchSuggestions.length > 0 && (
                                <div className="search-suggestions hero-search-suggestions">
                                    {searchSuggestions.map(item => (
                                        <button type="button" key={item.id} onMouseDown={event => { event.preventDefault(); navigate(`/books/${item.id}`); }}>
                                            <img src={item.coverUrl || "/covers-real/fallback.svg"} alt="" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/covers-real/fallback.svg"; }} />
                                            <span><b>{item.title}</b><small>{item.authorName} · {item.categoryName}</small></span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <button type="submit">Tìm sách</button>
                        </form>

                        <div className="popular">
                            <span>Tìm nhiều:</span>

                            {categories.length > 0 ? (
                                categories.slice(0, 10).map(category => (
                                    <Link
                                        key={category.id}
                                        to={`/books?categoryId=${category.id}`}
                                    >
                                        {category.name}
                                    </Link>
                                ))
                            ) : (
                                <Link to="/books">Xem tất cả sách</Link>
                            )}
                        </div>
                    </div>

                    <div className="hero-visual">
                        <div className="hero-card main">
                            <img
                                src="https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200"
                                alt="Không gian thư viện"
                            />

                            <div>
                                <span>Không gian truyền cảm hứng</span>
                                <b>Hàng nghìn đầu sách đang chờ bạn</b>
                            </div>
                        </div>

                        <div className="floating-card one">
                            <BookOpen />
                            <span>
                <b>Mượn nhanh</b>
                <small>Chỉ trong 30 giây</small>
              </span>
                        </div>

                        <div className="floating-card two">
                            <Sparkles />
                            <span>
                <b>Trợ lý Libby</b>
                <small>Tra cứu thông minh 24/7</small>
              </span>
                        </div>
                    </div>
                </div>
            </section>

            <section className="stats">
                <div className="container stats-grid">
                    <div><b>50</b><span>Đầu sách mẫu</span></div>
                    <div><b>10+</b><span>Thể loại</span></div>
                    <div><b>98%</b><span>Hài lòng</span></div>
                    <div><b>24/7</b><span>Tra cứu trực tuyến</span></div>
                </div>
            </section>

            <DiscoveryMarquee />

            <section className="section">
                <div className="container">
                    <div className="section-head">
                        <div>
                            <span className="eyebrow">Sách mới và nổi bật</span>
                            <h2>Khơi nguồn cảm hứng đọc</h2>
                        </div>

                        <Link className="text-link" to="/books">
                            Khám phá kho sách
                            <span className="nav-cue" aria-hidden="true"><ArrowUpRight /></span>
                        </Link>
                    </div>

                    <div className="book-grid">
                        {books.map(book => (
                            <BookCard key={book.id} book={book} />
                        ))}
                    </div>
                </div>
            </section>

            <section className="section soft">
                <div className="container">
                    <div className="section-center">
                        <span className="eyebrow">Tại sao chọn Smart Library?</span>
                        <h2>Đọc sách dễ dàng hơn mỗi ngày</h2>
                        <p>
                            Mọi trải nghiệm được thiết kế để bạn dành nhiều thời gian hơn cho
                            việc đọc.
                        </p>
                    </div>

                    <div className="feature-grid">
                        <div>
                            <span><Search /></span>
                            <h3>Tra cứu thông minh</h3>
                            <p>Tìm kiếm nhanh theo tên, tác giả, ISBN và thể loại.</p>
                        </div>

                        <div>
                            <span><Clock3 /></span>
                            <h3>Mượn trả thuận tiện</h3>
                            <p>Theo dõi hạn trả, gia hạn và nhận nhắc nhở đúng lúc.</p>
                        </div>

                        <div>
                            <span><ShieldCheck /></span>
                            <h3>Quản lý minh bạch</h3>
                            <p>Lịch sử mượn, đặt trước và khoản phí được cập nhật rõ ràng.</p>
                        </div>

                        <div>
                            <span><Sparkles /></span>
                            <h3>Trợ lý Libby</h3>
                            <p>Chatbot tiếng Việt hỗ trợ tìm sách và giải đáp 24/7.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="quote-section">
                <div className="container quote-card">
                    <Quote />
                    <blockquote>
                        “Một căn phòng không có sách cũng giống như một cơ thể không có
                        linh hồn.”
                    </blockquote>
                    <span>— Marcus Tullius Cicero</span>
                    <Link
                        className="btn btn-light"
                        to={libraryCta.to}
                    >
                        {libraryCta.label}
                        <span className="nav-cue" aria-hidden="true"><ArrowUpRight /></span>
                    </Link>
                </div>
            </section>
        </>
    );
}
