/**
 * src/pages/admin/Withdrawals.jsx
 * Seller withdrawal request approval queue.
 * Endpoints:
 *   GET   /api/v1/admin/withdrawals/
 *   POST  /api/v1/admin/withdrawals/<id>/approve/
 *   POST  /api/v1/admin/withdrawals/<id>/reject/
 */
import { useEffect, useState } from "react";
import {
    Wallet, CheckCircle, XCircle, Clock, RefreshCw,
    Search, ChevronDown, AlertCircle, User, Copy, Check
} from "lucide-react";
import api from "../../services/api";

function fmt(n) {
    return `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

const STATUS_STYLE = {
    pending:  "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    approved: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    rejected: "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",
    processing: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
};

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button onClick={copy} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-gray-400" />}
        </button>
    );
}

function WithdrawalRow({ w, onAction }) {
    const [loading, setLoading] = useState(false);
    const [note, setNote]       = useState("");
    const [open, setOpen]       = useState(false);

    const act = async (type) => {
        setLoading(true);
        try {
            await onAction(w.id, type, note);
        } finally {
            setLoading(false);
            setOpen(false);
        }
    };

    const statusStyle = STATUS_STYLE[w.status] || STATUS_STYLE.pending;
    const isPending   = w.status === "pending";

    return (
        <div className="card p-4 space-y-3">
            {/* Top row */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                        <User size={15} className="text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                            {w.seller_username}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{w.seller_email}</p>
                    </div>
                </div>
                <div className="flex-shrink-0 text-right">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{fmt(w.amount)}</p>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusStyle}`}>
                        {w.status}
                    </span>
                </div>
            </div>

            {/* Bank details */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Bank</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{w.bank_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Account</span>
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-mono text-gray-700 dark:text-gray-300">{w.account_number || "—"}</span>
                        {w.account_number && <CopyButton text={w.account_number} />}
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Account Name</span>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{w.account_name || "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Requested</span>
                    <span className="text-xs text-gray-500">
                        {w.created_at ? new Date(w.created_at).toLocaleString() : "—"}
                    </span>
                </div>
            </div>

            {/* Actions — only for pending */}
            {isPending && (
                <div>
                    {open && (
                        <div className="mb-3">
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Optional note (shown to seller)…"
                                rows={2}
                                className="input text-sm resize-none"
                            />
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setOpen(true); act("approve"); }}
                            disabled={loading}
                            className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <CheckCircle size={13} />
                            {loading ? "Processing…" : "Approve & Pay"}
                        </button>
                        <button
                            onClick={() => setOpen(v => !v)}
                            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                        <button
                            onClick={() => act("reject")}
                            disabled={loading}
                            className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <XCircle size={13} />
                            Reject
                        </button>
                    </div>
                </div>
            )}

            {/* Rejection note */}
            {w.status === "rejected" && w.rejection_note && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/10 rounded-xl p-3">
                    <AlertCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-600 dark:text-red-400">{w.rejection_note}</p>
                </div>
            )}
        </div>
    );
}

export default function WithdrawalsPage() {
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading]         = useState(true);
    const [filter, setFilter]           = useState("pending");
    const [search, setSearch]           = useState("");
    const [error, setError]             = useState("");

    const load = () => {
        setLoading(true);
        setError("");
        api.get(`/admin/withdrawals/?status=${filter}`)
            .then(r => setWithdrawals(r.data?.results ?? r.data ?? []))
            .catch(() => setError("Failed to load withdrawals."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [filter]);

    const handleAction = async (id, type, note) => {
        try {
            await api.post(`/admin/withdrawals/${id}/${type}/`, { note });
            load();
        } catch (e) {
            alert(e.response?.data?.error || `Failed to ${type} withdrawal.`);
        }
    };

    const filtered = withdrawals.filter(w =>
        !search ||
        w.seller_username?.toLowerCase().includes(search.toLowerCase()) ||
        w.seller_email?.toLowerCase().includes(search.toLowerCase())
    );

    const TABS = ["pending", "approved", "rejected"];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Withdrawal Requests</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Review and approve seller payout requests
                    </p>
                </div>
                <button onClick={load} className="btn-ghost text-sm flex items-center gap-2">
                    <RefreshCw size={14} /> Refresh
                </button>
            </div>

            {/* Tabs + Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
                    {TABS.map(t => (
                        <button
                            key={t}
                            onClick={() => setFilter(t)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                                filter === t
                                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by seller…"
                        className="input pl-9 text-sm"
                    />
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <RefreshCw size={20} className="animate-spin text-brand-500" />
                </div>
            ) : error ? (
                <div className="card p-8 text-center">
                    <p className="text-red-500 text-sm">{error}</p>
                    <button onClick={load} className="btn-primary mt-4 text-sm">Retry</button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card p-12 text-center">
                    <Wallet size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No {filter} withdrawal requests.
                    </p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filtered.map(w => (
                        <WithdrawalRow key={w.id} w={w} onAction={handleAction} />
                    ))}
                </div>
            )}
        </div>
    );
}