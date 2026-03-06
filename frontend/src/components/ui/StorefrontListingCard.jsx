/**
 * WHY this component handles both pixel Lead event AND backend click tracking:
 * Both must fire on the same user action (Buy button click).
 * The pixel fires synchronously in the browser (instant, no await).
 * The backend track-click fires async (fire-and-forget, never blocks UX).
 *
 * WHY fire-and-forget for track-click:
 * If the backend tracking call fails (network error, server down),
 * the checkout flow must NOT be interrupted. Analytics data loss
 * is acceptable; blocking a buyer from purchasing is not.
 */
export default function StorefrontListingCard({ listing, storeSlug, onBuy }) {

    const handleBuyClick = () => {
        // ── 1. Fire Facebook Lead pixel event ──────────────────────────────
        // WHY Lead not AddToCart: Lead is the standard FB event for
        // "buyer expressed intent" in a service/digital goods context.
        // AddToCart implies physical inventory with a cart — not our model.
        if (window.fbq) {
            window.fbq("track", "Lead", {
                content_name: listing.title,
                content_category: listing.platform,
                value: parseFloat(listing.price),
                currency: "NGN",
            });
        }

        // ── 2. Notify backend — fire-and-forget, never await ───────────────
        // WHY no await: Tracking must never delay the checkout modal opening.
        // The request is sent and we immediately proceed regardless of result.
        if (storeSlug) {
            fetch(`/api/v1/m/${storeSlug}/track-click/`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            }).catch(() => {
                // Silently swallow — analytics failure must not affect UX
            });
        }

        // ── 3. Open checkout modal ─────────────────────────────────────────
        onBuy();
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-lg transition-shadow duration-200">
            {listing.analytics_screenshot && (
                <img
                    src={listing.analytics_screenshot}
                    alt={listing.title}
                    className="w-full h-36 object-cover"
                    loading="lazy"
                />
            )}
            <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 capitalize">
                        {listing.platform}
                    </span>
                    {listing.monthly_revenue_usd > 0 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
                            Monetized ✓
                        </span>
                    )}
                </div>

                <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-tight mb-1 line-clamp-2">
                    {listing.title}
                </h3>

                <p className="text-xs text-gray-400 mb-3">
                    {Number(listing.follower_count).toLocaleString()} followers
                    {listing.average_engagement_rate > 0 && (
                        <> · {listing.average_engagement_rate}% eng.</>
                    )}
                </p>

                <div className="flex items-center justify-between">
                    <p className="font-bold text-gray-900 dark:text-white">
                        ₦{Number(listing.price).toLocaleString()}
                    </p>
                    <button
                        onClick={handleBuyClick}
                        className="text-xs font-semibold px-3 py-1.5 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl transition-colors"
                    >
                        Buy Now
                    </button>
                </div>
            </div>
        </div>
    );
}