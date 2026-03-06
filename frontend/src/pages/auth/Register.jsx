/**
 * src/pages/auth/Register.jsx
 *
 * FIX: The `Field` component was previously defined INSIDE RegisterPage.
 * React creates a new component type on every render when a component is
 * defined inside another. This causes React to unmount and remount the input
 * on every keystroke — which is why the input loses focus after typing one
 * character.
 *
 * Solution: Each field uses its own individual state variable with a direct
 * onChange handler. No child component needed, no closure stale-state risk.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TrendingUp, Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../../components/ui/ThemeToggle";

export default function RegisterPage() {
    // Individual state per field — avoids any potential stale closure issue
    const [fullName,  setFullName]  = useState("");
    const [username,  setUsername]  = useState("");
    const [email,     setEmail]     = useState("");
    const [password,  setPassword]  = useState("");
    const [password2, setPassword2] = useState("");
    const [showPw,    setShowPw]    = useState(false);
    const [error,     setError]     = useState("");
    const [success,   setSuccess]   = useState(false);
    const [loading,   setLoading]   = useState(false);

    const { register } = useAuth();
    const navigate     = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (password !== password2) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setLoading(true);
        try {
            await register({ full_name: fullName, username, email, password, password2 });
            setSuccess(true);
            setTimeout(() => navigate("/login"), 2500);
        } catch (err) {
            const data = err.response?.data;
            if (data && typeof data === "object") {
                const firstKey = Object.keys(data)[0];
                const firstVal = data[firstKey];
                setError(Array.isArray(firstVal) ? firstVal[0] : String(firstVal));
            } else {
                setError("Registration failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    /* ── Success screen ──────────────────────────────────────────────────── */
    if (success) {
        return (
            <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center px-4 font-ubuntu">
                <div className="card p-12 text-center max-w-sm w-full">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-5">
                        <CheckCircle size={32} className="text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Account Created!
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Redirecting you to sign in…
                    </p>
                    <div className="mt-4 w-full h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full animate-[progress_2.5s_linear_forwards]" />
                    </div>
                </div>
            </div>
        );
    }

    /* ── Form ────────────────────────────────────────────────────────────── */
    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col font-ubuntu">

            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/60">
                <Link to="/" className="flex items-center gap-2.5 font-bold text-gray-900 dark:text-white">
                    <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
                        <TrendingUp size={14} className="text-white" />
                    </div>
                    EscrowMarket
                </Link>
                <ThemeToggle />
            </div>

            {/* Form area */}
            <div className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="w-full max-w-sm">

                    {/* Heading */}
                    <div className="mb-8 text-center">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                            Create your account
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Already have one?{" "}
                            <Link to="/login" className="text-brand-500 hover:text-brand-600 font-semibold">
                                Sign in
                            </Link>
                        </p>
                    </div>

                    {/* Card */}
                    <div className="card p-7">

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-400 text-sm mb-5">
                                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Full name */}
                            <div>
                                <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Full name <span className="text-gray-400 font-normal">(optional)</span>
                                </label>
                                <input
                                    id="full_name"
                                    type="text"
                                    name="full_name"
                                    autoComplete="name"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="John Doe"
                                    className="input"
                                />
                            </div>

                            {/* Username */}
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Username
                                </label>
                                <input
                                    id="username"
                                    type="text"
                                    name="username"
                                    autoComplete="username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="johndoe"
                                    className="input"
                                    required
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="input"
                                    required
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Password
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={showPw ? "text" : "password"}
                                        name="password"
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Min 8 characters"
                                        className="input pr-10"
                                        required
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw((s) => !s)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                                        tabIndex={-1}
                                        aria-label={showPw ? "Hide password" : "Show password"}
                                    >
                                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label htmlFor="password2" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Confirm password
                                </label>
                                <input
                                    id="password2"
                                    type={showPw ? "text" : "password"}
                                    name="password2"
                                    autoComplete="new-password"
                                    value={password2}
                                    onChange={(e) => setPassword2(e.target.value)}
                                    placeholder="Repeat password"
                                    className="input"
                                    required
                                />
                                {/* Inline match indicator */}
                                {password2.length > 0 && (
                                    <p className={`text-xs mt-1.5 ${
                                        password === password2
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-red-500"
                                    }`}>
                                        {password === password2 ? "✓ Passwords match" : "✗ Passwords don't match"}
                                    </p>
                                )}
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={loading || !username || !email || !password || !password2}
                                className="btn-primary w-full flex items-center justify-center gap-2 mt-1"
                            >
                                {loading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Create Account <ArrowRight size={15} /></>
                                )}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-5">
                        By creating an account you agree to our{" "}
                        <span className="text-brand-400">Terms of Service</span>.
                    </p>
                </div>
            </div>
        </div>
    );
}