/**
 * src/components/guards/AdminRoute.jsx
 *
 * Allows: role === "platform_owner" | role === "admin" | is_superuser
 * "admin" is the legacy role assigned by createsuperuser before
 * PLATFORM_OWNER was added to the enum.
 */
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../ui/LoadingSpinner";

export default function AdminRoute({ children }) {
    const { user, isLoading } = useAuth();
    if (isLoading) return <LoadingSpinner fullscreen />;
    if (!user)     return <Navigate to="/login" replace />;

    const isOwner =
        user.is_superuser ||
        user.role === "platform_owner" ||
        user.role === "admin";

    if (!isOwner) return <Navigate to="/dashboard" replace />;
    return children;
}