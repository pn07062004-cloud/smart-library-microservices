import {
    clearAuthSession,
    getAuthToken
} from './authStorage';

export const API_BASE =
    (
        import.meta.env.VITE_API_URL || ''
    ).replace(/\/$/, '');

function requestUrl(path) {
    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    return `${API_BASE}${
        path.startsWith('/')
            ? path
            : `/${path}`
    }`;
}

function authHeaders() {
    const token = getAuthToken();

    return token
        ? {
            Authorization: `Bearer ${token}`
        }
        : {};
}

async function parseError(response) {
    try {
        const type =
            response.headers.get(
                'content-type'
            ) || '';

        if (
            type.includes(
                'application/json'
            )
        ) {
            return await response.json();
        }

        const text =
            await response.text();

        return text
            ? { message: text }
            : {};
    } catch {
        return {};
    }
}

async function ensureOk(response) {
    if (response.ok) return;

    const error =
        await parseError(response);

    if (response.status === 401) {
        clearAuthSession();

        window.dispatchEvent(
            new CustomEvent(
                'library-auth-expired'
            )
        );

        throw new Error(
            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        );
    }

    if (response.status === 403) {
        throw new Error(
            error.message ||
            'Bạn không có quyền thực hiện chức năng này.'
        );
    }

    if (response.status === 429) {
        throw new Error(
            error.message ||
            'Hệ thống đang nhận quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.'
        );
    }

    throw new Error(
        error.message ||
        error.error ||
        `Lỗi ${response.status}`
    );
}

export async function api(
    path,
    options = {}
) {
    const isFormData =
        options.body instanceof FormData;

    const response =
        await fetch(
            requestUrl(path),
            {
                ...options,

                headers: {
                    ...(isFormData
                        ? {}
                        : {
                            'Content-Type':
                                'application/json'
                        }),

                    ...authHeaders(),

                    ...options.headers
                }
            }
        );

    await ensureOk(response);

    if (
        response.status === 204 ||
        response.headers.get(
            'content-length'
        ) === '0'
    ) {
        return null;
    }

    const text =
        await response.text();

    return text
        ? JSON.parse(text)
        : null;
}

export async function streamJsonLines(
    path,
    options = {},
    onEvent = () => {}
) {
    const response =
        await fetch(
            requestUrl(path),
            {
                ...options,

                headers: {
                    'Content-Type':
                        'application/json',

                    Accept:
                        'application/x-ndjson',

                    ...authHeaders(),

                    ...options.headers
                }
            }
        );

    await ensureOk(response);

    if (!response.body) {
        throw new Error(
            'Không nhận được luồng phản hồi từ chatbot.'
        );
    }

    const reader =
        response.body.getReader();

    const decoder =
        new TextDecoder('utf-8');

    let buffer = '';

    while (true) {
        const {
            value,
            done
        } = await reader.read();

        buffer += decoder.decode(
            value ||
            new Uint8Array(),
            {
                stream: !done
            }
        );

        const lines =
            buffer.split('\n');

        buffer =
            lines.pop() || '';

        for (const line of lines) {
            const trimmed =
                line.trim();

            if (!trimmed) continue;

            onEvent(
                JSON.parse(trimmed)
            );
        }

        if (done) break;
    }

    const last =
        buffer.trim();

    if (last) {
        onEvent(
            JSON.parse(last)
        );
    }
}

export async function fetchBinary(
    path,
    options = {}
) {
    const response =
        await fetch(
            requestUrl(path),
            {
                ...options,

                headers: {
                    ...authHeaders(),
                    ...options.headers
                }
            }
        );

    await ensureOk(response);

    return response.blob();
}

export const money = value =>
    new Intl.NumberFormat(
        'vi-VN',
        {
            style: 'currency',
            currency: 'VND'
        }
    ).format(value || 0);

export const date = value => {
    if (!value) {
        return '—';
    }

    const parsed =
        new Date(value);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return '—';
    }

    return new Intl.DateTimeFormat(
        'vi-VN'
    ).format(parsed);
};