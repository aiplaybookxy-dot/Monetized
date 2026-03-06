/**
 * src/components/guards/ModeratorRoute.jsx
 *
 * ONLY allows role === "moderator".
 *
 * WHY not "admin" or "platform_owner":
 *   Platform owners have their own dedicated /admin route and layout.
 *   If an owner could also access /moderator, they'd see the wrong
 *   layout and have confusing duplicate access. Roles are mutually
 *   exclusive in terms of their portal:
 *     user          → /dashboard  (DashboardLayout)
 *     moderator     → /moderator  (ModeratorLayout)
 *     admin/owner   → /admin      (AdminDashboard standalone)
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../ui/LoadingSpinner";

export default function ModeratorRoute({ children }) {
    const { user, isLoading, isAuthenticated } = useAuth();

    if (isLoading) return <LoadingSpinner fullscreen />;
    if (!isAuthenticated) return <Navigate to="/login" replace />;

    // Platform owners who land here get sent to their own portal
    if (user.role === "platform_owner" || user.role === "admin" || user.is_superuser) {
        return <Navigate to="/admin" replace />;
    }

    if (user.role !== "moderator") {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}