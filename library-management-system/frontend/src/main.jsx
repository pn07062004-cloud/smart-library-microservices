import React
    from 'react';

import {
    createRoot
} from 'react-dom/client';

import {
    BrowserRouter
} from 'react-router-dom';

import App
    from './App';

import {
    AuthProvider
} from './context/AuthContext';

import {
    FavoritesProvider
} from './context/FavoritesContext';

import './styles.css';
import './premium.css';

createRoot(
    document.getElementById(
        'root'
    )
).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <FavoritesProvider>
                    <App />
                </FavoritesProvider>
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);