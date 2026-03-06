/**
 * src/components/layout/DashboardLayout.jsx
 *
 * Buyer/seller layout only. Moderators and owners never reach this —
 * PrivateRoute in App.jsx redirects them to /moderator and /admin first.
 */
import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, Package, PlusCircle, List, User,
    Settings, LogOut, Menu, TrendingUp, Store,
    BarChart3, X, Flag, Bell,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../ui/ThemeToggle";
import NotificationBell from "../ui/NotificationBell";

const NAV = [
    { to: "/dashboard",      icon: LayoutDashboard, label: "Dashboard"     },
    { to: "/orders",         icon: Package,         label: "My Orders"     },
    { to: "/disputes",       icon: Flag,            label: "My Disputes"   },
    { to: "/notifications",  icon: Bell,            label: "Notifications" },
    { to: "/sell/listings",  icon: List,            label: "My Listings"   },
    { to: "/sell",           icon: PlusCircle,      label: "New Listing",  exact: true },
    { to: "/store",          icon: Store,           label: "My Store"      },
    { to: "/sell/analytics", icon: BarChart3,       label: "Analytics"     },
    { to: "/profile",        icon: User,            label: "Profile"       },
    { to: "/settings",       icon: Settings,        label: "Settings"      },
];

const navCls = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
        isActive
            ? "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
            : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
    }`;

export default function DashboardLayout() {
    const [open, setOpen] = useState(false);
    const { user, logout } = useAuth();
    const navigate         = useNavigate();

    const Sidebar = () => (
        <aside className="flex flex-col h-full">
            <div className="px-4 py-5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                            <TrendingUp size={16} className="text-white" />
                        </div>
                        <span className="font-bold text-gray-900 dark:text-white">EscrowMarket</span>
                    </div>
                    <button className="lg:hidden text-gray-400" onClick={() => setOpen(false)}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {NAV.map(({ to, icon: Icon, label, exact }) => (
                    <NavLink key={to} to={to} end={exact} className={navCls} onClick={() => setOpen(false)}>
                        <Icon size={16} /> {label}
                    </NavLink>
                ))}
            </nav>

            <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 px-2 py-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 font-semibold text-sm flex-shrink-0">
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.username}</p>
                        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                    </div>
                </div>
                <button
                    onClick={() => { logout(); navigate("/login"); }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                >
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </aside>
    );

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
            <div className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <Sidebar />
            </div>
            {open && (
                <div className="lg:hidden fixed inset-0 z-40 flex">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
                    <div className="relative z-50 flex flex-col w-56 bg-white dark:bg-gray-900 shadow-xl">
                        <Sidebar />
                    </div>
                </div>
            )}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                    <button
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => setOpen(true)}
                    >
                        <Menu size={18} />
                    </button>
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