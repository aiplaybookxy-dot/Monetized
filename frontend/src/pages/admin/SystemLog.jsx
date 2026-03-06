import { useState, useEffect, useCallback, useRef } from "react";
import { ScrollText, Search, Filter, Eye, RefreshCw, ChevronDown, X } from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

// ── Action types for the filter dropdown ─────────────────────────────────────
const ACTION_TYPES = [
    { value: "", label: "All Actions" },
    { value: "VAULT_VIEWED", label: "🔓 Vault Viewed", group: "critical" },
    { value: "VAULT_UPLOADED", label: "⬆ Vault Uploaded", group: "critical" },
    { value: "ORDER_DISPUTED", label: "⚠ Dispute Raised", group: "critical" },
    { value: "DISPUTE_RESOLVED", label: "✅ Dispute Resolved", group: "critical" },
    { value: "LOGIN", label: "🔐 Login", group: "auth" },
    { value: "REGISTER", label: "📝 Register", group: "auth" },
    { value: "PASSWORD_CHANGE", label: "🔑 Password Changed", group: "auth" },
    { value: "ORDER_CREATED", label: "📦 Order Created", group: "orders" },
    { value: "ORDER_FUNDED", label: "💰 Order Funded", group: "orders" },
    { value: "ORDER_COMPLETED", label: "✔ Order Completed", group: "orders" },
    { value: "ORDER_CANCELLED", label: "✖ Order Cancelled", group: "orders" },
    { value: "LISTING_CREATED", label: "➕ Listing Created", group: "listings" },
    { value: "LISTING_APPROVED", label: "✅ Listing Approved", group: "listings" },
    { value: "LISTING_REJECTED", label: "❌ Listing Rejected", group: "listings" },
    { value: "USER_AUDITED", label: "👁 User Audited", group: "mod" },
    { value: "USER_SUSPENDED", label: "🚫 User Suspended", group: "mod" },
];

// ── Per-action styling (tag colour) ──────────────────────────────────────────
const TAG_CLASS = {
    VAULT_VIEWED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    VAULT_UPLOADED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    ORDER_DISPUTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    DISPUTE_RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    LOGIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    REGISTER: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    PASSWORD_CHANGE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    ORDER_COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    ORDER_CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    LISTING_APPROVED: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
    LISTING_REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    USER_AUDITED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    DEFAULT: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

// ── Detail modal for a single log entry ──────────────────────────────────────
function LogDetailModal({ log, onClose }) {
    if (!log) return null;
    const tagCls = TAG_CLASS[log.action] || TAG_CLASS.DEFAULT;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
            <div
                className="relative z-10 card w-full max-w-lg p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${tagCls}`}>{log.action}</span>
                        <p className="text-sm font-mono text-gray-400 mt-2">#{log.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <button onClick={onClose} className="btn-ghost w-8 h-8 flex items-center justify-center">
                        <X size={16} />
                    </button>
                </div>

                <div className="space-y-2 text-sm">
                    {[
                        ["User", log.username],
                        ["Description", log.description || "—"],
                        ["IP Address", log.ip_address || "—"],
                        ["Object", log.object_type ? `${log.object_type} #${log.object_id?.slice(0, 8)}` : "—"],
                        ["Timestamp", new Date(log.timestamp).toLocaleString()],
                    ].map(([k, v]) => (
                        <div key={k} className="flex gap-3">
                            <span className="text-gray-400 w-24 flex-shrink-0">{k}</span>
                            <span className="text-gray-900 dark:text-white font-medium break-all">{v}</span>
                        </div>
                    ))}
                </div>

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div>
                        <p className="text-xs text-gray-400 mb-1.5">Metadata</p>
                        <pre className="bg-gray-50 dark:bg-gray-800/80 rounded-xl p-3 text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                    </div>
                )}

                {log.user_agent && (
                    <div>
                        <p className="text-xs text-gray-400 mb-1">User Agent</p>
                        <p className="text-xs text-gray-500 break-all font-mono">{log.user_agent}</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main SystemLog page ───────────────────────────────────────────────────────
export default function SystemLogPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [search, setSearch] = useState("");
    const [action, setAction] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [showFilters, setShowFilters] = useState(false);

    // Pagination
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(false);

    // Detail modal
    const [selected, setSelected] = useState(null);

    const abortRef = useRef(null);

    const fetchLogs = useCallback(async (reset = true) => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        reset ? setLoading(true) : setRefreshing(true);

        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (action) params.set("action", action);
            if (fromDate) params.set("from_date", fromDate);
            if (toDate) params.set("to_date", toDate);
            params.set("page", reset ? 1 : page);

            const r = await api.get(`/activity/logs/?${params}`, {
                signal: abortRef.current.signal,
            });

            const results = r.data.results || [];
            setLogs(reset ? results : (prev) => [...prev, ...results]);
            setHasNext(!!r.data.next);
            if (reset) setPage(1);
        } catch (e) {
            if (e.name !== "CanceledError" && e.name !== "AbortError") console.error(e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [search, action, fromDate, toDate, page]);

    useEffect(() => {
        const t = setTimeout(() => fetchLogs(true), 250);
        return () => clearTimeout(t);
    }, [search, action, fromDate, toDate]);

    const loadMore = async () => {
        const nextPage = page + 1;
        setPage(nextPage);
        setRefreshing(true);

        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (action) params.set("action", action);
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        params.set("page", nextPage);

        try {
            const r = await api.get(`/activity/logs/?${params}`);
            const results = r.data.results || [];
            setLogs((prev) => [...prev, ...results]);
            setHasNext(!!r.data.next);
        } catch { }
        setRefreshing(false);
    };

    const activeFilters = [action, fromDate, toDate].filter(Boolean).length;

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ScrollText size={20} className="text-brand-500" /> System Log
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Immutable audit trail — all critical platform actions
                    </p>
                </div>
                <button
                    onClick={() => fetchLogs(true)}
                    disabled={refreshing}
                    className="btn-ghost border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm"
                >
                    <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                    Refresh
                </button>
            </div>

            {/* Search + filter bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by username, IP address, description…"
                        className="input pl-9"
                    />
                </div>
                <div className="relative">
                    <select
                        value={action}
                        onChange={(e) => setAction(e.target.value)}
                        className="input pr-8 appearance-none cursor-pointer text-sm"
                        style={{ minWidth: 160 }}
                    >
                        {ACTION_TYPES.map((a) => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
                <button
                    onClick={() => setShowFilters((s) => !s)}
                    className={`btn-ghost border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm relative ${showFilters ? "bg-gray-100 dark:bg-gray-800" : ""}`}
                >
                    <Filter size={14} /> Date
                    {activeFilters > 0 && (
                        <span className="w-4 h-4 bg-brand-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {activeFilters}
                        </span>
                    )}
                </button>
            </div>

            {showFilters && (
                <div className="card p-4 grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">From Date</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">To Date</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input text-sm" />
                    </div>
                </div>
            )}

            {/* Log table */}
            <div className="card overflow-hidden">
                {/* Table header */}
                <div className="hidden md:grid grid-cols-[140px_120px_1fr_110px_140px] gap-4 px-4 py-2.5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-700 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Action</span>
                    <span>User</span>
                    <span>Description</span>
                    <span>IP Address</span>
                    <span>Timestamp</span>
                </div>

                {loading ? (
                    <LoadingSpinner />
                ) : logs.length === 0 ? (
                    <div className="text-center py-16">
                        <ScrollText size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm">No log entries match your filters.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                        {logs.map((log) => {
                            const tagCls = TAG_CLASS[log.action] || TAG_CLASS.DEFAULT;
                            return (
                                <button
                                    key={log.id}
                                    onClick={() => setSelected(log)}
                                    className="w-full text-left hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                                >
                                    {/* Mobile layout */}
                                    <div className="md:hidden p-4 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tagCls}`}>{log.action}</span>
                                            <span className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleString()}</span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">@{log.username}</p>
                                        <p className="text-xs text-gray-500 line-clamp-1">{log.description}</p>
                                    </div>

                                    {/* Desktop layout */}
                                    <div className="hidden md:grid grid-cols-[140px_120px_1fr_110px_140px] gap-4 px-4 py-3.5 items-center">
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-md inline-block w-fit max-w-full truncate ${tagCls}`}>
                                            {log.action}
                                        </span>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                            @{log.username}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate pr-4">
                                            {log.description || "—"}
                                        </span>
                                        <span className="text-xs font-mono text-gray-500 truncate">
                                            {log.ip_address || "—"}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Load more */}
                {hasNext && (
                    <div className="p-4 border-t border-gray-100 dark:border-gray-800 text-center">
                        <button
                            onClick={loadMore}
                            disabled={refreshing}
                            className="btn-ghost border border-gray-200 dark:border-gray-700 text-sm"
                        >
                            {refreshing ? "Loading…" : "Load more entries"}
                        </button>
                    </div>
                )}
            </div>

            {/* Notice */}
            <p className="text-xs text-gray-400 text-center">
                🔒 All log entries are immutable. Click any row to inspect full metadata.
            </p>

            {/* Detail modal */}
            <LogDetailModal log={selected} onClose={() => setSelected(null)} />
        </div>
    );
}