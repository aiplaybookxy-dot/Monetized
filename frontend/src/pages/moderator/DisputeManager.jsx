import { useState, useEffect } from "react";
import {
    ShieldAlert, Clock, Eye, CheckCircle2,
    XCircle, MessageSquare, Lock, ChevronRight,
    AlertTriangle, User, DollarSign, RefreshCw,
} from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

/**
 * src/pages/moderator/DisputeManager.jsx — The Courtroom
 *
 * Architecture:
 * - DisputeList: queue of all active disputes (FIFO — oldest first)
 * - DisputeCourtroom: full case detail — chat, evidence, vault, verdict
 *
 * Security:
 * - Vault credentials only requested explicitly (never auto-fetched)
 * - Every vault click triggers backend ActivityLog entry (enforced server-side)
 * - Verdict submission requires confirmation dialog (prevent accidental clicks)
 * - Resolution is irreversible — UI makes this clear before submission
 */

// ── Dispute Queue ─────────────────────────────────────────────────────────────

function DisputeQueue({ disputes, selected, onSelect }) {
    if (disputes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
                <CheckCircle2 size={40} className="text-emerald-400 mb-3" />
                <p className="font-semibold text-gray-900 dark:text-white">All Clear</p>
                <p className="text-sm text-gray-400 mt-1">No active disputes in the queue.</p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {disputes.map((d) => {
                const isSelected = selected?.id === d.id;
                const age = Math.floor((Date.now() - new Date(d.created_at)) / 3600000);
                return (
                    <button
                        key={d.id}
                        onClick={() => onSelect(d)}
                        className={`w-full text-left px-4 py-4 transition-colors ${
                            isSelected
                                ? "bg-brand-50 dark:bg-brand-900/20"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                {d.listing_title}
                            </p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                d.status === "UNDER_REVIEW"
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                            }`}>
                                {d.status === "UNDER_REVIEW" ? "IN REVIEW" : "PENDING"}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                            {d.buyer_username} vs {d.seller_username}
                        </p>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">
                                ₦{Number(d.order_amount).toLocaleString()} · {d.reason_display}
                            </span>
                            <span className={`text-[10px] font-medium ${age > 24 ? "text-red-500" : "text-gray-400"}`}>
                                {age < 1 ? "< 1h ago" : `${age}h ago`}
                                {age > 24 && " ⚠️"}
                            </span>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 dark:text-gray-600 mt-1 ml-auto" />
                    </button>
                );
            })}
        </div>
    );
}


// ── Courtroom Detail ──────────────────────────────────────────────────────────

function Courtroom({ dispute, onResolved }) {
    const [vault, setVault]           = useState(null);
    const [vaultLoading, setVaultLoading] = useState(false);
    const [message, setMessage]       = useState("");
    const [sending, setSending]       = useState(false);
    const [messages, setMessages]     = useState(dispute.messages || []);
    const [verdict, setVerdict]       = useState("");
    const [note, setNote]             = useState("");
    const [resolving, setResolving]   = useState(false);
    const [error, setError]           = useState("");
    const [showVerdictForm, setShowVerdictForm] = useState(false);

    const fetchVault = async () => {
        setVaultLoading(true);
        setError("");
        try {
            const r = await api.get(`/disputes/${dispute.id}/vault/`);
            setVault(r.data);
        } catch (err) {
            setError(err.response?.data?.error || "Could not load vault credentials.");
        } finally {
            setVaultLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!message.trim()) return;
        setSending(true);
        try {
            const r = await api.post(`/disputes/${dispute.id}/messages/`, { body: message });
            setMessages((prev) => [...prev, r.data]);
            setMessage("");
        } catch (err) {
            setError(err.response?.data?.error || "Failed to send message.");
        } finally {
            setSending(false);
        }
    };

    const handleResolve = async () => {
        if (!verdict) { setError("Select a verdict."); return; }
        if (note.length < 10) { setError("Please provide a resolution note (min 10 characters)."); return; }

        const action = verdict === "RELEASED" ? "release funds to the seller" : "refund the buyer";
        if (!window.confirm(`⚠️ FINAL ACTION: Are you sure you want to ${action}? This cannot be undone.`)) return;

        setResolving(true);
        setError("");
        try {
            await api.post(`/disputes/${dispute.id}/resolve/`, {
                verdict,
                resolution_note: note,
            });
            onResolved();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to resolve dispute.");
        } finally {
            setResolving(false);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Case Header */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-amber-50 dark:bg-amber-900/10">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white text-sm">
                            {dispute.listing_title}
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Buyer: <strong>{dispute.buyer_username}</strong> · Seller: <strong>{dispute.seller_username}</strong>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Amount in Escrow: <strong className="text-gray-900 dark:text-white">₦{Number(dispute.order_amount).toLocaleString()}</strong>
                            · Reason: <strong>{dispute.reason_display}</strong>
                        </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 flex-shrink-0">
                        DISPUTED
                    </span>
                </div>

                {/* Dispute description */}
                <div className="mt-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Buyer's Statement</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{dispute.description}</p>
                </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* Evidence */}
                {dispute.evidence?.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                            Evidence ({dispute.evidence.length} files)
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {dispute.evidence.map((e) => (
                                <a
                                    key={e.id}
                                    href={e.file}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-brand-400 transition-colors group"
                                >
                                    {e.file.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                                        <img
                                            src={e.file}
                                            alt={e.caption}
                                            className="w-full h-20 object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-20 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                                            <span className="text-xs text-gray-400">📄 PDF</span>
                                        </div>
                                    )}
                                    {e.caption && (
                                        <p className="text-[10px] text-gray-400 p-1.5 truncate">{e.caption}</p>
                                    )}
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Vault Access — Moderator Only */}
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Lock size={12} className="text-brand-500" /> Escrow Vault
                        </p>
                        {!vault && (
                            <button
                                onClick={fetchVault}
                                disabled={vaultLoading}
                                className="text-xs font-semibold text-brand-500 hover:text-brand-600 flex items-center gap-1.5"
                            >
                                {vaultLoading
                                    ? <div className="w-3 h-3 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                                    : <><Eye size={11} /> View Credentials</>
                                }
                            </button>
                        )}
                    </div>
                    {!vault && (
                        <p className="text-[11px] text-gray-400">
                            Credentials are encrypted. Clicking "View" logs your access permanently for accountability.
                        </p>
                    )}
                    {vault && (
                        <div className="space-y-2">
                            {[
                                ["Username",       vault.username],
                                ["Password",       vault.password],
                                ["Recovery Email", vault.oge],
                                ["Notes",          vault.transfer_notes],
                            ].filter(([, v]) => v).map(([label, val]) => (
                                <div key={label} className="flex items-start gap-3 text-xs">
                                    <span className="text-gray-400 w-24 flex-shrink-0">{label}</span>
                                    <span className="font-mono text-gray-900 dark:text-white break-all">{val}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Chat Thread */}
                <div>
                    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
                        Dispute Chat ({messages.length} messages)
                    </p>
                    <div className="space-y-2">
                        {messages.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No messages yet.</p>
                        )}
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`p-3 rounded-xl text-xs ${
                                    msg.is_mod_note
                                        ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className={`font-semibold ${msg.is_mod_note ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                                        {msg.is_mod_note ? "🛡️ Moderator" : msg.sender_username}
                                        {msg.sender_role && !msg.is_mod_note && (
                                            <span className="text-gray-400 font-normal"> ({msg.sender_role})</span>
                                        )}
                                    </span>
                                    <span className="text-gray-400">
                                        {new Date(msg.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{msg.body}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom panel — message input + verdict */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                {error && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                        <AlertTriangle size={12} /> {error}
                    </p>
                )}

                {/* Post message */}
                <div className="flex gap-2">
                    <input
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                        placeholder="Post a moderator note to the chat..."
                        className="input flex-1 text-sm"
                    />
                    <button
                        onClick={sendMessage}
                        disabled={sending || !message.trim()}
                        className="btn-primary px-3 flex-shrink-0"
                    >
                        <MessageSquare size={15} />
                    </button>
                </div>

                {/* Verdict Section */}
                {!showVerdictForm ? (
                    <button
                        onClick={() => setShowVerdictForm(true)}
                        className="w-full py-2.5 border border-brand-300 dark:border-brand-700 text-brand-600 dark:text-brand-400 font-semibold rounded-xl text-sm hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                    >
                        Deliver Verdict
                    </button>
                ) : (
                    <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                            ⚖️ Final Verdict — Irreversible
                        </p>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setVerdict("RELEASED")}
                                className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                                    verdict === "RELEASED"
                                        ? "bg-emerald-500 text-white border-emerald-500"
                                        : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-emerald-400"
                                }`}
                            >
                                <DollarSign size={14} className="mx-auto mb-1" />
                                Release to Seller
                            </button>
                            <button
                                onClick={() => setVerdict("REFUNDED")}
                                className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                                    verdict === "REFUNDED"
                                        ? "bg-red-500 text-white border-red-500"
                                        : "border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-red-400"
                                }`}
                            >
                                <XCircle size={14} className="mx-auto mb-1" />
                                Refund Buyer
                            </button>
                        </div>

                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            placeholder="Explain your decision clearly. This is shown to both parties and logged permanently..."
                            className="input resize-none text-sm"
                        />

                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowVerdictForm(false)}
                                className="flex-1 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolve}
                                disabled={resolving || !verdict || note.length < 10}
                                className={`flex-1 py-2 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors ${
                                    verdict === "RELEASED"
                                        ? "bg-emerald-500 hover:bg-emerald-600"
                                        : verdict === "REFUNDED"
                                        ? "bg-red-500 hover:bg-red-600"
                                        : "bg-gray-300 dark:bg-gray-700 cursor-not-allowed"
                                }`}
                            >
                                {resolving
                                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : "Confirm Verdict"
                                }
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}


// ── Main DisputeManager Page ──────────────────────────────────────────────────

export default function DisputeManager() {
    const [disputes, setDisputes]     = useState([]);
    const [selected, setSelected]     = useState(null);
    const [loading, setLoading]       = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDisputes = async (isRefresh = false) => {
        isRefresh ? setRefreshing(true) : setLoading(true);
        try {
            const r = await api.get("/mod/disputes/");
            const list = r.data.results ?? r.data;
            setDisputes(list);
            // Auto-select first if nothing selected
            if (!selected && list.length > 0) setSelected(list[0]);
        } catch {
            // Errors handled silently — moderator sees empty state
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchDisputes(); }, []);

    const onResolved = () => {
        setSelected(null);
        fetchDisputes(true);
    };

    if (loading) return <LoadingSpinner />;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <ShieldAlert size={18} className="text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                            Dispute Courtroom
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {disputes.length} active {disputes.length === 1 ? "case" : "cases"} · FIFO queue
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => fetchDisputes(true)}
                    disabled={refreshing}
                    className="btn-ghost border border-gray-200 dark:border-gray-700 p-2 rounded-xl"
                >
                    <RefreshCw size={15} className={refreshing ? "animate-spin text-brand-500" : "text-gray-400"} />
                </button>
            </div>

            {/* Two-column courtroom layout */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-900" style={{ height: "calc(100vh - 200px)" }}>
                <div className="flex h-full">
                    {/* Left: Queue */}
                    <div className="w-72 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 overflow-y-auto">
                        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
                                <Clock size={11} /> Case Queue
                            </p>
                        </div>
                        <DisputeQueue
                            disputes={disputes}
                            selected={selected}
                            onSelect={setSelected}
                        />
                    </div>

                    {/* Right: Courtroom */}
                    <div className="flex-1 min-w-0">
                        {selected ? (
                            <Courtroom
                                key={selected.id}
                                dispute={selected}
                                onResolved={onResolved}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-center px-8">
                                <ShieldAlert size={40} className="text-gray-200 dark:text-gray-700 mb-3" />
                                <p className="font-semibold text-gray-400 dark:text-gray-600">
                                    Select a case to begin review
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}