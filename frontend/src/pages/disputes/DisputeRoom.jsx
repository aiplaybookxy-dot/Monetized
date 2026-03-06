/**
 * src/pages/disputes/DisputeRoom.jsx
 *
 * The user-facing dispute detail page. Accessible by:
 *   - The buyer (who opened the dispute)
 *   - The seller (whose listing is disputed)
 *
 * NOT the same as the Moderator Courtroom (/moderator/disputes):
 *   - No vault access (credentials only visible via order page)
 *   - No verdict actions (read-only for resolved disputes)
 *   - No case queue (single dispute context)
 *   - Focused on communication + evidence — not adjudication
 *
 * Layout: Single-column, mobile-first.
 * The Courtroom is split-panel for mods managing many cases simultaneously.
 * Users are looking at exactly one dispute — single column is cleaner.
 *
 * API calls:
 *   GET  /api/v1/disputes/<id>/          → dispute detail + messages + evidence
 *   POST /api/v1/disputes/<id>/messages/ → send message
 *   POST /api/v1/disputes/<id>/evidence/ → upload evidence file
 *
 * Polling: Messages poll every 15s.
 * WHY polling and not WebSocket: WebSockets require a separate ASGI server
 * (Daphne/Uvicorn). Gunicorn serves WSGI only. For a dispute room used by
 * 2–3 people max, 15s polling is imperceptible in UX and requires zero
 * infrastructure changes. WebSockets are the right call at scale — not here.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
    Flag, ChevronLeft, MessageSquare, Upload,
    Clock, CheckCircle2, ShieldAlert, AlertTriangle,
    ExternalLink, Image, FileText, Send, X,
    Lock, User, ArrowRight,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";


// ── Status + Verdict display maps ─────────────────────────────────────────────
const STATUS_DISPLAY = {
    PENDING:      { label: "Awaiting Moderator",  color: "text-amber-600 dark:text-amber-400",   bg: "bg-amber-50 dark:bg-amber-900/20",  icon: Clock },
    UNDER_REVIEW: { label: "Under Review",        color: "text-blue-600 dark:text-blue-400",     bg: "bg-blue-50 dark:bg-blue-900/20",    icon: ShieldAlert },
    RESOLVED:     { label: "Resolved",            color: "text-gray-600 dark:text-gray-400",     bg: "bg-gray-50 dark:bg-gray-800/60",    icon: CheckCircle2 },
};

const VERDICT_DISPLAY = {
    REFUNDED: {
        label: "Refund Approved",
        desc:  "The moderator ruled in favour of the buyer. A refund has been processed.",
        bg:    "bg-emerald-50 dark:bg-emerald-900/20",
        border:"border-emerald-200 dark:border-emerald-800",
        color: "text-emerald-700 dark:text-emerald-400",
        icon:  CheckCircle2,
    },
    RELEASED: {
        label: "Funds Released to Seller",
        desc:  "The moderator ruled in favour of the seller. Funds have been released.",
        bg:    "bg-purple-50 dark:bg-purple-900/20",
        border:"border-purple-200 dark:border-purple-800",
        color: "text-purple-700 dark:text-purple-400",
        icon:  CheckCircle2,
    },
};


// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message, currentUsername }) {
    const isOwn = message.sender_username === currentUsername;
    const isMod = message.is_mod_note;
    const time  = new Date(message.created_at).toLocaleTimeString([], {
        hour: "2-digit", minute: "2-digit",
    });
    const date  = new Date(message.created_at).toLocaleDateString([], {
        day: "numeric", month: "short",
    });

    // Moderator messages — full-width, distinct styling
    if (isMod) {
        return (
            <div className="flex justify-center my-2">
                <div className="max-w-lg w-full px-4 py-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <ShieldAlert size={12} className="text-blue-600 dark:text-blue-400" />
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                            Moderator Note
                        </span>
                        <span className="text-[10px] text-blue-400 ml-auto">{date} · {time}</span>
                    </div>
                    <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
                        {message.body}
                    </p>
                </div>
            </div>
        );
    }

    // Own message — right-aligned
    if (isOwn) {
        return (
            <div className="flex justify-end">
                <div className="max-w-sm">
                    <div className="bg-brand-500 text-white px-4 py-2.5 rounded-2xl rounded-tr-sm">
                        <p className="text-sm leading-relaxed">{message.body}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 text-right mt-1">{time}</p>
                </div>
            </div>
        );
    }

    // Other party — left-aligned
    return (
        <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mb-4">
                <User size={13} className="text-gray-500" />
            </div>
            <div className="max-w-sm">
                <p className="text-[10px] text-gray-400 mb-1 ml-1">{message.sender_username}</p>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-2.5 rounded-2xl rounded-tl-sm">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                        {message.body}
                    </p>
                </div>
                <p className="text-[10px] text-gray-400 mt-1 ml-1">{time}</p>
            </div>
        </div>
    );
}


// ── Date separator ────────────────────────────────────────────────────────────
function DateSeparator({ date }) {
    return (
        <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
            <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">{date}</span>
            <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
        </div>
    );
}

function groupMessagesByDate(messages) {
    const groups = [];
    let currentDate = null;
    messages.forEach((msg) => {
        const date = new Date(msg.created_at).toLocaleDateString([], {
            weekday: "long", day: "numeric", month: "long",
        });
        if (date !== currentDate) {
            groups.push({ type: "date", date });
            currentDate = date;
        }
        groups.push({ type: "message", message: msg });
    });
    return groups;
}


// ── Evidence file card ────────────────────────────────────────────────────────
function EvidenceCard({ file }) {
    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.file);

    return (
        <a
            href={file.file}
            target="_blank"
            rel="noopener noreferrer"
            className="group block rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 transition-colors"
        >
            {isImage ? (
                <div className="relative">
                    <img
                        src={file.file}
                        alt={file.caption || "Evidence"}
                        className="w-full h-28 object-cover"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <ExternalLink
                            size={18}
                            className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                    </div>
                </div>
            ) : (
                <div className="w-full h-28 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 group-hover:bg-gray-100 dark:group-hover:bg-gray-700 transition-colors">
                    <FileText size={24} className="text-gray-300 dark:text-gray-600 mb-1" />
                    <span className="text-[10px] text-gray-400">PDF</span>
                </div>
            )}
            <div className="px-2 py-1.5">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {file.caption || file.file.split("/").pop()}
                </p>
                <p className="text-[9px] text-gray-400 mt-0.5">
                    by {file.uploaded_by_username}
                </p>
            </div>
        </a>
    );
}


// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DisputeRoom() {
    const { id }       = useParams();
    const navigate     = useNavigate();
    const { user }     = useAuth();

    const [dispute, setDispute]         = useState(null);
    const [loading, setLoading]         = useState(true);
    const [error, setError]             = useState("");

    // Message input
    const [message, setMessage]         = useState("");
    const [sending, setSending]         = useState(false);
    const [msgError, setMsgError]       = useState("");

    // Evidence upload
    const [showUpload, setShowUpload]   = useState(false);
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploading, setUploading]     = useState(false);
    const [uploadError, setUploadError] = useState("");
    const [uploadSuccess, setUploadSuccess] = useState("");

    // Auto-scroll ref
    const messagesEndRef = useRef(null);
    const pollRef        = useRef(null);

    // ── Fetch dispute ────────────────────────────────────────────────────────
    const fetchDispute = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const r = await api.get(`/disputes/${id}/`);
            setDispute(r.data);
            setError("");
        } catch (err) {
            if (err.response?.status === 403) {
                setError("You are not a participant in this dispute.");
            } else if (err.response?.status === 404) {
                setError("Dispute not found.");
            } else {
                setError("Could not load dispute. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDispute();

        // Poll for new messages every 15 seconds
        // WHY 15s: Fast enough to feel live for a 2-person chat.
        // Slow enough to not hammer the server with 2–3 active disputes.
        pollRef.current = setInterval(() => fetchDispute(true), 15000);
        return () => clearInterval(pollRef.current);
    }, [fetchDispute]);

    // Auto-scroll to bottom when messages update
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [dispute?.messages?.length]);

    // ── Derived values ───────────────────────────────────────────────────────
    const isResolved = dispute?.status === "RESOLVED";
    const currentUsername = user?.username;

    const role = !dispute ? null
        : currentUsername === dispute.buyer_username  ? "buyer"
        : currentUsername === dispute.seller_username ? "seller"
        : null;

    const statusCfg  = STATUS_DISPLAY[dispute?.status]  || STATUS_DISPLAY.PENDING;
    const verdictCfg = dispute?.final_verdict ? VERDICT_DISPLAY[dispute.final_verdict] : null;
    const StatusIcon = statusCfg.icon;

    // ── Send message ─────────────────────────────────────────────────────────
    const handleSend = async () => {
        const body = message.trim();
        if (!body) return;
        if (body.length > 3000) {
            setMsgError("Message too long (max 3000 characters).");
            return;
        }
        setMsgError("");
        setSending(true);
        try {
            await api.post(`/disputes/${id}/messages/`, { body });
            setMessage("");
            await fetchDispute(true); // Refresh to get new message with server timestamp
        } catch (err) {
            setMsgError(err.response?.data?.error || "Failed to send. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e) => {
        // Send on Enter, new line on Shift+Enter
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // ── Upload evidence ──────────────────────────────────────────────────────
    const handleFileSelect = (e) => {
        const selected = Array.from(e.target.files);
        const existing = uploadFiles.length;
        if (existing + selected.length > 10) {
            setUploadError("Maximum 10 files per participant.");
            return;
        }
        setUploadFiles((prev) => [...prev, ...selected]);
        setUploadError("");
    };

    const removeUploadFile = (idx) => {
        setUploadFiles((f) => f.filter((_, i) => i !== idx));
    };

    const handleUpload = async () => {
        if (uploadFiles.length === 0) return;
        setUploading(true);
        setUploadError("");
        setUploadSuccess("");

        let success = 0;
        let failed  = 0;

        for (const file of uploadFiles) {
            const fd = new FormData();
            fd.append("file",    file);
            fd.append("caption", file.name);
            try {
                await api.post(`/disputes/${id}/evidence/`, fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                success++;
            } catch {
                failed++;
            }
        }

        setUploading(false);
        setUploadFiles([]);

        if (failed > 0 && success === 0) {
            setUploadError("All uploads failed. Check file types and sizes.");
        } else if (failed > 0) {
            setUploadError(`${success} uploaded, ${failed} failed.`);
        } else {
            setUploadSuccess(`${success} file${success > 1 ? "s" : ""} uploaded successfully.`);
            setTimeout(() => {
                setUploadSuccess("");
                setShowUpload(false);
            }, 2000);
        }

        await fetchDispute(true);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    if (loading) return <LoadingSpinner />;

    if (error) return (
        <div className="max-w-xl mx-auto pt-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto">
                <AlertTriangle size={28} className="text-red-500" />
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">{error}</p>
            <button
                onClick={() => navigate("/disputes")}
                className="btn-primary inline-flex items-center gap-2 text-sm"
            >
                <ChevronLeft size={14} /> Back to Disputes
            </button>
        </div>
    );

    const messageGroups = groupMessagesByDate(dispute.messages || []);

    return (
        <div className="max-w-2xl mx-auto flex flex-col gap-5">

            {/* ── Back navigation ─────────────────────────────────────────── */}
            <div className="flex items-center gap-3">
                <Link
                    to="/disputes"
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                    <ChevronLeft size={16} /> My Disputes
                </Link>
            </div>

            {/* ── Case header ──────────────────────────────────────────────── */}
            <div className="card p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                <Flag size={13} className="text-red-500" />
                            </div>
                            <h1 className="font-bold text-gray-900 dark:text-white text-base leading-tight truncate">
                                {dispute.listing_title}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1.5 mb-3">
                            <span className="font-medium">{dispute.buyer_username}</span>
                            <ArrowRight size={10} className="text-gray-300" />
                            <span className="font-medium">{dispute.seller_username}</span>
                            <span className="text-gray-300 dark:text-gray-600">·</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                                ₦{Number(dispute.order_amount).toLocaleString()}
                            </span>
                        </div>

                        {/* Reason */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                {dispute.reason_display}
                            </span>
                            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                                <StatusIcon size={9} />
                                {statusCfg.label}
                            </span>
                        </div>
                    </div>

                    {/* Order link */}
                    <Link
                        to={`/orders/${dispute.order_id}`}
                        className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600 flex-shrink-0 border border-brand-200 dark:border-brand-800 px-3 py-1.5 rounded-xl transition-colors"
                    >
                        View Order <ExternalLink size={11} />
                    </Link>
                </div>

                {/* Buyer's original statement */}
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                        Buyer's Statement
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {dispute.description}
                    </p>
                </div>
            </div>

            {/* ── Verdict banner (resolved disputes) ───────────────────────── */}
            {verdictCfg && (
                <div className={`card p-5 border-2 ${verdictCfg.border} ${verdictCfg.bg}`}>
                    <div className="flex items-start gap-3">
                        <verdictCfg.icon size={20} className={`${verdictCfg.color} flex-shrink-0 mt-0.5`} />
                        <div>
                            <p className={`font-bold text-sm ${verdictCfg.color} mb-0.5`}>
                                {verdictCfg.label}
                            </p>
                            <p className={`text-xs ${verdictCfg.color} opacity-80 mb-2`}>
                                {verdictCfg.desc}
                            </p>
                            {dispute.resolution_note && (
                                <div className="mt-2 p-2.5 bg-white/60 dark:bg-black/20 rounded-lg">
                                    <p className="text-[10px] font-semibold text-gray-500 mb-1">Moderator's Note</p>
                                    <p className={`text-xs ${verdictCfg.color} leading-relaxed`}>
                                        {dispute.resolution_note}
                                    </p>
                                </div>
                            )}
                            {dispute.resolved_by_username && (
                                <p className="text-[10px] text-gray-400 mt-2">
                                    Resolved by{" "}
                                    <strong>{dispute.resolved_by_username}</strong>
                                    {dispute.resolved_at && (
                                        <> on {new Date(dispute.resolved_at).toLocaleDateString()}</>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Evidence section ──────────────────────────────────────────── */}
            <div className="card p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                        <Image size={14} className="text-brand-500" />
                        Evidence
                        {dispute.evidence?.length > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                                {dispute.evidence.length}
                            </span>
                        )}
                    </h2>

                    {/* Upload button — only if dispute is still active */}
                    {!isResolved && (
                        <button
                            onClick={() => setShowUpload((s) => !s)}
                            className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600 border border-brand-200 dark:border-brand-800 px-3 py-1.5 rounded-xl transition-colors"
                        >
                            <Upload size={12} />
                            Add Evidence
                        </button>
                    )}
                </div>

                {/* Upload panel */}
                {showUpload && !isResolved && (
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            JPG, PNG, WebP, GIF, PDF · Max 10MB each · Up to 10 files
                        </p>

                        {/* Selected files list */}
                        {uploadFiles.length > 0 && (
                            <div className="space-y-1.5">
                                {uploadFiles.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center gap-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
                                    >
                                        <FileText size={11} className="text-gray-400 flex-shrink-0" />
                                        <span className="truncate flex-1 text-gray-700 dark:text-gray-300">{f.name}</span>
                                        <span className="text-gray-400 flex-shrink-0">
                                            {(f.size / 1024 / 1024).toFixed(1)}MB
                                        </span>
                                        <button
                                            onClick={() => removeUploadFile(i)}
                                            className="text-gray-400 hover:text-red-500 flex-shrink-0"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Drop zone */}
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-5 cursor-pointer hover:border-brand-400 transition-colors">
                            <Upload size={20} className="text-gray-300 mb-1.5" />
                            <span className="text-xs font-medium text-gray-500">Click to select files</span>
                            <input
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                                onChange={handleFileSelect}
                                className="hidden"
                            />
                        </label>

                        {uploadError && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertTriangle size={11} /> {uploadError}
                            </p>
                        )}
                        {uploadSuccess && (
                            <p className="text-xs text-emerald-600 flex items-center gap-1">
                                <CheckCircle2 size={11} /> {uploadSuccess}
                            </p>
                        )}

                        <div className="flex gap-2">
                            <button
                                onClick={() => { setShowUpload(false); setUploadFiles([]); }}
                                className="flex-1 py-2 text-xs border border-gray-200 dark:border-gray-700 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpload}
                                disabled={uploading || uploadFiles.length === 0}
                                className="flex-1 py-2 text-xs btn-primary flex items-center justify-center gap-1.5"
                            >
                                {uploading
                                    ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <><Upload size={11} /> Upload {uploadFiles.length > 0 && `(${uploadFiles.length})`}</>
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* Evidence grid */}
                {dispute.evidence?.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                        No evidence uploaded yet.
                        {!isResolved && " Upload screenshots or documents to support your case."}
                    </p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {dispute.evidence.map((file) => (
                            <EvidenceCard key={file.id} file={file} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Chat room ────────────────────────────────────────────────── */}
            <div className="card overflow-hidden flex flex-col">
                {/* Chat header */}
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
                        <MessageSquare size={14} className="text-brand-500" />
                        Dispute Chat
                    </h2>
                    <span className="text-xs text-gray-400">
                        {dispute.messages?.length ?? 0} {dispute.messages?.length === 1 ? "message" : "messages"}
                        <span className="ml-2 text-gray-300 dark:text-gray-600">· refreshes every 15s</span>
                    </span>
                </div>

                {/* Messages */}
                <div className="flex flex-col gap-2 p-5 min-h-[300px] max-h-[500px] overflow-y-auto">
                    {messageGroups.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                            <MessageSquare size={28} className="text-gray-200 dark:text-gray-700 mb-2" />
                            <p className="text-sm text-gray-400">No messages yet.</p>
                            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
                                Start the conversation — the moderator will join when reviewing.
                            </p>
                        </div>
                    )}

                    {messageGroups.map((item, idx) =>
                        item.type === "date" ? (
                            <DateSeparator key={`date-${idx}`} date={item.date} />
                        ) : (
                            <MessageBubble
                                key={item.message.id}
                                message={item.message}
                                currentUsername={currentUsername}
                            />
                        )
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Message input — hidden on resolved disputes */}
                {!isResolved ? (
                    <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
                        {msgError && (
                            <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
                                <AlertTriangle size={11} /> {msgError}
                            </p>
                        )}
                        <div className="flex items-end gap-2">
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Write a message... (Enter to send, Shift+Enter for new line)"
                                rows={2}
                                maxLength={3000}
                                className="input flex-1 resize-none text-sm"
                            />
                            <button
                                onClick={handleSend}
                                disabled={sending || !message.trim()}
                                className="btn-primary h-10 w-10 flex items-center justify-center flex-shrink-0 rounded-xl disabled:opacity-40"
                                title="Send message"
                            >
                                {sending
                                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Send size={15} />
                                }
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1.5 text-right">
                            {message.length}/3000
                        </p>
                    </div>
                ) : (
                    <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                        <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                            <Lock size={11} />
                            This dispute is resolved. The chat is now read-only.
                        </p>
                    </div>
                )}
            </div>

            {/* ── Security note ────────────────────────────────────────────── */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <p className="text-xs text-gray-400 leading-relaxed">
                    <strong className="text-gray-600 dark:text-gray-300">All messages are permanent.</strong>{" "}
                    Dispute chat logs cannot be edited or deleted — they form the evidentiary
                    record for the moderator's review. All messages, evidence, and the final
                    verdict are immutably logged.
                </p>
            </div>
        </div>
    );
}