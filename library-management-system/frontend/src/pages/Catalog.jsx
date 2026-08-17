import {
    useEffect,
    useMemo,
    useState
} from 'react';

import {
    useSearchParams
} from 'react-router-dom';

import {
    BookCopy,
    Check,
    RotateCcw,
    SlidersHorizontal,
    X
} from 'lucide-react';

import { api } from '../api';
import BookCard from '../components/BookCard';

import {
    Empty,
    Loading,
    Pagination,
    SearchBox
} from '../components/UI';

export default function Catalog() {
    const [
        searchParams,
        setSearchParams
    ] = useSearchParams();

    const [query, setQuery] = useState(
        searchParams.get('q') || ''
    );

    const [
        categoryId,
        setCategoryId
    ] = useState(
        searchParams.get('categoryId') || ''
    );

    const [
        available,
        setAvailable
    ] = useState(
        searchParams.get('available') === 'true'
    );

    const [page, setPage] = useState(0);
    const [data, setData] = useState(null);
    const [categories, setCategories] = useState([]);
    const [filtersOpen, setFiltersOpen] = useState(false);

    const activeFilterCount = useMemo(
        () =>
            Number(Boolean(categoryId)) +
            Number(available),
        [categoryId, available]
    );

    useEffect(() => {
        api('/api/categories')
            .then(response => {
                setCategories(
                    Array.isArray(response)
                        ? response
                        : []
                );
            })
            .catch(error => {
                console.error(
                    'Không tải được thể loại:',
                    error
                );

                setCategories([]);
            });
    }, []);

    useEffect(() => {
        const timeoutId = window.setTimeout(
            async () => {
                const apiParams =
                    new URLSearchParams();

                apiParams.set(
                    'page',
                    String(page)
                );

                apiParams.set(
                    'size',
                    '12'
                );

                if (query.trim()) {
                    apiParams.set(
                        'q',
                        query.trim()
                    );
                }

                if (categoryId) {
                    apiParams.set(
                        'categoryId',
                        categoryId
                    );
                }

                if (available) {
                    apiParams.set(
                        'available',
                        'true'
                    );
                }

                const browserParams =
                    new URLSearchParams();

                if (query.trim()) {
                    browserParams.set(
                        'q',
                        query.trim()
                    );
                }

                if (categoryId) {
                    browserParams.set(
                        'categoryId',
                        categoryId
                    );
                }

                if (available) {
                    browserParams.set(
                        'available',
                        'true'
                    );
                }

                setSearchParams(
                    browserParams,
                    { replace: true }
                );

                try {
                    const response = await api(
                        `/api/books?${apiParams.toString()}`
                    );

                    setData(response);

                } catch (error) {
                    console.error(
                        'Không tải được danh sách sách:',
                        error
                    );

                    setData({
                        content: [],
                        totalPages: 0,
                        totalElements: 0
                    });
                }
            },
            250
        );

        return () =>
            window.clearTimeout(timeoutId);

    }, [
        query,
        categoryId,
        available,
        page,
        setSearchParams
    ]);

    useEffect(() => {
        if (!filtersOpen) {
            return undefined;
        }

        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                setFiltersOpen(false);
            }
        }

        const previousOverflow =
            document.body.style.overflow;

        document.body.style.overflow = 'hidden';

        window.addEventListener(
            'keydown',
            handleKeyDown
        );

        return () => {
            document.body.style.overflow =
                previousOverflow;

            window.removeEventListener(
                'keydown',
                handleKeyDown
            );
        };
    }, [filtersOpen]);

    function selectCategory(value) {
        setCategoryId(
            value
                ? String(value)
                : ''
        );

        setPage(0);
    }

    function chooseCategory(value) {
        selectCategory(value);

        if (
            window.matchMedia(
                '(max-width: 900px)'
            ).matches
        ) {
            setFiltersOpen(false);
        }
    }

    function resetFilters() {
        setCategoryId('');
        setAvailable(false);
        setPage(0);
    }

    return (
        <section className="page catalog-page">

            <div className="page-banner catalog-banner">
                <div className="container">

                    <span className="eyebrow light-text">
                        Kho tri thức
                    </span>

                    <h1>
                        Khám phá kho sách
                    </h1>

                    <p>
                        Tìm cuốn sách tiếp theo dành cho bạn
                        trong hàng nghìn lựa chọn.
                    </p>

                </div>
            </div>

            <div className="container catalog-shell">

                <div className="catalog-mobile-tools">

                    <button
                        type="button"
                        className="catalog-filter-trigger"
                        onClick={() =>
                            setFiltersOpen(true)
                        }
                    >
                        <SlidersHorizontal />

                        Bộ lọc

                        {activeFilterCount > 0 && (
                            <b>
                                {activeFilterCount}
                            </b>
                        )}
                    </button>

                    <span className="catalog-mobile-result-count">
                        <BookCopy />

                        {data?.totalElements || 0}
                        {' kết quả'}
                    </span>

                </div>

                {filtersOpen && (
                    <button
                        type="button"
                        className="catalog-filter-backdrop"
                        aria-label="Đóng bộ lọc"
                        onClick={() =>
                            setFiltersOpen(false)
                        }
                    />
                )}

                <aside
                    className={
                        `catalog-filter-panel${
                            filtersOpen
                                ? ' is-open'
                                : ''
                        }`
                    }
                >

                    {/* HEADER CỐ ĐỊNH */}
                    <div className="catalog-filter-head">

                        <div className="catalog-filter-head-copy">

                            <span className="catalog-filter-icon">
                                <SlidersHorizontal />
                            </span>

                            <div>
                                <h2>
                                    Bộ lọc
                                </h2>

                                <p>
                                    Tinh chỉnh kết quả tìm kiếm
                                </p>
                            </div>

                        </div>

                        <div className="catalog-filter-head-actions">

                            <button
                                type="button"
                                className="catalog-filter-reset-top"
                                onClick={resetFilters}
                                disabled={
                                    activeFilterCount === 0
                                }
                                title="Đặt lại bộ lọc"
                                aria-label="Đặt lại bộ lọc"
                            >
                                <RotateCcw />
                            </button>

                            <button
                                type="button"
                                className="catalog-filter-close"
                                onClick={() =>
                                    setFiltersOpen(false)
                                }
                                aria-label="Đóng bộ lọc"
                            >
                                <X />
                            </button>

                        </div>

                    </div>

                    {/* CHỈ DANH SÁCH NÀY CUỘN */}
                    <div className="catalog-filter-scroll">

                        <div className="catalog-filter-section-title">
                            <span>
                                Thể loại
                            </span>
                        </div>

                        <div className="catalog-category-list">

                            <button
                                type="button"
                                className={
                                    !categoryId
                                        ? 'active'
                                        : ''
                                }
                                onClick={() =>
                                    chooseCategory('')
                                }
                            >

                                <span className="catalog-choice-indicator">
                                    {!categoryId && (
                                        <Check />
                                    )}
                                </span>

                                <span>
                                    Tất cả thể loại
                                </span>

                            </button>

                            {categories.map(category => {
                                const selected =
                                    String(categoryId) ===
                                    String(category.id);

                                return (
                                    <button
                                        type="button"
                                        key={category.id}
                                        className={
                                            selected
                                                ? 'active'
                                                : ''
                                        }
                                        onClick={() =>
                                            chooseCategory(
                                                category.id
                                            )
                                        }
                                    >

                                        <span className="catalog-choice-indicator">
                                            {selected && (
                                                <Check />
                                            )}
                                        </span>

                                        <span>
                                            {category.name}
                                        </span>

                                    </button>
                                );
                            })}

                        </div>

                    </div>

                    {/* FOOTER CỐ ĐỊNH */}
                    <div className="catalog-filter-footer">

                        <div className="catalog-availability-section">

                            <div className="catalog-availability-copy">

                                <strong>
                                    Chỉ sách có sẵn
                                </strong>

                                <span>
                                    Ẩn những sách hiện không thể mượn
                                </span>

                            </div>

                            <label className="catalog-switch">

                                <input
                                    type="checkbox"
                                    checked={available}
                                    onChange={event => {
                                        setAvailable(
                                            event.target.checked
                                        );

                                        setPage(0);
                                    }}
                                />

                                <span />

                            </label>

                        </div>

                    </div>

                </aside>

                <main className="catalog-content">

                    <div className="catalog-toolbar catalog-toolbar-modern">

                        <SearchBox
                            value={query}
                            onChange={value => {
                                setQuery(value);
                                setPage(0);
                            }}
                            placeholder="Tên sách, tác giả hoặc ISBN..."
                        />

                        <span className="catalog-result-count">
                            <BookCopy />

                            <b>
                                {data?.totalElements || 0}
                            </b>

                            <span>
                                kết quả
                            </span>
                        </span>

                    </div>

                    {!data ? (

                        <Loading />

                    ) : data.content?.length > 0 ? (

                        <>
                            <div className="book-grid three catalog-book-grid">

                                {data.content.map(book => (
                                    <BookCard
                                        book={book}
                                        key={book.id}
                                    />
                                ))}

                            </div>

                            <Pagination
                                page={page}
                                total={
                                    data.totalPages || 0
                                }
                                onChange={setPage}
                            />
                        </>

                    ) : (

                        <Empty
                            title="Không tìm thấy sách"
                            text="Hãy thử từ khóa hoặc bộ lọc khác."
                        />

                    )}

                </main>

            </div>

        </section>
    );
}