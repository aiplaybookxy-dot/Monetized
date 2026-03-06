/**
 * src/pages/sell/CreateListing.jsx
 *
 * CHANGES FROM PREVIOUS VERSION:
 *  - Fetches commission rate from GET /api/v1/platform/config/ on mount
 *  - Live fee breakdown panel updates as seller types their price
 *  - Breakdown shows: Asking Price, Platform Fee (X%), and "You receive"
 *  - Removed "Price is negotiable" checkbox entirely
 *  - price_is_negotiable removed from form payload
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertCircle, Info, TrendingDown, Wallet } from "lucide-react";
import api from "../../services/api";

const PLATFORMS = [
    "instagram", "twitter", "tiktok", "youtube",
    "facebook", "snapchat", "twitch", "other",
];

function fmt(n) {
    return `₦${Number(n || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;
}

// ── Fee Breakdown Panel ───────────────────────────────────────────────────────
function FeeBreakdown({ price, commissionPct, loading }) {
    const priceNum    = parseFloat(price) || 0;
    const commission  = (priceNum * commissionPct) / 100;
    const payout      = priceNum - commission;

    if (!priceNum) return (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-400 text-center">Enter a price to see your payout breakdown</p>
        </div>
    );

    return (
        <div className="rounded-xl bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <Wallet size={13} className="text-brand-500" />
                <p className="text-xs font-semibold text-brand-700 dark:text-brand-300 uppercase tracking-wide">
                    Your Payout Breakdown
                </p>
                {loading && (
                    <span className="text-[10px] text-gray-400">(loading rate…)</span>
                )}
            </div>

            <div className="space-y-2 text-sm">
                {/* Asking price */}
                <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">Asking price</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{fmt(priceNum)}</span>
                </div>

                {/* Platform fee */}
                <div className="flex justify-between items-center text-red-600 dark:text-red-400">
                    <span className="flex items-center gap-1.5">
                        <TrendingDown size={12} />
                        Platform fee ({commissionPct}%)
                    </span>
                    <span className="font-semibold">− {fmt(commission)}</span>
                </div>

                {/* Divider */}
                <div className="border-t border-brand-200 dark:border-brand-700 pt-2">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-gray-900 dark:text-white">You receive</span>
                        <span className="font-black text-brand-600 dark:text-brand-400 text-base">
                            {fmt(payout)}
                        </span>
                    </div>
                </div>
            </div>

            <p className="text-[11px] text-brand-600 dark:text-brand-400 flex items-start gap-1.5 pt-0.5">
                <Info size={11} className="flex-shrink-0 mt-0.5" />
                Fee is deducted only when the buyer confirms delivery and funds are released.
            </p>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CreateListingPage() {
    const navigate = useNavigate();

    const [form, setForm] = useState({
        platform:               "instagram",
        account_handle:         "",
        account_url:            "",
        title:                  "",
        description:            "",
        category:               "",
        follower_count:         "",
        average_engagement_rate:"",
        account_age_months:     "",
        monthly_revenue_usd:    "",
        price:                  "",
        // price_is_negotiable removed intentionally
    });

    const [commissionPct,    setCommissionPct]    = useState(10);   // default until API responds
    const [configLoading,    setConfigLoading]    = useState(true);
    const [loading,          setLoading]          = useState(false);
    const [error,            setError]            = useState("");
    const [success,          setSuccess]          = useState(false);

    // ── Fetch live commission rate ─────────────────────────────────────────
    useEffect(() => {
        api.get("/platform/config/")
            .then(r => setCommissionPct(Number(r.data.commission_percent) || 10))
            .catch(() => {/* silently keep default 10% */})
            .finally(() => setConfigLoading(false));
    }, []);

    const set = (field) => (e) => {
        setForm(f => ({ ...f, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            // Never send price_is_negotiable — removed from form and API contract
            const payload = { ...form };
            delete payload.price_is_negotiable;
            await api.post("/listings/create/", payload);
            setSuccess(true);
            setTimeout(() => navigate("/sell/listings"), 1500);
        } catch (err) {
            const data = err.response?.data;
            if (typeof data === "object") {
                const msgs = Object.entries(data)
                    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`);
                setError(msgs.join(" · "));
            } else {
                setError("Failed to create listing.");
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Success state ─────────────────────────────────────────────────────
    if (success) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="card p-10 text-center max-w-sm w-full">
                    <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Listing Created!</h2>
                    <p className="text-sm text-gray-400">Redirecting to your listings…</p>
                </div>
            </div>
        );
    }

    const Label = ({ children, required }) => (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {children}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
    );

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">New Listing</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Fill in the details about the account you want to sell. Listings start as drafts
                    and require moderator approval before going live.
                </p>
            </div>

            {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm mb-5">
                    <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="card p-6 space-y-5">

                {/* Platform */}
                <div>
                    <Label>Platform</Label>
                    <select value={form.platform} onChange={set("platform")} className="input">
                        {PLATFORMS.map(p => (
                            <option key={p} value={p}>
                                {p.charAt(0).toUpperCase() + p.slice(1)}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Handle + URL */}
                <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                        <Label required>Account Handle</Label>
                        <input
                            type="text"
                            value={form.account_handle}
                            onChange={set("account_handle")}
                            placeholder="@handle"
                            className="input"
                            required
                        />
                    </div>
                    <div>
                        <Label>Account URL (optional)</Label>
                        <input
                            type="url"
                            value={form.account_url}
                            onChange={set("account_url")}
                            placeholder="https://..."
                            className="input"
                        />
                    </div>
                </div>

                {/* Title */}
                <div>
                    <Label required>Listing Title</Label>
                    <input
                        type="text"
                        value={form.title}
                        onChange={set("title")}
                        placeholder="e.g. Finance Instagram — 120K Followers"
                        className="input"
                        required
                    />
                </div>

                {/* Description */}
                <div>
                    <Label required>Description</Label>
                    <textarea
                        value={form.description}
                        onChange={set("description")}
                        placeholder="Describe the account niche, audience, monetisation history, why you're selling…"
                        className="input resize-none"
                        rows={4}
                        required
                    />
                </div>

                {/* Category */}
                <div>
                    <Label>Category / Niche</Label>
                    <input
                        type="text"
                        value={form.category}
                        onChange={set("category")}
                        placeholder="e.g. Finance, Gaming, Lifestyle"
                        className="input"
                    />
                </div>

                {/* Stats grid */}
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { field: "follower_count",           label: "Followers",           ph: "120000" },
                        { field: "average_engagement_rate",  label: "Engagement Rate (%)", ph: "3.5"    },
                        { field: "account_age_months",       label: "Age (months)",         ph: "24"     },
                        { field: "monthly_revenue_usd",      label: "Monthly Rev. ($)",     ph: "500"    },
                    ].map(({ field, label, ph }) => (
                        <div key={field}>
                            <Label>{label}</Label>
                            <input
                                type="number"
                                value={form[field]}
                                onChange={set(field)}
                                placeholder={ph}
                                className="input"
                                min="0"
                                step="any"
                            />
                        </div>
                    ))}
                </div>

                {/* ── Price + Fee Breakdown ─────────────────────────────────── */}
                <div className="space-y-3">
                    <div>
                        <Label required>Asking Price (₦)</Label>
                        <input
                            type="number"
                            value={form.price}
                            onChange={set("price")}
                            placeholder="250000"
                            className="input"
                            required
                            min="1"
                            step="any"
                        />
                    </div>

                    {/* Live fee breakdown — seller only, synced to admin rate */}
                    <FeeBreakdown
                        price={form.price}
                        commissionPct={commissionPct}
                        loading={configLoading}
                    />
                </div>

                {/* Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 mt-2"
                >
                    {loading
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : "Save as Draft"
                    }
                </button>
            </form>
        </div>
    );
}