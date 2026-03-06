import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    ShoppingBag, Package, TrendingUp, Clock, ArrowRight,
    Plus, BarChart3, Activity, AlertTriangle,
    CheckCircle, Eye,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import StatusBadge from "../../components/ui/StatusBadge";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

function StatCard({ icon: Icon, label, value, color, sub, to }) {
    const inner = (
        <div className={`card p-5 flex items-start gap-4 ${to ? "hover:shadow-card-hover transition-shadow cursor-pointer" : ""}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={18} className="text-white" />
            </div>
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{value}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
            {to && <ArrowRight size={13} className="text-gray-300 dark:text-gray-600 ml-auto mt-1 flex-shrink-0" />}
        </div>
    );
    return to ? <Link to={to}>{inner}</Link> : inner;
}

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ user, recentOrders, recentListings }) {
    return (
        <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={ShoppingBag} label="Total Spent"     color="bg-brand-500"
                    value={`₦${Number(user?.total_spent  || 0).toLocaleString()}`}
                    sub={`${user?.completed_purchases || 0} purchase(s)`} />
                <StatCard icon={TrendingUp}  label="Total Earned"    color="bg-emerald-500"
                    value={`₦${Number(user?.total_earned || 0).toLocaleString()}`}
                    sub={`${user?.completed_sales || 0} sale(s)`} />
                <StatCard icon={Package}     label="Active Listings" color="bg-amber-500"
                    value={recentListings.filter(l => l.status === "active").length}
                    sub="Live on marketplace" />
                <StatCard icon={Clock}       label="Open Orders"     color="bg-purple-500"
                    value={recentOrders.filter(o => !["completed","cancelled","refunded"].includes(o.status)).length}
                    sub="Pending action" />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Purchases */}
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-900 dark:text-white">Recent Purchases</h2>
                        <Link to="/orders" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
                            View all <ArrowRight size={12} />
                        </Link>
                    </div>
                    {recentOrders.length === 0 ? (
                        <div className="text-center py-8">
                            <ShoppingBag size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">No purchases yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentOrders.map(order => (
                                <Link key={order.id} to={`/orders/${order.id}`}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            {order.listing?.title || "Listing"}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {order.listing?.platform} · {new Date(order.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                            ₦{Number(order.amount).toLocaleString()}
                                        </span>
                                        <StatusBadge status={order.status} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* My Listings */}
                <div className="card p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-gray-900 dark:text-white">My Listings</h2>
                        <Link to="/sell" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
                            <Plus size={12} /> New
                        </Link>
                    </div>
                    {recentListings.length === 0 ? (
                        <div className="text-center py-8">
                            <Package size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">You haven't listed anything yet.</p>
                            <Link to="/sell" className="text-xs text-brand-500 hover:underline mt-1 inline-block">
                                Create a listing
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {recentListings.map(listing => (
                                <div key={listing.id}
                                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{listing.title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            {listing.platform} · {Number(listing.follower_count || 0).toLocaleString()} followers
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                            ₦{Number(listing.price).toLocaleString()}
                                        </span>
                                        <StatusBadge status={listing.status} />
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

// ── Moderator Stats Tab — MODERATOR ONLY ─────────────────────────────────────
function ModeratorStatsTab() {
    const [stats,   setStats]   = useState(null);
    const [logs,    setLogs]    = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get("/mod/stats/"),
            api.get("/activity/logs/?page=1"),
        ])
            .then(([sRes, lRes]) => {
                setStats(sRes.data);
                setLogs(lRes.data.results?.slice(0, 8) || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <LoadingSpinner />;
    const s = stats || {};

    return (
        <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon={AlertTriangle} label="Open Disputes"    color="bg-rose-500"
                    value={s.open_disputes ?? "—"} sub="Frozen funds" to="/moderator/disputes" />
                <StatCard icon={Package}       label="Pending Listings" color="bg-amber-500"
                    value={s.pending_listings ?? "—"} sub="Awaiting approval" to="/moderator/listings" />
                {/*
                  WHY vault link goes to /moderator/disputes not /moderator/logs:
                  Vault views only happen during active disputes.
                  The moderator needs to see which dispute triggered the vault access.
                */}
                <StatCard icon={Eye}           label="Vault Views (24h)" color="bg-purple-500"
                    value={s.vault_views_24h ?? "—"} sub="Click to see dispute" to="/moderator/disputes" />
                <StatCard icon={Activity}      label="Log Entries (24h)" color="bg-teal-500"
                    value={s.log_entries_24h ?? "—"} to="/moderator/logs" />
                <StatCard icon={CheckCircle}   label="Resolved (7d)"    color="bg-emerald-500"
                    value={s.disputes_resolved_7d ?? "—"} />
            </div>

            {/* Recent activity */}
            <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Activity size={15} className="text-brand-500" /> Recent System Activity
                    </h2>
                    <Link to="/moderator/logs" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
                        Full log <ArrowRight size={11} />
                    </Link>
                </div>
                {logs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No logs yet.</p>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                        {logs.map(log => (
                            <div key={log.id} className="flex items-center justify-between py-3 gap-4">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 flex-shrink-0">
                                        {log.action}
                                    </span>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 truncate">
                                        @{log.username} — {log.description}
                                    </p>
                                </div>
                                <p className="text-[10px] text-gray-400 flex-shrink-0 font-mono">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── My Activity Tab ───────────────────────────────────────────────────────────
function MyActivityTab() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/activity/mine/")
            .then(r => setLogs(r.data.results || r.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const ACTION_COLOR = {
        VAULT_VIEWED:    "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
        ORDER_DISPUTED:  "text-red-600 bg-red-50 dark:bg-red-900/20",
        ORDER_COMPLETED: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20",
        LOGIN:           "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
        DEFAULT:         "text-gray-500 bg-gray-100 dark:bg-gray-800",
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="card p-5 max-w-2xl">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Activity size={15} className="text-brand-500" /> My Recent Activity
            </h2>
            {logs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No activity recorded yet.</p>
            ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800 max-h-96 overflow-y-auto">
                    {logs.map(log => {
                        const cls = ACTION_COLOR[log.action] || ACTION_COLOR.DEFAULT;
                        return (
                            <div key={log.id} className="flex items-start justify-between py-3 gap-3">
                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5 ${cls}`}>
                                        {log.action}
                                    </span>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                        {log.description}
                                    </p>
                                </div>
                                <p className="text-[10px] text-gray-400 flex-shrink-0 font-mono">
                                    {new Date(log.timestamp).toLocaleString()}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
    const { user }   = useAuth();
    const isMod      = user?.role === "moderator";

    // Tabs: regular users only see Overview + My Activity
    // Moderators also see their stats tab
    const TABS = [
        { id: "overview",  label: "Overview",         icon: BarChart3 },
        ...(isMod ? [{ id: "modstats", label: "Mod Stats", icon: TrendingUp }] : []),
        { id: "activity",  label: "My Activity",      icon: Activity  },
    ];

    const [activeTab,      setActiveTab]      = useState("overview");
    const [recentOrders,   setRecentOrders]   = useState([]);
    const [recentListings, setRecentListings] = useState([]);
    const [loading,        setLoading]        = useState(true);

    useEffect(() => {
        Promise.all([
            api.get("/orders/?page=1"),
            api.get("/listings/mine/"),
        ])
            .then(([ordersRes, listingsRes]) => {
                setRecentOrders(ordersRes.data.results?.slice(0, 4) || []);
                setRecentListings(listingsRes.data.results?.slice(0, 3) || []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <LoadingSpinner />;

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return "Good morning";
        if (h < 17) return "Good afternoon";
        return "Good evening";
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {greeting()}, {user?.username} 👋
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Here's what's happening with your account today.
                </p>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-gray-100 dark:border-gray-800">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                            activeTab === id
                                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700"
                        }`}
                    >
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {activeTab === "overview"  && <OverviewTab user={user} recentOrders={recentOrders} recentListings={recentListings} />}
            {activeTab === "modstats" && isMod && <ModeratorStatsTab />}
            {activeTab === "activity"  && <MyActivityTab />}
        </div>
    );
}