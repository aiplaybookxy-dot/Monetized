import { useState, useEffect, useCallback } from "react";
import {
    TrendingUp, Eye, MousePointerClick,
    ShoppingBag, DollarSign, Copy, CheckCircle,
    RefreshCw, ExternalLink, BarChart3,
} from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

/**
 * Architecture note:
 * This component owns its own data fetch — it does NOT share state
 * with StoreSettings. Each concern fetches what it needs independently.
 * This keeps both components lean and independently refreshable.
 */

function MetricCard({ icon: Icon, label, value, sub, color, alert }) {
    return (
        <div className={`card p-5 ${alert ? "border-amber-200 dark:border-amber-800" : ""}`}>
            <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                    <Icon size={18} className="text-white" />
                </div>
                {alert && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        LIVE
                    </span>
                )}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

export default function StoreAnalyticsPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const fetchAnalytics = useCallback(async (isRefresh = false) => {
        isRefresh ? setRefreshing(true) : setLoading(true);
        try {
            const r = await api.get("/store/analytics/");
            setData(r.data);
        } catch (err) {
            if (err.response?.status === 404) {
                setData(null);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

    const handleCopy = () => {
        if (!data?.store_url) return;
        navigator.clipboard.writeText(data.store_url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
        });
    };

    if (loading) return <LoadingSpinner />;

    if (!data) return (
        <div className="card p-10 text-center">
            <BarChart3 size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="font-semibold text-gray-900 dark:text-white mb-1">No analytics yet</p>
            <p className="text-sm text-gray-400">
                Create your store first, then share your link to start collecting data.
            </p>
        </div>
    );

    const ctr = data.total_views > 0
        ? ((data.total_clicks / data.total_views) * 100).toFixed(1)
        : "0.0";

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <BarChart3 size={22} className="text-brand-500" />
                        Store Analytics
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {data.store_name} · Real-time storefront metrics
                    </p>
                </div>
                <button
                    onClick={() => fetchAnalytics(true)}
                    disabled={refreshing}
                    className="btn-ghost border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm px-3 py-2 rounded-xl"
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {/* Store link card */}
            <div className="card p-5">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                    Your Storefront Link
                </p>
                <div className="flex items-center gap-3">
                    <div className="flex-1 font-mono text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 truncate text-gray-700 dark:text-gray-300">
                        {data.store_url}
                    </div>
                    <button
                        onClick={handleCopy}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex-shrink-0 ${copied
                            ? "bg-emerald-500 text-white"
                            : "btn-primary"
                            }`}
                    >
                        {copied ? <><CheckCircle size={14} /> Copied!</> : <><Copy size={14} /> Copy Link</>}
                    </button>
                    <a
                        href={data.store_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost border border-gray-200 dark:border-gray-700 p-2.5 rounded-xl flex-shrink-0"
                        title="Open store"
                    >
                        <ExternalLink size={15} className="text-gray-500" />
                    </a>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Share this link in your bio, ads, and social posts to drive traffic.
                </p>
            </div>

            {/* Metrics grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                    icon={Eye}
                    label="Total Views"
                    value={Number(data.total_views).toLocaleString()}
                    sub="Unique storefront loads"
                    color="bg-blue-500"
                    alert
                />
                <MetricCard
                    icon={MousePointerClick}
                    label="Total Clicks"
                    value={Number(data.total_clicks).toLocaleString()}
                    sub={`${ctr}% click-through rate`}
                    color="bg-purple-500"
                    alert
                />
                <MetricCard
                    icon={ShoppingBag}
                    label="Total Sales"
                    value={Number(data.total_sales).toLocaleString()}
                    sub={`${data.conversion_rate}% conversion rate`}
                    color="bg-emerald-500"
                />
                <MetricCard
                    icon={DollarSign}
                    label="Total Revenue"
                    value={`₦${Number(data.total_revenue).toLocaleString()}`}
                    sub="After platform commission"
                    color="bg-amber-500"
                />
            </div>

            {/* Funnel visualization */}
            <div className="card p-5">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                    <TrendingUp size={15} className="text-brand-500" />
                    Conversion Funnel
                </h2>
                <div className="space-y-3">
                    {[
                        {
                            label: "Storefront Views",
                            value: data.total_views,
                            max: data.total_views,
                            color: "bg-blue-500",
                            pct: "100%",
                        },
                        {
                            label: "Buy Button Clicks (Leads)",
                            value: data.total_clicks,
                            max: data.total_views,
                            color: "bg-purple-500",
                            pct: data.total_views > 0
                                ? `${((data.total_clicks / data.total_views) * 100).toFixed(1)}%`
                                : "0%",
                        },
                        {
                            label: "Completed Sales",
                            value: data.total_sales,
                            max: data.total_views,
                            color: "bg-emerald-500",
                            pct: data.total_views > 0
                                ? `${((data.total_sales / data.total_views) * 100).toFixed(1)}%`
                                : "0%",
                        },
                    ].map(({ label, value, max, color, pct }) => {
                        const width = max > 0 ? Math.max((value / max) * 100, 2) : 2;
                        return (
                            <div key={label}>
                                <div className="flex items-center justify-between text-xs mb-1.5">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            {Number(value).toLocaleString()}
                                        </span>
                                        <span className="text-gray-400 w-12 text-right">{pct}</span>
                                    </div>
                                </div>
                                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${color} rounded-full transition-all duration-700`}
                                        style={{ width: `${width}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Conversion insight */}
                <div className={`mt-5 p-4 rounded-xl text-xs ${data.conversion_rate >= 5
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : data.conversion_rate >= 2
                        ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                        : "bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400"
                    }`}>
                    {data.conversion_rate >= 5 && (
                        <>🔥 <strong>Strong performance!</strong> {data.conversion_rate}% conversion is above the 5% benchmark for digital asset storefronts.</>
                    )}
                    {data.conversion_rate >= 2 && data.conversion_rate < 5 && (
                        <>📈 <strong>Growing.</strong> {data.conversion_rate}% conversion. Optimize your listing titles and prices to push past 5%.</>
                    )}
                    {data.conversion_rate < 2 && data.total_views > 0 && (
                        <>💡 <strong>Early stage.</strong> Focus on driving targeted traffic — share your link in niche communities where buyers are actively looking.</>
                    )}
                    {data.total_views === 0 && (
                        <>📣 <strong>No traffic yet.</strong> Share your store link to start collecting data.</>
                    )}
                </div>
            </div>
        </div >
    );
}