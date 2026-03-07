/**
 * src/pages/admin/AdminUsers.jsx
 *
 * ADDITIONS vs previous version:
 *  + "Seize Bond" button on users with seller_bond > 0
 *  + Confirmation modal before seizing (irreversible — bans user + zeroes bond)
 *  + Bond amount displayed in user row (hidden on small screens)
 *  + seller_bond, bond_seized_at shown in the expanded row data
 */
import { useState, useCallback, useEffect } from "react";
import {
    Search, RefreshCw, ChevronLeft, ChevronRight,
    ShieldCheck, ShieldOff, CheckCircle, XCircle,
    AlertTriangle, Lock, Banknote, X,
} from "lucide-react";
import api from "../../services/api";

function fmt(n) {
    return `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

// ── Seize Bond Confirmation Modal ─────────────────────────────────────────────
function SeizeBondModal({ user, onConfirm, onCancel, loading }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                        <Lock size={20} className="text-red-500" />
                    </div>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X size={18} />
                    </button>
                </div>

                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    Seize Bond & Ban User
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    This action is <strong className="text-red-500">irreversible</strong>. It will:
                </p>

                <ul className="space-y-2 mb-5">
                    {[
                        `Deduct ${fmt(user.seller_bond)} from @${user.username}'s balance`,
                        "Permanently ban their account (is_active = False)",
                        "Record seizure timestamp to ActivityLog",
                        "Trigger in-app + email notification",
                    ].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                            {item}
                        </li>
                    ))}
                </ul>

                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-5">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                        Only use this for confirmed scam after a completed dispute resolution.
                        The seller can appeal by contacting support.
                    </p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                        {loading
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><Lock size={13} /> Seize & Ban</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── User Row ──────────────────────────────────────────────────────────────────
function UserRow({ user, onRoleChange, onSeizeBond }) {
    const [acting, setActing] = useState(false);

    const changeRole = async newRole => {
        setActing(true);
        try {
            await onRoleChange(user.id, newRole, user.username);
        } finally {
            setActing(false);
        }
    };

    const hasBond = parseFloat(user.seller_bond || 0) > 0;
    const isBanned = !user.is_active;

    return (
        <tr className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            {/* User */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm flex-shrink-0">
                        {user.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            @{user.username}
                            {isBanned && (
                                <span className="ml-1.5 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
                                    BANNED
                                </span>
                            )}
                            {user.bond_seized_at && (
                                <span className="ml-1.5 text-[10px] font-bold text-purple-500 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded-full">
                                    SEIZED
                                </span>
                            )}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                </div>
            </td>

            {/* Role */}
            <td className="px-4 py-3 hidden md:table-cell">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${
                    user.role === "admin" || user.role === "platform_owner"
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                        : user.role === "moderator"
                        ? "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}>
                    {user.role}
                </span>
            </td>

            {/* Earned */}
            <td className="px-4 py-3 hidden lg:table-cell">
                <p className="text-sm text-gray-700 dark:text-gray-300">{fmt(user.total_earned)}</p>
            </td>

            {/* Bond */}
            <td className="px-4 py-3 hidden lg:table-cell">
                {hasBond ? (
                    <span className="text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                        <Banknote size={10} /> {fmt(user.seller_bond)}
                    </span>
                ) : (
                    <span className="text-xs text-gray-400">—</span>
                )}
            </td>

            {/* Joined */}
            <td className="px-4 py-3 hidden xl:table-cell">
                <p className="text-xs text-gray-400">
                    {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : "—"}
                </p>
            </td>

            {/* Actions */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 justify-end flex-wrap">
                    {/* Role change */}
                    {user.role === "user" && (
                        <button
                            onClick={() => changeRole("moderator")}
                            disabled={acting || isBanned}
                            title="Make moderator"
                            className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-violet-600 dark:text-violet-400 transition-colors disabled:opacity-40"
                        >
                            <ShieldCheck size={13} />
                        </button>
                    )}
                    {user.role === "moderator" && (
                        <button
                            onClick={() => changeRole("user")}
                            disabled={acting}
                            title="Remove moderator"
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 transition-colors disabled:opacity-40"
                        >
                            <ShieldOff size={13} />
                        </button>
                    )}

                    {/* Ban / Unban */}
                    {!isBanned ? (
                        <button
                            onClick={() => onRoleChange(user.id, "ban", user.username)}
                            disabled={acting}
                            title="Ban user"
                            className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 rounded-lg transition-colors disabled:opacity-40"
                        >
                            Ban
                        </button>
                    ) : (
                        <button
                            onClick={() => onRoleChange(user.id, "unban", user.username)}
                            disabled={acting}
                            title="Unban user"
                            className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 rounded-lg transition-colors disabled:opacity-40"
                        >
                            Unban
                        </button>
                    )}

                    {/* ── Seize Bond — only visible if bond > 0 ── */}
                    {hasBond && !user.bond_seized_at && (
                        <button
                            onClick={() => onSeizeBond(user)}
                            disabled={acting}
                            title={`Seize ₦${user.seller_bond} bond & ban seller`}
                            className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50 rounded-lg transition-colors disabled:opacity-40 flex items-center gap-1"
                        >
                            <Lock size={10} /> Seize Bond
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
    const [users,   setUsers]   = useState([]);
    const [total,   setTotal]   = useState(0);
    const [page,    setPage]    = useState(1);
    const [loading, setLoading] = useState(true);
    const [search,  setSearch]  = useState("");
    const [role,    setRole]    = useState("");
    const [toast,   setToast]   = useState(null);

    // Bond seize modal state
    const [seizeTarget,  setSeizeTarget]  = useState(null);
    const [seizingBond,  setSeizingBond]  = useState(false);

    const showMsg = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    const load = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (role)   params.set("role", role);
        params.set("page", page);
        api.get(`/admin/users/?${params}`)
            .then(r => {
                const d = r.data;
                if (d?.results) {
                    setUsers(d.results);
                    setTotal(d.count ?? d.results.length);
                } else {
                    setUsers(Array.isArray(d) ? d : []);
                    setTotal(Array.isArray(d) ? d.length : 0);
                }
            })
            .catch(() => showMsg("error", "Failed to load users."))
            .finally(() => setLoading(false));
    }, [search, role, page]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { setPage(1); }, [search, role]);

    const handleRoleChange = async (userId, action, username) => {
        try {
            await api.patch(`/admin/users/${userId}/`, { action });
            showMsg("success", `Done — @${username} updated.`);
            load();
        } catch (e) {
            showMsg("error", e.response?.data?.error || "Action failed.");
        }
    };

    // ── Bond seize flow ───────────────────────────────────────────────────────
    const handleSeizeBond = (user) => setSeizeTarget(user);

    const confirmSeize = async () => {
        if (!seizeTarget) return;
        setSeizingBond(true);
        try {
            await api.post(`/admin/users/${seizeTarget.id}/seize-bond/`);
            showMsg("success", `Bond seized from @${seizeTarget.username}. Account banned.`);
            setSeizeTarget(null);
            load();
        } catch (e) {
            showMsg("error", e.response?.data?.error || "Seize failed.");
        } finally {
            setSeizingBond(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const ROLE_FILTERS = [
        { value: "",               label: "All Roles" },
        { value: "user",           label: "Users" },
        { value: "moderator",      label: "Moderators" },
        { value: "platform_owner", label: "Client Admin" },
        { value: "admin",          label: "Admins" },
    ];

    const TABLE_HEADERS = ["User", "Role", "Earned", "Bond", "Joined", "Actions"];

    return (
        <div className="space-y-6">
            {/* Seize modal */}
            {seizeTarget && (
                <SeizeBondModal
                    user={seizeTarget}
                    onConfirm={confirmSeize}
                    onCancel={() => setSeizeTarget(null)}
                    loading={seizingBond}
                />
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">All Users</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {total.toLocaleString()} registered account{total !== 1 ? "s" : ""}
                    </p>
                </div>
                <button onClick={load} className="btn-ghost text-sm flex items-center gap-2">
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
                </button>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
                    toast.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                }`}>
                    {toast.type === "success"
                        ? <CheckCircle size={14} />
                        : <XCircle size={14} />
                    }
                    {toast.msg}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, email, username…"
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                </div>
                <select
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    className="px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                    {ROLE_FILTERS.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <RefreshCw size={20} className="animate-spin text-brand-500" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-12 text-sm text-gray-400">
                        No users found.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-800">
                                    {TABLE_HEADERS.map(h => (
                                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ${
                                            h === "Role"   ? "hidden md:table-cell" :
                                            ["Earned", "Bond"].includes(h) ? "hidden lg:table-cell" :
                                            h === "Joined" ? "hidden xl:table-cell" : ""
                                        } ${h === "Actions" ? "text-right" : ""}`}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <UserRow
                                        key={u.id}
                                        user={u}
                                        onRoleChange={handleRoleChange}
                                        onSeizeBond={handleSeizeBond}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                        Page {page} of {totalPages} · {total} total users
                    </p>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                        >
                            <ChevronLeft size={15} />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                            const n = start + i;
                            return (
                                <button
                                    key={n}
                                    onClick={() => setPage(n)}
                                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                                        n === page
                                            ? "bg-brand-500 text-white"
                                            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
                                    }`}
                                >
                                    {n}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}