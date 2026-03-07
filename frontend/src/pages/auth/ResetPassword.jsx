/**
 * src/pages/auth/ResetPassword.jsx
 *
 * Handles two flows from one route: /reset-password/:uid/:token
 *
 *  1. GUEST CHECKOUT — buyer just paid as a guest, got an email with a
 *     "Set your password" link. This page lets them set their password
 *     so they can log in and track the order.
 *
 *  2. NORMAL PASSWORD RESET — any user who clicked "Forgot password?"
 *     from the login page and received a Django password-reset email.
 *
 * Backend endpoint: POST /api/v1/auth/password-reset-confirm/
 * Body: { uid, token, new_password, new_password2 }
 */
import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle, ShieldCheck } from "lucide-react";
import api from "../../services/api";

function PasswordInput({ label, value, onChange, placeholder }) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {label}
            </label>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    minLength={8}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10"
                />
                <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
            </div>
        </div>
    );
}

// Password strength meter
function StrengthBar({ password }) {
    const score = (() => {
        let s = 0;
        if (password.length >= 8)  s++;
        if (password.length >= 12) s++;
        if (/[A-Z]/.test(password)) s++;
        if (/[0-9]/.test(password)) s++;
        if (/[^A-Za-z0-9]/.test(password)) s++;
        return s;
    })();

    const bars  = [1, 2, 3, 4, 5];
    const color  = score <= 1 ? "bg-red-400" : score <= 2 ? "bg-amber-400" : score <= 3 ? "bg-yellow-400" : score <= 4 ? "bg-emerald-400" : "bg-emerald-500";
    const label  = ["", "Weak", "Fair", "Good", "Strong", "Very strong"][score] || "";

    if (!password) return null;
    return (
        <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
                {bars.map(b => (
                    <div
                        key={b}
                        className={`h-1 flex-1 rounded-full transition-all ${b <= score ? color : "bg-gray-200 dark:bg-gray-700"}`}
                    />
                ))}
            </div>
            <p className={`text-[11px] font-medium ${
                score <= 1 ? "text-red-500" : score <= 2 ? "text-amber-500" : "text-emerald-500"
            }`}>{label}</p>
        </div>
    );
}

export default function ResetPassword() {
    const { uid, token } = useParams();
    const navigate       = useNavigate();

    const [form, setForm] = useState({ new_password: "", new_password2: "" });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error,   setError]   = useState("");

    const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        setError("");

        if (form.new_password !== form.new_password2) {
            setError("Passwords do not match.");
            return;
        }
        if (form.new_password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setLoading(true);
        try {
            await api.post("/auth/password-reset-confirm/", {
                uid,
                token,
                new_password:  form.new_password,
                new_password2: form.new_password2,
            });
            setSuccess(true);
        } catch (err) {
            const data = err.response?.data;
            if (typeof data === "object") {
                const msgs = Object.values(data).flat().join(" · ");
                setError(msgs || "Link is invalid or has expired.");
            } else {
                setError("Link is invalid or has expired. Please request a new one.");
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Success state ─────────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
                <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle size={28} className="text-emerald-500" />
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        Password Set!
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                        Your password has been updated. You can now log in and access your orders.
                    </p>
                    <button
                        onClick={() => navigate("/login")}
                        className="w-full py-2.5 px-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    // ── Form ──────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-950">
            <div className="w-full max-w-md">

                {/* Logo / brand */}
                <div className="text-center mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-brand-500 flex items-center justify-center mx-auto mb-3">
                        <ShieldCheck size={22} className="text-white" />
                    </div>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white">Set Your Password</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Choose a strong password to secure your account
                    </p>
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg p-8">

                    {/* Context hint for guest buyers */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 mb-5">
                        <Lock size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                            Your payment is secured in escrow. Set a password to log in and
                            track your order status and receive credentials from the seller.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm mb-4">
                            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <PasswordInput
                                label="New Password"
                                value={form.new_password}
                                onChange={set("new_password")}
                                placeholder="At least 8 characters"
                            />
                            <StrengthBar password={form.new_password} />
                        </div>

                        <PasswordInput
                            label="Confirm Password"
                            value={form.new_password2}
                            onChange={set("new_password2")}
                            placeholder="Repeat your password"
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 px-4 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
                        >
                            {loading
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><Lock size={14} /> Set Password &amp; Log In</>
                            }
                        </button>
                    </form>

                    <p className="text-center text-xs text-gray-400 mt-5">
                        Already have a password?{" "}
                        <Link to="/login" className="text-brand-500 hover:underline font-medium">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}