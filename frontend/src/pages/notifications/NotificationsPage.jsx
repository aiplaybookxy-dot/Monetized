/**
 * src/pages/notifications/NotificationsPage.jsx
 *
 * Full-page notification centre — accessible via /notifications.
 * The NotificationBell dropdown links here for "View all notifications".
 *
 * Features:
 * - Filter by type group (All / Orders / Disputes / Security / System)
 * - Mark individual or all notifications as read
 * - Click navigates to relevant page (order, dispute, listing)
 * - Grouped by date for readability
 * - Empty states per filter
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
    Bell, CheckCheck, CreditCard, DollarSign, Key,
    ShieldAlert, AlertTriangle, XCircle, MessageSquare,
    Package, ShoppingBag, Lock, Megaphone, Scale,
    RefreshCw, Filter,
} from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";


// ── Type → display config ─────────────────────────────────────────────────────
const TYPE_CONFIG = {
    PAYMENT_CONFIRMED:    { icon: CreditCard,    color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", group: "orders" },
    SALE_MADE:            { icon: DollarSign,    color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", group: "orders" },
    CREDENTIALS_UPLOADED: { icon: Key,           color: "text-brand-500",  bg: "bg-brand-100 dark:bg-brand-900/30",   group: "orders" },
    ORDER_COMPLETED:      { icon: Package,       color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", group: "orders" },
    ORDER_DISPUTED:       { icon: AlertTriangle, color: "text-amber-500",  bg: "bg-amber-100 dark:bg-amber-900/30",   group: "disputes" },
    ORDER_CANCELLED:      { icon: XCircle,       color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/30",       group: "orders" },
    WITHDRAWAL_APPROVED:  { icon: DollarSign,    color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", group: "orders" },
    DISPUTE_OPENED:       { icon: ShieldAlert,   color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/30",       group: "disputes" },
    DISPUTE_MESSAGE:      { icon: MessageSquare, color: "text-blue-500",   bg: "bg-blue-100 dark:bg-blue-900/30",     group: "disputes" },
    DISPUTE_RESOLVED:     { icon: Scale,         color: "text-purple-500", bg: "bg-purple-100 dark:bg-purple-900/30", group: "disputes" },
    LISTING_APPROVED:     { icon: ShoppingBag,   color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", group: "system" },
    LISTING_REJECTED:     { icon: XCircle,       color: "text-red-500",    bg: "bg-red-100 dark:bg-red-900/30",       group: "system" },
    LOGIN_ALERT:          { icon: Lock,          color: "text-amber-500",  bg: "bg-amber-100 dark:bg-amber-900/30",   group: "security" },
    SYSTEM:               { icon: Megaphone,     color: "text-gray-500",   bg: "bg-gray-100 dark:bg-gray-800",        group: "system" },
};
const DEFAULT_CONFIG = { icon: Bell, color: "text-gray-500", bg: "bg-gray-100 dark:bg-gray-800", group: "system" };
const getConfig = (type) => TYPE_CONFIG[type] || DEFAULT_CONFIG;


// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
    { key: "all",      label: "All" },
    { key: "orders",   label: "Orders" },
    { key: "disputes", label: "Disputes" },
    { key: "security", label: "Security" },
    { key: "system",   label: "System" },
];


// ── Relative time ─────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
    const diff = (Date.now() - new Date(dateStr)) / 1000;
    if (diff < 60)     return "just now";
    if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}


// ── Group notifications by date ───────────────────────────────────────────────
function groupByDate(notifications) {
    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups    = {};

    notifications.forEach((n) => {
        const d   = new Date(n.created_at).toDateString();
        const key = d === today ? "Today" : d === yesterday ? "Yesterday" : new Date(n.created_at).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
        if (!groups[key]) groups[key] = [];
        groups[key].push(n);
    });

    return Object.entries(groups);
}


// ── Notification row ──────────────────────────────────────────────────────────
function NotificationRow({ notification, onRead, onNavigate }) {
    const cfg      = getConfig(notification.notification_type);
    const IconComp = cfg.icon;
    const isUnread = !notification.is_read;

    return (
        <div
            onClick={() => {
                if (isUnread) onRead(notification.id);
                if (notification.action_url) onNavigate(notification.action_url);
            }}
            className={`flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                isUnread ? "bg-brand-50/40 dark:bg-brand-900/10" : ""
            }`}
        >
            {/* Icon */}
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                <IconComp size={18} className={cfg.color} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                    <p className={`text-sm font-semibold leading-snug ${
                        isUnread
                            ? "text-gray-900 dark:text-white"
                            : "text-gray-700 dark:text-gray-300"
                    }`}>
                        {notification.title}
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[11px] text-gray-400 whitespace-nowrap">
                            {timeAgo(notification.created_at)}
                        </span>
                        {isUnread && (
                            <div className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
                        )}
                    </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                    {notification.message}
                </p>
            </div>
        </div>
    );
}


// ── Main page ─────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading]             = useState(true);
    const [refreshing, setRefreshing]       = useState(false);
    const [markingAll, setMarkingAll]       = useState(false);
    const [filter, setFilter]               = useState("all");

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchNotifications = useCallback(async (isRefresh = false) => {
        isRefresh ? setRefreshing(true) : setLoading(true);
        try {
            const r = await api.get("/notifications/");
            setNotifications(r.data?.results ?? r.data ?? []);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    // ── Mark single read ─────────────────────────────────────────────────────
    const handleMarkRead = useCallback(async (id) => {
        setNotifications((prev) =>
            prev.map((n) => n.id === id ? { ...n, is_read: true } : n)
        );
        try { await api.patch(`/notifications/${id}/read/`, { is_read: true }); }
        catch { /* silent */ }
    }, []);

    // ── Mark all read ────────────────────────────────────────────────────────
    const handleMarkAll = async () => {
        setMarkingAll(true);
        try {
            await api.post("/notifications/mark-all-read/");
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } finally {
            setMarkingAll(false);
        }
    };

    // ── Filter + group ────────────────────────────────────────────────────────
    const filtered = filter === "all"
        ? notifications
        : notifications.filter((n) => getConfig(n.notification_type).group === filter);

    const grouped      = groupByDate(filtered);
    const unreadCount  = notifications.filter((n) => !n.is_read).length;
    const filterCounts = FILTERS.reduce((acc, f) => {
        acc[f.key] = f.key === "all"
            ? notifications.length
            : notifications.filter((n) => getConfig(n.notification_type).group === f.key).length;
        return acc;
    }, {});

    if (loading) return <LoadingSpinner />;

    return (
        <div className="max-w-2xl mx-auto space-y-5">

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                            <Bell size={16} className="text-brand-500" />
                        </div>
                        Notifications
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {unreadCount > 0
                            ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}`
                            : "All caught up"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                        <button
                            onClick={handleMarkAll}
                            disabled={markingAll}
                            className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600 border border-brand-200 dark:border-brand-800 px-3 py-2 rounded-xl transition-colors"
                        >
                            {markingAll
                                ? <div className="w-3 h-3 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                                : <CheckCheck size={13} />
                            }
                            Mark all read
                        </button>
                    )}
                    <button
                        onClick={() => fetchNotifications(true)}
                        disabled={refreshing}
                        className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={14} className={`text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
                    </button>
                </div>
            </div>

            {/* ── Filter tabs ──────────────────────────────────────────────── */}
            <div className="card overflow-hidden">
                <div className="flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
                    {FILTERS.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px flex-shrink-0 transition-colors ${
                                filter === key
                                    ? "border-brand-500 text-brand-600 dark:text-brand-400"
                                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}
                        >
                            {label}
                            {filterCounts[key] > 0 && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                    filter === key
                                        ? "bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                                }`}>
                                    {filterCounts[key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Notification groups ──────────────────────────────────── */}
                {grouped.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                            <Bell size={24} className="text-gray-300 dark:text-gray-600" />
                        </div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">
                            {filter === "all" ? "No notifications yet" : `No ${filter} notifications`}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            {filter === "all"
                                ? "Activity on your orders, listings, and disputes will appear here."
                                : `You have no ${filter} notifications at this time.`}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800/80">
                        {grouped.map(([date, items]) => (
                            <div key={date}>
                                {/* Date header */}
                                <div className="px-5 py-2 bg-gray-50/70 dark:bg-gray-800/40">
                                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                        {date}
                                    </p>
                                </div>
                                {/* Rows */}
                                {items.map((n) => (
                                    <NotificationRow
                                        key={n.id}
                                        notification={n}
                                        onRead={handleMarkRead}
                                        onNavigate={(url) => navigate(url)}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}