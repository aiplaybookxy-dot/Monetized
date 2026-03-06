/**
 * src/pages/disputes/MyDisputes.jsx
 *
 * Disputes list for the authenticated user — shows cases where
 * they are the buyer OR the seller. Both roles see the same page
 * but the data they see reflects their own involvement.
 *
 * API: GET /api/v1/disputes/mine/
 * Returns: Array of DisputeSerializer objects (buyer + seller disputes combined)
 *
 * Layout decision — list page, not master-detail:
 * Unlike the Moderator Courtroom which uses a split layout (queue + detail),
 * the user-facing list uses full-width cards that link to /disputes/:id.
 * Reason: users typically have 1–3 disputes lifetime. A split layout
 * wastes screen space for sparse data and adds complexity with no benefit.
 * Moderators manage dozens simultaneously — hence the split layout there.
 */

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    Flag, ChevronRight, Clock, CheckCircle2,
    XCircle, AlertTriangle, RefreshCw, ShieldAlert,
    MessageSquare, ArrowRight,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";


// ── Status config — maps dispute status to visual treatment ──────────────────
const STATUS_CONFIG = {
    PENDING: {
        label:     "Awaiting Review",
        icon:      Clock,
        className: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
        dot:       "bg-amber-500",
    },
    UNDER_REVIEW: {
        label:     "Under Review",
        icon:      ShieldAlert,
        className: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
        dot:       "bg-blue-500",
    },
    RESOLVED: {
        label:     "Resolved",
        icon:      CheckCircle2,
        className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
        dot:       "bg-gray-400",
    },
};

// ── Verdict config — shown on resolved disputes ───────────────────────────────
const VERDICT_CONFIG = {
    REFUNDED: {
        label:     "Refund Approved",
        className: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
    },
    RELEASED: {
        label:     "Funds Released to Seller",
        className: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    },
};


// ── Dispute Card ──────────────────────────────────────────────────────────────
function DisputeCard({ dispute, currentUser }) {
    const statusCfg  = STATUS_CONFIG[dispute.status]  || STATUS_CONFIG.PENDING;
    const verdictCfg = VERDICT_CONFIG[dispute.final_verdict];
    const StatusIcon = statusCfg.icon;

    // Determine current user's role in this dispute
    const role = currentUser?.username === dispute.buyer_username
        ? "buyer"
        : currentUser?.username === dispute.seller_username
        ? "seller"
        : "observer";

    const roleLabel = {
        buyer:    "You opened this dispute",
        seller:   "Dispute against your listing",
        observer: "Participant",
    }[role];

    const unreadMessages = dispute.messages?.length ?? 0;
    const age = Math.floor(
        (Date.now() - new Date(dispute.created_at)) / (1000 * 60 * 60)
    );
    const ageLabel = age < 1
        ? "Just now"
        : age < 24
        ? `${age}h ago`
        : `${Math.floor(age / 24)}d ago`;

    return (
        <Link
            to={`/disputes/${dispute.id}`}
            className="card p-5 flex flex-col sm:flex-row gap-4 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md transition-all duration-200 group"
        >
            {/* Left: Status indicator bar */}
            <div className={`w-1 self-stretch rounded-full flex-shrink-0 hidden sm:block ${statusCfg.dot}`} />

            {/* Center: Content */}
            <div className="flex-1 min-w-0">
                {/* Title row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate leading-snug">
                            {dispute.listing_title}
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">{roleLabel}</p>
                    </div>

                    {/* Status badge */}
                    <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${statusCfg.className}`}>
                        <StatusIcon size={10} />
                        {statusCfg.label}
                    </span>
                </div>

                {/* Reason + amount */}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <span className="flex items-center gap-1">
                        <Flag size={10} className="text-red-400" />
                        {dispute.reason_display}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                        ₦{Number(dispute.order_amount).toLocaleString()}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span>{ageLabel}</span>
                </div>

                {/* Parties */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                        {dispute.buyer_username}
                    </span>
                    <ArrowRight size={10} className="text-gray-300" />
                    <span className="font-medium text-gray-600 dark:text-gray-300">
                        {dispute.seller_username}
                    </span>
                </div>

                {/* Bottom row: verdict or message count */}
                <div className="flex items-center justify-between">
                    {verdictCfg ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${verdictCfg.className}`}>
                            {verdictCfg.label}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                            <MessageSquare size={11} />
                            {unreadMessages} {unreadMessages === 1 ? "message" : "messages"}
                        </span>
                    )}
                    {dispute.resolution_note && dispute.status === "RESOLVED" && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">
                            "{dispute.resolution_note.slice(0, 60)}..."
                        </p>
                    )}
                </div>
            </div>

            {/* Right: Chevron */}
            <div className="flex items-center flex-shrink-0">
                <ChevronRight
                    size={18}
                    className="text-gray-300 dark:text-gray-600 group-hover:text-brand-400 transition-colors"
                />
            </div>
        </Link>
    );
}


// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
    { key: "all",         label: "All" },
    { key: "PENDING",     label: "Pending" },
    { key: "UNDER_REVIEW",label: "Under Review" },
    { key: "RESOLVED",    label: "Resolved" },
];


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyDisputesPage() {
    const { user }                      = useAuth();
    const [disputes, setDisputes]       = useState([]);
    const [loading, setLoading]         = useState(true);
    const [refreshing, setRefreshing]   = useState(false);
    const [filter, setFilter]           = useState("all");
    const [error, setError]             = useState("");

    const fetchDisputes = useCallback(async (isRefresh = false) => {
        isRefresh ? setRefreshing(true) : setLoading(true);
        setError("");
        try {
            const r = await api.get("/disputes/mine/");
            setDisputes(r.data?.results ?? r.data ?? []);
        } catch {
            setError("Could not load disputes. Please try again.");
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

    // Apply filter
    const filtered = filter === "all"
        ? disputes
        : disputes.filter((d) => d.status === filter);

    // Counts for filter tabs
    const counts = FILTERS.reduce((acc, f) => {
        acc[f.key] = f.key === "all"
            ? disputes.length
            : disputes.filter((d) => d.status === f.key).length;
        return acc;
    }, {});

    const activeCount  = disputes.filter((d) => d.status !== "RESOLVED").length;
    const resolvedCount = disputes.filter((d) => d.status === "RESOLVED").length;

    if (loading) return <LoadingSpinner />;

    return (
        <div className="max-w-3xl mx-auto space-y-6">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                            <Flag size={16} className="text-red-500" />
                        </div>
                        My Disputes
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {activeCount > 0
                            ? `${activeCount} active ${activeCount === 1 ? "case" : "cases"} · ${resolvedCount} resolved`
                            : disputes.length > 0
                            ? "All disputes have been resolved"
                            : "No disputes on your account"
                        }
                    </p>
                </div>

                <button
                    onClick={() => fetchDisputes(true)}
                    disabled={refreshing}
                    className="btn-ghost border border-gray-200 dark:border-gray-700 p-2.5 rounded-xl flex-shrink-0"
                    title="Refresh"
                >
                    <RefreshCw
                        size={15}
                        className={refreshing ? "animate-spin text-brand-500" : "text-gray-400"}
                    />
                </button>
            </div>

            {/* ── Error ───────────────────────────────────────────────────── */}
            {error && (
                <div className="card border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                    <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                        <AlertTriangle size={14} /> {error}
                    </p>
                </div>
            )}

            {/* ── Empty state ──────────────────────────────────────────────── */}
            {!error && disputes.length === 0 && (
                <div className="card p-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">
                        No disputes
                    </p>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">
                        All your transactions have gone smoothly. Disputes appear here if you or a buyer reports a problem with an order.
                    </p>
                    <Link
                        to="/orders"
                        className="inline-flex items-center gap-2 mt-5 text-sm font-medium text-brand-500 hover:text-brand-600"
                    >
                        View My Orders <ArrowRight size={14} />
                    </Link>
                </div>
            )}

            {/* ── Filter tabs ──────────────────────────────────────────────── */}
            {disputes.length > 0 && (
                <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800">
                    {FILTERS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                                filter === key
                                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >
                            {label}
                            {counts[key] > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    filter === key
                                        ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                                }`}>
                                    {counts[key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Dispute list ─────────────────────────────────────────────── */}
            {disputes.length > 0 && (
                <div className="space-y-3">
                    {filtered.length === 0 ? (
                        <div className="card p-10 text-center">
                            <p className="text-sm text-gray-400">
                                No disputes with status "{FILTERS.find(f => f.key === filter)?.label}".
                            </p>
                        </div>
                    ) : (
                        filtered.map((dispute) => (
                            <DisputeCard
                                key={dispute.id}
                                dispute={dispute}
                                currentUser={user}
                            />
                        ))
                    )}
                </div>
            )}

            {/* ── Info note ────────────────────────────────────────────────── */}
            {disputes.length > 0 && (
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-400 leading-relaxed">
                        <strong className="text-gray-600 dark:text-gray-300">How disputes work:</strong>{" "}
                        When a dispute is opened, funds are frozen and a moderator reviews the case.
                        Both parties can submit evidence and chat in the dispute room.
                        The moderator's verdict is final and immutably logged.
                    </p>
                </div>
            )}
        </div>
    );
}