/**
 * src/components/ui/NotificationBell.jsx
 *
 * In-app notification bell with dropdown panel.
 *
 * Architecture:
 * ─────────────
 * - Polls /api/v1/notifications/unread-count/ every 30s for the badge number
 * - Fetches full notification list on bell click (lazy — avoids loading
 *   50 notifications for every page load)
 * - Mark-as-read is fire-and-forget PATCH (UI updates optimistically)
 * - Mark All Read calls the bulk endpoint
 *
 * WHY polling and not WebSockets:
 * Same rationale as DisputeRoom — Gunicorn is WSGI, not ASGI. WebSockets
 * require Daphne/Uvicorn and Channels. 30s polling for the badge count is
 * imperceptible for notifications (user checks ~every few minutes at most)
 * and requires zero infrastructure changes.
 *
 * WHY badge polls separately from notification list:
 * The badge count endpoint (/unread-count/) is a single integer — < 50 bytes.
 * Fetching the full list every 30s would be 2–5KB per request per user.
 * At 100 concurrent users, that's 250KB/min of unnecessary traffic.
 * Separating them means the expensive list load only happens on click.
 *
 * Notification type → icon/color mapping:
 * Defined locally so no network request is needed to render the list.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Bell, X, Check, CheckCheck,
    CreditCard, DollarSign, Key, ShieldAlert,
    AlertTriangle, XCircle, MessageSquare,
    Package, ShoppingBag, Lock, Megaphone,
    RotateCcw, Scale,
} from "lucide-react";
import api from "../../services/api";


// ── Notification type config ─────────────────────────────────────────────────
const TYPE_CONFIG = {
    PAYMENT_CONFIRMED:    { icon: CreditCard,    color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    SALE_MADE:            { icon: DollarSign,    color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    CREDENTIALS_UPLOADED: { icon: Key,           color: "text-brand-500",  bg: "bg-brand-100 dark:bg-brand-900/30" },
    ORDER_COMPLETED:      { icon: Package,       color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    ORDER_DISPUTED:       { icon: AlertTriangle, color: "text-amber-500",  bg: "bg-amber-100 dark:bg-amber-900/30" },
    ORDER_CANCELLED:      { icon: XCircle,       color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/30" },
    WITHDRAWAL_APPROVED:  { icon: DollarSign,    color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    DISPUTE_OPENED:       { icon: ShieldAlert,   color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/30" },
    DISPUTE_MESSAGE:      { icon: MessageSquare, color: "text-blue-500",   bg: "bg-blue-100 dark:bg-blue-900/30" },
    DISPUTE_RESOLVED:     { icon: Scale,         color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30" },
    LISTING_APPROVED:     { icon: ShoppingBag,   color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
    LISTING_REJECTED:     { icon: XCircle,       color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/30" },
    LOGIN_ALERT:          { icon: Lock,          color: "text-amber-500",  bg: "bg-amber-100 dark:bg-amber-900/30" },
    SYSTEM:               { icon: Megaphone,     color: "text-gray-500",   bg: "bg-gray-100 dark:bg-gray-800" },
};

const DEFAULT_CONFIG = { icon: Bell, color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800" };

function getConfig(type) {
    return TYPE_CONFIG[type] || DEFAULT_CONFIG;
}

// ── Relative time formatter ───────────────────────────────────────────────────
function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60)    return "just now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString();
}


// ── Single notification row ───────────────────────────────────────────────────
function NotificationRow({ notification, onRead, onClick }) {
    const cfg       = getConfig(notification.notification_type);
    const IconComp  = cfg.icon;
    const isUnread  = !notification.is_read;

    const handleClick = () => {
        if (isUnread) onRead(notification.id);
        onClick(notification.action_url);
    };

    return (
        <button
            onClick={handleClick}
            className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60 ${
                isUnread ? "bg-brand-50/50 dark:bg-brand-900/10" : ""
            }`}
        >
            {/* Icon */}
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                <IconComp size={14} className={cfg.color} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold leading-snug ${
                    isUnread
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-700 dark:text-gray-300"
                }`}>
                    {notification.title}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-2">
                    {notification.message}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">
                    {timeAgo(notification.created_at)}
                </p>
            </div>

            {/* Unread dot */}
            {isUnread && (
                <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />
            )}
        </button>
    );
}


// ── Main NotificationBell component ──────────────────────────────────────────
export default function NotificationBell() {
    const navigate                          = useNavigate();
    const [open, setOpen]                   = useState(false);
    const [unreadCount, setUnreadCount]     = useState(0);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading]             = useState(false);
    const [markingAll, setMarkingAll]       = useState(false);
    const panelRef                          = useRef(null);
    const pollRef                           = useRef(null);

    // ── Poll unread count every 30s ──────────────────────────────────────────
    const fetchCount = useCallback(async () => {
        try {
            const r = await api.get("/notifications/unread-count/");
            setUnreadCount(r.data.unread_count ?? 0);
        } catch {
            // Silent — badge count failure must never crash the layout
        }
    }, []);

    useEffect(() => {
        fetchCount();
        pollRef.current = setInterval(fetchCount, 30000);
        return () => clearInterval(pollRef.current);
    }, [fetchCount]);

    // ── Fetch full list when panel opens ────────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get("/notifications/");
            setNotifications(r.data?.results ?? r.data ?? []);
        } catch {
            // Silent — if list fails, badge count is still accurate
        } finally {
            setLoading(false);
        }
    }, []);

    const handleBellClick = () => {
        setOpen((prev) => {
            if (!prev) fetchNotifications();
            return !prev;
        });
    };

    // ── Close on outside click ───────────────────────────────────────────────
    useEffect(() => {
        if (!open) return;
        const handleOutsideClick = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleOutsideClick);
        return () => document.removeEventListener("mousedown", handleOutsideClick);
    }, [open]);

    // ── Mark single notification read (optimistic) ───────────────────────────
    const handleMarkRead = useCallback(async (id) => {
        // Optimistic update — UI responds instantly
        setNotifications((prev) =>
            prev.map((n) => n.id === id ? { ...n, is_read: true } : n)
        );
        setUnreadCount((c) => Math.max(0, c - 1));

        // Fire-and-forget PATCH — failure doesn't revert UI (minor inconsistency
        // is less disruptive than a visible flash back to unread state)
        try {
            await api.patch(`/notifications/${id}/`, { is_read: true });
        } catch {
            // Accept the inconsistency — next poll will correct badge count
        }
    }, []);

    // ── Mark all read ────────────────────────────────────────────────────────
    const handleMarkAllRead = async () => {
        setMarkingAll(true);
        try {
            await api.post("/notifications/mark-all-read/");
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch {
            // Silent
        } finally {
            setMarkingAll(false);
        }
    };

    // ── Navigate on notification click ───────────────────────────────────────
    const handleNavigate = (url) => {
        if (!url) return;
        setOpen(false);
        navigate(url);
    };

    const hasUnread = unreadCount > 0;
    const allRead   = notifications.every((n) => n.is_read);

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell button */}
            <button
                onClick={handleBellClick}
                className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ""}`}
            >
                <Bell size={17} />

                {/* Badge */}
                {hasUnread && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold leading-none shadow-sm">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown panel */}
            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden z-50">

                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                                Notifications
                            </h3>
                            {hasUnread && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {!allRead && notifications.length > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    disabled={markingAll}
                                    className="flex items-center gap-1 text-[11px] font-medium text-brand-500 hover:text-brand-600 px-2 py-1 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
                                    title="Mark all as read"
                                >
                                    {markingAll
                                        ? <div className="w-3 h-3 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                                        : <CheckCheck size={12} />
                                    }
                                    All read
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Notification list */}
                    <div className="overflow-y-auto max-h-[420px] divide-y divide-gray-50 dark:divide-gray-800/80">

                        {loading && (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                            </div>
                        )}

                        {!loading && notifications.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                                    <Bell size={20} className="text-gray-300 dark:text-gray-600" />
                                </div>
                                <p className="font-medium text-sm text-gray-700 dark:text-gray-300">
                                    All caught up!
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                    You have no notifications right now.
                                </p>
                            </div>
                        )}

                        {!loading && notifications.map((notif) => (
                            <NotificationRow
                                key={notif.id}
                                notification={notif}
                                onRead={handleMarkRead}
                                onClick={handleNavigate}
                            />
                        ))}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                            <button
                                onClick={() => { setOpen(false); navigate("/notifications"); }}
                                className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors w-full text-center"
                            >
                                View all notifications →
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}