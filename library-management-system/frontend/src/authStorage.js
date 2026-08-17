const TOKEN_KEY = 'library_token';
const USER_KEY = 'library_user';

export const CHAT_RESET_EVENT = 'libby-chat-reset';

function storage() {
    return window.sessionStorage;
}

export function getAuthToken() {
    return storage().getItem(TOKEN_KEY) || '';
}

export function getStoredUser() {
    const raw = storage().getItem(USER_KEY);

    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        storage().removeItem(USER_KEY);
        return null;
    }
}

export function saveAuthSession(token, user) {
    if (token) {
        storage().setItem(TOKEN_KEY, token);

        // Tạm giữ để EBookReader cũ vẫn hoạt động.
        window.localStorage.setItem(TOKEN_KEY, token);
    }

    if (user) {
        storage().setItem(
            USER_KEY,
            JSON.stringify(user)
        );
    }
}

export function updateStoredUser(user) {
    if (!user) {
        storage().removeItem(USER_KEY);
        return;
    }

    storage().setItem(
        USER_KEY,
        JSON.stringify(user)
    );
}

export function clearAuthSession() {
    storage().removeItem(TOKEN_KEY);
    storage().removeItem(USER_KEY);

    // Dọn dữ liệu của phiên bản cũ.
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
}

export function clearAllLibbySessions() {
    const keys = [];

    for (
        let index = 0;
        index < storage().length;
        index += 1
    ) {
        const key = storage().key(index);

        if (
            key?.startsWith('libby-interaction-id:') ||
            key?.startsWith('libby-messages:')
        ) {
            keys.push(key);
        }
    }

    keys.forEach(key =>
        storage().removeItem(key)
    );

    window.localStorage.removeItem(
        'libby-interaction-id'
    );

    window.localStorage.removeItem(
        'libby-messages'
    );

    window.dispatchEvent(
        new CustomEvent(CHAT_RESET_EVENT)
    );
}