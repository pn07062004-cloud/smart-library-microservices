import {
    Navigate,
    Route,
    Routes,
    useLocation
} from 'react-router-dom';

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';

import Home from './pages/Home';
import Catalog from './pages/Catalog';
import BookDetail from './pages/BookDetail';
import AuthPages from './pages/AuthPages';
import MemberDashboard from './pages/MemberDashboard';
import ManageBooks from './pages/ManageBooks';
import ManageLoans from './pages/ManageLoans';
import ManageUsers from './pages/ManageUsers';
import AdminSettings from './pages/AdminSettings';
import About from './pages/About';
import Regulations from './pages/Regulations';
import StatsPage from './pages/StatsPage';
import ToonHub from './pages/ToonHub';
import PaymentFines from './pages/PaymentFines';
import PaymentHistory from './pages/PaymentHistory';
import PaymentResult from './pages/PaymentResult';
import QuickBorrowReturn from './pages/QuickBorrowReturn';
import Profile from './pages/Profile';

function defaultRoute(user) {
    if (!user) {
        return '/login';
    }

    return user.role === 'MEMBER'
        ? '/'
        : '/admin/stats';
}

function LoadingScreen({ text = 'Đang tải…' }) {
    return (
        <div
            className="app-loading app-loading-screen"
            role="status"
            aria-live="polite"
        >
            {text}
        </div>
    );
}

function Guard({ children, roles }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <LoadingScreen text="Đang khôi phục phiên đăng nhập…" />
        );
    }

    if (!user) {
        return (
            <Navigate
                to="/login"
                state={{ from: location }}
                replace
            />
        );
    }

    if (
        roles &&
        !roles.includes(user.role)
    ) {
        return (
            <Navigate
                to={defaultRoute(user)}
                replace
            />
        );
    }

    return children;
}

function GuestOnly({ children }) {
    const { user, loading } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (user) {
        return (
            <Navigate
                to={defaultRoute(user)}
                replace
            />
        );
    }

    return children;
}

export default function App() {
    const location = useLocation();
    const { user, loading } = useAuth();

    if (location.pathname === '/toonhub') {
        return <ToonHub />;
    }

    /*
     * Nếu đang có token và F5 thì chờ xác thực xong
     * để tránh nháy giao diện khách rồi mới thành người dùng.
     */
    if (loading) {
        return (
            <LoadingScreen text="Đang tải Smart Library…" />
        );
    }

    return (
        <ErrorBoundary>
            <Layout>
                <Routes>

                    {/* PUBLIC */}
                    <Route
                        path="/"
                        element={<Home />}
                    />

                    <Route
                        path="/books"
                        element={<Catalog />}
                    />

                    <Route
                        path="/books/:id"
                        element={<BookDetail />}
                    />

                    <Route
                        path="/about"
                        element={<About />}
                    />

                    <Route
                        path="/quy-dinh"
                        element={<Regulations />}
                    />

                    {/* AUTH */}
                    <Route
                        path="/login"
                        element={
                            <GuestOnly>
                                <AuthPages mode="login" />
                            </GuestOnly>
                        }
                    />

                    <Route
                        path="/register"
                        element={
                            <GuestOnly>
                                <AuthPages mode="register" />
                            </GuestOnly>
                        }
                    />

                    <Route
                        path="/forgot-password"
                        element={
                            <GuestOnly>
                                <AuthPages mode="forgot" />
                            </GuestOnly>
                        }
                    />

                    <Route
                        path="/reset-password"
                        element={
                            <AuthPages mode="reset" />
                        }
                    />

                    {/* MEMBER */}
                    <Route
                        path="/my-library"
                        element={
                            <Guard roles={['MEMBER']}>
                                <MemberDashboard />
                            </Guard>
                        }
                    />

                    <Route
                        path="/payments"
                        element={
                            <Guard roles={['MEMBER']}>
                                <PaymentFines />
                            </Guard>
                        }
                    />

                    <Route
                        path="/payments/history"
                        element={
                            <Guard roles={['MEMBER']}>
                                <PaymentHistory />
                            </Guard>
                        }
                    />

                    <Route
                        path="/payments/result"
                        element={
                            <PaymentResult />
                        }
                    />

                    {/* ADMIN / LIBRARIAN */}
                    <Route
                        path="/admin"
                        element={
                            <Navigate
                                to="/admin/stats"
                                replace
                            />
                        }
                    />

                    <Route
                        path="/admin/stats"
                        element={
                            <Guard
                                roles={[
                                    'ADMIN',
                                    'LIBRARIAN'
                                ]}
                            >
                                <StatsPage />
                            </Guard>
                        }
                    />

                    <Route
                        path="/admin/books"
                        element={
                            <Guard
                                roles={[
                                    'ADMIN',
                                    'LIBRARIAN'
                                ]}
                            >
                                <ManageBooks />
                            </Guard>
                        }
                    />

                    <Route
                        path="/admin/loans"
                        element={
                            <Guard
                                roles={[
                                    'ADMIN',
                                    'LIBRARIAN'
                                ]}
                            >
                                <ManageLoans />
                            </Guard>
                        }
                    />

                    <Route
                        path="/admin/quick-borrow"
                        element={
                            <Guard
                                roles={[
                                    'ADMIN',
                                    'LIBRARIAN'
                                ]}
                            >
                                <QuickBorrowReturn />
                            </Guard>
                        }
                    />

                    <Route
                        path="/admin/users"
                        element={
                            <Guard
                                roles={[
                                    'ADMIN',
                                    'LIBRARIAN'
                                ]}
                            >
                                <ManageUsers />
                            </Guard>
                        }
                    />

                    <Route
                        path="/admin/settings"
                        element={
                            <Guard roles={['ADMIN']}>
                                <AdminSettings />
                            </Guard>
                        }
                    />

                    {/* ACCOUNT */}
                    <Route
                        path="/profile"
                        element={
                            <Guard>
                                <Profile />
                            </Guard>
                        }
                    />

                    <Route
                        path="*"
                        element={
                            <Navigate
                                to={
                                    user
                                        ? defaultRoute(user)
                                        : '/'
                                }
                                replace
                            />
                        }
                    />

                </Routes>
            </Layout>
        </ErrorBoundary>
    );
}