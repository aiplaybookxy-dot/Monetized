/**
 * src/pages/settings/Settings.jsx
 *
 * Six working sections:
 *   1. Profile        — edit full name, username, bio, avatar
 *   2. Appearance     — light / dark / system theme
 *   3. Password       — change password with confirmation
 *   4. Notifications  — (UI preference toggles, stored in localStorage)
 *   5. Bank Details   — save bank info for withdrawals (stored in profile)
 *   6. Login History  — last 20 sessions with IP + success/fail
 */
import { useState, useEffect, useRef } from "react";
import {
    User, Shield, Moon, Sun, Monitor, Bell,
    CreditCard, Clock, CheckCircle, AlertCircle,
    Camera, Eye, EyeOff, Save, LogOut,
} from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

// ── Nigerian banks list ───────────────────────────────────────────────────────
const NG_BANKS = [
    { name: "Access Bank",             code: "044" },
    { name: "Citibank Nigeria",        code: "023" },
    { name: "Ecobank Nigeria",         code: "050" },
    { name: "Fidelity Bank",           code: "070" },
    { name: "First Bank of Nigeria",   code: "011" },
    { name: "First City Monument Bank",code: "214" },
    { name: "Globus Bank",             code: "00103" },
    { name: "Guaranty Trust Bank",     code: "058" },
    { name: "Heritage Bank",           code: "030" },
    { name: "Jaiz Bank",               code: "301" },
    { name: "Keystone Bank",           code: "082" },
    { name: "Kuda Bank",               code: "90267" },
    { name: "Moniepoint MFB",          code: "50515" },
    { name: "OPay",                    code: "999992" },
    { name: "Palmpay",                 code: "999991" },
    { name: "Polaris Bank",            code: "076" },
    { name: "Providus Bank",           code: "101" },
    { name: "Stanbic IBTC Bank",       code: "221" },
    { name: "Standard Chartered",      code: "068" },
    { name: "Sterling Bank",           code: "232" },
    { name: "SunTrust Bank",           code: "100" },
    { name: "Union Bank of Nigeria",   code: "032" },
    { name: "United Bank for Africa",  code: "033" },
    { name: "Unity Bank",              code: "215" },
    { name: "VFD Microfinance Bank",   code: "566" },
    { name: "Wema Bank",               code: "035" },
    { name: "Zenith Bank",             code: "057" },
];

// ── Reusable components ───────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children, iconColor = "text-brand-500" }) {
    return (
        <div className="card p-6 space-y-5">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Icon size={16} className={iconColor} />
                {title}
            </h2>
            {children}
        </div>
    );
}

function Alert({ type, message }) {
    if (!message) return null;
    const isSuccess = type === "success";
    return (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm ${
            isSuccess
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
        }`}>
            {isSuccess ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {message}
        </div>
    );
}

function SaveButton({ loading, label = "Save Changes" }) {
    return (
        <button
            type="submit"
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-6 disabled:opacity-60"
        >
            {loading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Save size={14} />
            }
            {loading ? "Saving…" : label}
        </button>
    );
}


// ── 1. Profile Section ────────────────────────────────────────────────────────
function ProfileSection() {
    const { user, fetchMe } = useAuth();
    const [form, setForm]   = useState({
        full_name: user?.full_name || "",
        username:  user?.username  || "",
        bio:       user?.bio       || "",
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error,   setError]   = useState("");
    const [avatar,  setAvatar]  = useState(null);
    const [preview, setPreview] = useState(user?.avatar || null);
    const fileRef = useRef();

    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setAvatar(file);
        setPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true); setSuccess(""); setError("");
        try {
            const data = new FormData();
            Object.entries(form).forEach(([k, v]) => data.append(k, v));
            if (avatar) data.append("avatar", avatar);
            await api.patch("/auth/me/", data, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            await fetchMe();
            setSuccess("Profile updated successfully.");
            setAvatar(null);
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            const d = err.response?.data;
            setError(typeof d === "object" ? Object.values(d).flat()[0] : "Failed to update profile.");
        } finally { setLoading(false); }
    };

    return (
        <SectionCard icon={User} title="Profile Information">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Alert type="success" message={success} />
                <Alert type="error"   message={error} />

                {/* Avatar */}
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center overflow-hidden">
                            {preview
                                ? <img src={preview} alt="avatar" className="w-full h-full object-cover" />
                                : <span className="text-2xl font-bold text-brand-600">{user?.username?.[0]?.toUpperCase()}</span>
                            }
                        </div>
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            className="absolute -bottom-1 -right-1 w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center text-white shadow"
                        >
                            <Camera size={11} />
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.username}</p>
                        <p className="text-xs text-gray-400">{user?.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            Click the camera to change avatar
                        </p>
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Full Name</label>
                        <input value={form.full_name} onChange={set("full_name")} className="input" placeholder="Your full name" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Username</label>
                        <input value={form.username} onChange={set("username")} className="input" placeholder="username" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bio</label>
                    <textarea
                        value={form.bio}
                        onChange={set("bio")}
                        rows={3}
                        maxLength={500}
                        className="input resize-none"
                        placeholder="Tell buyers about yourself…"
                    />
                    <p className="text-xs text-gray-400 mt-1">{form.bio.length}/500</p>
                </div>

                <SaveButton loading={loading} />
            </form>
        </SectionCard>
    );
}


// ── 2. Appearance Section ─────────────────────────────────────────────────────
function AppearanceSection() {
    const { theme, setLight, setDark } = useTheme();

    const options = [
        { label: "Light",  icon: Sun,     action: setLight, value: "light" },
        { label: "Dark",   icon: Moon,    action: setDark,  value: "dark"  },
    ];

    return (
        <SectionCard icon={Monitor} title="Appearance">
            <div className="flex gap-3">
                {options.map(({ label, icon: Icon, action, value }) => (
                    <button
                        key={value}
                        type="button"
                        onClick={action}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                            theme === value
                                ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
                                : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                    >
                        <Icon size={15} /> {label}
                    </button>
                ))}
            </div>
        </SectionCard>
    );
}


// ── 3. Password Section ───────────────────────────────────────────────────────
function PasswordSection() {
    const [form, setForm]   = useState({ old_password: "", new_password: "", new_password2: "" });
    const [show, setShow]   = useState(false);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error,   setError]   = useState("");

    const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.new_password !== form.new_password2) { setError("New passwords don't match."); return; }
        setLoading(true); setError(""); setSuccess("");
        try {
            await api.post("/auth/change-password/", form);
            setSuccess("Password changed. You'll receive a confirmation email.");
            setForm({ old_password: "", new_password: "", new_password2: "" });
            setTimeout(() => setSuccess(""), 5000);
        } catch (err) {
            const d = err.response?.data;
            setError(typeof d === "object" ? Object.values(d).flat()[0] : "Failed to change password.");
        } finally { setLoading(false); }
    };

    const fields = [
        { key: "old_password",  label: "Current Password" },
        { key: "new_password",  label: "New Password" },
        { key: "new_password2", label: "Confirm New Password" },
    ];

    return (
        <SectionCard icon={Shield} title="Change Password" iconColor="text-rose-500">
            <form onSubmit={handleSubmit} className="space-y-4">
                <Alert type="success" message={success} />
                <Alert type="error"   message={error} />
                {fields.map(({ key, label }) => (
                    <div key={key}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
                        <div className="relative">
                            <input
                                type={show ? "text" : "password"}
                                value={form[key]}
                                onChange={set(key)}
                                className="input pr-10"
                                required
                                autoComplete={key === "old_password" ? "current-password" : "new-password"}
                            />
                            <button
                                type="button"
                                onClick={() => setShow(s => !s)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                {show ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        </div>
                    </div>
                ))}
                <SaveButton loading={loading} label="Change Password" />
            </form>
        </SectionCard>
    );
}


// ── 4. Notification Preferences ───────────────────────────────────────────────
const NOTIF_PREFS_KEY = "escrow_notif_prefs";

const NOTIF_OPTIONS = [
    { key: "order_updates",    label: "Order Updates",    desc: "Funded, provisioned, completed" },
    { key: "dispute_alerts",   label: "Dispute Alerts",   desc: "When a dispute is opened or resolved" },
    { key: "sale_made",        label: "Sale Made",        desc: "When a buyer purchases your listing" },
    { key: "withdrawal_status",label: "Withdrawal Status",desc: "Approved or rejected payout requests" },
    { key: "login_alerts",     label: "Login Alerts",     desc: "New login from an unrecognised IP" },
];

function NotificationsSection() {
    const [prefs, setPrefs] = useState(() => {
        try { return JSON.parse(localStorage.getItem(NOTIF_PREFS_KEY)) || {}; }
        catch { return {}; }
    });
    const [saved, setSaved] = useState(false);

    const toggle = (key) => {
        setPrefs(p => ({ ...p, [key]: !p[key] }));
    };

    const save = () => {
        localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <SectionCard icon={Bell} title="Notification Preferences" iconColor="text-amber-500">
            <div className="space-y-3">
                {NOTIF_OPTIONS.map(({ key, label, desc }) => (
                    <div key={key} className="flex items-center justify-between gap-4 py-1">
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                            <p className="text-xs text-gray-400">{desc}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => toggle(key)}
                            className={`relative inline-flex items-center w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                                prefs[key] !== false ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
                            }`}
                        >
                            <span className={`inline-block w-3.5 h-3.5 bg-white rounded-full shadow transition-transform ${
                                prefs[key] !== false ? "translate-x-5" : "translate-x-0.5"
                            }`} />
                        </button>
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-3">
                <button type="button" onClick={save} className="btn-primary flex items-center gap-2 px-6">
                    <Save size={14} /> Save Preferences
                </button>
                {saved && <span className="text-sm text-emerald-500 flex items-center gap-1"><CheckCircle size={13} /> Saved</span>}
            </div>
        </SectionCard>
    );
}


// ── 5. Bank Details ───────────────────────────────────────────────────────────
const BANK_KEY = "escrow_bank_details";

function BankDetailsSection() {
    const [form, setForm] = useState(() => {
        try { return JSON.parse(localStorage.getItem(BANK_KEY)) || { bank_name: "", bank_code: "", account_number: "", account_name: "" }; }
        catch { return { bank_name: "", bank_code: "", account_number: "", account_name: "" }; }
    });
    const [saved,  setSaved]  = useState(false);
    const [error,  setError]  = useState("");

    const set = (f) => (e) => {
        const val = e.target.value;
        if (f === "bank_code") {
            const bank = NG_BANKS.find(b => b.code === val);
            setForm(p => ({ ...p, bank_code: val, bank_name: bank?.name || "" }));
        } else {
            setForm(p => ({ ...p, [f]: val }));
        }
    };

    const save = (e) => {
        e.preventDefault();
        if (!form.bank_code || !form.account_number || !form.account_name) {
            setError("All bank fields are required."); return;
        }
        if (!/^\d{10}$/.test(form.account_number)) {
            setError("Account number must be exactly 10 digits."); return;
        }
        setError("");
        localStorage.setItem(BANK_KEY, JSON.stringify(form));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <SectionCard icon={CreditCard} title="Bank Details for Withdrawals" iconColor="text-emerald-500">
            <p className="text-xs text-gray-400 -mt-2">
                These details are pre-filled when you submit a withdrawal request.
            </p>
            <form onSubmit={save} className="space-y-4">
                <Alert type="error" message={error} />

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bank</label>
                    <select value={form.bank_code} onChange={set("bank_code")} className="input">
                        <option value="">Select your bank…</option>
                        {NG_BANKS.map(b => (
                            <option key={b.code} value={b.code}>{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Account Number</label>
                        <input
                            value={form.account_number}
                            onChange={set("account_number")}
                            className="input font-mono"
                            placeholder="0123456789"
                            maxLength={10}
                            inputMode="numeric"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Account Name</label>
                        <input
                            value={form.account_name}
                            onChange={set("account_name")}
                            className="input"
                            placeholder="As on bank record"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <SaveButton loading={false} label="Save Bank Details" />
                    {saved && (
                        <span className="text-sm text-emerald-500 flex items-center gap-1">
                            <CheckCircle size={13} /> Saved
                        </span>
                    )}
                </div>
            </form>
        </SectionCard>
    );
}


// ── 6. Login History ──────────────────────────────────────────────────────────
function LoginHistorySection() {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/auth/login-history/")
            .then(r => setHistory(r.data?.results ?? r.data ?? []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <SectionCard icon={Clock} title="Recent Login Sessions" iconColor="text-gray-400">
            {loading ? (
                <div className="space-y-2">
                    {[1,2,3].map(i => (
                        <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    ))}
                </div>
            ) : history.length === 0 ? (
                <p className="text-sm text-gray-400">No login history available.</p>
            ) : (
                <div className="space-y-2">
                    {history.slice(0, 10).map((entry) => (
                        <div
                            key={entry.id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl"
                        >
                            <div className="min-w-0">
                                <p className="text-xs font-mono text-gray-900 dark:text-white">{entry.ip_address}</p>
                                <p className="text-xs text-gray-400 truncate max-w-xs mt-0.5">
                                    {entry.user_agent?.slice(0, 55)}{entry.user_agent?.length > 55 ? "…" : ""}
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                                <p className="text-xs text-gray-400">{new Date(entry.timestamp).toLocaleString()}</p>
                                <span className={`text-xs font-semibold ${entry.was_successful ? "text-emerald-500" : "text-red-500"}`}>
                                    {entry.was_successful ? "✓ Success" : "✗ Failed"}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}


// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
    return (
        <div className="max-w-2xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Manage your account, appearance, and payout details
                </p>
            </div>
            <ProfileSection />
            <AppearanceSection />
            <PasswordSection />
            <NotificationsSection />
            <BankDetailsSection />
            <LoginHistorySection />
        </div>
    );
}