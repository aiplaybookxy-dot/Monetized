/**
 * src/components/layout/AdminLayout.jsx
 * Amber sidebar — exclusive to platform_owner / admin / is_superuser
 */
import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, DollarSign, Users, Settings2,
    BarChart3, ShieldCheck, LogOut, Menu, X,
    TrendingUp, Wallet, ScrollText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../ui/ThemeToggle";
import NotificationBell from "../ui/NotificationBell";

const NAV = [
    { to: "/admin",             icon: LayoutDashboard, label: "Overview",         exact: true },
    { to: "/admin/revenue",     icon: DollarSign,      label: "Revenue"                       },
    { to: "/admin/withdrawals", icon: Wallet,          label: "Withdrawals"                   },
    { to: "/admin/users",       icon: Users,           label: "Users"                         },
    { to: "/admin/commission",  icon: BarChart3,       label: "Commission"                    },
    { to: "/admin/moderators",  icon: ShieldCheck,     label: "Moderators"                    },
    { to: "/admin/logs",        icon: ScrollText,      label: "System Logs"                   },
    { to: "/admin/settings",    icon: Settings2,       label: "Platform Settings"             },
];

const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
        isActive
            ? "bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-400"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

function Sidebar({ onClose }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    return (
        <aside className="flex flex-col h-full">
            <div className="px-4 py-5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                            <TrendingUp size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm leading-none">Admin Panel</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">EscrowMarket Platform</p>
                        </div>
                    </div>
                    <button className="lg:hidden text-gray-400" onClick={onClose}><X size={18} /></button>
                </div>
                <Link to="/dashboard" onClick={onClose}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-amber-500 transition-colors">
                    ← Back to Marketplace
                </Link>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {NAV.map(({ to, icon: Icon, label, exact }) => (
                    <NavLink key={to} to={to} end={exact} className={linkClass} onClick={onClose}>
                        <Icon size={16} /> {label}
                    </NavLink>
                ))}
            </nav>
            <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold text-sm flex-shrink-0">
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.username}</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wide font-semibold">Platform Owner</p>
                    </div>
                </div>
                <button onClick={() => { logout(); navigate("/login"); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors">
                    <LogOut size={14} /> Sign Out
                </button>
            </div>
        </aside>
    );
}

export default function AdminLayout() {
    const [open, setOpen] = useState(false);
    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
            <div className="hidden lg:flex flex-col w-56 shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <Sidebar onClose={() => {}} />
            </div>
            {open && (
                <div className="lg:hidden fixed inset-0 z-40 flex">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
                    <div className="relative z-50 flex flex-col w-56 bg-white dark:bg-gray-900 shadow-2xl">
                        <Sidebar onClose={() => setOpen(false)} />
                    </div>
                </div>
            )}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                    <button className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setOpen(true)}>
                        <Menu size={18} />
                    </button>
                    <span className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full">
                        <TrendingUp size={11} /> Platform Admin
                    </span>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1">
                        <NotificationBell />
                        <ThemeToggle />
                    </div>
                </header>
                <main className="flex-1 overflow-y-auto p-4 lg:p-6"><Outlet /></main>
            </div>
        </div>
    );
}