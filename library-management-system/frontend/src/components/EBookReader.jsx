import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

import {
    Maximize2,
    Minus,
    Plus,
    X
} from 'lucide-react';

import {
    createPortal
} from 'react-dom';

import {
    Document,
    Page,
    pdfjs
} from 'react-pdf';

import {
    API_BASE
} from '../api';

import {
    getAuthToken
} from '../authStorage';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';


pdfjs.GlobalWorkerOptions.workerSrc =
    new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).toString();


const PREVIEW_PAGES = 4;

const MIN_ZOOM = 0.7;
const MAX_ZOOM = 1.6;
const ZOOM_STEP = 0.1;

const DEFAULT_ZOOM = 1;

/*
 * 100% = kích thước đọc bình thường.
 * Không phóng PDF kín màn hình.
 */
const MAX_PAGE_WIDTH = 640;


export default function EBookReader({
                                        book,
                                        ebook,
                                        open = true,
                                        onClose,
                                        fileUrl,
                                        pdfUrl,
                                        src,
                                        initialMode = 'full'
                                    }) {
    const bodyRef =
        useRef(null);

    const objectUrlRef =
        useRef('');


    const token =
        getAuthToken();


    const [
        numPages,
        setNumPages
    ] = useState(0);


    const [
        zoom,
        setZoom
    ] = useState(
        DEFAULT_ZOOM
    );


    const [
        pageBaseWidth,
        setPageBaseWidth
    ] = useState(
        MAX_PAGE_WIDTH
    );


    const [
        error,
        setError
    ] = useState('');


    const [
        objectUrl,
        setObjectUrl
    ] = useState('');


    const [
        readerMode,
        setReaderMode
    ] = useState(
        initialMode
    );


    const resolvedBook =
        book ||
        ebook?.book ||
        ebook ||
        {};


    const title =
        resolvedBook.title ||
        resolvedBook.bookTitle ||
        'E-book';


    const readUrl =
        useMemo(() => {
            const directUrl =
                fileUrl ||
                pdfUrl ||
                src ||
                ebook?.readUrl ||
                ebook?.url ||
                ebook?.fileUrl;


            if (directUrl) {
                return directUrl;
            }


            return resolvedBook?.id
                ? (
                    `${API_BASE}` +
                    `/api/books/` +
                    `${resolvedBook.id}` +
                    `/ebook/read`
                )
                : '';

        }, [
            fileUrl,
            pdfUrl,
            src,
            ebook,
            resolvedBook?.id
        ]);


    const previewUrl =
        useMemo(
            () =>
                resolvedBook?.id
                    ? (
                        `${API_BASE}` +
                        `/api/books/` +
                        `${resolvedBook.id}` +
                        `/ebook/preview`
                    )
                    : '',
            [
                resolvedBook?.id
            ]
        );


    /*
     * Tính lại kích thước 100%.
     *
     * Trên desktop:
     * tối đa 640px.
     *
     * Trên màn hình nhỏ:
     * tự co theo vùng đọc.
     */
    const updatePageWidth =
        useCallback(() => {
            const body =
                bodyRef.current;


            if (!body) {
                return;
            }


            const available =
                Math.max(
                    260,
                    body.clientWidth - 48
                );


            setPageBaseWidth(
                Math.min(
                    MAX_PAGE_WIDTH,
                    available
                )
            );

        }, []);


    /*
     * Tạo Blob URL mới.
     */
    function setPdfBlob(
        blob,
        mode
    ) {
        if (
            objectUrlRef.current
        ) {
            URL.revokeObjectURL(
                objectUrlRef.current
            );
        }


        const nextUrl =
            URL.createObjectURL(
                blob
            );


        objectUrlRef.current =
            nextUrl;


        setObjectUrl(
            nextUrl
        );


        setReaderMode(
            mode
        );
    }


    /*
     * Khóa trang phía sau + ESC.
     */
    useEffect(() => {
        if (!open) {
            return undefined;
        }


        const previousOverflow =
            document.body.style.overflow;


        document.body.style.overflow =
            'hidden';


        function handleKeyDown(
            event
        ) {
            if (
                event.key ===
                'Escape'
            ) {
                onClose?.();
            }
        }


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

    }, [
        open,
        onClose
    ]);


    /*
     * Reset mỗi lần mở.
     */
    useEffect(() => {
        if (!open) {
            return;
        }


        setNumPages(0);

        setZoom(
            DEFAULT_ZOOM
        );

        setError('');

        setReaderMode(
            initialMode
        );


        if (
            bodyRef.current
        ) {
            bodyRef.current.scrollTop =
                0;

            bodyRef.current.scrollLeft =
                0;
        }

    }, [
        open,
        initialMode,
        readUrl,
        previewUrl
    ]);


    /*
     * Load PDF.
     */
    useEffect(() => {
        if (!open) {
            return undefined;
        }


        let cancelled =
            false;


        async function fetchPdf(
            url
        ) {
            const response =
                await fetch(
                    url,
                    {
                        headers:
                            token
                                ? {
                                    Authorization:
                                        `Bearer ${token}`
                                }
                                : {}
                    }
                );


            if (!response.ok) {
                let message =
                    'Không mở được e-book.';


                try {
                    const result =
                        await response.json();


                    message =
                        result?.message ||
                        message;

                } catch {
                    // Response không phải JSON.
                }


                const requestError =
                    new Error(
                        message
                    );


                requestError.status =
                    response.status;


                throw requestError;
            }


            return response.blob();
        }


        async function load() {
            setError('');

            setNumPages(0);


            const requestedUrl =
                initialMode === 'preview'
                    ? (
                        previewUrl ||
                        readUrl
                    )
                    : readUrl;


            if (!requestedUrl) {
                setError(
                    'Sách này chưa có file e-book.'
                );

                return;
            }


            try {
                const blob =
                    await fetchPdf(
                        requestedUrl
                    );


                if (cancelled) {
                    return;
                }


                setPdfBlob(
                    blob,
                    initialMode === 'preview'
                        ? 'preview'
                        : 'full'
                );


                return;

            } catch (loadError) {

                const canPreview =
                    initialMode !== 'preview' &&
                    previewUrl &&
                    [
                        400,
                        401,
                        403
                    ].includes(
                        loadError?.status
                    );


                if (!canPreview) {
                    if (!cancelled) {
                        setError(
                            loadError?.message ||
                            'Không mở được e-book.'
                        );
                    }

                    return;
                }
            }


            /*
             * Không đủ quyền full
             * → fallback sang preview.
             */
            try {
                const blob =
                    await fetchPdf(
                        previewUrl
                    );


                if (cancelled) {
                    return;
                }


                setPdfBlob(
                    blob,
                    'preview'
                );

            } catch (
                previewError
                ) {
                if (!cancelled) {
                    setError(
                        previewError?.message ||
                        'Không mở được bản xem trước.'
                    );
                }
            }
        }


        load();


        return () => {
            cancelled = true;
        };

    }, [
        open,
        initialMode,
        readUrl,
        previewUrl,
        token
    ]);


    /*
     * Responsive theo vùng reader.
     */
    useEffect(() => {
        if (!open) {
            return undefined;
        }


        const body =
            bodyRef.current;


        if (!body) {
            return undefined;
        }


        updatePageWidth();


        const observer =
            typeof ResizeObserver !==
            'undefined'
                ? new ResizeObserver(
                    updatePageWidth
                )
                : null;


        observer?.observe(
            body
        );


        window.addEventListener(
            'resize',
            updatePageWidth
        );


        window.visualViewport
            ?.addEventListener(
                'resize',
                updatePageWidth
            );


        return () => {
            observer?.disconnect();


            window.removeEventListener(
                'resize',
                updatePageWidth
            );


            window.visualViewport
                ?.removeEventListener(
                    'resize',
                    updatePageWidth
                );
        };

    }, [
        open,
        updatePageWidth
    ]);


    /*
     * Cleanup Blob.
     */
    useEffect(
        () => () => {
            if (
                objectUrlRef.current
            ) {
                URL.revokeObjectURL(
                    objectUrlRef.current
                );
            }
        },
        []
    );


    function handlePdfLoaded({
                                 numPages: pages
                             }) {
        setNumPages(
            pages
        );


        setError('');


        window.requestAnimationFrame(
            updatePageWidth
        );
    }


    function zoomOut() {
        setZoom(
            value =>
                Math.max(
                    MIN_ZOOM,

                    Number(
                        (
                            value -
                            ZOOM_STEP
                        ).toFixed(2)
                    )
                )
        );
    }


    function zoomIn() {
        setZoom(
            value =>
                Math.min(
                    MAX_ZOOM,

                    Number(
                        (
                            value +
                            ZOOM_STEP
                        ).toFixed(2)
                    )
                )
        );
    }


    function fitPage() {
        setZoom(
            DEFAULT_ZOOM
        );


        window.requestAnimationFrame(
            updatePageWidth
        );
    }


    if (
        !open ||
        typeof document ===
        'undefined'
    ) {
        return null;
    }


    const pageCount =
        readerMode === 'preview'
            ? Math.min(
                numPages,
                PREVIEW_PAGES
            )
            : numPages;


    const pageWidth =
        Math.max(
            240,

            Math.round(
                pageBaseWidth *
                zoom
            )
        );


    const reader = (
        <div
            className="sl-ebook-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={
                `Đọc e-book ${title}`
            }
            onMouseDown={
                event => {
                    if (
                        event.target ===
                        event.currentTarget
                    ) {
                        onClose?.();
                    }
                }
            }
        >

            <div className="sl-ebook-window">

                <header className="sl-ebook-header">

                    <div className="sl-ebook-heading">

                        <span>
                            Đọc e-book trực tuyến
                        </span>

                        <h2 title={title}>
                            {title}
                        </h2>

                    </div>


                    <button
                        type="button"
                        className="sl-ebook-close"
                        onClick={onClose}
                        aria-label="Đóng"
                        title="Đóng"
                    >
                        <X />
                    </button>

                </header>


                <div className="sl-ebook-toolbar">

                    <div className="sl-ebook-zoom">

                        <button
                            type="button"
                            onClick={zoomOut}
                            disabled={
                                zoom <=
                                MIN_ZOOM
                            }
                            aria-label="Thu nhỏ"
                        >
                            <Minus />
                        </button>


                        <strong>
                            {Math.round(
                                zoom * 100
                            )}
                            %
                        </strong>


                        <button
                            type="button"
                            onClick={zoomIn}
                            disabled={
                                zoom >=
                                MAX_ZOOM
                            }
                            aria-label="Phóng to"
                        >
                            <Plus />
                        </button>


                        <button
                            type="button"
                            className="sl-ebook-fit"
                            onClick={fitPage}
                        >
                            <Maximize2 />

                            Vừa khung
                        </button>

                    </div>


                    <div className="sl-ebook-status">

                        {readerMode === 'preview'
                            ? (
                                `Xem trước tối đa ${PREVIEW_PAGES} trang đầu`
                            )
                            : (
                                numPages
                                    ? `${numPages} trang`
                                    : 'Đang tải...'
                            )
                        }

                    </div>

                </div>


                <div
                    ref={bodyRef}
                    className={
                        `sl-ebook-body ${
                            zoom > 1
                                ? 'is-zoomed'
                                : ''
                        }`
                    }
                >

                    {error ? (

                        <div className="sl-ebook-message sl-ebook-error">

                            <b>
                                Không mở được e-book
                            </b>

                            <span>
                                {error}
                            </span>

                        </div>

                    ) : !objectUrl ? (

                        <div className="sl-ebook-message">
                            Đang tải e-book...
                        </div>

                    ) : (

                        <Document
                            file={objectUrl}
                            onLoadSuccess={
                                handlePdfLoaded
                            }
                            onLoadError={
                                loadError =>
                                    setError(
                                        loadError?.message ||
                                        'Không đọc được file PDF.'
                                    )
                            }
                            loading={
                                <div className="sl-ebook-message">
                                    Đang xử lý PDF...
                                </div>
                            }
                            className="sl-ebook-document"
                        >

                            {readerMode ===
                                'preview' && (

                                    <div className="sl-ebook-preview-note">
                                        Đây là bản xem trước{' '}
                                        {PREVIEW_PAGES}{' '}
                                        trang đầu.
                                    </div>

                                )}


                            <div className="sl-ebook-pages">

                                {Array.from(
                                    {
                                        length:
                                        pageCount
                                    },
                                    (
                                        _,
                                        index
                                    ) =>
                                        index + 1
                                ).map(
                                    pageNumber => (

                                        <section
                                            className="sl-ebook-page"
                                            key={
                                                pageNumber
                                            }
                                        >

                                            <div className="sl-ebook-page-number">

                                                Trang{' '}
                                                {pageNumber}
                                                /
                                                {pageCount}

                                            </div>


                                            <Page
                                                pageNumber={
                                                    pageNumber
                                                }
                                                width={
                                                    pageWidth
                                                }
                                                renderAnnotationLayer
                                                renderTextLayer
                                            />

                                        </section>
                                    )
                                )}

                            </div>

                        </Document>

                    )}

                </div>

            </div>

        </div>
    );


    return createPortal(
        reader,
        document.body
    );
}