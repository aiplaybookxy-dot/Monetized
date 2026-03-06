import { useState, useEffect } from "react";
import { List, CheckCircle, XCircle, Users, TrendingUp, ExternalLink, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

function ListingCard({ listing, onReviewed }) {
    const [decision, setDecision] = useState("approve");
    const [reason, setReason] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(false);

    const submit = async () => {
        if (decision === "reject" && !reason.trim()) {
            setError("Please provide a rejection reason.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            await api.post(`/mod/listings/${listing.id}/review/`, {
                decision,
                rejection_reason: reason,
            });
            onReviewed(listing.id);
        } catch (err) {
            setError(err.response?.data?.error || "Review failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card overflow-hidden">
            <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="px-2.5 py-1 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-xs font-semibold capitalize flex-shrink-0">
                            {listing.platform}
                        </span>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white">{listing.title}</h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                @{listing.account_handle} · by @{listing.seller?.username}
                            </p>
                        </div>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white flex-shrink-0">
                        ₦{Number(listing.price).toLocaleString()}
                    </p>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    <span className="flex items-center gap-1"><Users size={11} />{Number(listing.follower_count).toLocaleString()} followers</span>
                    <span className="flex items-center gap-1"><TrendingUp size={11} />{listing.average_engagement_rate}% eng.</span>
                </div>

                {/* Description preview */}
                <p className={`text-sm text-gray-600 dark:text-gray-300 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>
                    {listing.description}
                </p>
                <button onClick={() => setExpanded((e) => !e)} className="text-xs text-brand-500 hover:underline mt-1">
                    {expanded ? "Show less" : "Read more"}
                </button>

                {listing.account_url && (
                    <a href={listing.account_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-500 mt-2"
                    >
                        <ExternalLink size={11} /> View account
                    </a>
                )}
            </div>

            {/* Review bar */}
            <div className="border-t border-gray-100 dark:border-gray-700 p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
                <div className="flex gap-2">
                    <button onClick={() => setDecision("approve")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border-2 transition-all ${decision === "approve"
                                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                                : "border-gray-200 dark:border-gray-700 text-gray-500"
                            }`}
                    >
                        <CheckCircle size={13} /> Approve
                    </button>
                    <button onClick={() => setDecision("reject")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border-2 transition-all ${decision === "reject"
                                ? "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                                : "border-gray-200 dark:border-gray-700 text-gray-500"
                            }`}
                    >
                        <XCircle size={13} /> Reject
                    </button>
                </div>

                {decision === "reject" && (
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={2}
                        className="input text-sm resize-none w-full"
                        placeholder="Reason for rejection (shown to seller)…"
                    />
                )}

                {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle size={11} />{error}</p>}

                <button onClick={submit} disabled={loading}
                    className={`w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${decision === "approve"
                            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                            : "bg-red-500 hover:bg-red-600 text-white"
                        } disabled:opacity-50`}
                >
                    {loading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                        decision === "approve" ? "Approve & Publish" : "Reject Listing"
                    )}
                </button>
            </div>
        </div>
    );
}

export default function ListingApprovalsPage() {
    const [listings, setListings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/mod/listings/pending/")
            .then((r) => setListings(r.data.results || r.data || []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="max-w-3xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <List size={20} className="text-amber-500" /> Listing Queue
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {listings.length} listing{listings.length !== 1 ? "s" : ""} pending review
                </p>
            </div>

            {loading ? <LoadingSpinner /> : listings.length === 0 ? (
                <div className="card py-20 text-center">
                    <CheckCircle size={44} className="text-emerald-400 mx-auto mb-3" />
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">Queue empty!</p>
                    <p className="text-sm text-gray-400 mt-1">No listings awaiting review.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {listings.map((l) => (
                        <ListingCard key={l.id} listing={l} onReviewed={(id) => setListings((p) => p.filter((x) => x.id !== id))} />
                    ))}
                </div>
            )}
        </div>
    );
}