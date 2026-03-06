/**
 * src/App.jsx
 *
 * Single AppLayout for all authenticated routes.
 * The layout itself reads user.role and shows the correct nav.
 *
 * Route guards (RoleRoute) protect individual route trees from
 * direct URL access — they do NOT control which layout is shown.
 *
 * Role → home mapping (must match Login.jsx getRoleHome):
 *   admin / platform_owner / superuser  → /admin
 *   moderator                           → /moderator
 *   user                                → /dashboard
 */
import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import AppLayout      from "./components/layout/AppLayout";
import LoadingSpinner from "./components/ui/LoadingSpinner";

// ── Public ────────────────────────────────────────────────────────────────────
const HomePage       = lazy(() => import("./pages/Home"));
const LoginPage      = lazy(() => import("./pages/auth/Login"));
const RegisterPage   = lazy(() => import("./pages/auth/Register"));
const AccountDetail  = lazy(() => import("./pages/listing/AccountDetail"));
const StorefrontPage = lazy(() => import("./pages/store/Storefront"));
const PaymentVerify  = lazy(() => import("./pages/payment/Verify"));
const NotFound       = lazy(() => import("./pages/NotFound"));

// ── Buyer / Seller ────────────────────────────────────────────────────────────
const DashboardPage = lazy(() => import("./pages/dashboard/Dashboard"));
const OrdersPage    = lazy(() => import("./pages/orders/Orders"));
const OrderDetail   = lazy(() => import("./pages/orders/OrderDetailPage"));
const SellPage      = lazy(() => import("./pages/sell/CreateListing"));
const MyListings    = lazy(() => import("./pages/sell/MyListings"));
const ProfilePage   = lazy(() => import("./pages/profile/Profile"));
const SettingsPage  = lazy(() => import("./pages/settings/Settings"));
const StoreSettings = lazy(() => import("./pages/store/StoreSettings"));

// ── Moderator ─────────────────────────────────────────────────────────────────
const ModeratorDashboard = lazy(() => import("./pages/moderator/ModeratorDashboard"));
const DisputeManager     = lazy(() => import("./pages/moderator/DisputeManager"));
const ListingApprovals   = lazy(() => import("./pages/moderator/ListingApprovals"));
const UserAudit          = lazy(() => import("./pages/moderator/UserAudit"));
const ModSystemLog       = lazy(() => import("./pages/admin/SystemLog"));

// ── Admin ─────────────────────────────────────────────────────────────────────
const AdminDashboard   = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminRevenue     = lazy(() => import("./pages/admin/Revenue"));
const AdminWithdrawals = lazy(() => import("./pages/admin/Withdrawals"));
const AdminUsers       = lazy(() => import("./pages/admin/AdminUsers"));
const AdminModerators  = lazy(() => import("./pages/admin/Moderators"));
const AdminLogs        = lazy(() => import("./pages/admin/SystemLog"));
const AdminSettings    = lazy(() => import("./pages/admin/PlatformSettings"));


// ── Role helpers ──────────────────────────────────────────────────────────────

export function getRoleHome(user) {
    if (!user) return "/login";
    if (user.is_superuser || user.role === "admin" || user.role === "platform_owner")
        return "/admin";
    if (user.role === "moderator") return "/moderator";
    return "/dashboard";
}

function isAdmin(user) {
    return user?.is_superuser || user?.role === "admin" || user?.role === "platform_owner";
}

function isModerator(user) {
    return user?.role === "moderator";
}


// ── Route guards ──────────────────────────────────────────────────────────────

/** Redirect to login if not authenticated. */
function PrivateRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) return <LoadingSpinner fullscreen />;
    return isAuthenticated ? children : <Navigate to="/login" replace />;
}

/**
 * Block /login and /register for authenticated users.
 * Sends each role to their own home.
 */
function PublicOnlyRoute({ children }) {
    const { user, isAuthenticated, isLoading } = useAuth();
    if (isLoading) return <LoadingSpinner fullscreen />;
    if (isAuthenticated) return <Navigate to={getRoleHome(user)} replace />;
    return children;
}

/** Protect /admin/* routes — only admins get through. */
function AdminRoute({ children }) {
    const { user, isLoading, isAuthenticated } = useAuth();
    if (isLoading) return <LoadingSpinner fullscreen />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (!isAdmin(user))   return <Navigate to={getRoleHome(user)} replace />;
    return children;
}

/** Protect /moderator/* routes — only moderators get through. */
function ModRoute({ children }) {
    const { user, isLoading, isAuthenticated } = useAuth();
    if (isLoading) return <LoadingSpinner fullscreen />;
    if (!isAuthenticated)  return <Navigate to="/login" replace />;
    // Admins attempting /moderator get sent to their own portal
    if (isAdmin(user))     return <Navigate to="/admin" replace />;
    if (!isModerator(user)) return <Navigate to="/dashboard" replace />;
    return children;
}

/** Protect /dashboard/* routes — block privileged roles from user routes. */
function UserRoute({ children }) {
    const { user, isLoading, isAuthenticated } = useAuth();
    if (isLoading) return <LoadingSpinner fullscreen />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    // Admins/mods who manually type /dashboard get redirected to their portal
    if (isAdmin(user))     return <Navigate to="/admin"     replace />;
    if (isModerator(user)) return <Navigate to="/moderator" replace />;
    return children;
}


// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
    return (
        <Suspense fallback={<LoadingSpinner fullscreen />}>
            <Routes>

                {/* ── Fully public ───────────────────────────────────────── */}
                <Route path="/"               element={<HomePage />} />
                <Route path="/listing/:id"    element={<AccountDetail />} />
                <Route path="/m/:slug"        element={<StorefrontPage />} />
                <Route path="/payment/verify" element={<PaymentVerify />} />

                {/* ── Auth (redirect away if already logged in) ───────────── */}
                <Route path="/login"
                    element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
                <Route path="/register"
                    element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />

                {/* ── All authenticated routes share ONE layout ────────────── */}
                <Route
                    path="/"
                    element={
                        <PrivateRoute>
                            <AppLayout />
                        </PrivateRoute>
                    }
                >
                    {/* Regular user / buyer / seller */}
                    <Route path="dashboard"
                        element={<UserRoute><DashboardPage /></UserRoute>} />
                    <Route path="orders"
                        element={<UserRoute><OrdersPage /></UserRoute>} />
                    <Route path="orders/:id"
                        element={<UserRoute><OrderDetail /></UserRoute>} />
                    <Route path="sell"
                        element={<UserRoute><SellPage /></UserRoute>} />
                    <Route path="sell/listings"
                        element={<UserRoute><MyListings /></UserRoute>} />
                    <Route path="profile"
                        element={<UserRoute><ProfilePage /></UserRoute>} />
                    <Route path="settings"
                        element={<UserRoute><SettingsPage /></UserRoute>} />
                    <Route path="store"
                        element={<UserRoute><StoreSettings /></UserRoute>} />
                    <Route path="sell/listings/:id/vault" 
                        element={<UserRoute><ListingVaultUpload /></UserRoute>} />

                    {/* Moderator portal */}
                    <Route path="moderator"
                        element={<ModRoute><ModeratorDashboard /></ModRoute>} />
                    <Route path="moderator/disputes"
                        element={<ModRoute><DisputeManager /></ModRoute>} />
                    <Route path="moderator/listings"
                        element={<ModRoute><ListingApprovals /></ModRoute>} />
                    <Route path="moderator/users"
                        element={<ModRoute><UserAudit /></ModRoute>} />
                    <Route path="moderator/logs"
                        element={<ModRoute><ModSystemLog /></ModRoute>} />

                    {/* Admin portal */}
                    <Route path="admin"
                        element={<AdminRoute><AdminDashboard /></AdminRoute>} />
                    <Route path="admin/revenue"
                        element={<AdminRoute><AdminRevenue /></AdminRoute>} />
                    <Route path="admin/withdrawals"
                        element={<AdminRoute><AdminWithdrawals /></AdminRoute>} />
                    <Route path="admin/users"
                        element={<AdminRoute><AdminUsers /></AdminRoute>} />
                    <Route path="admin/moderators"
                        element={<AdminRoute><AdminModerators /></AdminRoute>} />
                    <Route path="admin/logs"
                        element={<AdminRoute><AdminLogs /></AdminRoute>} />
                    <Route path="admin/settings"
                        element={<AdminRoute><AdminSettings /></AdminRoute>} />
                </Route>

                {/* ── 404 ─────────────────────────────────────────────────── */}
                <Route path="*" element={<NotFound />} />

            </Routes>
        </Suspense>
    );
}