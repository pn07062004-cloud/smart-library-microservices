import { useEffect, useRef, useState } from 'react';
import { ArrowRightLeft, BookCopy, Camera, CircleAlert, CircleCheckBig, QrCode, RefreshCcw, ScanLine, StopCircle, UserRound } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import AdminShell from '../components/AdminShell';
import { api } from '../api';
import { showError, showSuccess } from '../utils/feedback';
import { useAuth } from '../context/AuthContext';

const SCANNER_ID = 'quick-borrow-scanner';
const STAFF_DENIED_MESSAGE = 'Tài khoản hiện tại không có quyền sử dụng quầy mượn/trả nhanh.';
const QR_PERMISSION_MESSAGE = 'Không xử lý được. Hãy đăng nhập bằng tài khoản Thủ thư hoặc Quản trị viên và bảo đảm circulation-service đã chạy bản mới.';

function parseNumeric(value) {
    const text = String(value || '').trim();
    return /^\d+$/.test(text) ? Number(text) : null;
}

function friendlyError(error) {
    const message = error?.message || String(error || '');
    if (message.includes('403') || message.toLowerCase().includes('forbidden') || message.includes('không có quyền')) {
        return QR_PERMISSION_MESSAGE;
    }
    return message || 'Xử lý thất bại';
}

function nowText() {
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).format(new Date());
}

export default function QuickBorrowReturn() {
    const { user, isStaff } = useAuth();
    const [stage, setStage] = useState('copy');
    const [copyId, setCopyId] = useState('');
    const [userId, setUserId] = useState('');
    const [scannerInput, setScannerInput] = useState('');
    const [status, setStatus] = useState('Sẵn sàng quét QR sách.');
    const [running, setRunning] = useState(false);
    const [busy, setBusy] = useState(false);
    const [logs, setLogs] = useState([]);
    const scannerRef = useRef(null);
    const scannerInputRef = useRef(null);
    const stageRef = useRef('copy');
    const copyRef = useRef('');
    const busyRef = useRef(false);
    const lastScanRef = useRef({ value: '', at: 0 });

    useEffect(() => {
        stageRef.current = stage;
        copyRef.current = copyId;
        busyRef.current = busy;
    }, [stage, copyId, busy]);

    useEffect(() => {
        if (user && !isStaff) {
            setStatus(STAFF_DENIED_MESSAGE);
        }
    }, [user, isStaff]);

    useEffect(() => {
        requestAnimationFrame(() => {
            document.querySelector('.admin-main')?.scrollTo(0, 0);
            scannerInputRef.current?.focus({ preventScroll: true });
        });
    }, []);

    useEffect(() => {
        return () => {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
                scannerRef.current.clear().catch(() => {});
                scannerRef.current = null;
            }
        };
    }, []);

    function pushLog(type, title, detail) {
        setLogs(items => [{ type, title, detail, time: nowText() }, ...items].slice(0, 8));
    }

    async function stopScanner() {
        if (scannerRef.current) {
            try {
                await scannerRef.current.stop();
            } catch {}
            try {
                await scannerRef.current.clear();
            } catch {}
            scannerRef.current = null;
        }
        setRunning(false);
    }

    async function processPair(nextCopyId, nextUserId) {
        if (user && !isStaff) {
            throw new Error(STAFF_DENIED_MESSAGE);
        }

        const payload = {
            copyId: parseNumeric(nextCopyId),
            userId: parseNumeric(nextUserId)
        };

        if (!payload.copyId || !payload.userId) {
            throw new Error('QR không hợp lệ');
        }

        const result = await api('/api/qr/borrow-return', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const message = result?.message || (result?.action === 'RETURN' ? 'Trả sách thành công' : 'Mượn sách thành công');
        setStatus(message);
        showSuccess(message);
        pushLog('success', result?.action === 'RETURN' ? 'Trả sách' : 'Mượn sách', message);
        setCopyId('');
        setUserId('');
        setScannerInput('');
        setStage('copy');
        stageRef.current = 'copy';
        copyRef.current = '';
        scannerInputRef.current?.focus({ preventScroll: true });
    }

    async function handleScannedValue(decoded, source = 'camera') {
        const raw = String(decoded || '').trim();
        const seen = lastScanRef.current;
        const now = Date.now();

        if (!raw) return false;
        if (seen.value === raw && now - seen.at < 900) return false;
        lastScanRef.current = { value: raw, at: now };

        if (busyRef.current) return true;

        const id = parseNumeric(raw);
        if (!id) {
            setStatus('QR không hợp lệ. Hãy quét mã số.');
            pushLog('error', 'QR lỗi', String(decoded || 'Không đọc được mã'));
            showError('QR không hợp lệ');
            return true;
        }

        if (stageRef.current === 'user' && String(id) === copyRef.current) {
            const message = 'Hãy quét QR độc giả khác với QR sách.';
            setStatus(message);
            pushLog('error', 'Quét nhầm mã', message);
            showError(message);
            return true;
        }

        if (stageRef.current === 'copy') {
            const copyValue = String(id);
            setCopyId(copyValue);
            copyRef.current = copyValue;
            setStage('user');
            stageRef.current = 'user';
            const message = `Đã nhận QR sách #${id}. Quét tiếp QR độc giả.`;
            setStatus(message);
            pushLog('info', source === 'keyboard' ? 'Máy quét USB' : 'QR sách', `Bản sách #${id}`);
            showSuccess(message);
            return true;
        }

        setBusy(true);
        busyRef.current = true;
        setUserId(String(id));
        setStatus('Đang xử lý mượn/trả...');
        try {
            await processPair(copyRef.current, String(id));
        } catch (error) {
            const message = friendlyError(error);
            setStatus(message);
            pushLog('error', 'Xử lý thất bại', message);
            showError(message);
        } finally {
            setBusy(false);
            busyRef.current = false;
        }

        return true;
    }

    async function startScanner() {
        if (running) return;
        if (user && !isStaff) {
            setStatus(STAFF_DENIED_MESSAGE);
            showError(STAFF_DENIED_MESSAGE);
            return;
        }

        const scanner = new Html5Qrcode(SCANNER_ID);
        scannerRef.current = scanner;
        lastScanRef.current = { value: '', at: 0 };

        try {
            setRunning(true);
            setStatus('Đang mở camera...');

            await scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 25,
                    qrbox: (viewfinderWidth, viewfinderHeight) => {
                        const size = Math.max(180, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.52));
                        return { width: size, height: size };
                    },
                    aspectRatio: 4 / 3,
                    disableFlip: false,
                    experimentalFeatures: { useBarCodeDetectorIfSupported: true }
                },
                async decoded => {
                    await handleScannedValue(decoded, 'camera');
                },
                () => {}
            );
        } catch (error) {
            setRunning(false);
            scannerRef.current = null;
            const message = 'Không mở được camera. Hãy kiểm tra quyền truy cập.';
            setStatus(message);
            pushLog('error', 'Camera lỗi', error.message || message);
            showError(message);
        }
    }

    async function manualProcess() {
        if (busy) return;
        if (user && !isStaff) {
            setStatus(STAFF_DENIED_MESSAGE);
            showError(STAFF_DENIED_MESSAGE);
            return;
        }
        setBusy(true);
        busyRef.current = true;
        try {
            await processPair(copyId, userId);
        } catch (error) {
            const message = friendlyError(error);
            setStatus(message);
            pushLog('error', 'Xử lý thất bại', message);
            showError(message);
        } finally {
            setBusy(false);
            busyRef.current = false;
        }
    }

    function handleUsbKeyDown(event) {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const raw = scannerInput.trim();
        if (!raw || busy) return;
        handleScannedValue(raw, 'keyboard').finally(() => setScannerInput(''));
    }

    function resetSession() {
        setCopyId('');
        setUserId('');
        setScannerInput('');
        setStage('copy');
        stageRef.current = 'copy';
        copyRef.current = '';
        setStatus('Đã reset bộ quét.');
        pushLog('info', 'Reset phiên', 'Sẵn sàng quét lại từ đầu');
        scannerInputRef.current?.focus({ preventScroll: true });
    }

    const cameraDisabled = !isStaff;

    return (
        <AdminShell
            title="Quầy mượn/trả nhanh"
            subtitle="Quét mã bản sách và mã độc giả để lập phiếu mượn hoặc ghi nhận trả ngay tại quầy."
            action={(
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', minWidth: 310 }}>
                    <button className="btn btn-outline" type="button" onClick={startScanner} disabled={running || cameraDisabled}>
                        <Camera /> {running ? 'Camera đang mở' : 'Mở camera'}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={stopScanner} disabled={!running}>
                        <StopCircle /> Dừng quét
                    </button>
                </div>
            )}
        >
            <div className="admin-grid quick-borrow-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(380px,430px)', gap: 18, alignItems: 'stretch' }}>
                <div className="panel quick-borrow-camera" style={{ overflow: 'hidden', gridRow: '1 / span 2' }}>
                    <div className="panel-head">
                        <div>
                            <h2>Camera quét QR</h2>
                            <p>{stage === 'copy' ? 'Quét QR bản sách' : 'Quét QR độc giả'}</p>
                        </div>
                        <span className="system-ok"><i style={{ background: running ? '#29a36f' : '#b5bdb8' }} />{running ? 'Đang hoạt động' : 'Đã dừng'}</span>
                    </div>
                    <div className="quick-borrow-camera-frame" style={{ position: 'relative', background: '#0d1f1a' }}>
                        <div id={SCANNER_ID} className="quick-borrow-scanner" />
                        {running ? (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', textAlign: 'center', pointerEvents: 'none', background: 'linear-gradient(rgba(8,22,18,.16), rgba(8,22,18,.34))' }}>
                                <ScanLine style={{ width: 44, height: 44, marginBottom: 10 }} />
                                <span style={{ fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,.12)', borderRadius: 999, padding: '10px 14px', backdropFilter: 'blur(8px)' }}>Đưa mã QR vào giữa khung hình</span>
                            </div>
                        ) : (
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#fff', textAlign: 'center', pointerEvents: 'none' }}>
                                <Camera style={{ width: 40, height: 40, marginBottom: 10, opacity: .6 }} />
                                <span style={{ fontSize: 13, fontWeight: 700, opacity: .75 }}>Bấm "Mở camera" để bắt đầu quét</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="panel quick-borrow-ticket">
                    <div className="panel-head">
                        <div>
                            <h2>Phiếu quét hiện tại</h2>
                            <p>Kiểm tra trạng thái trước khi xử lý</p>
                        </div>
                    </div>
                    <div style={{ padding: '0 18px 18px', display: 'grid', gap: 10 }}>
                        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', background: '#fbfbf8' }}>
                            <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginBottom: 6 }}>Trạng thái</small>
                            <b>{stage === 'copy' ? 'Quét QR sách' : 'Quét QR độc giả'}</b>
                        </div>
                        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', background: '#fbfbf8' }}>
                            <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginBottom: 6 }}>Mã bản sách</small>
                            <b>{copyId || 'Chưa có'}</b>
                        </div>
                        <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px', background: '#fbfbf8' }}>
                            <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10, marginBottom: 6 }}>Mã độc giả</small>
                            <b>{userId || 'Chưa có'}</b>
                        </div>
                        <p style={{ margin: '4px 0 0', padding: '12px 14px', borderRadius: 12, background: 'var(--mint)', color: 'var(--green)', fontSize: 13, lineHeight: 1.6 }}>{status}</p>
                        <button className="btn btn-primary btn-block" type="button" onClick={manualProcess} disabled={busy || cameraDisabled}>
                            <ArrowRightLeft /> Xử lý ngay
                        </button>
                        <button className="btn btn-outline btn-block" type="button" onClick={resetSession}>
                            <RefreshCcw /> Reset phiên quét
                        </button>
                    </div>
                </div>

                <div className="panel quick-borrow-usb">
                    <div className="panel-head">
                        <div>
                            <h2>Máy quét USB nhanh</h2>
                            <p>Ưu tiên khi dùng tại quầy thực tế.</p>
                        </div>
                    </div>
                    <div style={{ padding: '0 18px 18px', display: 'grid', gap: 12 }}>
                        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 700 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ScanLine style={{ width: 17, height: 17 }} /> Mã quét liên tiếp</span>
                            <input
                                ref={scannerInputRef}
                                value={scannerInput}
                                onChange={event => setScannerInput(event.target.value)}
                                onKeyDown={handleUsbKeyDown}
                                placeholder={stage === 'copy' ? 'Quét mã bản sách rồi nhấn Enter' : 'Quét mã độc giả rồi nhấn Enter'}
                                inputMode="numeric"
                                autoComplete="off"
                                style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', outline: 'none' }}
                            />
                        </label>
                        <p style={{ margin: 0, color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>
                            Đặt con trỏ vào ô này, quét mã sách rồi quét mã độc giả.
                        </p>
                    </div>
                </div>

                <div className="panel quick-borrow-history" style={{ overflow: 'hidden' }}>
                    <div className="panel-head">
                        <div>
                            <h2>Lịch sử xử lý gần đây</h2>
                            <p>Kết quả mượn/trả sẽ xuất hiện ngay sau mỗi lượt quét</p>
                        </div>
                        <QrCode className="empty-icon" />
                    </div>
                    <div style={{ padding: '0 18px 18px', display: 'grid', gap: 10 }}>
                        {logs.length === 0 ? (
                            <div className="empty" style={{ padding: '22px 10px' }}>
                                <QrCode className="empty-icon" />
                                <h3>Chưa có lượt quét nào</h3>
                                <p>Quét QR bản sách trước, rồi quét QR độc giả để xử lý mượn hoặc trả.</p>
                            </div>
                        ) : logs.map((item, index) => (
                            <article key={`${item.time}-${index}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid var(--line)', borderRadius: 12, padding: 14, background: item.type === 'success' ? '#f6fbf8' : item.type === 'error' ? '#fff8f8' : '#fcfdfc' }}>
                                <span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', flex: 'none', background: item.type === 'success' ? '#def3e8' : item.type === 'error' ? '#ffe5e5' : 'var(--mint)', color: item.type === 'success' ? 'var(--green)' : item.type === 'error' ? 'var(--red)' : 'var(--green)' }}>
                                    {item.type === 'success' ? <CircleCheckBig style={{ width: 18, height: 18 }} /> : item.type === 'error' ? <CircleAlert style={{ width: 18, height: 18 }} /> : <ScanLine style={{ width: 18, height: 18 }} />}
                                </span>
                                <div>
                                    <b style={{ display: 'block', fontSize: 13 }}>{item.title}</b>
                                    <p style={{ margin: '4px 0 6px', color: 'var(--muted)', fontSize: 12, lineHeight: 1.6 }}>{item.detail}</p>
                                    <small style={{ fontSize: 10, color: 'var(--muted)' }}>{item.time}</small>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>

                <div className="panel quick-borrow-manual">
                    <div className="panel-head">
                        <div>
                            <h2>Nhập tay khi cần</h2>
                            <p>Dùng khi cần nhập nhanh bằng bàn phím.</p>
                        </div>
                    </div>
                    <div style={{ padding: '0 18px 18px', display: 'grid', gap: 12 }}>
                        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 700 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BookCopy style={{ width: 17, height: 17 }} /> Mã bản sách</span>
                            <input value={copyId} onChange={e => setCopyId(e.target.value)} placeholder="Ví dụ: 120" inputMode="numeric" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', outline: 'none' }} />
                        </label>
                        <label style={{ display: 'grid', gap: 7, fontSize: 12, fontWeight: 700 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserRound style={{ width: 17, height: 17 }} /> Mã độc giả</span>
                            <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="Ví dụ: 45" inputMode="numeric" style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '11px 13px', outline: 'none' }} />
                        </label>
                    </div>
                </div>
            </div>
        </AdminShell>
    );
}