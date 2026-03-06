/**
 * src/pages/listing/AccountDetail.jsx
 *
 * CHANGES FROM PREVIOUS VERSION:
 *  - All fee breakdown rows removed from the purchase card (buyer never sees fees)
 *  - All "price_is_negotiable" text removed
 *  - "You pay" / "Platform fee" section replaced with a clean price + escrow note
 *
 * WHY: The fee is the platform's internal business. Showing buyers a fee
 * breakdown creates confusion ("why am I paying a fee if I pay the full price?")
 * because the buyer pays the listing price — the fee comes out of the seller's
 * payout, not a buyer surcharge. Sellers see the breakdown in CreateListing.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    Users, TrendingUp, Calendar, DollarSign, ShieldCheck,
    AlertCircle, CheckCircle, Clock, Star, ExternalLink,
    ChevronLeft, Eye, Tag, BarChart2,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

// ── Platform config ───────────────────────────────────────────────────────────
const PLATFORM_CONFIG = {
    instagram: { label: "Instagram", gradient: "from-purple-500 via-pink-500 to-orange-400" },
    youtube:   { label: "YouTube",   gradient: "from-red-600 to-red-500"                    },
    tiktok:    { label: "TikTok",    gradient: "from-gray-900 via-gray-800 to-gray-900"     },
    twitter:   { label: "Twitter/X", gradient: "from-sky-500 to-blue-600"                  },
    facebook:  { label: "Facebook",  gradient: "from-blue-700 to-blue-500"                 },
    snapchat:  { label: "Snapchat",  gradient: "from-yellow-400 to-yellow-300"             },
    twitch:    { label: "Twitch",    gradient: "from-purple-700 to-purple-500"             },
    other:     { label: "Other",     gradient: "from-gray-600 to-gray-500"                 },
};

// ── Guest checkout modal ──────────────────────────────────────────────────────
function GuestCheckoutModal({ listing, onConfirm, onClose, loading, error }) {
    const [email, setEmail] = useState("");
    const isValid = email.includes("@") && email.includes(".");

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-6 space-y-5">

                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <ShieldCheck size={20} className="text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Secure Checkout</h2>
                            <p className="text-xs text-gray-400 mt-0.5">No account required</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    >✕</button>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                        <strong>Guest checkout enabled.</strong> Enter your email — we'll create a secure
                        account and email you your login credentials after payment so you can track your order.
                    </p>
                </div>

                {/* Order summary */}
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">Purchasing</p>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-1">{listing.title}</p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{listing.platform} · @{listing.account_handle}</p>
                    <p className="text-2xl font-black text-gray-900 dark:text-white mt-2">
                        ₦{Number(listing.price).toLocaleString()}
                    </p>
                </div>

                {/* Email */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Your Email Address *
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && isValid && onConfirm(email)}
                        placeholder="you@example.com"
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
                    />
                    {error && (
                        <p className="text-xs text-red-500 mt-2 flex items-center gap-1.5">
                            <AlertCircle size={12} className="flex-shrink-0" /> {error}
                        </p>
                    )}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                    >Cancel</button>
                    <button
                        onClick={() => onConfirm(email)}
                        disabled={loading || !isValid}
                        className="flex-1 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-brand-500/25"
                    >
                        {loading
                            ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><ShieldCheck size={16} /> Continue to Payment</>
                        }
                    </button>
                </div>

                <p className="text-[11px] text-center text-gray-400">
                    Already have an account?{" "}
                    <Link to="/login" className="text-brand-500 hover:underline font-medium">Sign in instead</Link>
                </p>
            </div>
        </div>
    );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon: Icon, label, value, highlight }) {
    return (
        <div className={`flex flex-col items-center justify-center p-4 rounded-2xl border gap-1.5 ${
            highlight
                ? "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800"
                : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
        }`}>
            <Icon size={17} className={highlight ? "text-brand-500" : "text-gray-400"} />
            <p className={`text-xl font-black ${highlight ? "text-brand-600 dark:text-brand-400" : "text-gray-900 dark:text-white"}`}>
                {value}
            </p>
            <p className="text-[11px] text-gray-400 text-center leading-tight font-medium">{label}</p>
        </div>
    );
}

// ── Screenshot gallery ────────────────────────────────────────────────────────
function ScreenshotGallery({ screenshots, analyticsScreenshot }) {
    const [active, setActive] = useState(0);
    const all = [
        ...(Array.isArray(screenshots) ? screenshots : []),
        ...(analyticsScreenshot ? [analyticsScreenshot] : []),
    ];
    if (all.length === 0) return null;

    return (
        <div className="space-y-3">
            <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <img
                    src={all[active]}
                    alt={`Screenshot ${active + 1}`}
                    className="w-full h-full object-cover"
                    onError={e => { e.target.parentElement.style.display = "none"; }}
                />
            </div>
            {all.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {all.map((src, i) => (
                        <button
                            key={i}
                            onClick={() => setActive(i)}
                            className={`w-16 h-12 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all duration-150 ${
                                i === active
                                    ? "border-brand-500 opacity-100"
                                    : "border-transparent opacity-50 hover:opacity-80"
                            }`}
                        >
                            <img src={src} alt="" className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AccountDetailPage() {
    const { id }   = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();

    const [listing,    setListing]    = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [buying,     setBuying]     = useState(false);
    const [error,      setError]      = useState("");
    const [showGuest,  setShowGuest]  = useState(false);
    const [guestError, setGuestError] = useState("");

    useEffect(() => {
        api.get(`/listings/${id}/`)
            .then(res => setListing(res.data))
            .catch(() => setError("This account listing could not be found."))
            .finally(() => setLoading(false));
    }, [id]);

    const handleBuy = () => {
        if (isAuthenticated) {
            proceedToPayment(null);
        } else {
            setGuestError("");
            setShowGuest(true);
        }
    };

    const proceedToPayment = async (guestEmail) => {
        setBuying(true);
        setGuestError("");
        setError("");
        try {
            const payload = { listing_id: id };
            if (guestEmail) payload.guest_email = guestEmail;
            const res = await api.post("/payments/initiate/", payload);
            window.location.href = res.data.authorization_url;
        } catch (err) {
            const msg = err.response?.data?.error || "Payment initiation failed. Please try again.";
            if (guestEmail) setGuestError(msg);
            else setError(msg);
            setBuying(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
            <LoadingSpinner />
        </div>
    );

    if (error || !listing) return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center text-center px-4 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <AlertCircle size={28} className="text-gray-400" />
            </div>
            <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Account Not Found</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-sm max-w-xs">
                    {error || "This listing may have been sold or removed."}
                </p>
            </div>
            <button
                onClick={() => navigate(-1)}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
            >← Go Back</button>
        </div>
    );

    const isSeller    = user?.id === listing.seller?.id;
    const isAvailable = listing.status === "active";
    const platform    = PLATFORM_CONFIG[listing.platform] || PLATFORM_CONFIG.other;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

            {/* Hero Banner */}
            <div className={`bg-gradient-to-br ${platform.gradient} text-white relative overflow-hidden`}>
                <div className="absolute inset-0 bg-black/20" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                <div className="relative max-w-5xl mx-auto px-4 pt-5 pb-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-6 transition-colors"
                    >
                        <ChevronLeft size={16} /> Back
                    </button>

                    <div className="flex flex-col sm:flex-row sm:items-end gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <span className="text-2xl font-black">{platform.label[0]}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/20">
                                    {platform.label}
                                </span>
                                {listing.is_featured && (
                                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-yellow-400/90 text-yellow-900">
                                        ⭐ Featured
                                    </span>
                                )}
                                {!isAvailable && (
                                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-500/80">
                                        {listing.status === "sold" ? "SOLD" : "UNAVAILABLE"}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black leading-tight drop-shadow-sm">
                                {listing.title}
                            </h1>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <p className="text-white/70 text-sm font-medium">@{listing.account_handle}</p>
                                {listing.account_url && (
                                    <a href={listing.account_url} target="_blank" rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-white/60 hover:text-white text-xs transition-colors">
                                        <ExternalLink size={11} /> View Account
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Price desktop */}
                        <div className="hidden sm:block text-right flex-shrink-0">
                            <p className="text-4xl font-black drop-shadow-sm">
                                ₦{Number(listing.price).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Price mobile */}
                    <div className="sm:hidden mt-4 pt-4 border-t border-white/20">
                        <p className="text-3xl font-black">₦{Number(listing.price).toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="grid lg:grid-cols-3 gap-6 items-start">

                    {/* Left: Account Details */}
                    <div className="lg:col-span-2 space-y-5">

                        {/* Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <StatPill icon={Users}     label="Followers"   value={Number(listing.follower_count).toLocaleString()} highlight />
                            <StatPill icon={TrendingUp} label="Engagement"  value={`${Number(listing.average_engagement_rate).toFixed(1)}%`} highlight />
                            <StatPill icon={Calendar}   label="Account Age" value={`${listing.account_age_months}mo`} />
                            <StatPill icon={DollarSign} label="Monthly Rev." value={`$${Number(listing.monthly_revenue_usd || 0).toLocaleString()}`} />
                        </div>

                        {/* About */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
                            <h2 className="font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                                <BarChart2 size={14} className="text-brand-500" /> About This Account
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                                {listing.description}
                            </p>
                            {(listing.category || listing.tags?.length > 0) && (
                                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                                    {listing.category && (
                                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-semibold">
                                            <Tag size={10} /> {listing.category}
                                        </span>
                                    )}
                                    {listing.tags?.map((tag, i) => (
                                        <span key={i} className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Screenshots */}
                        {(listing.screenshots?.length > 0 || listing.analytics_screenshot) && (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
                                <h2 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                                    <Eye size={14} className="text-brand-500" /> Proof Screenshots
                                </h2>
                                <ScreenshotGallery
                                    screenshots={listing.screenshots}
                                    analyticsScreenshot={listing.analytics_screenshot}
                                />
                            </div>
                        )}

                        {/* Seller */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
                            <h2 className="font-bold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wide">Seller</h2>
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center font-black text-brand-600 text-xl flex-shrink-0 overflow-hidden">
                                    {listing.seller?.avatar
                                        ? <img src={listing.seller.avatar} alt="" className="w-full h-full object-cover" />
                                        : listing.seller?.username?.[0]?.toUpperCase()
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 dark:text-white">
                                        @{listing.seller?.username}
                                    </p>
                                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Star size={11} fill="#f59e0b" className="text-amber-400" />
                                            {Number(listing.seller?.seller_rating || 0).toFixed(1)} rating
                                        </span>
                                        <span>·</span>
                                        <span>{listing.seller?.completed_sales || 0} sales completed</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-gray-400 flex items-center gap-1.5 px-1">
                            <Eye size={12} />
                            {listing.view_count} people viewed this account
                        </p>
                    </div>

                    {/* Right: Purchase Card */}
                    <div className="lg:sticky lg:top-6 space-y-3">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6 shadow-sm">

                            {/* Price — clean, no fee breakdown for buyers */}
                            <p className="text-3xl font-black text-gray-900 dark:text-white">
                                ₦{Number(listing.price).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5 mb-5">Fixed price · Escrow protected</p>

                            {/* Error */}
                            {error && (
                                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs mb-4">
                                    <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                                    {error}
                                </div>
                            )}

                            {/* CTA */}
                            {isSeller ? (
                                <div className="text-center py-2 space-y-1.5">
                                    <p className="text-sm text-gray-400">This is your listing.</p>
                                    <Link to="/sell/listings" className="text-xs text-brand-500 hover:underline font-medium">
                                        Manage listings →
                                    </Link>
                                </div>
                            ) : !isAvailable ? (
                                <div className="text-center py-3">
                                    <p className="text-sm font-bold text-gray-400">
                                        {listing.status === "sold"
                                            ? "This account has been sold."
                                            : "This listing is not available."}
                                    </p>
                                </div>
                            ) : (
                                <button
                                    onClick={handleBuy}
                                    disabled={buying}
                                    className="w-full py-4 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-black text-base transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-500/30 hover:shadow-brand-500/40 hover:-translate-y-0.5"
                                >
                                    {buying
                                        ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><ShieldCheck size={18} /> Buy Now — Escrow Protected</>
                                    }
                                </button>
                            )}

                            {/* Trust signals */}
                            {isAvailable && !isSeller && (
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                                        <ShieldCheck size={13} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
                                            Funds held securely in escrow until you confirm delivery.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20">
                                        <CheckCircle size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-blue-700 dark:text-blue-400 font-medium leading-relaxed">
                                            24–48hr inspection window before funds are released.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                                        <Clock size={13} className="text-gray-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                                            Listed {new Date(listing.created_at).toLocaleDateString("en-NG", {
                                                day: "numeric", month: "short", year: "numeric"
                                            })}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isAuthenticated && isAvailable && !isSeller && (
                            <p className="text-xs text-center text-gray-400">
                                Already have an account?{" "}
                                <Link to="/login" className="text-brand-500 hover:underline font-medium">Sign in</Link>
                                {" "}for faster checkout.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Guest Modal */}
            {showGuest && (
                <GuestCheckoutModal
                    listing={listing}
                    onConfirm={proceedToPayment}
                    onClose={() => { setShowGuest(false); setGuestError(""); setBuying(false); }}
                    loading={buying}
                    error={guestError}
                />
            )}
        </div>
    );
}