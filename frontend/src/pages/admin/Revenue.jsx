/**
 * src/pages/admin/Revenue.jsx
 * Platform revenue analytics — total earned, per-platform breakdown, recent ledger.
 * Endpoint: GET /api/v1/admin/revenue/
 */
import { useEffect, useState } from "react";
import {
    TrendingUp, DollarSign, ShoppingBag, BarChart3,
    RefreshCw, Calendar, ArrowUpRight, Package
} from "lucide-react";
import api from "../../services/api";

const PLATFORM_COLORS = {
    instagram: "bg-pink-500",
    youtube:   "bg-red-500",
    tiktok:    "bg-gray-800",
    twitter:   "bg-sky-500",
    facebook:  "bg-blue-600",
    snapchat:  "bg-yellow-400",
    twitch:    "bg-purple-600",
    other:     "bg-gray-400",
};

const PLATFORM_BG = {
    instagram: "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300",
    youtube:   "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
    tiktok:    "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
    twitter:   "bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300",
    facebook:  "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
    snapchat:  "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300",
    twitch:    "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
    other:     "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
};

function fmt(n) {
    return `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

function StatCard({ icon: Icon, label, value, sub, color = "brand" }) {
    const colors = {
        brand:   "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400",
        emerald: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
        amber:   "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400",
        sky:     "bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400",
    };
    return (
        <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
                    <Icon size={18} />
                </div>
                <ArrowUpRight size={14} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

export default function RevenuePage() {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState("");

    const load = () => {
        setLoading(true);
        api.get("/admin/revenue/")
            .then(r => setData(r.data))
            .catch(() => setError("Failed to load revenue data."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <RefreshCw size={22} className="animate-spin text-brand-500" />
        </div>
    );

    if (error) return (
        <div className="card p-8 text-center">
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={load} className="btn-primary mt-4 text-sm">Retry</button>
        </div>
    );

    const summary       = data?.summary || {};
    const byPlatform    = data?.by_platform || [];
    const recentEntries = data?.recent || [];

    // Build bar chart widths
    const maxAmt = Math.max(...byPlatform.map(p => Number(p.total || 0)), 1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Revenue Analytics</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Platform commission earned across all completed orders
                    </p>
                </div>
                <button onClick={load} className="btn-ghost text-sm flex items-center gap-2">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={DollarSign}
                    label="Total Revenue"
                    value={fmt(summary.total_revenue)}
                    sub="All time platform commission"
                    color="emerald"
                />
                <StatCard
                    icon={Package}
                    label="Completed Orders"
                    value={summary.total_orders?.toLocaleString() ?? "—"}
                    sub="Orders reaching COMPLETED"
                    color="brand"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Avg Commission"
                    value={fmt(summary.avg_commission)}
                    sub="Per completed order"
                    color="sky"
                />
                <StatCard
                    icon={Calendar}
                    label="This Month"
                    value={fmt(summary.this_month)}
                    sub="Revenue in current calendar month"
                    color="amber"
                />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* By Platform */}
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-5">
                        <BarChart3 size={15} className="text-brand-500" />
                        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Revenue by Platform</h2>
                    </div>
                    {byPlatform.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No data yet.</p>
                    ) : (
                        <div className="space-y-4">
                            {byPlatform.map(p => {
                                const pct = (Number(p.total || 0) / maxAmt) * 100;
                                const colorClass = PLATFORM_COLORS[p.platform] || PLATFORM_COLORS.other;
                                const badgeClass = PLATFORM_BG[p.platform] || PLATFORM_BG.other;
                                return (
                                    <div key={p.platform}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md capitalize ${badgeClass}`}>
                                                {p.platform}
                                            </span>
                                            <div className="text-right">
                                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                    {fmt(p.total)}
                                                </span>
                                                <span className="text-xs text-gray-400 ml-2">
                                                    {p.count} orders
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                                            <div
                                                className={`h-2 rounded-full ${colorClass} transition-all duration-700`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Recent Ledger */}
                <div className="card p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <ShoppingBag size={15} className="text-brand-500" />
                        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Recent Revenue Entries</h2>
                    </div>
                    {recentEntries.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No entries yet.</p>
                    ) : (
                        <div className="space-y-1">
                            {recentEntries.map(e => (
                                <div
                                    key={e.id}
                                    className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                            #{String(e.order_id || "").slice(0, 8).toUpperCase()}
                                        </p>
                                        <p className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">
                                            {e.listing_title || "—"}
                                        </p>
                                    </div>
                                    <div className="text-right ml-4 flex-shrink-0">
                                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                            {fmt(e.commission_amount)}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            {e.recorded_at
                                                ? new Date(e.recorded_at).toLocaleDateString()
                                                : "—"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}