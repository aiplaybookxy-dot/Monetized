import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Search, SlidersHorizontal, Users, TrendingUp, Star, X } from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const PLATFORMS = [
    { value: "", label: "All Platforms" },
    { value: "instagram", label: "Instagram" },
    { value: "tiktok", label: "TikTok" },
    { value: "youtube", label: "YouTube" },
    { value: "twitter", label: "Twitter / X" },
    { value: "facebook", label: "Facebook" },
    { value: "snapchat", label: "Snapchat" },
    { value: "twitch", label: "Twitch" },
];

function ListingCard({ listing }) {
    return (
        <Link
            to={`/market/${listing.id}`}
            className="card p-5 flex flex-col gap-3 hover:shadow-card-hover transition-shadow duration-200 group"
        >
            <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-semibold capitalize">
                    {listing.platform}
                </span>
                {listing.is_featured && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                        <Star size={11} fill="currentColor" /> Featured
                    </span>
                )}
            </div>

            <div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-500 transition-colors line-clamp-2 leading-snug">
                    {listing.title}
                </h3>
                <p className="text-xs text-gray-400 mt-1">@{listing.account_handle}</p>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                    <Users size={12} />
                    {Number(listing.follower_count).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                    <TrendingUp size={12} />
                    {listing.average_engagement_rate?.toFixed(1)}% eng.
                </span>
            </div>

            {listing.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {listing.description}
                </p>
            )}

            <div className="mt-auto pt-3 border-t border-gray-50 dark:border-gray-700/50 flex items-center justify-between">
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                    ₦{Number(listing.price).toLocaleString()}
                </p>
                {listing.price_is_negotiable && (
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                        Negotiable
                    </span>
                )}
            </div>
        </Link>
    );
}

export default function MarketPage() {
    const [listings,  setListings]  = useState([]);
    const [loading,   setLoading]   = useState(true);
    const [next,      setNext]      = useState(null);
    const [search,    setSearch]    = useState("");
    const [platform,  setPlatform]  = useState("");
    const [minPrice,  setMinPrice]  = useState("");
    const [maxPrice,  setMaxPrice]  = useState("");
    const [ordering,  setOrdering]  = useState("-created_at");
    const [showFilters, setShowFilters] = useState(false);

    const fetchListings = useCallback(async (append = false) => {
        if (!append) setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search)   params.set("search",    search);
            if (platform) params.set("platform",  platform);
            if (minPrice) params.set("min_price", minPrice);
            if (maxPrice) params.set("max_price", maxPrice);
            if (ordering) params.set("ordering",  ordering);

            const url = append && next ? next : `/listings/?${params}`;
            const res  = await api.get(url);
            const data = res.data;

            setListings(prev => append ? [...prev, ...(data.results || data)] : (data.results || data));
            setNext(data.next || null);
        } catch (e) {
            // fail silently — empty state handles it
        } finally {
            setLoading(false);
        }
    }, [search, platform, minPrice, maxPrice, ordering, next]);

    useEffect(() => {
        const t = setTimeout(() => fetchListings(false), 300);
        return () => clearTimeout(t);
    }, [search, platform, minPrice, maxPrice, ordering]);

    const clearFilters = () => {
        setSearch(""); setPlatform(""); setMinPrice(""); setMaxPrice(""); setOrdering("-created_at");
    };

    const hasFilters = search || platform || minPrice || maxPrice || ordering !== "-created_at";

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marketplace</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Browse verified social media accounts available for purchase.
                </p>
            </div>

            {/* Search + Filter bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search accounts, handles, descriptions…"
                        className="input pl-9 text-sm"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(f => !f)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        showFilters || hasFilters
                            ? "bg-brand-50 border-brand-300 text-brand-600 dark:bg-brand-900/30 dark:border-brand-700 dark:text-brand-400"
                            : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                    }`}
                >
                    <SlidersHorizontal size={15} />
                    Filters
                    {hasFilters && (
                        <span className="w-2 h-2 rounded-full bg-brand-500 inline-block" />
                    )}
                </button>
                {hasFilters && (
                    <button onClick={clearFilters}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                        <X size={13} /> Clear
                    </button>
                )}
            </div>

            {/* Filter panel */}
            {showFilters && (
                <div className="card p-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Platform</label>
                        <select value={platform} onChange={e => setPlatform(e.target.value)} className="input text-sm py-2">
                            {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Min Price (₦)</label>
                        <input type="number" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                            placeholder="e.g. 50000" className="input text-sm py-2" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Max Price (₦)</label>
                        <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                            placeholder="e.g. 500000" className="input text-sm py-2" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Sort by</label>
                        <select value={ordering} onChange={e => setOrdering(e.target.value)} className="input text-sm py-2">
                            <option value="-created_at">Newest First</option>
                            <option value="price">Lowest Price</option>
                            <option value="-price">Highest Price</option>
                            <option value="-follower_count">Most Followers</option>
                            <option value="-average_engagement_rate">Highest Engagement</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Results */}
            {loading && listings.length === 0 ? (
                <LoadingSpinner />
            ) : listings.length === 0 ? (
                <div className="text-center py-20 card">
                    <Search size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No listings found.</p>
                    {hasFilters && (
                        <button onClick={clearFilters} className="text-sm text-brand-500 hover:underline mt-2">
                            Clear filters
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <p className="text-xs text-gray-400">{listings.length} listing{listings.length !== 1 ? "s" : ""} found</p>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {listings.map(l => <ListingCard key={l.id} listing={l} />)}
                    </div>
                    {next && (
                        <div className="text-center pt-2">
                            <button onClick={() => fetchListings(true)}
                                disabled={loading}
                                className="btn-ghost border border-gray-200 dark:border-gray-700 text-sm">
                                {loading ? "Loading…" : "Load more"}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}