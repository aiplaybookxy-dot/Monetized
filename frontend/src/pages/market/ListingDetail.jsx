import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
    Users, TrendingUp, Calendar, DollarSign, ShieldCheck,
    AlertCircle, ArrowLeft, Star, Clock, Eye, CheckCircle,
    ExternalLink, Image,
} from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/ui/LoadingSpinner";
import StatusBadge from "../../components/ui/StatusBadge";

function StatBox({ icon: Icon, label, value }) {
    return (
        <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 text-center">
            <Icon size={16} className="text-brand-500 mx-auto mb-1" />
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
        </div>
    );
}

export default function ListingDetailPage() {
    const { id }       = useParams();
    const { isAuthenticated, user } = useAuth();
    const navigate     = useNavigate();
    const [listing,  setListing]  = useState(null);
    const [loading,  setLoading]  = useState(true);
    const [buying,   setBuying]   = useState(false);
    const [error,    setError]    = useState("");
    const [imgIndex, setImgIndex] = useState(0);

    useEffect(() => {
        api.get(`/listings/${id}/`)
            .then(res => setListing(res.data))
            .catch(() => navigate("/market"))
            .finally(() => setLoading(false));
    }, [id]);

    const handleBuy = async () => {
        if (!isAuthenticated) {
            navigate("/login", { state: { from: { pathname: `/market/${id}` } } });
            return;
        }
        setBuying(true);
        setError("");
        try {
            const res = await api.post("/payments/initiate/", { listing_id: id });
            window.location.href = res.data.authorization_url;
        } catch (err) {
            setError(err.response?.data?.error || "Failed to initiate payment. Please try again.");
            setBuying(false);
        }
    };

    if (loading) return <LoadingSpinner />;
    if (!listing) return null;

    const isSeller   = user?.id === listing.seller?.id;
    const screenshots = Array.isArray(listing.screenshots) ? listing.screenshots : [];

    return (
        <div className="max-w-4xl mx-auto space-y-5 pb-10">

            {/* Back */}
            <Link to="/market"
                className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                <ArrowLeft size={15} /> Back to Marketplace
            </Link>

            <div className="grid lg:grid-cols-3 gap-6 items-start">

                {/* ── LEFT: Main details ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Title card */}
                    <div className="card p-6">
                        <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-semibold capitalize">
                                    {listing.platform}
                                </span>
                                <StatusBadge status={listing.status} />
                                {listing.is_featured && (
                                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                                        <Star size={11} fill="currentColor" /> Featured
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                                <Eye size={12} /> {listing.view_count} views
                            </div>
                        </div>

                        <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
                            {listing.title}
                        </h1>
                        <p className="text-sm text-gray-400 mt-1">@{listing.account_handle}</p>

                        {listing.account_url && (
                            <a href={listing.account_url} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-brand-500 hover:underline mt-2">
                                <ExternalLink size={11} /> View account
                            </a>
                        )}

                        {listing.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-4 leading-relaxed">
                                {listing.description}
                            </p>
                        )}
                    </div>

                    {/* Stats grid */}
                    <div className="card p-5">
                        <h2 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">Account Stats</h2>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <StatBox icon={Users}    label="Followers"   value={Number(listing.follower_count).toLocaleString()} />
                            <StatBox icon={TrendingUp} label="Engagement" value={`${listing.average_engagement_rate?.toFixed(1)}%`} />
                            <StatBox icon={Calendar} label="Account Age" value={`${listing.account_age_months}mo`} />
                            <StatBox icon={DollarSign} label="Monthly Rev." value={`$${Number(listing.monthly_revenue_usd).toLocaleString()}`} />
                        </div>
                    </div>

                    {/* Tags */}
                    {listing.tags?.length > 0 && (
                        <div className="card p-5">
                            <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Tags</h2>
                            <div className="flex flex-wrap gap-2">
                                {listing.tags.map((tag, i) => (
                                    <span key={i}
                                        className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Screenshots */}
                    {screenshots.length > 0 && (
                        <div className="card p-5">
                            <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm flex items-center gap-2">
                                <Image size={14} className="text-brand-500" /> Screenshots
                            </h2>
                            <div className="space-y-3">
                                <img
                                    src={screenshots[imgIndex]}
                                    alt={`Screenshot ${imgIndex + 1}`}
                                    className="w-full rounded-xl object-cover max-h-72 bg-gray-100 dark:bg-gray-800"
                                />
                                {screenshots.length > 1 && (
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {screenshots.map((src, i) => (
                                            <button key={i} onClick={() => setImgIndex(i)}
                                                className={`w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${
                                                    i === imgIndex ? "border-brand-500" : "border-transparent"
                                                }`}>
                                                <img src={src} alt="" className="w-full h-full object-cover" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Seller card */}
                    <div className="card p-5">
                        <h2 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Seller</h2>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 font-semibold flex-shrink-0">
                                {listing.seller?.avatar ? (
                                    <img src={listing.seller.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    listing.seller?.username?.[0]?.toUpperCase()
                                )}
                            </div>
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">
                                    @{listing.seller?.username}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                                    <span className="flex items-center gap-1">
                                        <Star size={10} fill="currentColor" className="text-amber-400" />
                                        {listing.seller?.seller_rating?.toFixed(1)} rating
                                    </span>
                                    <span>{listing.seller?.completed_sales} sales</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Purchase sidebar ── */}
                <div className="space-y-4 lg:sticky lg:top-20">
                    <div className="card p-6">
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            ₦{Number(listing.price).toLocaleString()}
                        </p>
                        {listing.price_is_negotiable && (
                            <p className="text-xs text-gray-400 mt-1">Price is negotiable</p>
                        )}

                        {/* Fee breakdown */}
                        <div className="space-y-2 py-4 my-4 border-y border-gray-100 dark:border-gray-700 text-sm">
                            <div className="flex justify-between text-gray-500 dark:text-gray-400">
                                <span>Platform fee (5%)</span>
                                <span>₦{Number(listing.commission_amount || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                                <span>You pay</span>
                                <span>₦{Number(listing.price).toLocaleString()}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs mb-4">
                                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                                {error}
                            </div>
                        )}

                        {isSeller ? (
                            <div className="text-center py-2">
                                <p className="text-sm text-gray-400">This is your listing.</p>
                                <Link to="/sell/listings" className="text-xs text-brand-500 hover:underline mt-1 inline-block">
                                    Manage listings →
                                </Link>
                            </div>
                        ) : listing.status !== "active" ? (
                            <div className="text-center py-2">
                                <p className="text-sm text-gray-400">This listing is no longer available.</p>
                            </div>
                        ) : (
                            <button
                                onClick={handleBuy}
                                disabled={buying}
                                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
                            >
                                {buying ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <ShieldCheck size={15} />
                                        Buy Now — Secure Escrow
                                    </>
                                )}
                            </button>
                        )}

                        {/* Trust signals */}
                        <div className="mt-4 space-y-2">
                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
                                <ShieldCheck size={13} className="text-emerald-500 flex-shrink-0" />
                                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                                    Funds held in escrow until you confirm delivery.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                                <CheckCircle size={13} className="text-gray-400 flex-shrink-0" />
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    24–48hr inspection window before funds release.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                                <Clock size={13} className="text-gray-400 flex-shrink-0" />
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Listed {new Date(listing.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}