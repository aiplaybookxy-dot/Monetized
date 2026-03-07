/**
 * src/pages/wallet/Wallet.jsx
 *
 * Seller withdrawal & balance dashboard.
 *
 * Sections:
 *  1. Balance card  — total_earned / bond reserved / available
 *  2. Active banner — shown when a PENDING/PROCESSING request exists
 *  3. Withdrawal form — collapsible, bank + amount
 *  4. History table — all past requests with status badges
 *
 * API:
 *  GET  /api/v1/auth/me/           → user balance fields (total_earned, seller_bond)
 *  GET  /api/v1/withdrawals/mine/  → seller's own withdrawal history  ← NEW backend endpoint
 *  POST /api/v1/admin/withdrawals/ → submit new request
 *  GET  /api/v1/platform/config/   → min_withdrawal_amount
 */
import { useState, useEffect, useCallback } from "react";
import {
    Wallet2, ArrowDownCircle, Clock, CheckCircle, XCircle,
    AlertTriangle, RefreshCw, Banknote, Lock, ChevronDown,
    ChevronUp, Info, CreditCard,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n) =>
    `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

function timeAgo(dateStr) {
    if (!dateStr) return "";
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
    PENDING:    { label: "Pending Review",  color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-900/20",     icon: Clock       },
    PROCESSING: { label: "Processing",      color: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-900/20",       icon: RefreshCw   },
    APPROVED:   { label: "Approved",        color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: CheckCircle },
    REJECTED:   { label: "Rejected",        color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/20",         icon: XCircle     },
};

// ── Balance card ──────────────────────────────────────────────────────────────
function BalanceCard({ user, minWithdrawal }) {
    const total     = parseFloat(user.total_earned  || 0);
    const bond      = parseFloat(user.seller_bond   || 0);
    const available = Math.max(0, total - bond);

    return (
        <div className="card p-0 overflow-hidden">
            {/* Gradient header */}
            <div className="px-6 py-5 bg-gradient-to-r from-brand-500 to-brand-600">
                <div className="flex items-center gap-2 mb-1">
                    <Wallet2 size={16} className="text-brand-100" />
                    <span className="text-brand-100 text-xs font-semibold uppercase tracking-wide">
                        Seller Wallet
                    </span>
                </div>
                <p className="text-3xl font-black text-white">{fmt(available)}</p>
                <p className="text-brand-200 text-xs mt-0.5">Available to withdraw</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800">
                <div className="p-4 text-center">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(total)}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Total Earned</p>
                </div>
                <div className="p-4 text-center">
                    <p className={`text-sm font-bold ${bond > 0 ? "text-amber-500" : "text-gray-400"}`}>
                        {fmt(bond)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center justify-center gap-1">
                        {bond > 0 && <Lock size={10} />} Bond Reserved
                    </p>
                </div>
                <div className="p-4 text-center">
                    <p className={`text-sm font-bold ${available >= minWithdrawal ? "text-emerald-500" : "text-gray-400"}`}>
                        {fmt(available)}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">Available</p>
                </div>
            </div>

            {/* Min withdrawal note */}
            {available < minWithdrawal && (
                <div className="px-5 pb-4">
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <Info size={11} />
                        Minimum withdrawal is {fmt(minWithdrawal)}.
                        You need {fmt(minWithdrawal - available)} more.
                    </p>
                </div>
            )}
        </div>
    );
}

// ── Active request banner ─────────────────────────────────────────────────────
function ActiveRequestBanner({ request }) {
    const cfg  = STATUS[request.status] || STATUS.PENDING;
    const Icon = cfg.icon;

    const borderColor = {
        PENDING:    "border-amber-200 dark:border-amber-800",
        PROCESSING: "border-blue-200 dark:border-blue-800",
        APPROVED:   "border-emerald-200 dark:border-emerald-800",
        REJECTED:   "border-red-200 dark:border-red-800",
    }[request.status] || "border-gray-200 dark:border-gray-700";

    return (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.bg} ${borderColor}`}>
            <Icon size={16} className={`${cfg.color} flex-shrink-0 mt-0.5`} />
            <div className="flex-1">
                <p className={`text-sm font-semibold ${cfg.color}`}>
                    {request.status === "PENDING"    && "Withdrawal Pending Review"}
                    {request.status === "PROCESSING" && "Withdrawal Being Processed"}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {fmt(request.amount)} → {request.bank_name} · {request.account_number}
                    <span className="ml-2">· {timeAgo(request.created_at)}</span>
                </p>
                {request.status === "PENDING" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        You cannot submit another request until this one is reviewed.
                    </p>
                )}
            </div>
        </div>
    );
}

// ── Withdrawal form ───────────────────────────────────────────────────────────
function WithdrawalForm({ user, minWithdrawal, onSuccess, hasActive }) {
    const available = Math.max(0, parseFloat(user.total_earned || 0) - parseFloat(user.seller_bond || 0));

    const [form, setForm] = useState({
        amount: "", bank_name: "", bank_code: "",
        account_number: "", account_name: "",
    });
    const [open,    setOpen]    = useState(false);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState("");
    const [success, setSuccess] = useState("");

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async () => {
        setError(""); setSuccess("");
        const amount = parseFloat(form.amount);
        if (!amount || amount < minWithdrawal) { setError(`Minimum is ${fmt(minWithdrawal)}.`); return; }
        if (amount > available) { setError("Exceeds available balance."); return; }
        if (!form.bank_name || !form.account_number || !form.account_name) {
            setError("Bank name, account number, and account name are required."); return;
        }
        setLoading(true);
        try {
            await api.post("/admin/withdrawals/", {
                amount: form.amount, bank_name: form.bank_name, bank_code: form.bank_code,
                account_number: form.account_number, account_name: form.account_name,
            });
            setSuccess("Request submitted. The platform owner will review it within 24 hours.");
            setForm({ amount: "", bank_name: "", bank_code: "", account_number: "", account_name: "" });
            setOpen(false);
            onSuccess();
        } catch (err) {
            const data = err.response?.data;
            setError(typeof data === "object" ? Object.values(data).flat().join(" · ") : "Failed to submit.");
        } finally {
            setLoading(false);
        }
    };

    const canWithdraw = available >= minWithdrawal && !hasActive;

    return (
        <div className="card overflow-hidden">
            <button
                onClick={() => setOpen((o) => !o)}
                disabled={!canWithdraw}
                className="w-full flex items-center justify-between px-5 py-4 disabled:opacity-50 text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                        <ArrowDownCircle size={16} className="text-brand-500" />
                    </div>
                    <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {hasActive ? "Request Already Submitted" : "Request Withdrawal"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {hasActive ? "Awaiting platform review"
                                : canWithdraw ? `${fmt(available)} available`
                                : `Below minimum of ${fmt(minWithdrawal)}`}
                        </p>
                    </div>
                </div>
                {!hasActive && (open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />)}
            </button>

            {open && !hasActive && (
                <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
                    {success && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm">
                            <CheckCircle size={14} className="flex-shrink-0 mt-0.5" /> {success}
                        </div>
                    )}
                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /> {error}
                        </div>
                    )}

                    {/* Amount */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                            Amount (₦) *
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">₦</span>
                            <input type="number" min={minWithdrawal} max={available} step="0.01"
                                value={form.amount} onChange={set("amount")}
                                placeholder={`Min ${fmt(minWithdrawal)}`}
                                className="w-full pl-7 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                        <div className="flex justify-between mt-1.5">
                            <p className="text-[11px] text-gray-400">Available: {fmt(available)}</p>
                            <button type="button" onClick={() => setForm((f) => ({ ...f, amount: available.toFixed(2) }))}
                                className="text-[11px] text-brand-500 hover:underline font-semibold">Max</button>
                        </div>
                    </div>

                    {/* Bank name */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Bank Name *</label>
                        <input type="text" value={form.bank_name} onChange={set("bank_name")}
                            placeholder="e.g. GTBank, Access Bank, Opay"
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    </div>

                    {/* Account number + code */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Account Number *</label>
                            <input type="text" maxLength={10} value={form.account_number} onChange={set("account_number")}
                                placeholder="0123456789"
                                className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Bank Code <span className="text-gray-400">(optional)</span></label>
                            <input type="text" maxLength={6} value={form.bank_code} onChange={set("bank_code")}
                                placeholder="058"
                                className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                            />
                        </div>
                    </div>

                    {/* Account name */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Account Name *</label>
                        <input type="text" value={form.account_name} onChange={set("account_name")}
                            placeholder="As shown on your bank account"
                            className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                    </div>

                    {/* Note */}
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                        <Info size={12} className="text-gray-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-gray-400">
                            Requests are reviewed manually and processed within 24 hours.
                            Bank code enables automated Paystack transfer.
                        </p>
                    </div>

                    <button onClick={handleSubmit} disabled={loading}
                        className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                        {loading
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><ArrowDownCircle size={14} /> Submit Withdrawal Request</>
                        }
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Withdrawal history ────────────────────────────────────────────────────────
function WithdrawalHistory({ requests, loading }) {
    if (loading) return (
        <div className="card p-8 flex items-center justify-center">
            <RefreshCw size={18} className="animate-spin text-gray-400" />
        </div>
    );

    return (
        <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <CreditCard size={15} className="text-brand-500" />
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Withdrawal History</h2>
                <span className="ml-auto text-xs text-gray-400">
                    {requests.length} request{requests.length !== 1 ? "s" : ""}
                </span>
            </div>

            {requests.length === 0 ? (
                <div className="py-12 text-center">
                    <Banknote size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No withdrawals yet</p>
                    <p className="text-xs text-gray-400 mt-1">Your withdrawal requests will appear here.</p>
                </div>
            ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {requests.map((req) => {
                        const cfg  = STATUS[req.status] || STATUS.PENDING;
                        const Icon = cfg.icon;
                        return (
                            <div key={req.id} className="px-5 py-4 flex items-start gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                                    <Icon size={14} className={cfg.color} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {fmt(req.amount)}
                                        </p>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {req.bank_name} · {req.account_number} · {timeAgo(req.created_at)}
                                    </p>
                                    {req.status === "REJECTED" && req.rejection_reason && (
                                        <p className="text-xs text-red-500 mt-1">
                                            Reason: {req.rejection_reason}
                                        </p>
                                    )}
                                    {req.paystack_transfer_ref && (
                                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                            Ref: {req.paystack_transfer_ref}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WalletPage() {
    const { user } = useAuth();

    const [withdrawals,   setWithdrawals]   = useState([]);
    const [minWithdrawal, setMinWithdrawal] = useState(5000);
    const [wLoading,      setWLoading]      = useState(true);
    const [error,         setError]         = useState("");

    const loadWithdrawals = useCallback(async () => {
        setWLoading(true);
        try {
            const r = await api.get("/withdrawals/mine/");
            setWithdrawals(r.data?.results ?? r.data ?? []);
        } catch {
            setError("Could not load withdrawal history.");
        } finally {
            setWLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWithdrawals();
        api.get("/platform/config/")
            .then((r) => setMinWithdrawal(parseFloat(r.data.min_withdrawal_amount || 5000)))
            .catch(() => {});
    }, [loadWithdrawals]);

    const handleSuccess = () => loadWithdrawals();

    const activeRequest = withdrawals.find(
        (w) => w.status === "PENDING" || w.status === "PROCESSING"
    );

    if (!user) return null;

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Wallet</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Manage your earnings and request withdrawals
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
                    <AlertTriangle size={13} /> {error}
                </div>
            )}

            <BalanceCard user={user} minWithdrawal={minWithdrawal} />
            {activeRequest && <ActiveRequestBanner request={activeRequest} />}
            <WithdrawalForm
                user={user}
                minWithdrawal={minWithdrawal}
                onSuccess={handleSuccess}
                hasActive={!!activeRequest}
            />
            <WithdrawalHistory requests={withdrawals} loading={wLoading} />
        </div>
    );
}