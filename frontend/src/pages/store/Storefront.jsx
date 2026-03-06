import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
    ShieldCheck, Users, TrendingUp, Star, Store,
    ArrowRight, CheckCircle, Package,
} from "lucide-react";
import api from "../../services/api";

function injectPixel(pixelId) {
    if (!pixelId || window._fbPixelLoaded) return;
    window._fbPixelLoaded = true;
    (function(f,b,e,v,n,t,s){
        if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
        t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)
    })(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
}

function fireLeadPixel() {
    if (window.fbq) window.fbq('track', 'Lead');
}

// ── Active listing card ───────────────────────────────────────────────────────
function StoreListingCard({ listing, onViewDetails }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 flex flex-col gap-3 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-semibold capitalize">
                    {listing.platform}
                </span>
                {listing.is_featured && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                        <Star size={11} fill="currentColor" /> Featured
                    </span>
                )}
            </div>

            <div>
                <h3 className="font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">
                    {listing.title}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">@{listing.account_handle}</p>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                    <Users size={11} /> {Number(listing.follower_count).toLocaleString()} followers
                </span>
                <span className="flex items-center gap-1">
                    <TrendingUp size={11} /> {listing.average_engagement_rate?.toFixed(1)}% eng.
                </span>
            </div>

            {listing.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {listing.description}
                </p>
            )}

            <div className="mt-auto pt-3 border-t border-gray-50 dark:border-gray-700 flex items-center justify-between gap-3">
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                    ₦{Number(listing.price).toLocaleString()}
                </p>
                <button
                    onClick={() => onViewDetails(listing)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors flex-shrink-0"
                >
                    View Details <ArrowRight size={13} />
                </button>
            </div>
        </div>
    );
}

// ── Sold listing card ─────────────────────────────────────────────────────────
function SoldListingCard({ listing }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4 opacity-75">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={18} className="text-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{listing.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 capitalize">
                    {listing.platform} · @{listing.account_handle} · {Number(listing.follower_count).toLocaleString()} followers
                </p>
            </div>
            <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 line-through">
                    ₦{Number(listing.price).toLocaleString()}
                </p>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">SOLD</span>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function StorefrontPage() {
    const { slug }   = useParams();
    const navigate   = useNavigate();
    const [store,    setStore]    = useState(null);
    const [loading,  setLoading]  = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        api.get(`/m/${slug}/`)
            .then(res => {
                setStore(res.data);
                if (res.data.pixel_id) injectPixel(res.data.pixel_id);
            })
            .catch(err => {
                if (err.response?.status === 404) setNotFound(true);
            })
            .finally(() => setLoading(false));
    }, [slug]);

    const handleViewDetails = (listing) => {
        // Record lead click in background
        api.post(`/m/${slug}/click/`, { listing_id: listing.id }).catch(() => {});
        // Fire Facebook Pixel Lead event
        fireLeadPixel();
        // Navigate to full listing detail page using React Router (no full reload)
        navigate(`/listing/${listing.id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center text-center px-4">
                <Store size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Store Not Found</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                    This storefront doesn't exist or has been deactivated.
                </p>
                <Link to="/register"
                    className="mt-6 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
                    Create your own store →
                </Link>
            </div>
        );
    }

    const activeListings = store.listings      || [];
    const soldListings   = store.sold_listings || [];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">

            {/* Store Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                <div className="max-w-4xl mx-auto px-4 py-8 flex items-center gap-5">
                    {store.logo ? (
                        <img src={store.logo} alt="logo"
                            className="w-16 h-16 rounded-2xl object-cover border border-gray-100 dark:border-gray-700 flex-shrink-0" />
                    ) : (
                        <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
                            <span className="text-2xl font-bold text-indigo-600">
                                {store.store_name?.[0]?.toUpperCase()}
                            </span>
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{store.store_name}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">@{store.owner_username}</p>
                        {store.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 max-w-lg">{store.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                            <span>{activeListings.length} available</span>
                            {soldListings.length > 0 && (
                                <span className="text-emerald-500">{soldListings.length} sold</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

                {/* Trust badge */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                    <ShieldCheck size={15} className="text-emerald-500 flex-shrink-0" />
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        All purchases are protected by secure escrow — funds held until you confirm delivery.
                    </p>
                </div>

                {/* Active listings */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <Package size={18} className="text-indigo-500" />
                        Available Accounts
                        <span className="ml-1 text-sm font-normal text-gray-400">({activeListings.length})</span>
                    </h2>

                    {activeListings.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                            <Store size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 dark:text-gray-400">No active listings yet.</p>
                        </div>
                    ) : (
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activeListings.map(listing => (
                                <StoreListingCard
                                    key={listing.id}
                                    listing={listing}
                                    onViewDetails={handleViewDetails}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Sold listings — proof of track record */}
                {soldListings.length > 0 && (
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                            <CheckCircle size={18} className="text-emerald-500" />
                            Previously Sold
                            <span className="ml-1 text-sm font-normal text-gray-400">({soldListings.length})</span>
                        </h2>
                        <p className="text-xs text-gray-400 mb-4">
                            These accounts have been successfully transferred to buyers via escrow.
                        </p>
                        <div className="space-y-2">
                            {soldListings.map(listing => (
                                <SoldListingCard key={listing.id} listing={listing} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center py-8 text-xs text-gray-400 border-t border-gray-100 dark:border-gray-800 mt-8">
                Powered by{" "}
                <Link to="/" className="text-indigo-500 hover:underline">EscrowMarket</Link>
                {" "}— Secure Digital Asset Trading
            </div>
        </div>
    );
}