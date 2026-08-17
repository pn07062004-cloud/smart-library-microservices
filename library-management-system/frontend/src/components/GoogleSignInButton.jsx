import { useEffect, useRef, useState } from 'react';

const configuredClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
const GOOGLE_CLIENT_ID = configuredClientId && !configuredClientId.startsWith('your-google-')
    ? configuredClientId
    : '';
const SCRIPT_ID = 'google-identity-services';
const SCRIPT_URL = 'https://accounts.google.com/gsi/client?hl=vi';

let googleIdentityPromise;

function loadGoogleIdentityServices() {
    if (window.google?.accounts?.id) return Promise.resolve(window.google);
    if (googleIdentityPromise) return googleIdentityPromise;

    googleIdentityPromise = new Promise((resolve, reject) => {
        const handleLoad = () => {
            if (window.google?.accounts?.id) {
                resolve(window.google);
            } else {
                googleIdentityPromise = undefined;
                reject(new Error('Google Identity Services không khởi tạo được.'));
            }
        };
        const handleError = () => {
            googleIdentityPromise = undefined;
            reject(new Error('Không thể tải dịch vụ đăng nhập Google.'));
        };

        const existingScript = document.getElementById(SCRIPT_ID);
        if (existingScript) {
            existingScript.addEventListener('load', handleLoad, { once: true });
            existingScript.addEventListener('error', handleError, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = SCRIPT_URL;
        script.async = true;
        script.defer = true;
        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });
        document.head.appendChild(script);
    });

    return googleIdentityPromise;
}

export default function GoogleSignInButton({ onCredential, disabled = false }) {
    const containerRef = useRef(null);
    const credentialHandlerRef = useRef(onCredential);
    const [error, setError] = useState('');

    useEffect(() => {
        credentialHandlerRef.current = onCredential;
    }, [onCredential]);

    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) {
            setError('Chưa cấu hình Google Client ID cho website.');
            return undefined;
        }

        let active = true;
        let resizeObserver;

        loadGoogleIdentityServices()
            .then(google => {
                if (!active || !containerRef.current) return;

                google.accounts.id.initialize({
                    client_id: GOOGLE_CLIENT_ID,
                    auto_select: false,
                    cancel_on_tap_outside: true,
                    callback: response => {
                        if (!response?.credential) {
                            setError('Google không trả về thông tin xác thực.');
                            return;
                        }
                        credentialHandlerRef.current?.(response.credential);
                    }
                });

                let renderedWidth = 0;
                const render = () => {
                    if (!active || !containerRef.current) return;
                    const width = Math.min(400, Math.max(240, Math.floor(containerRef.current.clientWidth)));
                    if (width === renderedWidth) return;
                    renderedWidth = width;
                    containerRef.current.replaceChildren();
                    google.accounts.id.renderButton(containerRef.current, {
                        type: 'standard',
                        theme: 'outline',
                        size: 'large',
                        text: 'continue_with',
                        shape: 'rectangular',
                        logo_alignment: 'left',
                        width
                    });
                };

                render();
                resizeObserver = new ResizeObserver(render);
                resizeObserver.observe(containerRef.current);
            })
            .catch(loadError => {
                if (active) setError(loadError.message);
            });

        return () => {
            active = false;
            resizeObserver?.disconnect();
        };
    }, []);

    if (error) {
        return <p className="google-signin-error" role="status">{error}</p>;
    }

    return (
        <div
            className={`google-signin-shell${disabled ? ' is-disabled' : ''}`}
            aria-busy={disabled}
        >
            <div ref={containerRef} className="google-signin-container" />
        </div>
    );
}
