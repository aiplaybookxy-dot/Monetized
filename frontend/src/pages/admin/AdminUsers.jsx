/**
 * src/pages/admin/AdminUsers.jsx
 * Full user management — search, filter by role, suspend/activate, view stats.
 * Endpoints:
 *   GET   /api/v1/admin/users/?search=&role=
 *   PATCH /api/v1/admin/users/<id>/role/  { role: "moderator"|"user" }
 */
import { useEffect, useState, useCallback } from "react";
import {
    Users, Search, RefreshCw, Filter, ShieldCheck,
    ShieldOff, UserCheck, UserX, ChevronLeft, ChevronRight,
    Mail, Calendar, Star, AlertTriangle, CheckCircle
} from "lucide-react";
import api from "../../services/api";

function fmt(n) {
    return `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

const ROLE_STYLE = {
    admin:     "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400",
    platform_owner:     "bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400",
    moderator: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400",
    user:      "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

function Avatar({ username, size = "sm" }) {
    const s = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm";
    return (
        <div className={`${s} rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0`}>
            <span className="text-white font-bold">{(username || "?")[0].toUpperCase()}</span>
        </div>
    );
}

function UserRow({ user, onRoleChange }) {
    const [acting, setActing] = useState(false);

    const changeRole = async (newRole) => {
        if (!confirm(`Change @${user.username}'s role to "${newRole}"?`)) return;
        setActing(true);
        try {
            await onRoleChange(user.id, newRole, user.username);
        } finally {
            setActing(false);
        }
    };

    return (
        <tr className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
            {/* User */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                    <Avatar username={user.username} />
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
                            {user.full_name || user.username}
                        </p>
                        <p className="text-xs text-gray-400">@{user.username}</p>
                    </div>
                </div>
            </td>
            {/* Email */}
            <td className="px-4 py-3 hidden md:table-cell">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Mail size={11} />
                    <span className="truncate max-w-[180px]">{user.email}</span>
                </div>
            </td>
            {/* Role */}
            <td className="px-4 py-3">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${ROLE_STYLE[user.role] || ROLE_STYLE.user}`}>
                    {user.role}
                </span>
            </td>
            {/* Financials */}
            <td className="px-4 py-3 hidden lg:table-cell text-right">
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{fmt(user.total_earned)}</p>
                <p className="text-[10px] text-gray-400">earned</p>
            </td>
            <td className="px-4 py-3 hidden lg:table-cell text-right">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{fmt(user.total_spent)}</p>
                <p className="text-[10px] text-gray-400">spent</p>
            </td>
            {/* Joined */}
            <td className="px-4 py-3 hidden xl:table-cell">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Calendar size={11} />
                    {user.date_joined ? new Date(user.date_joined).toLocaleDateString() : "—"}
                </div>
            </td>
            {/* Actions */}
            <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 justify-end">
                    {user.role === "user" && (
                        <button
                            onClick={() => changeRole("moderator")}
                            disabled={acting}
                            title="Make moderator"
                            className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40 text-violet-600 dark:text-violet-400 transition-colors disabled:opacity-50"
                        >
                            <ShieldCheck size={13} />
                        </button>
                    )}
                    {user.role === "moderator" && (
                        <button
                            onClick={() => changeRole("user")}
                            disabled={acting}
                            title="Remove moderator"
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-500 dark:text-red-400 transition-colors disabled:opacity-50"
                        >
                            <ShieldOff size={13} />
                        </button>
                    )}
                </div>
            </td>
        </tr>
    );
}

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
    const [users, setUsers]     = useState([]);
    const [total, setTotal]     = useState(0);
    const [page, setPage]       = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch]   = useState("");
    const [role, setRole]       = useState("");
    const [toast, setToast]     = useState(null);

    const showMsg = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
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

    // Reset page on filter change
    useEffect(() => { setPage(1); }, [search, role]);

    const handleRoleChange = async (userId, newRole, username) => {
        try {
            await api.patch(`/admin/users/${userId}/role/`, { role: newRole });
            showMsg("success", `@${username} is now "${newRole}".`);
            load();
        } catch (e) {
            showMsg("error", e.response?.data?.error || "Role change failed.");
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const ROLE_FILTERS = [
        { value: "",          label: "All Roles" },
        { value: "user",      label: "Users" },
        { value: "moderator", label: "Moderators" },
        { value: "platform_owner", label: "Client Admin" },
        { value: "admin",     label: "Admins" },
    ];

    return (
        <div className="space-y-6">
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
                    {toast.type === "success" ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                    {toast.msg}
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 max-w-xs">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search username, email, name…"
                        className="input pl-9 text-sm"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter size={14} className="text-gray-400" />
                    <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1">
                        {ROLE_FILTERS.map(f => (
                            <button
                                key={f.value}
                                onClick={() => setRole(f.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    role === f.value
                                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48">
                        <RefreshCw size={20} className="animate-spin text-brand-500" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-12 text-center">
                        <Users size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 text-sm">No users found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-800">
                                    {["User", "Email", "Role", "Earned", "Spent", "Joined", "Actions"].map(h => (
                                        <th
                                            key={h}
                                            className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide ${
                                                ["Email"].includes(h) ? "hidden md:table-cell" :
                                                ["Earned", "Spent"].includes(h) ? "hidden lg:table-cell" :
                                                h === "Joined" ? "hidden xl:table-cell" : ""
                                            } ${h === "Actions" ? "text-right" : ""}`}
                                        >
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <UserRow key={u.id} user={u} onRoleChange={handleRoleChange} />
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
                                            : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
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