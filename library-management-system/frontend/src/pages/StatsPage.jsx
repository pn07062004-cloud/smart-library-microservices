import { useCallback, useEffect, useRef, useState } from 'react';
import {
    Area, AreaChart, Bar, BarChart, CartesianGrid,
    Cell, Legend, Pie, PieChart, ResponsiveContainer,
    Tooltip, XAxis, YAxis
} from 'recharts';
import {
    AlertCircle,
    Award,
    BarChart2,
    BookOpen,
    Clock,
    RefreshCw,
    TrendingUp,
    WalletCards
} from 'lucide-react';
import { api, money } from '../api';
import AdminShell from '../components/AdminShell';

/* ─── color palette ─── */
const C = {
    green: '#087255',
    gold: '#d2a84e',
    amber: '#d97706',
    red: '#b94444',
    purple: '#7048ad',
    blue: '#2563eb',
    muted: '#607069',
};

const PIE_COLORS = [C.green, C.amber, C.red, C.purple, C.blue];
const AUTO_REFRESH_MS = 30_000;

/* ─── small helpers ─── */
function StatCard({ icon, label, value, sub, color = C.green }) {
    return (
        <div className="stat-card-chart">
            <div
                className="stat-card-icon"
                style={{
                    background: color + '1a',
                    color
                }}
            >
                {icon}
            </div>

            <div className="stat-card-body">
                <span>{label}</span>
                <b>{value}</b>
                {sub && <small>{sub}</small>}
            </div>
        </div>
    );
}

function SectionHeading({ icon, title, subtitle }) {
    return (
        <div className="chart-section-head">
            <span className="chart-section-icon">
                {icon}
            </span>

            <div>
                <h3>{title}</h3>
                {subtitle && <p>{subtitle}</p>}
            </div>
        </div>
    );
}

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) {
        return null;
    }

    return (
        <div className="chart-tooltip">
            <b>{label}</b>

            {payload.map((p, i) => (
                <span
                    key={i}
                    style={{
                        color: p.color
                    }}
                >
                    {p.name}: <b>{p.value}</b>
                </span>
            ))}
        </div>
    );
};

export default function StatsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState('daily');

    const loadingRef = useRef(false);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (loadingRef.current) {
            return;
        }

        loadingRef.current = true;

        if (!silent) {
            setLoading(true);
        }

        try {
            const res = await api('/api/dashboard/stats');

            setData(res);
            setError('');
        } catch (e) {
            setError(
                e?.message ||
                'Không thể tải dữ liệu thống kê.'
            );
        } finally {
            loadingRef.current = false;

            if (!silent) {
                setLoading(false);
            }
        }
    }, []);

    /*
     * Lần đầu mở trang:
     * tải dữ liệu ngay.
     */
    useEffect(() => {
        load();
    }, [load]);

    /*
     * Tự cập nhật dữ liệu mỗi 30 giây.
     *
     * silent = true:
     * - không làm màn hình nhấp nháy
     * - không ẩn biểu đồ đang có
     * - chỉ cập nhật dữ liệu nền
     */
    useEffect(() => {
        const intervalId = window.setInterval(() => {
            load({
                silent: true
            });
        }, AUTO_REFRESH_MS);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [load]);

    /*
     * Nếu người dùng chuyển sang tab khác rồi quay lại,
     * cập nhật dữ liệu ngay thay vì chờ đủ 30 giây.
     */
    useEffect(() => {
        function handleVisibilityChange() {
            if (document.visibilityState === 'visible') {
                load({
                    silent: true
                });
            }
        }

        document.addEventListener(
            'visibilitychange',
            handleVisibilityChange
        );

        return () => {
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange
            );
        };
    }, [load]);

    /*
     * Chỉ thay toàn bộ màn hình bằng lỗi
     * khi chưa từng tải được dữ liệu.
     */
    if (error && !data) {
        return (
            <AdminShell
                title="Thống kê"
                subtitle="Biểu đồ phân tích dữ liệu thư viện"
            >
                <div className="chart-error">
                    <AlertCircle />

                    <b>
                        Không tải được dữ liệu
                    </b>

                    <span>
                        {error}
                    </span>

                    <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => load()}
                        disabled={loading}
                    >
                        Thử lại
                    </button>
                </div>
            </AdminShell>
        );
    }

    const s = data?.summary;

    const chartData =
        view === 'daily'
            ? data?.last30Days
            : data?.last12Months;

    /*
     * Dữ liệu biểu đồ trạng thái phiếu mượn.
     */
    const pieData = s
        ? [
            {
                name: 'Đang mượn',
                value: Number(s.activeLoans)
            },
            {
                name: 'Quá hạn',
                value: Number(s.overdueLoans)
            },
            {
                name: 'Đã trả',
                value: Number(s.returnedLoans)
            }
        ].filter(item => item.value > 0)
        : [];

    return (
        <AdminShell
            title="Thống kê & Phân tích"
            subtitle="Dữ liệu tự động cập nhật từ hệ thống thư viện"
        >
            {/* Toolbar */}
            <div className="chart-toolbar">
                <div className="chart-view-toggle">
                    <button
                        type="button"
                        className={
                            view === 'daily'
                                ? 'active'
                                : ''
                        }
                        onClick={() =>
                            setView('daily')
                        }
                    >
                        30 ngày qua
                    </button>

                    <button
                        type="button"
                        className={
                            view === 'monthly'
                                ? 'active'
                                : ''
                        }
                        onClick={() =>
                            setView('monthly')
                        }
                    >
                        12 tháng
                    </button>
                </div>

                <div className="chart-actions">
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => load()}
                        disabled={loading}
                    >
                        <RefreshCw
                            style={{
                                width: 15,
                                animation: loading
                                    ? 'spin 1s linear infinite'
                                    : 'none'
                            }}
                        />

                        {loading
                            ? 'Đang cập nhật...'
                            : 'Cập nhật'
                        }
                    </button>
                </div>
            </div>

            {/*
             * Nếu lần cập nhật nền bị lỗi nhưng đã có dữ liệu cũ,
             * không phá dashboard.
             */}
            {error && data && (
                <div
                    className="permission-note"
                    role="status"
                    aria-live="polite"
                >
                    Không thể lấy dữ liệu mới nhất.
                    Hệ thống đang giữ số liệu của lần tải gần nhất.
                </div>
            )}

            {loading && !data ? (
                <div className="chart-loading">
                    <RefreshCw
                        style={{
                            animation:
                                'spin 1s linear infinite'
                        }}
                    />

                    <span>
                        Đang tải dữ liệu thống kê...
                    </span>
                </div>
            ) : (
                <>
                    {/* KPI */}
                    <div className="stat-cards-row">
                        <StatCard
                            icon={<BookOpen />}
                            label="Tổng phiếu mượn"
                            value={
                                s?.totalLoans ?? '—'
                            }
                            sub={
                                `Tháng này: ${
                                    data?.newLoanThisMonth ?? 0
                                }`
                            }
                            color={C.green}
                        />

                        <StatCard
                            icon={<TrendingUp />}
                            label="Đang mượn"
                            value={
                                s?.activeLoans ?? '—'
                            }
                            sub={
                                `Hôm nay: +${
                                    data?.newLoansToday ?? 0
                                }`
                            }
                            color={C.blue}
                        />

                        <StatCard
                            icon={<Clock />}
                            label="Quá hạn"
                            value={
                                s?.overdueLoans ?? '—'
                            }
                            color={C.red}
                        />

                        <StatCard
                            icon={<BarChart2 />}
                            label="Đặt trước"
                            value={
                                s?.reservations ?? '—'
                            }
                            color={C.purple}
                        />

                        <StatCard
                            icon={<WalletCards />}
                            label="Tiền phạt chưa thu"
                            value={
                                money(
                                    s?.unpaidAmount ?? 0
                                )
                            }
                            sub={
                                `${s?.unpaidFines ?? 0} khoản`
                            }
                            color={C.amber}
                        />
                    </div>

                    {/* Xu hướng mượn / trả */}
                    <div className="chart-card">
                        <SectionHeading
                            icon={<TrendingUp />}
                            title={
                                view === 'daily'
                                    ? 'Xu hướng mượn/trả – 30 ngày qua'
                                    : 'Xu hướng mượn/trả – 12 tháng'
                            }
                            subtitle="Số phiếu mượn mới và sách được trả mỗi ngày/tháng"
                        />

                        <ResponsiveContainer
                            width="100%"
                            height={300}
                        >
                            <AreaChart
                                data={chartData}
                                margin={{
                                    top: 10,
                                    right: 20,
                                    bottom: 0,
                                    left: 0
                                }}
                            >
                                <defs>
                                    <linearGradient
                                        id="gBorrow"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor={C.green}
                                            stopOpacity={0.25}
                                        />

                                        <stop
                                            offset="95%"
                                            stopColor={C.green}
                                            stopOpacity={0.02}
                                        />
                                    </linearGradient>

                                    <linearGradient
                                        id="gReturn"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor={C.gold}
                                            stopOpacity={0.25}
                                        />

                                        <stop
                                            offset="95%"
                                            stopColor={C.gold}
                                            stopOpacity={0.02}
                                        />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#e2e8e0"
                                />

                                <XAxis
                                    dataKey={
                                        view === 'daily'
                                            ? 'date'
                                            : 'month'
                                    }
                                    tick={{
                                        fontSize: 11,
                                        fill: C.muted
                                    }}
                                    tickLine={false}
                                    interval={
                                        view === 'daily'
                                            ? 4
                                            : 0
                                    }
                                />

                                <YAxis
                                    tick={{
                                        fontSize: 11,
                                        fill: C.muted
                                    }}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />

                                <Tooltip
                                    content={
                                        <CustomTooltip />
                                    }
                                />

                                <Legend
                                    wrapperStyle={{
                                        fontSize: 12
                                    }}
                                />

                                <Area
                                    type="monotone"
                                    dataKey="borrowed"
                                    name="Mượn mới"
                                    stroke={C.green}
                                    strokeWidth={2.5}
                                    fill="url(#gBorrow)"
                                    dot={false}
                                    activeDot={{
                                        r: 5,
                                        fill: C.green
                                    }}
                                />

                                <Area
                                    type="monotone"
                                    dataKey="returned"
                                    name="Đã trả"
                                    stroke={C.gold}
                                    strokeWidth={2.5}
                                    fill="url(#gReturn)"
                                    dot={false}
                                    activeDot={{
                                        r: 5,
                                        fill: C.gold
                                    }}
                                />

                                {view === 'monthly' && (
                                    <Area
                                        type="monotone"
                                        dataKey="overdue"
                                        name="Quá hạn"
                                        stroke={C.red}
                                        strokeWidth={2}
                                        fill="none"
                                        strokeDasharray="5 3"
                                        dot={false}
                                    />
                                )}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Hai biểu đồ phía dưới */}
                    <div className="charts-bottom-grid">
                        {/* Top sách */}
                        <div className="chart-card">
                            <SectionHeading
                                icon={<Award />}
                                title="Top 5 sách được mượn nhiều nhất"
                                subtitle="Xếp hạng theo tổng lượt mượn"
                            />

                            {data?.topBorrowedBooks?.length ? (
                                <ResponsiveContainer
                                    width="100%"
                                    height={260}
                                >
                                    <BarChart
                                        data={
                                            data.topBorrowedBooks
                                        }
                                        layout="vertical"
                                        margin={{
                                            top: 5,
                                            right: 30,
                                            left: 0,
                                            bottom: 5
                                        }}
                                    >
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke="#e2e8e0"
                                            horizontal={false}
                                        />

                                        <XAxis
                                            type="number"
                                            tick={{
                                                fontSize: 11,
                                                fill: C.muted
                                            }}
                                            tickLine={false}
                                            axisLine={false}
                                            allowDecimals={false}
                                        />

                                        <YAxis
                                            type="category"
                                            dataKey="bookTitle"
                                            width={130}
                                            tick={{
                                                fontSize: 10,
                                                fill: C.muted
                                            }}
                                            tickFormatter={
                                                value =>
                                                    value?.length > 22
                                                        ? value.slice(
                                                        0,
                                                        20
                                                    ) + '…'
                                                        : value
                                            }
                                            tickLine={false}
                                        />

                                        <Tooltip
                                            content={
                                                <CustomTooltip />
                                            }
                                        />

                                        <Bar
                                            dataKey="count"
                                            name="Lượt mượn"
                                            radius={[
                                                0,
                                                6,
                                                6,
                                                0
                                            ]}
                                        >
                                            {data.topBorrowedBooks.map(
                                                (_, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill={
                                                            PIE_COLORS[
                                                            i %
                                                            PIE_COLORS.length
                                                                ]
                                                        }
                                                    />
                                                )
                                            )}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="chart-empty">
                                    Chưa có dữ liệu
                                </div>
                            )}
                        </div>

                        {/* Trạng thái phiếu */}
                        <div className="chart-card">
                            <SectionHeading
                                icon={<BarChart2 />}
                                title="Phân bổ trạng thái phiếu mượn"
                                subtitle="Tổng quan tất cả phiếu mượn hiện tại"
                            />

                            {pieData.length ? (
                                <div className="pie-wrap">
                                    <ResponsiveContainer
                                        width="100%"
                                        height={220}
                                    >
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {pieData.map(
                                                    (_, i) => (
                                                        <Cell
                                                            key={i}
                                                            fill={
                                                                PIE_COLORS[
                                                                i %
                                                                PIE_COLORS.length
                                                                    ]
                                                            }
                                                        />
                                                    )
                                                )}
                                            </Pie>

                                            <Tooltip
                                                content={
                                                    <CustomTooltip />
                                                }
                                            />

                                            <Legend
                                                formatter={(
                                                    value,
                                                    entry
                                                ) => (
                                                    <span
                                                        style={{
                                                            fontSize: 12,
                                                            color: C.muted
                                                        }}
                                                    >
                                                        {value}:{' '}

                                                        <b
                                                            style={{
                                                                color:
                                                                entry.color
                                                            }}
                                                        >
                                                            {
                                                                entry
                                                                    .payload
                                                                    .value
                                                            }
                                                        </b>
                                                    </span>
                                                )}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>

                                    <div className="pie-center-label">
                                        <b>
                                            {
                                                s?.totalLoans ??
                                                0
                                            }
                                        </b>

                                        <span>
                                            Tổng
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="chart-empty">
                                    Chưa có dữ liệu
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </AdminShell>
    );
}