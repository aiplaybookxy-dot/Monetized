/**
 * src/pages/admin/AdminDashboard.jsx
 *
 * Platform Owner Dashboard — 4 tabs:
 *   Finance    → Revenue charts, escrow, pending withdrawals
 *   Users      → All users with ban/promote/verify actions
 *   Settings   → Commission rate, site-wide toggles
 *   Disputes   → God view of all disputes + override capability
 *
 * Uses recharts for the monthly revenue chart.
 * Skeleton loaders on all data-heavy sections.
 */
import { useState, useEffect, useCallback, Component } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    TrendingUp, DollarSign, ShieldAlert, Users,
    Settings, BarChart3, LogOut, CreditCard,
    CheckCircle, XCircle, AlertTriangle, RefreshCw,
    ChevronRight, Scale, Lock, ToggleLeft, ToggleRight,
    Search, Filter, Eye, Flag, ArrowUpRight,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../../components/ui/ThemeToggle";


// ── Error boundary — prevents one tab crash from blanking the whole page ─────
class TabErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    render() {
        if (this.state.error) {
            return (
                <div className="card p-8 text-center">
                    <p className="text-red-500 font-semibold mb-2">Something went wrong in this tab.</p>
                    <p className="text-xs text-gray-400 font-mono">{String(this.state.error)}</p>
                    <button
                        onClick={() => this.setState({ error: null })}
                        className="mt-4 btn-primary text-sm px-4"
                    >
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ className = "" }) {
    return (
        <div className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl ${className}`} />
    );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, bg, sub }) {
    return (
        <div className="card p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-10 h-10 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={color} />
                </div>
                {sub && (
                    <span className="text-xs text-gray-400 mt-1">{sub}</span>
                )}
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
        </div>
    );
}

function StatSkeleton() {
    return (
        <div className="card p-5 space-y-3">
            <Skeleton className="w-10 h-10" />
            <Skeleton className="w-24 h-7" />
            <Skeleton className="w-32 h-4" />
        </div>
    );
}

// ── Role badge ────────────────────────────────────────────────────────────────
const ROLE_BADGE = {
    platform_owner: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
    admin:           "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    moderator:       "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    user:            "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled }) {
    return (
        <button
            onClick={() => onChange(!value)}
            disabled={disabled}
            className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors focus:outline-none ${
                value ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
            <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                value ? "translate-x-6" : "translate-x-1"
            }`} />
        </button>
    );
}


// ── Revenue Chart — recharts loaded lazily inside component ──────────────────
// WHY lazy import: recharts calls useContext() internally. If imported at the
// module level it runs before React's context tree is ready, causing
// "Cannot read properties of null (reading 'useContext')".
// Dynamic import defers execution until the component actually mounts.
function RevenueChart({ data }) {
    const [Lib, setLib] = useState(null);
    useEffect(() => {
        import("recharts").then(setLib);
    }, []);
    if (!Lib) return <Skeleton className="h-56 w-full" />;
    const { AreaChart, Area, XAxis, YAxis, CartesianGrid,
            Tooltip, ResponsiveContainer, Legend } = Lib;
    return (
        <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.4} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                        tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                        formatter={(v, n) => [`₦${Number(v).toLocaleString()}`, n === "gmv" ? "GMV" : "Commission"]}
                        contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: 12 }}
                    />
                    <Legend formatter={(v) => v === "gmv" ? "GMV" : "Commission"} />
                    <Area type="monotone" dataKey="gmv"        stroke="#6366f1" fill="url(#gmvGrad)"  strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="commission" stroke="#10b981" fill="url(#commGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: FINANCE
// ═══════════════════════════════════════════════════════════════════════════════
function FinanceTab() {
    const [stats,       setStats]       = useState(null);
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [wLoading,    setWLoading]    = useState(true);
    const [reviewing,   setReviewing]   = useState(null);
    const [rejectModal, setRejectModal] = useState(null);
    const [rejectReason, setRejectReason] = useState("");

    const fetchStats = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get("/admin/stats/");
            setStats(r.data);
        } finally { setLoading(false); }
    }, []);

    const fetchWithdrawals = useCallback(async () => {
        setWLoading(true);
        try {
            const r = await api.get("/admin/withdrawals/?status=PENDING");
            setWithdrawals(r.data);
        } finally { setWLoading(false); }
    }, []);

    useEffect(() => { fetchStats(); fetchWithdrawals(); }, [fetchStats, fetchWithdrawals]);

    const handleWithdrawal = async (id, decision, rejectionReason = "") => {
        setReviewing(id);
        try {
            await api.post(`/admin/withdrawals/${id}/review/`, {
                decision,
                rejection_reason: rejectionReason,
            });
            await fetchWithdrawals();
            await fetchStats();
        } catch (err) {
            alert(err.response?.data?.error || "Action failed.");
        } finally {
            setReviewing(null);
            setRejectModal(null);
            setRejectReason("");
        }
    };

    const fmt = (v) => `₦${Number(v || 0).toLocaleString()}`;

    return (
        <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {loading ? (
                    <>
                        <StatSkeleton /><StatSkeleton /><StatSkeleton /><StatSkeleton />
                    </>
                ) : (
                    <>
                        <StatCard label="Total GMV"         value={fmt(stats?.total_revenue)}      icon={TrendingUp}  color="text-brand-500"   bg="bg-brand-50 dark:bg-brand-900/30" />
                        <StatCard label="Commissions Earned" value={fmt(stats?.total_commissions)}  icon={DollarSign}  color="text-emerald-500" bg="bg-emerald-50 dark:bg-emerald-900/20" />
                        <StatCard label="In Escrow"          value={fmt(stats?.escrow_held)}         icon={Lock}        color="text-amber-500"   bg="bg-amber-50 dark:bg-amber-900/20" />
                        <StatCard label="Pending Payouts"    value={fmt(stats?.pending_withdrawals)} icon={CreditCard}  color="text-red-500"     bg="bg-red-50 dark:bg-red-900/20" />
                    </>
                )}
            </div>

            {/* Secondary stats */}
            {!loading && stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { label: "Total Orders",     value: stats.total_orders },
                        { label: "Completed Orders", value: stats.completed_orders },
                        { label: "Active Disputes",  value: stats.disputed_orders },
                        { label: "Registered Users", value: stats.total_users },
                    ].map(({ label, value }) => (
                        <div key={label} className="card p-4 text-center">
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Revenue chart */}
            <div className="card p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 size={16} className="text-brand-500" />
                    Monthly Revenue (Last 12 Months)
                </h3>
                {loading ? (
                    <Skeleton className="h-56 w-full" />
                ) : (
                    <RevenueChart data={stats?.monthly_revenue || []} />
                )}
            </div>

            {/* Pending Withdrawals */}
            <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <CreditCard size={15} className="text-brand-500" />
                        Pending Withdrawal Requests
                    </h3>
                    <span className="text-xs text-gray-400">{withdrawals.length} pending</span>
                </div>

                {wLoading ? (
                    <div className="p-5 space-y-3">
                        {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                ) : withdrawals.length === 0 ? (
                    <div className="py-12 text-center">
                        <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">No pending withdrawals</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                        {withdrawals.map((w) => (
                            <div key={w.id} className="px-5 py-4 flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {w.seller_username}
                                        </p>
                                        <span className="text-xs text-gray-400">{w.seller_email}</span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {w.bank_name} · {w.account_number} · {w.account_name}
                                    </p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {new Date(w.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <p className="text-base font-bold text-gray-900 dark:text-white flex-shrink-0">
                                    ₦{Number(w.amount).toLocaleString()}
                                </p>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => handleWithdrawal(w.id, "approve")}
                                        disabled={reviewing === w.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {reviewing === w.id
                                            ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : <><CheckCircle size={11} /> Approve</>
                                        }
                                    </button>
                                    <button
                                        onClick={() => setRejectModal(w)}
                                        disabled={reviewing === w.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        <XCircle size={11} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Reject modal */}
            {rejectModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="card p-6 w-full max-w-sm">
                        <h3 className="font-bold text-gray-900 dark:text-white mb-1">Reject Withdrawal</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            ₦{Number(rejectModal.amount).toLocaleString()} for {rejectModal.seller_username}
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason for rejection (required)..."
                            className="input resize-none h-24 mb-4 text-sm"
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                                className="flex-1 btn-ghost border border-gray-200 dark:border-gray-700 text-sm py-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleWithdrawal(rejectModal.id, "reject", rejectReason)}
                                disabled={!rejectReason.trim() || reviewing === rejectModal.id}
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm py-2 rounded-xl font-semibold transition-colors disabled:opacity-50"
                            >
                                Confirm Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: USERS
// ═══════════════════════════════════════════════════════════════════════════════
function UsersTab() {
    const [users,    setUsers]    = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [search,   setSearch]   = useState("");
    const [role,     setRole]     = useState("");
    const [acting,   setActing]   = useState(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (role)   params.set("role",   role);
            const r = await api.get(`/admin/users/?${params}`);
            setUsers(r.data?.results ?? r.data ?? []);
        } finally { setLoading(false); }
    }, [search, role]);

    useEffect(() => {
        const t = setTimeout(fetchUsers, 300);
        return () => clearTimeout(t);
    }, [fetchUsers]);

    const handleAction = async (userId, action) => {
        if (!window.confirm(`Confirm: ${action} this user?`)) return;
        setActing(userId);
        try {
            await api.patch(`/admin/users/${userId}/`, { action });
            await fetchUsers();
        } catch (err) {
            alert(err.response?.data?.error || "Action failed.");
        } finally {
            setActing(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Search + filter */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search users by name, email, username..."
                        className="input pl-8 text-sm"
                    />
                </div>
                <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="input w-36 text-sm"
                >
                    <option value="">All Roles</option>
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    <option value="platform_owner">Platform Owner</option>
                </select>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40">
                                {["User", "Role", "Earned", "Spent", "Sales", "Status", "Actions"].map(h => (
                                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                            {loading ? (
                                Array.from({length: 6}).map((_, i) => (
                                    <tr key={i}>
                                        {Array.from({length: 7}).map((_, j) => (
                                            <td key={j} className="px-4 py-3">
                                                <Skeleton className="h-4 w-full" />
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : users.map((u) => (
                                <tr key={u.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                                    <td className="px-4 py-3">
                                        <div>
                                            <p className="font-medium text-gray-900 dark:text-white">{u.username}</p>
                                            <p className="text-xs text-gray-400 truncate max-w-[160px]">{u.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] || ROLE_BADGE.user}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                        ₦{Number(u.total_earned).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                                        ₦{Number(u.total_spent).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                                        {u.completed_sales}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            u.is_active
                                                ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                                                : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                        }`}>
                                            {u.is_active ? "Active" : "Banned"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1.5">
                                            {u.is_active ? (
                                                <button
                                                    onClick={() => handleAction(u.id, "ban")}
                                                    disabled={acting === u.id}
                                                    className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Ban user"
                                                >
                                                    Ban
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleAction(u.id, "unban")}
                                                    disabled={acting === u.id}
                                                    className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-50"
                                                >
                                                    Unban
                                                </button>
                                            )}
                                            {u.role === "user" && (
                                                <button
                                                    onClick={() => handleAction(u.id, "promote_moderator")}
                                                    disabled={acting === u.id}
                                                    className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Promote to Moderator"
                                                >
                                                    → Mod
                                                </button>
                                            )}
                                            {u.role === "moderator" && (
                                                <button
                                                    onClick={() => handleAction(u.id, "demote_user")}
                                                    disabled={acting === u.id}
                                                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Demote to User"
                                                >
                                                    → User
                                                </button>
                                            )}
                                            {!u.is_email_verified && (
                                                <button
                                                    onClick={() => handleAction(u.id, "verify")}
                                                    disabled={acting === u.id}
                                                    className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 rounded-lg transition-colors disabled:opacity-50"
                                                    title="Manually verify email"
                                                >
                                                    Verify
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {!loading && users.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-10">No users found.</p>
                )}
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab() {
    const [cfg,     setCfg]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving,  setSaving]  = useState(false);
    const [saved,   setSaved]   = useState(false);
    const [error,   setError]   = useState("");
    
    const fetchSettings = useCallback(async () => {
        setLoading(true);
        try {
            const r = await api.get("/admin/settings/");
            setCfg(r.data);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchSettings(); }, [fetchSettings]);

    const handleSave = async (field, value) => {
        setSaving(true);
        setSaved(false);
        setError("");
        try {
            const r = await api.patch("/admin/settings/", { [field]: value });
            setCfg(r.data);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err.response?.data?.[field]?.[0] || "Save failed.");
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = (field) => {
        if (!cfg) return;
        handleSave(field, !cfg[field]);
    };

    if (loading) return (
        <div className="space-y-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
    );

    if (!cfg) return null;

    const TOGGLES = [
        { field: "maintenance_mode",     label: "Maintenance Mode",     desc: "Show maintenance page to all users. All requests are blocked.", danger: true },
        { field: "disable_new_signups",  label: "Disable New Signups",  desc: "Prevent new users from creating accounts.", danger: false },
        { field: "disable_new_listings", label: "Disable New Listings", desc: "Stop sellers from creating new listings.", danger: false },
        { field: "disable_payments",     label: "Disable Payments",     desc: "Block all Paystack payment initiations.", danger: true },
    ];

    return (
        <div className="space-y-5 max-w-2xl">

            {saved && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm">
                    <CheckCircle size={14} /> Changes saved successfully.
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                    <AlertTriangle size={14} /> {error}
                </div>
            )}

            {/* Financial settings */}
            <div className="card p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <DollarSign size={15} className="text-emerald-500" />
                    Financial Settings
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Commission Rate (%)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="50"
                                value={cfg.commission_percent}
                                onChange={(e) => setCfg({ ...cfg, commission_percent: e.target.value })}
                                className="input w-32 text-sm"
                            />
                            <button
                                onClick={() => handleSave("commission_percent", cfg.commission_percent)}
                                disabled={saving}
                                className="btn-primary text-sm px-4"
                            >
                                {saving ? "Saving…" : "Save"}
                            </button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">
                            Current: {cfg.commission_percent}% — applies to all new orders. Existing orders are unaffected.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Minimum Withdrawal Amount (₦)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="number"
                                step="100"
                                min="0"
                                value={cfg.min_withdrawal_amount}
                                onChange={(e) => setCfg({ ...cfg, min_withdrawal_amount: e.target.value })}
                                className="input w-40 text-sm"
                            />
                            <button
                                onClick={() => handleSave("min_withdrawal_amount", cfg.min_withdrawal_amount)}
                                disabled={saving}
                                className="btn-primary text-sm px-4"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Site toggles */}
            <div className="card p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Settings size={15} className="text-brand-500" />
                    Site-Wide Toggles
                </h3>
                <div className="space-y-4">
                    {TOGGLES.map(({ field, label, desc, danger }) => (
                        <div
                            key={field}
                            className={`flex items-start justify-between gap-4 p-4 rounded-xl border transition-colors ${
                                cfg[field]
                                    ? danger
                                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                                    : "bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800"
                            }`}
                        >
                            <div className="flex-1">
                                <p className={`text-sm font-semibold ${
                                    cfg[field] && danger ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-white"
                                }`}>
                                    {label}
                                    {cfg[field] && (
                                        <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                            danger ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                                        }`}>
                                            ACTIVE
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{desc}</p>
                            </div>
                            <Toggle
                                value={cfg[field]}
                                onChange={() => handleToggle(field)}
                                disabled={saving}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Contact settings */}
            <div className="card p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Platform Info</h3>
                <div className="space-y-4">
                    {[
                        { field: "platform_name", label: "Platform Name", type: "text" },
                        { field: "support_email", label: "Support Email",  type: "email" },
                    ].map(({ field, label, type }) => (
                        <div key={field}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
                            <div className="flex gap-2">
                                <input
                                    type={type}
                                    value={cfg[field]}
                                    onChange={(e) => setCfg({ ...cfg, [field]: e.target.value })}
                                    className="input text-sm"
                                />
                                <button
                                    onClick={() => handleSave(field, cfg[field])}
                                    disabled={saving}
                                    className="btn-primary text-sm px-4 flex-shrink-0"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// TAB: DISPUTES (GOD VIEW)
// ═══════════════════════════════════════════════════════════════════════════════
function DisputesTab() {
    const [disputes,  setDisputes]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [selected,  setSelected]  = useState(null);
    const [verdict,   setVerdict]   = useState("REFUNDED");
    const [note,      setNote]      = useState("");
    const [overriding,setOverriding]= useState(false);
    const [statusFilter, setStatusFilter] = useState("");

    const fetchDisputes = useCallback(async () => {
        setLoading(true);
        try {
            const params = statusFilter ? `?status=${statusFilter}` : "";
            const r = await api.get(`/admin/disputes/${params}`);
            setDisputes(r.data?.results ?? r.data ?? []);
        } finally { setLoading(false); }
    }, [statusFilter]);

    useEffect(() => { fetchDisputes(); }, [fetchDisputes]);

    const handleOverride = async () => {
        if (!note.trim()) { alert("Resolution note is required."); return; }
        if (!window.confirm(`Override this dispute as ${verdict}? This is irreversible.`)) return;
        setOverriding(true);
        try {
            await api.post(`/admin/disputes/${selected.id}/override/`, {
                verdict, resolution_note: note
            });
            setSelected(null);
            setNote("");
            await fetchDisputes();
        } catch (err) {
            alert(err.response?.data?.error || "Override failed.");
        } finally { setOverriding(false); }
    };

    const STATUS_COLOR = {
        PENDING:      "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
        UNDER_REVIEW: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
        RESOLVED:     "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
    };

    return (
        <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-3">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input w-44 text-sm"
                >
                    <option value="">All Disputes</option>
                    <option value="PENDING">Pending</option>
                    <option value="UNDER_REVIEW">Under Review</option>
                    <option value="RESOLVED">Resolved</option>
                </select>
                <button onClick={fetchDisputes} className="btn-ghost border border-gray-200 dark:border-gray-700 p-2.5 rounded-xl">
                    <RefreshCw size={14} className="text-gray-400" />
                </button>
                <span className="text-xs text-gray-400 ml-auto">{disputes.length} disputes</span>
            </div>

            {/* Dispute list */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="p-5 space-y-3">
                        {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                    </div>
                ) : disputes.length === 0 ? (
                    <div className="py-12 text-center">
                        <CheckCircle size={28} className="text-emerald-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">No disputes match this filter.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
                        {disputes.map((d) => (
                            <div
                                key={d.id}
                                onClick={() => setSelected(selected?.id === d.id ? null : d)}
                                className={`px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                                    selected?.id === d.id ? "bg-brand-50/50 dark:bg-brand-900/10" : ""
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                            {d.listing_title}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                            {d.buyer_username} → {d.seller_username} · ₦{Number(d.order_amount).toLocaleString()}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-0.5">{d.reason_display}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[d.status] || STATUS_COLOR.PENDING}`}>
                                            {d.status_display}
                                        </span>
                                        <ChevronRight size={14} className={`text-gray-300 transition-transform ${selected?.id === d.id ? "rotate-90" : ""}`} />
                                    </div>
                                </div>

                                {/* Expanded override panel */}
                                {selected?.id === d.id && d.status !== "RESOLVED" && (
                                    <div
                                        className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                                <AlertTriangle size={12} /> Admin Override — Irreversible
                                            </p>
                                            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                                                This overrides any existing moderator action.
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="flex-1">
                                                <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5 block">Verdict</label>
                                                <select
                                                    value={verdict}
                                                    onChange={(e) => setVerdict(e.target.value)}
                                                    className="input text-sm"
                                                >
                                                    <option value="REFUNDED">Refund Buyer</option>
                                                    <option value="RELEASED">Release to Seller</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5 block">Resolution Note</label>
                                            <textarea
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                                placeholder="Explain your decision..."
                                                className="input resize-none h-20 text-sm"
                                            />
                                        </div>
                                        <button
                                            onClick={handleOverride}
                                            disabled={overriding || !note.trim()}
                                            className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {overriding
                                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                : <><Scale size={14} /> Execute Admin Override</>
                                            }
                                        </button>
                                    </div>
                                )}
                                {selected?.id === d.id && d.status === "RESOLVED" && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800" onClick={(e) => e.stopPropagation()}>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            <strong>Verdict:</strong> {d.verdict_display || "—"} &nbsp;·&nbsp;
                                            <strong>Resolved by:</strong> {d.resolved_by_username || "—"}
                                        </p>
                                        {d.resolution_note && (
                                            <p className="text-xs text-gray-400 mt-1.5 italic">"{d.resolution_note}"</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}


// ═══════════════════════════════════════════════════════════════════════════════
// MAIN: AdminDashboard
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
    { key: "finance",  label: "Finance",   icon: DollarSign  },
    { key: "users",    label: "Users",     icon: Users       },
    { key: "settings", label: "Settings",  icon: Settings    },
    { key: "disputes", label: "Disputes",  icon: ShieldAlert },
];

export default function AdminDashboard() {
    const { user, logout } = useAuth();
    const navigate         = useNavigate();
    const [tab, setTab]    = useState("finance");

    const handleLogout = () => { logout(); navigate("/login"); };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 font-ubuntu">

            {/* ── Top nav ─────────────────────────────────────────────────── */}
            <header className="sticky top-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 sm:px-6 h-14 flex items-center gap-4">
                <div className="flex items-center gap-2.5 font-bold text-gray-900 dark:text-white">
                    <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
                        <TrendingUp size={14} className="text-white" />
                    </div>
                    <span className="hidden sm:block">EscrowMarket</span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full ml-1">
                        Owner
                    </span>
                </div>

                <div className="flex-1" />

                {/* Tab navigation in header (desktop) */}
                <nav className="hidden md:flex items-center gap-1">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button
                            key={key}
                            onClick={() => setTab(key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                                tab === key
                                    ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
                                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                        >
                            <Icon size={14} /> {label}
                        </button>
                    ))}
                </nav>

                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 hidden sm:block">{user?.username}</span>
                    <ThemeToggle />
                    <button
                        onClick={handleLogout}
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                        title="Sign out"
                    >
                        <LogOut size={15} />
                    </button>
                </div>
            </header>

            {/* ── Mobile tab bar ───────────────────────────────────────────── */}
            <div className="md:hidden sticky top-14 z-20 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex overflow-x-auto">
                {TABS.map(({ key, label, icon: Icon }) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 flex-shrink-0 transition-colors ${
                            tab === key
                                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                                : "border-transparent text-gray-500"
                        }`}
                    >
                        <Icon size={13} /> {label}
                    </button>
                ))}
            </div>

            {/* ── Page content ─────────────────────────────────────────────── */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
                <div className="mb-6">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                        {TABS.find(t => t.key === tab)?.label}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {tab === "finance"  && "Financial overview, escrow status, and withdrawal approvals"}
                        {tab === "users"    && "Manage all platform users — ban, verify, promote"}
                        {tab === "settings" && "Global platform configuration and site-wide toggles"}
                        {tab === "disputes" && "All disputes across the platform with admin override capability"}
                    </p>
                </div>

                {tab === "finance"  && <TabErrorBoundary key="finance"><FinanceTab /></TabErrorBoundary>}
                {tab === "users"    && <TabErrorBoundary key="users"><UsersTab /></TabErrorBoundary>}
                {tab === "settings" && <TabErrorBoundary key="settings"><SettingsTab /></TabErrorBoundary>}
                {tab === "disputes" && <TabErrorBoundary key="disputes"><DisputesTab /></TabErrorBoundary>}
            </main>
        </div>
    );
}