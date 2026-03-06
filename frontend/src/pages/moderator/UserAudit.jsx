import { useState, useEffect, useCallback } from "react";
import { Search, Users, ArrowLeft, Shield, Activity, Package, ShoppingBag } from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

function UserRow({ user, onSelect }) {
    return (
        <button
            onClick={() => onSelect(user)}
            className="w-full text-left flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
        >
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-sm flex-shrink-0">
                    {user.username?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">@{user.username}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                {user.role !== "user" && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${user.role === "admin" ? "bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" :
                            "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        }`}>
                        {user.role.toUpperCase()}
                    </span>
                )}
                <div className="text-right">
                    <p className="text-xs font-medium text-gray-900 dark:text-white">{user.activity_count} actions</p>
                    <p className="text-[10px] text-gray-400">{user.completed_sales}s / {user.completed_purchases}p</p>
                </div>
                <span className="text-gray-300 group-hover:text-brand-400 transition-colors">›</span>
            </div>
        </button>
    );
}

function UserProfile({ user, onBack }) {
    const [logs, setLogs] = useState([]);
    const [logsLoading, setLogsLoading] = useState(true);

    useEffect(() => {
        api.get(`/activity/logs/user/${user.id}/`)
            .then((r) => setLogs(r.data.results || []))
            .catch(() => { })
            .finally(() => setLogsLoading(false));
    }, [user.id]);

    const ACTION_COLOR = {
        VAULT_VIEWED: "text-purple-500 bg-purple-50 dark:bg-purple-900/20",
        ORDER_DISPUTED: "text-red-500 bg-red-50 dark:bg-red-900/20",
        ORDER_COMPLETED: "text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
        LOGIN: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
        DEFAULT: "text-gray-500 bg-gray-100 dark:bg-gray-800",
    };

    return (
        <div className="space-y-5">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <ArrowLeft size={14} /> Back to users
            </button>

            {/* Profile card */}
            <div className="card p-6">
                <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 text-2xl font-bold">
                        {user.username?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">@{user.username}</h2>
                            {user.role !== "user" && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">
                                    {user.role.toUpperCase()}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-400">{user.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Joined {new Date(user.date_joined).toLocaleDateString()} ·
                            Last active {user.last_active_at ? new Date(user.last_active_at).toLocaleString() : "Unknown"}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                        { icon: ShoppingBag, label: "Spent", value: `₦${Number(user.total_spent || 0).toLocaleString()}` },
                        { icon: Activity, label: "Earned", value: `₦${Number(user.total_earned || 0).toLocaleString()}` },
                        { icon: Package, label: "Sales", value: user.completed_sales },
                        { icon: Shield, label: "Log Entries", value: user.activity_count },
                    ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 text-center">
                            <Icon size={14} className="text-brand-500 mx-auto mb-1" />
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{value}</p>
                            <p className="text-[10px] text-gray-400">{label}</p>
                        </div>
                    ))}
                </div>

                {user.last_login_ip && (
                    <p className="text-xs text-gray-400 mt-3 font-mono">
                        Last login IP: <span className="text-gray-600 dark:text-gray-300">{user.last_login_ip}</span>
                    </p>
                )}
            </div>

            {/* Activity log */}
            <div className="card p-5">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Activity Log</h3>
                {logsLoading ? (
                    <LoadingSpinner size="sm" />
                ) : logs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No activity logged yet.</p>
                ) : (
                    <div className="space-y-0 divide-y divide-gray-50 dark:divide-gray-800 max-h-80 overflow-y-auto">
                        {logs.map((log) => {
                            const colorClass = ACTION_COLOR[log.action] || ACTION_COLOR.DEFAULT;
                            return (
                                <div key={log.id} className="flex items-start justify-between py-3 gap-3">
                                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5 ${colorClass}`}>
                                            {log.action}
                                        </span>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{log.description}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-[10px] font-mono text-gray-400">{log.ip_address}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(log.timestamp).toLocaleString()}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function UserAuditPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = search ? `?search=${encodeURIComponent(search)}` : "";
            const r = await api.get(`/mod/users/${params}`);
            setUsers(r.data.results || r.data || []);
        } catch { }
        setLoading(false);
    }, [search]);

    useEffect(() => {
        const t = setTimeout(fetchUsers, 300);
        return () => clearTimeout(t);
    }, [fetchUsers]);

    if (selected) {
        return (
            <div className="max-w-2xl mx-auto">
                <UserProfile user={selected} onBack={() => setSelected(null)} />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Users size={20} className="text-brand-500" /> User Audits
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Search and audit user accounts and transaction history
                </p>
            </div>

            <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by username, email or name…"
                    className="input pl-9"
                />
            </div>

            <div className="card overflow-hidden">
                {loading ? <LoadingSpinner /> : users.length === 0 ? (
                    <p className="text-center text-sm text-gray-400 py-10">No users found.</p>
                ) : (
                    <div className="divide-y divide-gray-50 dark:divide-gray-800">
                        {users.map((u) => (
                            <UserRow key={u.id} user={u} onSelect={setSelected} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}