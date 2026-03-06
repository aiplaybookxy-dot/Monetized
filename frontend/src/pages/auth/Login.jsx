/**
 * src/pages/auth/Login.jsx
 *
 * CRITICAL FIX:
 *   login() now returns the user object. We read user.role immediately
 *   after login and navigate to the role-correct portal.
 *
 *   Before: always navigated to `from || "/dashboard"` — mods and
 *           admins both landed on /dashboard and saw the user layout.
 *   After:  getRoleHome(user) returns /admin, /moderator, or /dashboard
 *           based on the role returned by the API.
 */
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { TrendingUp, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../../components/ui/ThemeToggle";

/** Must match getRoleHome() in App.jsx — single source of truth */
function getRoleHome(user) {
    if (!user) return "/dashboard";
    if (user.is_superuser || user.role === "admin" || user.role === "platform_owner")
        return "/admin";
    if (user.role === "moderator")
        return "/moderator";
    return "/dashboard";
}

export default function LoginPage() {
    const [form,   setForm]   = useState({ email: "", password: "" });
    const [showPw, setShowPw] = useState(false);
    const [error,  setError]  = useState("");
    const [loading, setLoading] = useState(false);

    const { login }  = useAuth();
    const navigate   = useNavigate();
    const location   = useLocation();

    // If another page redirected here (e.g. PrivateRoute), honour it —
    // but only for regular users. Admins/mods always go to their portal.
    const intendedPath = location.state?.from?.pathname;

    const handleChange = (e) =>
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            // login() → stores tokens → calls /auth/me/ → returns user
            const loggedInUser = await login(form.email, form.password);

            const roleHome = getRoleHome(loggedInUser);

            // Only honour intendedPath for regular users hitting a protected page
            const destination =
                loggedInUser?.role === "user" && intendedPath
                    ? intendedPath
                    : roleHome;

            navigate(destination, { replace: true });
        } catch (err) {
            setError(err.response?.data?.detail || "Invalid email or password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4">
                <Link to="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                    <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
                        <TrendingUp size={14} className="text-white" />
                    </div>
                    EscrowMarket
                </Link>
                <ThemeToggle />
            </div>

            {/* Form */}
            <div className="flex-1 flex items-center justify-center px-4 py-10">
                <div className="w-full max-w-sm">
                    <div className="card p-8">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            Sign in
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-7">
                            Don't have an account?{" "}
                            <Link to="/register" className="text-brand-500 hover:underline font-medium">
                                Register
                            </Link>
                        </p>

                        {error && (
                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm mb-5">
                                <AlertCircle size={15} className="flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Email address
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={form.email}
                                    onChange={handleChange}
                                    required
                                    autoFocus
                                    autoComplete="email"
                                    className="input"
                                    placeholder="you@example.com"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPw ? "text" : "password"}
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        required
                                        autoComplete="current-password"
                                        className="input pr-10"
                                        placeholder="••••••••"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                    >
                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="btn-primary w-full mt-2"
                            >
                                {loading
                                    ? <span className="flex items-center justify-center gap-2">
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Signing in…
                                        </span>
                                    : "Sign In"
                                }
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}