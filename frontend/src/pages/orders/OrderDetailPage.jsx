import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    ShieldCheck, Clock, CheckCircle2, AlertTriangle,
    XCircle, ChevronLeft, Lock, Upload, Flag, ExternalLink,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import StatusBadge from "../../components/ui/StatusBadge";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const STATUS_STEPS = [
    { key: "pending",      label: "Payment Pending",      icon: Clock },
    { key: "funded",       label: "Funds in Escrow",      icon: ShieldCheck },
    { key: "in_provision", label: "Credentials Uploaded", icon: Upload },
    { key: "completed",    label: "Complete",             icon: CheckCircle2 },
];
const STEP_INDEX = Object.fromEntries(STATUS_STEPS.map((s, i) => [s.key, i]));

// ── Inline dispute modal ──────────────────────────────────────────────────────
function DisputeModal({ orderId, onClose, onSuccess }) {
    const [reason,  setReason]  = useState("");
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState("");

    const handleSubmit = async () => {
        if (!reason.trim()) { setError("Please describe the problem."); return; }
        setLoading(true);
        try {
            await api.post(`/orders/${orderId}/dispute/`, { reason });
            onSuccess();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to open dispute.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <Flag size={18} className="text-red-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white">Report a Problem</h2>
                        <p className="text-xs text-gray-400">Funds will be frozen until resolved.</p>
                    </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400">
                    <strong>Before disputing:</strong> Try contacting the seller first. Disputes are reviewed by a moderator and may take 24–72 hours.
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Describe the problem *
                    </label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={4}
                        className="input resize-none text-sm"
                        placeholder="e.g. The account credentials don't work, the follower count is much lower than listed…"
                    />
                </div>

                {error && <p className="text-xs text-red-500">{error}</p>}

                <div className="flex gap-3 pt-1">
                    <button onClick={onClose}
                        className="flex-1 btn-ghost border border-gray-200 dark:border-gray-700 text-sm">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={loading}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2">
                        {loading
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><Flag size={13} /> Open Dispute</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OrderDetailPage() {
    const { id }   = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [order,        setOrder]        = useState(null);
    const [loading,      setLoading]      = useState(true);
    const [vault,        setVault]        = useState(null);
    const [vaultLoading, setVaultLoading] = useState(false);
    const [completing,   setCompleting]   = useState(false);
    const [showDispute,  setShowDispute]  = useState(false);
    const [error,        setError]        = useState("");

    const fetchOrder = () => {
        setLoading(true);
        api.get(`/orders/${id}/`)
            .then(r  => setOrder(r.data))
            .catch(() => setError("Order not found."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchOrder(); }, [id]);

    const isBuyer  = order && user?.id === order.buyer?.id;
    const isSeller = order && user?.id === order.seller?.id;

    const canDispute = order && ["funded", "in_provision"].includes(order.status?.toLowerCase());

    const handleViewCredentials = async () => {
        setVaultLoading(true);
        setError("");
        try {
            const r = await api.get(`/orders/${id}/credentials/`);
            setVault(r.data);
        } catch (err) {
            setError(err.response?.data?.error || "Could not load credentials.");
        } finally {
            setVaultLoading(false);
        }
    };

    const handleComplete = async () => {
        if (!window.confirm("Confirm the account credentials work and you're satisfied? Funds will be released to the seller.")) return;
        setCompleting(true);
        setError("");
        try {
            await api.post(`/orders/${id}/complete/`, { confirmed: true });
            fetchOrder();
        } catch (err) {
            setError(err.response?.data?.error || "Could not complete order.");
            setCompleting(false);
        }
    };

    const handleDisputeSuccess = () => {
        setShowDispute(false);
        fetchOrder();
    };

    if (loading) return <LoadingSpinner />;

    if (error && !order) return (
        <div className="text-center py-20">
            <p className="text-gray-500">{error}</p>
            <Link to="/orders" className="text-brand-500 hover:underline text-sm mt-2 inline-block">
                ← Back to Orders
            </Link>
        </div>
    );

    const status      = order.status?.toLowerCase();
    const currentStep = STEP_INDEX[status] ?? 0;
    const isDisputed  = status === "disputed";
    const isCompleted = status === "completed";
    const isCancelled = ["cancelled", "refunded"].includes(status);

    return (
        <div className="max-w-3xl mx-auto space-y-5 pb-10">

            {/* Header */}
            <div className="flex items-center gap-3">
                <button onClick={() => navigate("/orders")}
                    className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <ChevronLeft size={18} className="text-gray-600 dark:text-gray-400" />
                </button>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                        Order #{order.id?.toString().slice(0, 8).toUpperCase()}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {order.listing?.title}
                    </p>
                </div>
                <StatusBadge status={order.status} />
            </div>

            {/* Dispute banner */}
            {isDisputed && (
                <div className="card border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-amber-800 dark:text-amber-400 text-sm">
                                Dispute Under Review
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                                Funds are frozen while a moderator reviews this case. You'll be notified when a decision is made.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Cancelled banner */}
            {isCancelled && (
                <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                    <div className="flex items-center gap-3">
                        <XCircle size={18} className="text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                            This order has been {status}.
                        </p>
                    </div>
                </div>
            )}

            {/* Completed banner */}
            {isCompleted && (
                <div className="card border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                    <div className="flex items-center gap-3">
                        <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
                        <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                            Order completed successfully. Funds have been released to the seller.
                        </p>
                    </div>
                </div>
            )}

            {/* Escrow progress */}
            {!isCancelled && (
                <div className="card p-5">
                    <h2 className="font-semibold text-sm text-gray-900 dark:text-white mb-5">Escrow Progress</h2>
                    <div className="flex items-start">
                        {STATUS_STEPS.map(({ key, label, icon: Icon }, idx) => {
                            const done   = idx < currentStep;
                            const active = idx === currentStep;
                            return (
                                <div key={key} className="flex-1 flex flex-col items-center">
                                    <div className="flex items-center w-full">
                                        <div className={`flex-1 h-0.5 ${idx === 0 ? "opacity-0" : done || active ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                                            done   ? "bg-brand-500" :
                                            active ? "bg-brand-500 ring-4 ring-brand-100 dark:ring-brand-900/40" :
                                                     "bg-gray-100 dark:bg-gray-800"
                                        }`}>
                                            <Icon size={14} className={done || active ? "text-white" : "text-gray-400"} />
                                        </div>
                                        <div className={`flex-1 h-0.5 ${idx === STATUS_STEPS.length - 1 ? "opacity-0" : done ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                                    </div>
                                    <p className={`text-[10px] text-center mt-1.5 font-medium leading-tight px-1 ${
                                        active ? "text-brand-600 dark:text-brand-400" :
                                        done   ? "text-gray-700 dark:text-gray-300"   :
                                                 "text-gray-400"
                                    }`}>
                                        {label}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Order info */}
            <div className="card p-5 space-y-3">
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Order Details</h2>
                {[
                    ["Listing",    order.listing?.title],
                    ["Platform",   order.listing?.platform],
                    ["Amount",     `₦${Number(order.amount).toLocaleString()}`],
                    ["Buyer",      `@${order.buyer?.username}`],
                    ["Seller",     `@${order.seller?.username}`],
                    ["Reference",  order.paystack_reference],
                    ["Date",       new Date(order.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })],
                ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{label}</span>
                        <span className="text-gray-900 dark:text-white text-right font-medium">{value || "—"}</span>
                    </div>
                ))}
            </div>

            {/* Credentials vault — buyer only, after provisioned */}
            {isBuyer && ["in_provision", "completed", "disputed"].includes(status) && (
                <div className="card p-5">
                    <h2 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm">
                        <Lock size={14} className="text-brand-500" /> Account Credentials
                    </h2>
                    {!vault ? (
                        <button onClick={handleViewCredentials} disabled={vaultLoading}
                            className="btn-primary flex items-center gap-2">
                            {vaultLoading
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><Lock size={14} /> Reveal Credentials</>}
                        </button>
                    ) : (
                        <div className="space-y-3">
                            {[
                                ["Username",       vault.username],
                                ["Password",       vault.password],
                                ["Recovery Email", vault.oge],
                                ["Transfer Notes", vault.transfer_notes],
                            ].filter(([, v]) => v).map(([label, value]) => (
                                <div key={label} className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                                    <p className="font-mono text-sm text-gray-900 dark:text-white break-all">{value}</p>
                                </div>
                            ))}
                            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                                <AlertTriangle size={11} className="flex-shrink-0 mt-0.5" />
                                Keep these private. Change the password immediately after verifying access.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Seller: upload credentials prompt */}
            {isSeller && status === "funded" && !order.has_vault && (
                <div className="card border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-900/20 p-5">
                    <div className="flex items-start gap-3">
                        <Upload size={16} className="text-brand-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-brand-800 dark:text-brand-300 text-sm">
                                Payment received — upload credentials now
                            </p>
                            <p className="text-xs text-brand-700 dark:text-brand-400 mt-0.5">
                                The buyer has paid. Upload the account credentials to the secure vault to proceed.
                            </p>
                            <Link to={`/orders/${id}`}
                                className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline">
                                <ExternalLink size={11} /> Go to upload form
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Buyer: confirm actions */}
            {isBuyer && status === "in_provision" && (
                <div className="card p-5 space-y-3">
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Verify & Confirm</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Check the credentials work, then confirm to release payment to the seller. If there's a problem, open a dispute.
                    </p>
                    <button onClick={handleComplete} disabled={completing}
                        className="btn-primary w-full flex items-center justify-center gap-2">
                        {completing
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><CheckCircle2 size={15} /> Confirm & Release Funds</>}
                    </button>
                </div>
            )}

            {/* Report a problem */}
            {isBuyer && canDispute && (
                <div className="card border-red-100 dark:border-red-900/30 p-5">
                    <div className="flex items-start gap-3">
                        <Flag size={15} className="text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">Having a problem?</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">
                                If credentials don't work or the account isn't as described — open a dispute. Funds are frozen until a moderator resolves it.
                            </p>
                            <button onClick={() => setShowDispute(true)}
                                className="text-sm font-semibold text-red-500 hover:text-red-600 flex items-center gap-1.5 transition-colors">
                                <Flag size={13} /> Report a Problem
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="card bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 p-4">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            )}

            {/* Dispute modal */}
            {showDispute && (
                <DisputeModal
                    orderId={id}
                    onClose={() => setShowDispute(false)}
                    onSuccess={handleDisputeSuccess}
                />
            )}
        </div>
    );
}