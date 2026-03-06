/**
 * src/pages/admin/Moderators.jsx
 * View, promote, and demote platform moderators.
 * Endpoints:
 *   GET   /api/v1/admin/users/?role=moderator
 *   GET   /api/v1/admin/users/?role=user (to search for users to promote)
 *   PATCH /api/v1/admin/users/<id>/role/  { role: "moderator" | "user" }
 */
import { useEffect, useState } from "react";
import {
    ShieldCheck, ShieldOff, Search, RefreshCw,
    UserPlus, User, Calendar, Mail, AlertTriangle, CheckCircle, X
} from "lucide-react";
import api from "../../services/api";

function Avatar({ username }) {
    return (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">
                {(username || "?")[0].toUpperCase()}
            </span>
        </div>
    );
}

function ModeratorCard({ user, onDemote }) {
    const [loading, setLoading] = useState(false);

    const demote = async () => {
        if (!confirm(`Remove moderator role from @${user.username}?`)) return;
        setLoading(true);
        try {
            await onDemote(user.id);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <Avatar username={user.username} />
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                {user.full_name || user.username}
                            </p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                                MOD
                            </span>
                        </div>
                        <p className="text-xs text-gray-400">@{user.username}</p>
                    </div>
                </div>
                <button
                    onClick={demote}
                    disabled={loading}
                    title="Remove moderator role"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                    <ShieldOff size={12} />
                    {loading ? "…" : "Demote"}
                </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Mail size={11} />
                    <span className="truncate">{user.email}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar size={11} />
                    {user.date_joined
                        ? new Date(user.date_joined).toLocaleDateString()
                        : "—"}
                </div>
            </div>
        </div>
    );
}

export default function ModeratorsPage() {
    const [mods, setMods]             = useState([]);
    const [loading, setLoading]       = useState(true);
    const [toast, setToast]           = useState(null);

    // Promote panel state
    const [showPromote, setShowPromote] = useState(false);
    const [query, setQuery]             = useState("");
    const [results, setResults]         = useState([]);
    const [searching, setSearching]     = useState(false);
    const [promoting, setPromoting]     = useState(null);

    const showMsg = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const load = () => {
        setLoading(true);
        api.get("/admin/users/?role=moderator")
            .then(r => setMods(r.data?.results ?? r.data ?? []))
            .catch(() => showMsg("error", "Failed to load moderators."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    // Search users to promote
    useEffect(() => {
        if (!query.trim()) { setResults([]); return; }
        const t = setTimeout(() => {
            setSearching(true);
            api.get(`/admin/users/?search=${encodeURIComponent(query)}&role=user`)
                .then(r => setResults(r.data?.results ?? r.data ?? []))
                .catch(() => {})
                .finally(() => setSearching(false));
        }, 400);
        return () => clearTimeout(t);
    }, [query]);

    const promote = async (userId, username) => {
        setPromoting(userId);
        try {
            await api.patch(`/admin/users/${userId}/role/`, { role: "moderator" });
            showMsg("success", `@${username} is now a moderator.`);
            setShowPromote(false);
            setQuery("");
            load();
        } catch (e) {
            showMsg("error", e.response?.data?.error || "Failed to promote user.");
        } finally {
            setPromoting(null);
        }
    };

    const demote = async (userId) => {
        try {
            await api.patch(`/admin/users/${userId}/role/`, { role: "user" });
            showMsg("success", "Moderator role removed.");
            load();
        } catch (e) {
            showMsg("error", e.response?.data?.error || "Failed to demote moderator.");
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Moderators</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {mods.length} active moderator{mods.length !== 1 ? "s" : ""} — manage dispute resolution access
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="btn-ghost text-sm flex items-center gap-2">
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={() => setShowPromote(v => !v)}
                        className="btn-primary text-sm flex items-center gap-2"
                    >
                        <UserPlus size={14} />
                        Promote User
                    </button>
                </div>
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

            {/* Promote Panel */}
            {showPromote && (
                <div className="card p-5 border-brand-200 dark:border-brand-800 bg-brand-50/30 dark:bg-brand-900/10">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={15} className="text-brand-500" />
                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                                Promote a User to Moderator
                            </h3>
                        </div>
                        <button onClick={() => { setShowPromote(false); setQuery(""); }}>
                            <X size={16} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by username or email…"
                            className="input pl-9 text-sm"
                        />
                    </div>
                    {searching && (
                        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                            <RefreshCw size={11} className="animate-spin" /> Searching…
                        </p>
                    )}
                    {results.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                            {results.map(u => (
                                <div
                                    key={u.id}
                                    className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <Avatar username={u.username} />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {u.full_name || u.username}
                                            </p>
                                            <p className="text-xs text-gray-400">@{u.username} · {u.email}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => promote(u.id, u.username)}
                                        disabled={promoting === u.id}
                                        className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold transition-colors disabled:opacity-50"
                                    >
                                        {promoting === u.id ? "…" : "Promote"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {query && !searching && results.length === 0 && (
                        <p className="text-xs text-gray-400 mt-3 text-center">No users found matching "{query}"</p>
                    )}
                </div>
            )}

            {/* Moderator grid */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <RefreshCw size={20} className="animate-spin text-brand-500" />
                </div>
            ) : mods.length === 0 ? (
                <div className="card p-12 text-center">
                    <ShieldCheck size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No moderators yet. Promote a user above to get started.
                    </p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {mods.map(m => (
                        <ModeratorCard key={m.id} user={m} onDemote={demote} />
                    ))}
                </div>
            )}
        </div>
    );
}