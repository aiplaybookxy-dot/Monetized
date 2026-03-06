import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    ShieldAlert, List, Users, Eye, TrendingUp,
    ArrowRight, Clock, AlertTriangle, Activity,
} from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

function StatCard({ icon: Icon, label, value, sub, color, to }) {
    const inner = (
        <div className={`card p-5 flex items-start gap-4 transition-shadow duration-200 ${to ? "hover:shadow-card-hover cursor-pointer" : ""}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon size={18} className="text-white" />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
                {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
            </div>
            {to && <ArrowRight size={14} className="text-gray-300 dark:text-gray-600 ml-auto mt-1 flex-shrink-0" />}
        </div>
    );
    return to ? <Link to={to}>{inner}</Link> : inner;
}

export default function ModeratorDashboard() {
    const [stats, setStats] = useState(null);
    const [recentLogs, setRecentLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get("/mod/stats/"),
            api.get("/activity/logs/?action=VAULT_VIEWED"),
        ])
            .then(([statsRes, logsRes]) => {
                setStats(statsRes.data);
                setRecentLogs(logsRes.data.results?.slice(0, 6) || []);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <LoadingSpinner />;

    const urgency = stats?.open_disputes > 0
        ? "bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800"
        : "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800";
    const urgencyText = stats?.open_disputes > 0
        ? `text-rose-700 dark:text-rose-400`
        : `text-emerald-700 dark:text-emerald-400`;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ShieldAlert size={22} className="text-rose-500" />
                        Moderator Overview
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Platform health at a glance
                    </p>
                </div>
                <p className="text-xs text-gray-400 hidden sm:block">
                    {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </p>
            </div>

            {/* Urgency banner */}
            {stats?.open_disputes > 0 && (
                <div className={`${urgency} rounded-2xl p-4 flex items-center gap-3`}>
                    <AlertTriangle size={18} className="text-rose-500 flex-shrink-0" />
                    <div className="flex-1">
                        <p className={`font-semibold text-sm ${urgencyText}`}>
                            {stats.open_disputes} open dispute{stats.open_disputes > 1 ? "s" : ""} require your attention
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Funds are frozen — resolve as soon as possible.
                        </p>
                    </div>
                    <Link to="/moderator/disputes" className="btn-primary text-xs py-1.5 px-3 flex-shrink-0">
                        Review Now →
                    </Link>
                </div>
            )}

            {/* Stats grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard icon={ShieldAlert} label="Open Disputes" value={stats?.open_disputes} color="bg-rose-500" to="/moderator/disputes" sub="Awaiting resolution" />
                <StatCard icon={List} label="Pending Listings" value={stats?.pending_listings} color="bg-amber-500" to="/moderator/listings" sub="Awaiting approval" />
                <StatCard icon={Users} label="Active Users" value={stats?.total_users} color="bg-brand-500" to="/moderator/users" sub="All registered accounts" />
                <StatCard icon={Eye} label="Vault Views (24h)" value={stats?.vault_views_24h} color="bg-purple-500" to="/moderator/logs" sub="Credential accesses" />
                <StatCard icon={Activity} label="Log Entries (24h)" value={stats?.log_entries_24h} color="bg-teal-500" to="/moderator/logs" sub="Total platform actions" />
                <StatCard icon={TrendingUp} label="Disputes Resolved (7d)" value={stats?.disputes_resolved_7d} color="bg-emerald-500" sub="This week" />
            </div>

            {/* Recent vault views */}
            <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Eye size={15} className="text-purple-500" />
                        Recent Vault Views
                    </h2>
                    <Link to="/moderator/logs?action=VAULT_VIEWED" className="text-xs text-brand-500 hover:underline flex items-center gap-1">
                        View all <ArrowRight size={11} />
                    </Link>
                </div>

                {recentLogs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No vault views recorded yet.</p>
                ) : (
                    <div className="space-y-0 divide-y divide-gray-50 dark:divide-gray-800">
                        {recentLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between py-3 gap-4">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        @{log.username}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate mt-0.5">{log.description}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-mono text-gray-500">{log.ip_address}</p>
                                    <p className="text-[10px] text-gray-400 flex items-center gap-1 justify-end mt-0.5">
                                        <Clock size={9} />
                                        {new Date(log.timestamp).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}