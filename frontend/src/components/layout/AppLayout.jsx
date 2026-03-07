/**
 * src/components/layout/AppLayout.jsx
 *
 * ONE layout for all authenticated users.
 * Nav items, accent color, and portal badge all derive from user.role.
 *
 * role === "admin"     → amber sidebar  → admin routes
 * role === "moderator" → rose sidebar   → mod routes
 * role === "user"      → brand sidebar  → buyer/seller routes
 *
 * WHY one layout instead of three:
 *   Separate layouts require three separate route guards.
 *   Any mismatch between a guard's role check and the actual role
 *   stored on the user object causes mods/admins to fall through to
 *   the user layout. One layout that reads user.role directly can
 *   never get out of sync with the auth state.
 */
import { useState } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import {
    LayoutDashboard, Package, PlusCircle, List, User,
    Settings, LogOut, Menu, TrendingUp, Store, BarChart3,
    Flag, Bell, X, ShieldAlert, DollarSign, Users, Wallet,
    ScrollText, Settings2, ShieldCheck, Upload,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../ui/ThemeToggle";
import NotificationBell from "../ui/NotificationBell";

// ── Nav definitions per role ──────────────────────────────────────────────────

const USER_NAV = [
    { to: "/dashboard",      icon: LayoutDashboard, label: "Dashboard",     exact: true },
    { to: "/orders",         icon: Package,         label: "My Orders"                  },
    { to: "/disputes",       icon: Flag,            label: "My Disputes"                },
    { to: "/wallet",         icon: Wallet,          label: "Wallet"                     },
    { to: "/notifications",  icon: Bell,            label: "Notifications"              },
    { to: "/sell/listings",  icon: List,            label: "My Listings"                },
    { to: "/sell",           icon: PlusCircle,      label: "New Listing",   exact: true },
    { to: "/store",          icon: Store,           label: "My Store"                   },
    { to: "/sell/analytics", icon: BarChart3,       label: "Analytics"                  },
    { to: "/profile",        icon: User,            label: "Profile"                    },
    { to: "/settings",       icon: Settings,        label: "Settings"                   },
];

const MOD_NAV = [
    { to: "/moderator",             icon: BarChart3,   label: "Overview",       exact: true },
    { to: "/moderator/disputes",    icon: ShieldAlert, label: "Disputes"                    },
    { to: "/moderator/listings",    icon: Upload,      label: "Listing Queue"               },
    { to: "/moderator/vault-queue", icon: ShieldCheck, label: "Vault Queue"                 },
    { to: "/moderator/users",       icon: Users,       label: "User Audits"                 },
    { to: "/moderator/logs",        icon: ScrollText,  label: "System Log"                  },
];

const ADMIN_NAV = [
    { to: "/admin",             icon: LayoutDashboard, label: "Overview",          exact: true },
    { to: "/admin/revenue",     icon: DollarSign,      label: "Revenue"                        },
    { to: "/admin/withdrawals", icon: Wallet,          label: "Withdrawals"                    },
    { to: "/admin/users",       icon: Users,           label: "All Users"                      },
    { to: "/admin/moderators",  icon: ShieldCheck,     label: "Moderators"                     },
    { to: "/admin/logs",        icon: ScrollText,      label: "System Logs"                    },
    { to: "/admin/settings",    icon: Settings2,       label: "Platform Settings"              },
];

// ── Theme tokens per role ─────────────────────────────────────────────────────

const ROLE_THEME = {
    admin: {
        dot:    "bg-amber-500",
        avatar: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400",
        active: "bg-amber-50 dark:bg-amber-900/25 text-amber-700 dark:text-amber-400",
        badge:  "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400",
        label:  "Platform Owner",
        tag:    "ADMIN",
    },
    moderator: {
        dot:    "bg-rose-500",
        avatar: "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400",
        active: "bg-rose-50 dark:bg-rose-900/25 text-rose-600 dark:text-rose-400",
        badge:  "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400",
        label:  "Moderator Portal",
        tag:    "MOD",
    },
    user: {
        dot:    "bg-brand-500",
        avatar: "bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400",
        active: "bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400",
        badge:  "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400",
        label:  "EscrowMarket",
        tag:    null,
    },
};

function getRole(user) {
    if (!user) return "user";
    if (user.is_superuser || user.role === "admin" || user.role === "platform_owner")
        return "admin";
    if (user.role === "moderator") return "moderator";
    return "user";
}

function getNav(role) {
    if (role === "admin")     return ADMIN_NAV;
    if (role === "moderator") return MOD_NAV;
    return USER_NAV;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ role, theme, user, nav, onClose, onLogout }) {
    const inactive =
        "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800";

    return (
        <aside className="flex flex-col h-full">
            {/* Brand */}
            <div className="px-4 py-5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 ${theme.dot} rounded-lg flex items-center justify-center`}>
                            <TrendingUp size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm leading-none">
                                {theme.label}
                            </p>
                            {role !== "user" && (
                                <p className="text-[10px] text-gray-400 mt-0.5">EscrowMarket Platform</p>
                            )}
                        </div>
                    </div>
                    <button className="lg:hidden text-gray-400 hover:text-gray-600" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>
                {/* Back link for privileged roles */}
                {role !== "user" && (
                    <Link to="/dashboard" onClick={onClose}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-500 transition-colors">
                        ← Back to Marketplace
                    </Link>
                )}
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {nav.map(({ to, icon: Icon, label, exact }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={exact}
                        onClick={onClose}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                                isActive ? theme.active : inactive
                            }`
                        }
                    >
                        <Icon size={16} />
                        {label}
                    </NavLink>
                ))}
            </nav>

            {/* User footer */}
            <div className="px-3 py-4 border-t border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-3 px-2 py-2 mb-1">
                    <div className={`w-8 h-8 rounded-full ${theme.avatar} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                        {user?.username?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {user?.username}
                        </p>
                        {theme.tag ? (
                            <p className={`text-[10px] uppercase tracking-wide font-semibold ${theme.badge.split(" ").filter(c => c.startsWith("text-")).join(" ")}`}>
                                {theme.tag}
                            </p>
                        ) : (
                            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                        )}
                    </div>
                </div>
                <button
                    onClick={onLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                >
                    <LogOut size={16} /> Sign Out
                </button>
            </div>
        </aside>
    );
}

// ── Layout ────────────────────────────────────────────────────────────────────

export default function AppLayout() {
    const [open, setOpen]  = useState(false);
    const { user, logout } = useAuth();
    const navigate         = useNavigate();

    const role  = getRole(user);
    const theme = ROLE_THEME[role];
    const nav   = getNav(role);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    const sidebarProps = {
        role, theme, user, nav,
        onClose:  () => setOpen(false),
        onLogout: handleLogout,
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">

            {/* Desktop sidebar */}
            <div className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                <Sidebar {...sidebarProps} onClose={() => {}} />
            </div>

            {/* Mobile overlay */}
            {open && (
                <div className="lg:hidden fixed inset-0 z-40 flex">
                    <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />
                    <div className="relative z-50 flex flex-col w-56 bg-white dark:bg-gray-900 shadow-2xl">
                        <Sidebar {...sidebarProps} />
                    </div>
                </div>
            )}

            {/* Main content area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {/* Topbar */}
                <header className="flex items-center justify-between px-4 lg:px-6 h-14 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                    <button
                        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
                        onClick={() => setOpen(true)}
                    >
                        <Menu size={18} />
                    </button>

                    {/* Role badge — only visible on desktop for privileged roles */}
                    {role !== "user" && (
                        <span className={`hidden lg:flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full ${theme.badge}`}>
                            {role === "admin"     && <TrendingUp size={11}  />}
                            {role === "moderator" && <ShieldAlert size={11} />}
                            {theme.label}
                        </span>
                    )}

                    <div className="flex-1" />
                    <div className="flex items-center gap-1">
                        <NotificationBell />
                        <ThemeToggle />
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 lg:p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}