import { useState } from "react";
import { Camera, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";

export default function ProfilePage() {
    const { user, login } = useAuth();
    const [form, setForm] = useState({
        full_name: user?.full_name || "",
        username: user?.username || "",
        bio: user?.bio || "",
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState("");

    const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

    const handleSave = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess(false);
        try {
            await api.patch("/auth/me/", form);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            const data = err.response?.data;
            setError(typeof data === "object" ? Object.values(data)[0] : "Update failed.");
        } finally {
            setLoading(false);
        }
    };

    const Label = ({ children }) => (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{children}</label>
    );

    return (
        <div className="max-w-xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>

            {/* Avatar + stats */}
            <div className="card p-6 flex items-center gap-6">
                <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 dark:text-brand-400 text-2xl font-bold">
                        {user?.username?.[0]?.toUpperCase()}
                    </div>
                    <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50">
                        <Camera size={11} className="text-gray-500" />
                    </button>
                </div>
                <div>
                    <p className="font-bold text-gray-900 dark:text-white text-lg">@{user?.username}</p>
                    <p className="text-sm text-gray-400">{user?.email}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>⭐ {user?.seller_rating?.toFixed(1)} rating</span>
                        <span>{user?.completed_sales} sales</span>
                        <span>{user?.completed_purchases} purchases</span>
                    </div>
                </div>
            </div>

            {/* Edit form */}
            <form onSubmit={handleSave} className="card p-6 space-y-4">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-1">Edit Profile</h2>

                {success && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm">
                        <CheckCircle size={14} /> Profile updated successfully.
                    </div>
                )}
                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                        <AlertCircle size={14} /> {error}
                    </div>
                )}

                <div>
                    <Label>Full Name</Label>
                    <input type="text" value={form.full_name} onChange={set("full_name")} className="input" placeholder="Your name" />
                </div>
                <div>
                    <Label>Username</Label>
                    <input type="text" value={form.username} onChange={set("username")} className="input" required />
                </div>
                <div>
                    <Label>Bio</Label>
                    <textarea value={form.bio} onChange={set("bio")} rows={3}
                        className="input resize-none" placeholder="Tell buyers and sellers about yourself…" />
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Save Changes"}
                </button>
            </form>

            {/* Stats card */}
            <div className="card p-5 grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">₦{Number(user?.total_earned || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">Total Earned</p>
                </div>
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">₦{Number(user?.total_spent || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">Total Spent</p>
                </div>
            </div>
        </div>
    );
}