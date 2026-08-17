import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState
} from 'react';

import { api } from '../api';

import {
    clearAllLibbySessions,
    clearAuthSession,
    getAuthToken,
    getStoredUser,
    saveAuthSession,
    updateStoredUser
} from '../authStorage';

const AuthContext =
    createContext(null);

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({
                                 children
                             }) {
    const [
        user,
        setUserState
    ] = useState(
        () => getStoredUser()
    );

    const [
        loading,
        setLoading
    ] = useState(
        () => Boolean(getAuthToken())
    );

    useEffect(() => {
        const token =
            getAuthToken();

        if (!token) {
            setLoading(false);
            return;
        }

        let cancelled = false;

        api('/api/auth/me')
            .then(currentUser => {
                if (cancelled) return;

                setUserState(
                    currentUser
                );

                updateStoredUser(
                    currentUser
                );
            })
            .catch(() => {
                if (cancelled) return;

                clearAuthSession();
                clearAllLibbySessions();

                setUserState(null);
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    function setUser(nextUser) {
        setUserState(nextUser);

        updateStoredUser(
            nextUser
        );
    }

    function applyAuthResponse(
        response
    ) {
        if (
            !response?.token ||
            !response?.user
        ) {
            throw new Error(
                'Phản hồi đăng nhập không hợp lệ.'
            );
        }

        // Tài khoản mới => chat mới.
        clearAllLibbySessions();

        saveAuthSession(
            response.token,
            response.user
        );

        setUserState(
            response.user
        );

        return response.user;
    }

    function logout() {
        clearAuthSession();
        clearAllLibbySessions();

        setUserState(null);
    }

    useEffect(() => {
        function handleExpired() {
            logout();
        }

        window.addEventListener(
            'library-auth-expired',
            handleExpired
        );

        return () => {
            window.removeEventListener(
                'library-auth-expired',
                handleExpired
            );
        };
    }, []);

    async function login(
        email,
        password
    ) {
        setLoading(true);

        try {
            const response =
                await api(
                    '/api/auth/login',
                    {
                        method: 'POST',

                        body:
                            JSON.stringify({
                                email,
                                password
                            })
                    }
                );

            return applyAuthResponse(
                response
            );
        } finally {
            setLoading(false);
        }
    }

    async function loginWithGoogle(
        credential
    ) {
        setLoading(true);

        try {
            const response =
                await api(
                    '/api/auth/google',
                    {
                        method: 'POST',

                        body:
                            JSON.stringify({
                                credential
                            })
                    }
                );

            return applyAuthResponse(
                response
            );
        } finally {
            setLoading(false);
        }
    }

    async function register(data) {
        setLoading(true);

        try {
            const response =
                await api(
                    '/api/auth/register',
                    {
                        method: 'POST',

                        body:
                            JSON.stringify(
                                data
                            )
                    }
                );

            return applyAuthResponse(
                response
            );
        } finally {
            setLoading(false);
        }
    }

    const value =
        useMemo(
            () => ({
                user,
                loading,

                login,
                loginWithGoogle,
                register,

                logout,
                setUser,
                applyAuthResponse,

                isStaff: [
                    'ADMIN',
                    'LIBRARIAN'
                ].includes(
                    user?.role
                )
            }),
            [
                user,
                loading
            ]
        );

    return (
        <AuthContext.Provider
            value={value}
        >
            {children}
        </AuthContext.Provider>
    );
}