import { Component } from 'react';

export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        if (import.meta.env.DEV) {
            // Keep details in development without showing a blank page to users.
            console.error(error, info);
        }
    }

    reset = () => {
        this.setState({ hasError: false });
    };

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <main className="page-soft" style={{ minHeight: 'calc(100vh - 96px)', display: 'grid', placeItems: 'center', padding: 24 }}>
                <section className="empty" style={{ maxWidth: 620, width: '100%', background: '#fffdfa', border: '1px solid var(--line)', borderRadius: 18, padding: 36 }}>
                    <div className="empty-icon">!</div>
                    <h3>Không thể hiển thị trang</h3>
                    <p>Trang vừa gặp lỗi khi tải dữ liệu. Bạn có thể thử tải lại hoặc quay về trang chủ.</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
                        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                            Tải lại trang
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => { this.reset(); window.location.assign('/'); }}>
                            Về trang chủ
                        </button>
                    </div>
                </section>
            </main>
        );
    }
}