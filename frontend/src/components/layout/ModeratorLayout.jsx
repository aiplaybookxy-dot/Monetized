import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
    ShieldAlert, Users, List, BarChart3, Menu,
    LogOut, TrendingUp, ChevronLeft, ScrollText,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../ui/ThemeToggle";
import NotificationBell from "../ui/NotificationBell";

const NAV = [
    { to: "/moderator", icon: BarChart3, label: "Overview", exact: true },
    { to: "/moderator/disputes", icon: ShieldAlert, label: "Disputes" },
    { to: "/moderator/listings", icon: List, label: "Listing Queue" },
    { to: "/moderator/users", icon: Users, label: "User Audits" },
    { to: "/moderator/logs", icon: ScrollText, label: "System Log" },
];

export default function ModeratorLayout() {
    const [open, setOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const linkClass = ({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${isActive
            ? "bg-rose-50 dark:bg-rose-900/25 text-rose-600 dark:text-rose-400"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
        }`;

    const Sidebar = () => (
        <aside className="flex flex-col h-full">
            {/* Brand strip */}
            <div className="px-4 py-5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center">
                        <ShieldAlert size={15} className="text-white" />
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm leading-none">Moderator</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">EscrowMarket Portal</p>
                    </div>
                </div>
                <Link
                    to="/dashboard"
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-500 transition-colors"
                >
                    <ChevronLeft size={12} /> Back to Marketplace
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {NAV.map(({ to, icon: Icon, label, exact }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={exact}
                        className={linkClass}
                        onClick={() => setOpen(false)}
                    >
                        <Icon size={16} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* User footer */}
            <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 font-bold text-xs flex-shrink-0">
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{user?.username}</p>
                        <p className="text-[10px] text-rose-500 uppercase tracking-wide font-semibold">
                            {user?.role}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { logout(); navigate("/login"); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium
                     text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                >
                    <LogOut size={13} /> Sign Out
                </button>
            </div>
        </aside>
    );

    return (
        <div className="flex h-screen bg-surface-light dark:bg-surface-dark overflow-hidden">
            {/* Desktop sidebar */}
            <div className="hidden lg:flex flex-col w-52 shrink-0 border-r border-gray-100 dark:text-white dark:border-gray-800 bg-white dark:bg-gray-900 ">
                <Sidebar />
            </div>

            {/* Mobile overlay */}
            {open && (
                <div className="lg:hidden fixed inset-0 z-40 flex">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
                    <div className="relative z-50 flex flex-col w-52 bg-white dark:bg-gray-900 shadow-2xl">
                        <Sidebar />
                    </div>
                </div>
            )}

            {/* Main */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                    <button
                        className="lg:hidden btn-ghost w-9 h-9 flex items-center justify-center"
                        onClick={() => setOpen(true)}
                    >
                        <Menu size={18} />
                    </button>
                    {/* Moderator badge */}
                    <span className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-3 py-1 rounded-full">
                        <ShieldAlert size={11} /> Moderator Portal
                    </span>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1">
                        <NotificationBell />
                        <ThemeToggle />
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}