import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
    Maximize2,
    Minimize2,
    RotateCcw,
    Send,
    X,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, streamJsonLines } from '../api';
import { useAuth } from '../context/AuthContext';
import { CHAT_RESET_EVENT } from '../authStorage';

const DEFAULT_MESSAGE = {
    from: 'bot',
    text: 'Xin chào! Mình là Libby. Bạn đang muốn tìm cuốn sách nào?',
    books: [],
    quick: [
        'Có sách trẻ em không?',
        'Sách của Paulo Coelho',
        'Gợi ý sách đang có sẵn'
    ],
    systemGreeting: true
};

function BookFaceIcon({ size = 44, animated = false }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            className={animated ? 'book-face-svg' : ''}
        >
            <ellipse
                cx="40"
                cy="76"
                rx="16"
                ry="3"
                fill="#083d25"
                opacity="0.16"
            />

            <path
                d="M16 28 L26 8 L32 26 Z"
                fill="#0e8a60"
            />

            <path
                d="M64 28 L54 8 L48 26 Z"
                fill="#0e8a60"
            />

            <ellipse
                cx="40"
                cy="46"
                rx="30"
                ry="32"
                fill="#0e8a60"
            />

            <ellipse
                cx="40"
                cy="62"
                rx="14"
                ry="11"
                fill="#165c3e"
                opacity="0.35"
            />

            <circle
                cx="28"
                cy="42"
                r="13"
                fill="#ffffff"
            />

            <circle
                cx="52"
                cy="42"
                r="13"
                fill="#ffffff"
            />

            <circle
                cx="29"
                cy="43"
                r="6"
                fill="#0a3f2c"
            />

            <circle
                cx="53"
                cy="43"
                r="6"
                fill="#0a3f2c"
            />

            <circle
                cx="31"
                cy="41"
                r="1.6"
                fill="#ffffff"
            />

            <circle
                cx="55"
                cy="41"
                r="1.6"
                fill="#ffffff"
            />

            <path
                d="M36 52 L40 60 L44 52 Z"
                fill="#f4d03f"
            />
        </svg>
    );
}

const DRAG_THRESHOLD = 6;
const EDGE_MARGIN = 10;
const HEADER_GAP = 8;
const FLOAT_CLEARANCE = 14;
const PANEL_GAP = 12;
const FAB_SIZE = 68;
const OPEN_FAB_GAP = 10;

const ZOOM_LEVELS = [
    0.9,
    1,
    1.15,
    1.3,
    1.45
];

function loadStoredMessages(storageKey) {
    try {
        const raw =
            window.sessionStorage.getItem(
                storageKey
            );

        if (!raw) {
            return [DEFAULT_MESSAGE];
        }

        const parsed =
            JSON.parse(raw);

        if (
            !Array.isArray(parsed) ||
            parsed.length === 0
        ) {
            return [DEFAULT_MESSAGE];
        }

        return parsed
            .slice(-40)
            .map(message => ({
                from:
                    message?.from === 'user'
                        ? 'user'
                        : 'bot',

                text:
                    String(
                        message?.text ?? ''
                    ),

                books:
                    Array.isArray(
                        message?.books
                    )
                        ? message.books.slice(
                            0,
                            5
                        )
                        : [],

                quick:
                    Array.isArray(
                        message?.quick
                    )
                        ? message.quick.slice(
                            0,
                            4
                        )
                        : [],

                systemGreeting:
                    Boolean(
                        message?.systemGreeting
                    )
            }));
    } catch {
        return [DEFAULT_MESSAGE];
    }
}

export default function ChatWidget() {
    const { user } = useAuth();

    const chatOwnerKey =
        user?.id
            ? `user-${user.id}`
            : 'guest';

    const interactionStorageKey =
        `libby-interaction-id:${chatOwnerKey}`;

    const messagesStorageKey =
        `libby-messages:${chatOwnerKey}`;

    const [open, setOpen] =
        useState(false);

    const [input, setInput] =
        useState('');

    const [busy, setBusy] =
        useState(false);

    const [messages, setMessages] =
        useState(() =>
            loadStoredMessages(
                messagesStorageKey
            )
        );

    const [
        interactionId,
        setInteractionId
    ] = useState(() =>
        window.sessionStorage.getItem(
            interactionStorageKey
        ) || ''
    );

    const [pos, setPos] =
        useState(null);

    const [expanded, setExpanded] =
        useState(false);

    const [
        viewportVersion,
        setViewportVersion
    ] = useState(0);

    const [
        panelStyle,
        setPanelStyle
    ] = useState(null);

    const [
        zoomIndex,
        setZoomIndex
    ] = useState(() => {
        const saved =
            Number(
                window.localStorage.getItem(
                    'libby-zoom-index'
                )
            );

        return (
            Number.isInteger(saved) &&
            saved >= 0 &&
            saved < ZOOM_LEVELS.length
        )
            ? saved
            : 1;
    });

    const endRef =
        useRef(null);

    const rootRef =
        useRef(null);

    const inputRef =
        useRef(null);

    const dragState =
        useRef(null);

    const sessionVersionRef =
        useRef(0);

    const abortRef =
        useRef(null);

    const skipPersistRef =
        useRef(false);

    function resetChat({
                           close = true,
                           resetPosition = false
                       } = {}) {
        sessionVersionRef.current += 1;

        skipPersistRef.current = true;

        abortRef.current?.abort();
        abortRef.current = null;

        setInteractionId('');
        setMessages([DEFAULT_MESSAGE]);
        setInput('');
        setBusy(false);
        setExpanded(false);

        if (close) {
            setOpen(false);
        }

        if (resetPosition) {
            setPos(null);
        }

        window.sessionStorage.removeItem(
            interactionStorageKey
        );

        window.sessionStorage.removeItem(
            messagesStorageKey
        );

        window.localStorage.removeItem(
            'libby-interaction-id'
        );
    }

    /*
     * Khi đổi tài khoản:
     * - dừng request cũ
     * - nạp phiên chat đúng user
     * - đóng chatbot
     * - đưa icon về vị trí mặc định
     */
    useEffect(() => {
        sessionVersionRef.current += 1;

        skipPersistRef.current = true;

        abortRef.current?.abort();
        abortRef.current = null;

        setInteractionId(
            window.sessionStorage.getItem(
                interactionStorageKey
            ) || ''
        );

        setMessages(
            loadStoredMessages(
                messagesStorageKey
            )
        );

        setInput('');
        setBusy(false);
        setExpanded(false);
        setOpen(false);
        setPos(null);

        window.localStorage.removeItem(
            'libby-interaction-id'
        );
    }, [
        interactionStorageKey,
        messagesStorageKey
    ]);

    /*
     * Lưu lịch sử riêng cho từng tài khoản.
     */
    useEffect(() => {
        if (skipPersistRef.current) {
            skipPersistRef.current = false;
            return;
        }

        const safeMessages =
            messages.slice(-40);

        try {
            window.sessionStorage.setItem(
                messagesStorageKey,
                JSON.stringify(
                    safeMessages
                )
            );
        } catch {
            /*
             * Nếu storage bị chặn / đầy,
             * chatbot vẫn tiếp tục chạy trong RAM.
             */
        }
    }, [
        messages,
        messagesStorageKey
    ]);

    /*
     * Hủy request khi component bị unmount.
     */
    useEffect(() => {
        return () => {
            abortRef.current?.abort();
        };
    }, []);

    /*
     * Logout / auth reset:
     * xóa phiên chat và trả icon về vị trí mặc định.
     */
    useEffect(() => {
        function handleChatReset() {
            resetChat({
                close: true,
                resetPosition: true
            });
        }

        window.addEventListener(
            CHAT_RESET_EVENT,
            handleChatReset
        );

        return () => {
            window.removeEventListener(
                CHAT_RESET_EVENT,
                handleChatReset
            );
        };
    }, [
        interactionStorageKey,
        messagesStorageKey
    ]);

    /*
     * Tự cuộn xuống tin nhắn mới.
     */
    useEffect(() => {
        try {
            endRef.current
                ?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end'
                });
        } catch {
            endRef.current
                ?.scrollIntoView();
        }
    }, [
        messages,
        open,
        busy
    ]);

    /*
     * Lưu mức zoom chữ.
     */
    useEffect(() => {
        window.localStorage.setItem(
            'libby-zoom-index',
            String(zoomIndex)
        );
    }, [zoomIndex]);

    /*
     * Chỉ focus khi mở chatbot.
     *
     * Không phụ thuộc busy nữa,
     * vì input phải tiếp tục dùng được
     * khi Libby đang trả lời.
     */
    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const frame =
            window.requestAnimationFrame(
                () => {
                    inputRef.current?.focus({
                        preventScroll: true
                    });
                }
            );

        return () => {
            window.cancelAnimationFrame(
                frame
            );
        };
    }, [open]);

    /*
     * Escape đóng chatbot.
     */
    useEffect(() => {
        function handleKeyboard(event) {
            if (!open) {
                return;
            }

            if (event.key === 'Escape') {
                setExpanded(false);
                setOpen(false);
            }
        }

        window.addEventListener(
            'keydown',
            handleKeyboard
        );

        return () => {
            window.removeEventListener(
                'keydown',
                handleKeyboard
            );
        };
    }, [open]);

    function getViewportSize() {
        const visualViewport =
            window.visualViewport;

        return {
            width:
                Math.max(
                    1,
                    visualViewport?.width ||
                    window.innerWidth
                ),

            height:
                Math.max(
                    1,
                    visualViewport?.height ||
                    window.innerHeight
                )
        };
    }

    function getSafeTop() {
        const header =
            document.querySelector(
                '.header'
            );

        const headerBottom =
            header
                ?.getBoundingClientRect()
                .bottom || 76;

        return Math.max(
            EDGE_MARGIN,
            Math.ceil(
                headerBottom +
                HEADER_GAP +
                FLOAT_CLEARANCE
            )
        );
    }

    function clamp(x, y) {
        const w =
            rootRef.current?.offsetWidth ??
            FAB_SIZE;

        const h =
            rootRef.current?.offsetHeight ??
            FAB_SIZE;

        const viewport =
            getViewportSize();

        const minY =
            getSafeTop();

        const maxX =
            viewport.width -
            w -
            EDGE_MARGIN;

        const maxY =
            viewport.height -
            h -
            EDGE_MARGIN;

        return {
            x:
                Math.min(
                    Math.max(
                        x,
                        EDGE_MARGIN
                    ),
                    Math.max(
                        EDGE_MARGIN,
                        maxX
                    )
                ),

            y:
                Math.min(
                    Math.max(
                        y,
                        minY
                    ),
                    Math.max(
                        minY,
                        maxY
                    )
                )
        };
    }

    /*
     * Khi resize / browser zoom:
     * tính lại giới hạn chatbot.
     */
    useEffect(() => {
        function handleViewportChange() {
            setViewportVersion(
                current =>
                    current + 1
            );

            setPos(current =>
                current
                    ? clamp(
                        current.x,
                        current.y
                    )
                    : current
            );
        }

        window.addEventListener(
            'resize',
            handleViewportChange
        );

        window.visualViewport
            ?.addEventListener(
                'resize',
                handleViewportChange
            );

        window.visualViewport
            ?.addEventListener(
                'scroll',
                handleViewportChange
            );

        return () => {
            window.removeEventListener(
                'resize',
                handleViewportChange
            );

            window.visualViewport
                ?.removeEventListener(
                    'resize',
                    handleViewportChange
                );

            window.visualViewport
                ?.removeEventListener(
                    'scroll',
                    handleViewportChange
                );
        };
    }, []);

    /*
     * Tính kích thước khung chat.
     */
    useLayoutEffect(() => {
        if (!open) {
            setPanelStyle(null);
            return;
        }

        const viewport =
            getViewportSize();

        const safeTop =
            getSafeTop();

        const availableWidth =
            Math.max(
                1,
                viewport.width -
                EDGE_MARGIN * 2
            );

        const availableHeight =
            Math.max(
                1,
                viewport.height -
                safeTop -
                EDGE_MARGIN
            );

        /*
         * Fullscreen.
         */
        if (expanded) {
            setPanelStyle({
                position: 'fixed',

                left:
                EDGE_MARGIN,

                top:
                safeTop,

                right:
                    'auto',

                bottom:
                    'auto',

                width:
                availableWidth,

                height:
                availableHeight,

                maxWidth:
                availableWidth,

                maxHeight:
                availableHeight,

                minWidth:
                    0,

                minHeight:
                    0,

                resize:
                    'none'
            });

            return;
        }

        const desiredWidth =
            Math.min(
                420,
                availableWidth
            );

        const spaceForOpenFab =
            FAB_SIZE +
            OPEN_FAB_GAP;

        const panelHeightLimit =
            Math.max(
                260,
                availableHeight -
                spaceForOpenFab
            );

        const desiredHeight =
            Math.min(
                620,
                panelHeightLimit
            );

        const fabRect =
            rootRef.current
                ?.getBoundingClientRect();

        let left =
            fabRect
                ? fabRect.right -
                desiredWidth

                : viewport.width -
                desiredWidth -
                EDGE_MARGIN;

        let top =
            fabRect
                ? fabRect.top -
                desiredHeight -
                PANEL_GAP

                : viewport.height -
                desiredHeight -
                spaceForOpenFab -
                EDGE_MARGIN;

        left =
            Math.min(
                Math.max(
                    left,
                    EDGE_MARGIN
                ),

                Math.max(
                    EDGE_MARGIN,

                    viewport.width -
                    desiredWidth -
                    EDGE_MARGIN
                )
            );

        const maxTop =
            Math.max(
                safeTop,

                viewport.height -
                desiredHeight -
                spaceForOpenFab -
                EDGE_MARGIN
            );

        top =
            Math.min(
                Math.max(
                    top,
                    safeTop
                ),

                maxTop
            );

        setPanelStyle({
            position:
                'fixed',

            left,

            top,

            right:
                'auto',

            bottom:
                'auto',

            width:
            desiredWidth,

            height:
            desiredHeight,

            maxWidth:
            availableWidth,

            maxHeight:
            availableHeight,

            minWidth:
                0,

            minHeight:
                0,

            resize:
                availableWidth >= 360 &&
                availableHeight >= 480
                    ? 'both'
                    : 'none'
        });
    }, [
        open,
        expanded,
        pos,
        zoomIndex,
        viewportVersion
    ]);

    /*
     * Kéo icon chatbot.
     */
    function handlePointerDown(event) {
        event.preventDefault();

        try {
            event.currentTarget
                .releasePointerCapture(
                    event.pointerId
                );
        } catch {
            /*
             * Không phải browser nào
             * cũng giữ pointer capture.
             */
        }

        const rect =
            rootRef.current
                .getBoundingClientRect();

        dragState.current = {
            startX:
            event.clientX,

            startY:
            event.clientY,

            originLeft:
            rect.left,

            originTop:
            rect.top,

            moved:
                false
        };

        window.addEventListener(
            'pointermove',
            handlePointerMove
        );

        window.addEventListener(
            'pointerup',
            handlePointerUp
        );
    }

    function handlePointerMove(event) {
        const d =
            dragState.current;

        if (!d) {
            return;
        }

        const dx =
            event.clientX -
            d.startX;

        const dy =
            event.clientY -
            d.startY;

        if (
            !d.moved &&
            Math.hypot(
                dx,
                dy
            ) <
            DRAG_THRESHOLD
        ) {
            return;
        }

        d.moved = true;

        setPos(
            clamp(
                d.originLeft + dx,
                d.originTop + dy
            )
        );
    }

    function handlePointerUp() {
        window.removeEventListener(
            'pointermove',
            handlePointerMove
        );

        window.removeEventListener(
            'pointerup',
            handlePointerUp
        );

        const wasDrag =
            dragState.current?.moved;

        dragState.current =
            null;

        if (!wasDrag) {
            setOpen(current => {
                if (current) {
                    setExpanded(false);
                }

                return !current;
            });
        }
    }

    function closeChat() {
        setExpanded(false);
        setOpen(false);
    }

    function zoomOut() {
        setZoomIndex(
            current =>
                Math.max(
                    0,
                    current - 1
                )
        );
    }

    function zoomIn() {
        setZoomIndex(
            current =>
                Math.min(
                    ZOOM_LEVELS.length -
                    1,

                    current + 1
                )
        );
    }

    function rememberInteraction(value) {
        const id =
            typeof value === 'string'
                ? value.trim()
                : '';

        if (!id) {
            return;
        }

        setInteractionId(id);

        window.sessionStorage.setItem(
            interactionStorageKey,
            id
        );
    }

    /*
     * Gửi câu hỏi.
     */
    async function sendMessage(value) {
        const content =
            String(
                value ?? input
            ).trim();

        /*
         * Trong lúc busy:
         * không gửi request thứ hai.
         *
         * Nhưng input KHÔNG bị khóa,
         * người dùng vẫn gõ được.
         */
        if (!content || busy) {
            return;
        }

        const requestSessionVersion =
            sessionVersionRef.current;

        const isCurrentSession =
            () =>
                requestSessionVersion ===
                sessionVersionRef.current;

        /*
         * Chỉ gửi 12 tin gần nhất
         * để prompt không phình quá lớn.
         */
        const history =
            messages
                .filter(
                    message =>
                        !message
                            .systemGreeting &&

                        (
                            message.from ===
                            'user' ||

                            message.from ===
                            'bot'
                        )
                )
                .slice(-12)
                .map(
                    message => ({
                        role:
                            message.from ===
                            'user'
                                ? 'user'
                                : 'model',

                        content:
                            String(
                                message.text ??
                                ''
                            )
                    })
                );

        const responseId =
            `libby-${Date.now()}-${Math.random()}`;

        setMessages(current => [
            ...current,

            {
                from:
                    'user',

                text:
                content,

                books:
                    [],

                quick:
                    []
            },

            {
                from:
                    'bot',

                text:
                    'Libby đang suy nghĩ…',

                books:
                    [],

                quick:
                    [],

                responseId
            }
        ]);

        /*
         * Clear câu vừa gửi.
         *
         * Sau đó input lập tức sẵn sàng
         * để người dùng gõ câu tiếp theo.
         */
        setInput('');
        setBusy(true);

        window.requestAnimationFrame(
            () => {
                inputRef.current?.focus({
                    preventScroll: true
                });
            }
        );

        let streamedReply = '';
        let receivedDelta = false;
        let receivedFinal = false;

        const updateResponse =
            changes => {
                if (!isCurrentSession()) {
                    return;
                }

                setMessages(current =>
                    current.map(message =>
                        message.responseId ===
                        responseId

                            ? {
                                ...message,
                                ...changes
                            }

                            : message
                    )
                );
            };

        const controller =
            new AbortController();

        abortRef.current?.abort();

        abortRef.current =
            controller;

        try {
            await streamJsonLines(
                '/api/chat/stream',

                {
                    method:
                        'POST',

                    signal:
                    controller.signal,

                    body:
                        JSON.stringify({
                            message:
                            content,

                            history,

                            previousInteractionId:
                                interactionId ||
                                null
                        })
                },

                event => {
                    if (!isCurrentSession()) {
                        return;
                    }

                    /*
                     * Metadata:
                     * interaction ID,
                     * cards sách,
                     * quick replies.
                     */
                    if (
                        event?.type ===
                        'meta'
                    ) {
                        rememberInteraction(
                            event.interactionId
                        );

                        const books =
                            Array.isArray(
                                event.books
                            )
                                ? event.books.filter(
                                    book =>
                                        book &&
                                        book.id != null
                                )

                                : [];

                        const quick =
                            Array.isArray(
                                event.quickReplies
                            )
                                ? event.quickReplies.filter(
                                    item =>
                                        typeof item ===
                                        'string'
                                )

                                : [];

                        updateResponse({
                            books,
                            quick
                        });

                        return;
                    }

                    /*
                     * Streaming text.
                     */
                    if (
                        event?.type ===
                        'delta' &&

                        typeof event.delta ===
                        'string'
                    ) {
                        if (
                            isCurrentSession() &&
                            !receivedDelta &&
                            !receivedFinal
                        ) {
                            streamedReply = '';
                            receivedDelta = true;
                        }

                        streamedReply +=
                            event.delta;

                        updateResponse({
                            text:
                            streamedReply
                        });

                        return;
                    }

                    /*
                     * Hoàn tất.
                     */
                    if (
                        event?.type ===
                        'done'
                    ) {
                        rememberInteraction(
                            event.interactionId
                        );

                        receivedFinal =
                            true;

                        const finalReply =
                            typeof event.reply ===
                            'string' &&
                            event.reply.trim()

                                ? event.reply.trim()

                                : streamedReply.trim();

                        updateResponse({
                            text:
                                finalReply ||
                                'Mình chưa tạo được câu trả lời. Bạn thử hỏi lại nhé.'
                        });
                    }
                }
            );

            /*
             * Fallback nếu stream
             * chỉ trả metadata mà không trả text.
             */
            if (
                isCurrentSession() &&
                !receivedDelta &&
                !receivedFinal
            ) {
                const response =
                    await api(
                        '/api/chat',

                        {
                            method:
                                'POST',

                            signal:
                            controller.signal,

                            body:
                                JSON.stringify({
                                    message:
                                    content,

                                    history,

                                    previousInteractionId:
                                        interactionId ||
                                        null
                                })
                        }
                    );

                if (!isCurrentSession()) {
                    return;
                }

                rememberInteraction(
                    response?.interactionId
                );

                updateResponse({
                    text:
                        response?.reply ||
                        'Mình chưa tạo được câu trả lời. Bạn thử hỏi lại nhé.',

                    books:
                        Array.isArray(
                            response?.books
                        )
                            ? response.books.slice(
                                0,
                                3
                            )

                            : [],

                    quick:
                        Array.isArray(
                            response?.quickReplies
                        )
                            ? response.quickReplies
                            : []
                });
            }
        } catch (error) {
            if (
                error?.name ===
                'AbortError'
            ) {
                return;
            }

            if (!isCurrentSession()) {
                return;
            }

            updateResponse({
                text:
                    error?.message

                        ? `Chatbot chưa phản hồi được: ${error.message}`

                        : 'Chatbot đang tạm thời không kết nối được. Bạn hãy thử lại.',

                books:
                    [],

                quick:
                    []
            });
        } finally {
            if (
                abortRef.current ===
                controller
            ) {
                abortRef.current =
                    null;
            }

            if (isCurrentSession()) {
                setBusy(false);
            }
        }
    }

    /*
     * Enter / nút Send.
     *
     * Nếu Libby đang trả lời:
     * - giữ nguyên chữ đang gõ
     * - không gửi
     * - focus vẫn ở input
     */
    function handleSubmit(event) {
        event.preventDefault();

        if (
            !input.trim() ||
            busy
        ) {
            inputRef.current?.focus({
                preventScroll: true
            });

            return;
        }

        sendMessage(input);
    }

    function handleImageError(event) {
        event.currentTarget.onerror =
            null;

        event.currentTarget.src =
            '/covers-real/fallback.svg';
    }

    const rootStyle =
        pos
            ? {
                left:
                pos.x,

                top:
                pos.y,

                right:
                    'auto',

                bottom:
                    'auto'
            }

            : undefined;

    /*
     * Khi mở chat:
     * nút X tròn nằm dưới góc phải panel.
     */
    const openFabStyle =
        (() => {
            if (
                !open ||
                expanded ||
                !panelStyle
            ) {
                return undefined;
            }

            const viewport =
                getViewportSize();

            const panelLeft =
                Number(
                    panelStyle.left
                ) ||
                EDGE_MARGIN;

            const panelTop =
                Number(
                    panelStyle.top
                ) ||
                getSafeTop();

            const panelWidth =
                Number(
                    panelStyle.width
                ) ||
                420;

            const panelHeight =
                Number(
                    panelStyle.height
                ) ||
                530;

            const left =
                Math.min(
                    Math.max(
                        panelLeft +
                        panelWidth -
                        FAB_SIZE,

                        EDGE_MARGIN
                    ),

                    Math.max(
                        EDGE_MARGIN,

                        viewport.width -
                        FAB_SIZE -
                        EDGE_MARGIN
                    )
                );

            const top =
                Math.min(
                    Math.max(
                        panelTop +
                        panelHeight +
                        OPEN_FAB_GAP,

                        getSafeTop()
                    ),

                    Math.max(
                        getSafeTop(),

                        viewport.height -
                        FAB_SIZE -
                        EDGE_MARGIN
                    )
                );

            return {
                position:
                    'fixed',

                left,

                top,

                right:
                    'auto',

                bottom:
                    'auto',

                cursor:
                    'pointer'
            };
        })();

    const zoom =
        ZOOM_LEVELS[
            zoomIndex
            ];

    return (
        <div
            className={
                `chat-root${
                    !open
                        ? ' chat-root-floating'
                        : ''
                }${
                    expanded
                        ? ' chat-root-expanded'
                        : ''
                }`
            }
            ref={rootRef}
            style={rootStyle}
        >
            {open && (
                <section
                    className={
                        `chat-panel chat-panel-pop${
                            expanded
                                ? ' chat-expanded'
                                : ''
                        }`
                    }
                    style={{
                        ...panelStyle,
                        '--chat-zoom':
                        zoom
                    }}
                    aria-label="Trợ lý thư viện Libby"
                >
                    <header>
                        <span>
                            <BookFaceIcon
                                size={22}
                            />

                            <span>
                                <b>
                                    Libby
                                </b>

                                <small>
                                    <i />
                                    {' '}
                                    Trợ lý thư viện
                                </small>
                            </span>
                        </span>

                        <div
                            className="chat-window-actions"
                            role="group"
                            aria-label="Điều chỉnh cửa sổ chatbot"
                        >
                            <button
                                type="button"
                                aria-label="Bắt đầu cuộc trò chuyện mới"
                                title="Cuộc trò chuyện mới"
                                onClick={() =>
                                    resetChat({
                                        close:
                                            false
                                    })
                                }
                            >
                                <RotateCcw />
                            </button>

                            <button
                                type="button"
                                aria-label="Thu nhỏ chữ chatbot"
                                title="Thu nhỏ chữ"
                                disabled={
                                    zoomIndex ===
                                    0
                                }
                                onClick={
                                    zoomOut
                                }
                            >
                                <ZoomOut />
                            </button>

                            <output
                                aria-live="polite"
                                title="Mức phóng đại hiện tại"
                            >
                                {
                                    Math.round(
                                        zoom *
                                        100
                                    )
                                }%
                            </output>

                            <button
                                type="button"
                                aria-label="Phóng to chữ chatbot"
                                title="Phóng to chữ"
                                disabled={
                                    zoomIndex ===
                                    ZOOM_LEVELS.length -
                                    1
                                }
                                onClick={
                                    zoomIn
                                }
                            >
                                <ZoomIn />
                            </button>

                            <button
                                type="button"
                                aria-label={
                                    expanded
                                        ? 'Thu nhỏ cửa sổ chatbot'
                                        : 'Phóng to cửa sổ chatbot'
                                }
                                title={
                                    expanded
                                        ? 'Thu nhỏ cửa sổ'
                                        : 'Phóng to cửa sổ'
                                }
                                onClick={() =>
                                    setExpanded(
                                        current =>
                                            !current
                                    )
                                }
                            >
                                {
                                    expanded
                                        ? <Minimize2 />
                                        : <Maximize2 />
                                }
                            </button>

                            <button
                                type="button"
                                aria-label="Đóng chatbot"
                                title="Đóng chatbot"
                                onClick={
                                    closeChat
                                }
                            >
                                <X />
                            </button>
                        </div>
                    </header>

                    <div
                        className="chat-body"
                        aria-live="polite"
                        aria-busy={busy}
                    >
                        {messages.map(
                            (
                                message,
                                index
                            ) => {
                                const books =
                                    Array.isArray(
                                        message.books
                                    )
                                        ? message.books
                                        : [];

                                const quick =
                                    Array.isArray(
                                        message.quick
                                    )
                                        ? message.quick
                                        : [];

                                return (
                                    <div
                                        key={
                                            `${message.from}-${index}`
                                        }
                                        className={
                                            `chat-msg ${message.from}`
                                        }
                                    >
                                        <div>
                                            {
                                                String(
                                                    message.text ??
                                                    ''
                                                )
                                            }
                                        </div>

                                        {
                                            books.length >
                                            0 && (
                                                <div className="chat-books">
                                                    {
                                                        books.map(
                                                            book => (
                                                                <Link
                                                                    key={
                                                                        book.id
                                                                    }
                                                                    to={
                                                                        `/books/${book.id}`
                                                                    }
                                                                    onClick={
                                                                        closeChat
                                                                    }
                                                                >
                                                                    <img
                                                                        src={
                                                                            book.coverUrl ||
                                                                            'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=200'
                                                                        }
                                                                        alt=""
                                                                        aria-hidden="true"
                                                                        onError={
                                                                            handleImageError
                                                                        }
                                                                    />

                                                                    <span>
                                                                        <b>
                                                                            {
                                                                                book.title ||
                                                                                'Sách chưa có tên'
                                                                            }
                                                                        </b>

                                                                        <small>
                                                                            {
                                                                                book.authorName ||
                                                                                'Chưa rõ tác giả'
                                                                            }
                                                                            {' · '}
                                                                            {
                                                                                Number(
                                                                                    book.availableCopies ||
                                                                                    0
                                                                                )
                                                                            }
                                                                            {' '}
                                                                            bản có sẵn
                                                                        </small>
                                                                    </span>
                                                                </Link>
                                                            )
                                                        )
                                                    }
                                                </div>
                                            )
                                        }

                                        {
                                            quick.length >
                                            0 && (
                                                <div className="quick">
                                                    {
                                                        quick
                                                            .slice(
                                                                0,
                                                                4
                                                            )
                                                            .map(
                                                                (
                                                                    question,
                                                                    quickIndex
                                                                ) => (
                                                                    <button
                                                                        type="button"
                                                                        key={
                                                                            `${question}-${quickIndex}`
                                                                        }
                                                                        disabled={
                                                                            busy
                                                                        }
                                                                        onClick={() =>
                                                                            sendMessage(
                                                                                question
                                                                            )
                                                                        }
                                                                    >
                                                                        {
                                                                            question
                                                                        }
                                                                    </button>
                                                                )
                                                            )
                                                    }
                                                </div>
                                            )
                                        }
                                    </div>
                                );
                            }
                        )}

                        <div
                            ref={endRef}
                        />
                    </div>

                    <form
                        onSubmit={
                            handleSubmit
                        }
                    >
                        {/*
                         * QUAN TRỌNG:
                         * input KHÔNG disabled khi busy.
                         */}
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={
                                event =>
                                    setInput(
                                        event.target.value
                                    )
                            }
                            placeholder={
                                busy
                                    ? 'Libby đang trả lời — bạn có thể nhập câu tiếp theo...'
                                    : 'Hỏi Libby về sách...'
                            }
                            aria-label="Nhập câu hỏi cho Libby"
                            autoComplete="off"
                        />

                        {/*
                         * Chỉ khóa SEND.
                         * Người dùng vẫn gõ bình thường.
                         */}
                        <button
                            type="submit"
                            disabled={
                                !input.trim() ||
                                busy
                            }
                            aria-label="Gửi tin nhắn"
                        >
                            <Send />
                        </button>
                    </form>
                </section>
            )}

            {!expanded && (
                <button
                    type="button"
                    className={
                        `chat-fab${
                            open
                                ? ' chat-fab-open'
                                : ''
                        }`
                    }
                    aria-label={
                        open
                            ? 'Đóng chatbot'
                            : 'Mở chatbot'
                    }
                    onPointerDown={
                        open
                            ? undefined
                            : handlePointerDown
                    }
                    onClick={
                        open
                            ? closeChat
                            : undefined
                    }
                    title={
                        open
                            ? 'Đóng Libby'
                            : 'Kéo để di chuyển · Bấm để mở Libby'
                    }
                    style={
                        open
                            ? openFabStyle
                            : undefined
                    }
                >
                    {!open && (
                        <span
                            className="chat-fab-shadow"
                            aria-hidden="true"
                        />
                    )}

                    {
                        open
                            ? (
                                <X
                                    size={26}
                                />
                            )
                            : (
                                <BookFaceIcon
                                    size={44}
                                    animated
                                />
                            )
                    }
                </button>
            )}
        </div>
    );
}