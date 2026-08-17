import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from './AuthContext';

const FavoritesContext = createContext(null);

export const useFavorites = () => useContext(FavoritesContext);

function toFavoriteBook(item) {
    return {
        id: item.bookId ?? item.id,
        title: item.title,
        authorName: item.authorName,
        categoryName: item.categoryName,
        coverUrl: item.coverUrl,
        availableCopies: item.availableCopies,
        addedAt: item.addedAt,
    };
}

function readGuestFavorites(storageKey) {
    try {
        const stored = localStorage.getItem(storageKey);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function FavoritesProvider({ children }) {
    const { user } = useAuth();
    const storageKey = useMemo(
        () => user ? `library_favorites_${user.id}` : 'library_favorites_guest',
        [user]
    );

    const [favorites, setFavorites] = useState(() => readGuestFavorites(storageKey));

    useEffect(() => {
        let active = true;

        async function loadFavorites() {
            if (!user) {
                setFavorites(readGuestFavorites(storageKey));
                return;
            }

            try {
                const response = await api('/api/favorites');
                if (active) setFavorites(Array.isArray(response) ? response.map(toFavoriteBook) : []);
            } catch {
                if (active) setFavorites([]);
            }
        }

        loadFavorites();
        return () => {
            active = false;
        };
    }, [user, storageKey]);

    useEffect(() => {
        if (user) return;
        try {
            localStorage.setItem(storageKey, JSON.stringify(favorites));
        } catch {
            // Ignore storage quota errors for guests.
        }
    }, [favorites, storageKey, user]);

    const isFavorite = useCallback(
        (bookId) => favorites.some((book) => book.id === bookId),
        [favorites]
    );

    const toggleFavorite = useCallback(async (book) => {
        const exists = favorites.some((item) => item.id === book.id);

        setFavorites((previous) => exists
            ? previous.filter((item) => item.id !== book.id)
            : [
                {
                    id: book.id,
                    title: book.title,
                    authorName: book.authorName,
                    categoryName: book.categoryName,
                    coverUrl: book.coverUrl,
                    availableCopies: book.availableCopies,
                    addedAt: new Date().toISOString(),
                },
                ...previous,
            ]
        );

        if (!user) return;

        try {
            if (exists) {
                await api(`/api/favorites/${book.id}`, { method: 'DELETE' });
            } else {
                const saved = await api(`/api/favorites/${book.id}`, { method: 'POST' });
                setFavorites((previous) => [
                    toFavoriteBook(saved),
                    ...previous.filter((item) => item.id !== book.id),
                ]);
            }
        } catch (error) {
            setFavorites((previous) => exists
                ? [toFavoriteBook({ ...book, bookId: book.id, addedAt: new Date().toISOString() }), ...previous]
                : previous.filter((item) => item.id !== book.id)
            );
            throw error;
        }
    }, [favorites, user]);

    const removeFavorite = useCallback(async (bookId) => {
        const removed = favorites.find((book) => book.id === bookId);
        setFavorites((previous) => previous.filter((book) => book.id !== bookId));

        if (!user) return;

        try {
            await api(`/api/favorites/${bookId}`, { method: 'DELETE' });
        } catch (error) {
            if (removed) setFavorites((previous) => [removed, ...previous]);
            throw error;
        }
    }, [favorites, user]);

    const clearFavorites = useCallback(async () => {
        const previous = favorites;
        setFavorites([]);

        if (!user) return;

        try {
            await api('/api/favorites', { method: 'DELETE' });
        } catch (error) {
            setFavorites(previous);
            throw error;
        }
    }, [favorites, user]);

    return (
        <FavoritesContext.Provider
            value={{ favorites, isFavorite, toggleFavorite, removeFavorite, clearFavorites }}
        >
            {children}
        </FavoritesContext.Provider>
    );
}
