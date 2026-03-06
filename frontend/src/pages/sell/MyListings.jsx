/**
 * src/pages/sell/MyListings.jsx
 *
 * Seller's listing management page.
 * Shows each listing's status, custody level badge, and credential status.
 * Links to the vault upload page for listings missing verification.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
    Plus, RefreshCw, AlertCircle, ShieldCheck, Shield, Lock,
    CheckCircle, XCircle, Clock, AlertTriangle, Eye,
} from "lucide-react";
import api from "../../services/api";

// ── Badge config ──────────────────────────────────────────────────────────────
const STATUS_BADGE = {
    draft:          { label: "Draft",         cls: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"          },
    pending_review: { label: "In Review",     cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"   },
    active:         { label: "Active",        cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" },
    under_review:   { label: "Under Review",  cls: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"       },
    sold:           { label: "Sold",          cls: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
    suspended:      { label: "Suspended",     cls: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"           },
};

const CREDENTIAL_BADGE = {
    UNVERIFIED:   { label: "Unverified",         icon: AlertCircle, cls: "bg-gray-100 dark:bg-gray-800 text-gray-500"               },
    VERIFIED:     { label: "Verified",            icon: CheckCircle, cls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600"   },
    FAILED:       { label: "Creds Failed",        icon: XCircle,     cls: "bg-red-100 dark:bg-red-900/30 text-red-600"              },
    CUSTODY_HELD: { label: "Platform Custody",    icon: ShieldCheck, cls: "bg-brand-100 dark:bg-brand-900/30 text-brand-600"        },
    STALE:        { label: "Needs Re-verify",     icon: AlertTriangle, cls: "bg-amber-100 dark:bg-amber-900/30 text-amber-600"      },
};

const CUSTODY_LEVEL = {
    0: null,
    1: { label: "OGE Custody",    cls: "text-amber-600 bg-amber-50 dark:bg-amber-900/20"   },
    2: { label: "Pre-Vaulted",    cls: "text-blue-600 bg-blue-50 dark:bg-blue-900/20"      },
    3: { label: "Full Custody",   cls: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" },
};

function fmt(n) {
    return `₦${Number(n || 0).toLocaleString("en-NG")}`;
}

function StatusBadge({ status }) {
    const cfg = STATUS_BADGE[status] || STATUS_BADGE.draft;
    return (
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

function CredentialBadge({ credentialStatus }) {
    const cfg = CREDENTIAL_BADGE[credentialStatus] || CREDENTIAL_BADGE.UNVERIFIED;
    const Icon = cfg.icon;
    return (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.cls}`}>
            <Icon size={10} /> {cfg.label}
        </span>
    );
}

function CustodyBadge({ level }) {
    const cfg = CUSTODY_LEVEL[level];
    if (!cfg) return null;
    return (
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${cfg.cls}`}>
            <Lock size={10} /> {cfg.label}
        </span>
    );
}

function ListingCard({ listing, onDelete }) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!window.confirm("Delete this listing? This cannot be undone.")) return;
        setDeleting(true);
        try {
            await api.delete(`/listings/${listing.id}/delete/`);
            onDelete(listing.id);
        } catch {
            alert("Failed to delete listing.");
        } finally {
            setDeleting(false);
        }
    };

    const needsVault = (
        listing.status !== "sold" &&
        listing.status !== "suspended" &&
        !listing.has_listing_vault
    );
    const credStatus = listing.credential_status;
    const needsReverify = credStatus === "STALE" || credStatus === "FAILED";

    return (
        <div className="card p-5">
            <div className="flex items-start justify-between gap-3">
                {/* Platform icon */}
                <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-black text-brand-600 dark:text-brand-400 uppercase">
                        {listing.platform[0]}
                    </span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <StatusBadge status={listing.status} />
                        <CredentialBadge credentialStatus={listing.credential_status} />
                        <CustodyBadge level={listing.custody_level} />
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white truncate">{listing.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">@{listing.account_handle} · {listing.platform}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span className="font-bold text-base text-gray-900 dark:text-white">{fmt(listing.price)}</span>
                        <span className="flex items-center gap-1">
                            <Eye size={10} /> {listing.view_count}
                        </span>
                        <span>{new Date(listing.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            {/* Vault CTA — shown when listing has no vault OR needs re-verify */}
            {(needsVault || needsReverify) && (
                <div className={`mt-4 p-3 rounded-xl border flex items-start gap-2.5 ${
                    needsReverify
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                }`}>
                    <AlertTriangle size={14} className={needsReverify ? "text-red-500 flex-shrink-0 mt-0.5" : "text-amber-500 flex-shrink-0 mt-0.5"} />
                    <div className="flex-1">
                        <p className={`text-xs font-semibold ${needsReverify ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                            {needsReverify
                                ? "Credentials need re-verification — listing may be suspended soon"
                                : "Upload credentials to get a Platform Verified badge"
                            }
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                            Verified listings sell 3× faster and build buyer trust.
                        </p>
                    </div>
                    <Link
                        to={`/sell/listings/${listing.id}/vault`}
                        className="text-xs font-semibold text-brand-500 hover:underline flex-shrink-0"
                    >
                        {needsReverify ? "Update →" : "Upload →"}
                    </Link>
                </div>
            )}

            {/* Verified success bar */}
            {credStatus === "VERIFIED" || credStatus === "CUSTODY_HELD" ? (
                <div className="mt-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" />
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        Platform Verified — buyers can see your verification badge
                    </p>
                </div>
            ) : null}

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                {listing.status !== "sold" && listing.status !== "suspended" && (
                    <Link
                        to={`/sell/listings/${listing.id}/vault`}
                        className="text-xs text-gray-500 hover:text-brand-500 transition-colors flex items-center gap-1"
                    >
                        <Lock size={11} /> Manage Vault
                    </Link>
                )}
                <div className="flex-1" />
                <button
                    onClick={handleDelete}
                    disabled={deleting || listing.status === "sold"}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                >
                    {deleting ? "Deleting…" : "Delete"}
                </button>
            </div>
        </div>
    );
}

export default function MyListingsPage() {
    const [listings, setListings] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState("");

    const load = () => {
        setLoading(true);
        api.get("/listings/mine/")
            .then(r => setListings(r.data.results || r.data || []))
            .catch(() => setError("Failed to load listings."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDelete = id => setListings(ls => ls.filter(l => l.id !== id));

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <RefreshCw size={20} className="animate-spin text-brand-500" />
        </div>
    );

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Listings</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {listings.length} listing{listings.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="btn-ghost p-2">
                        <RefreshCw size={14} className="text-gray-500" />
                    </button>
                    <Link to="/sell" className="btn-primary text-sm flex items-center gap-2">
                        <Plus size={14} /> New Listing
                    </Link>
                </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 text-[11px] text-gray-400 items-center px-1">
                <span className="font-semibold text-gray-500 dark:text-gray-400">Verification:</span>
                <span className="flex items-center gap-1"><CheckCircle size={10} className="text-emerald-500" /> Verified</span>
                <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-amber-500" /> Needs Re-verify</span>
                <span className="flex items-center gap-1"><XCircle size={10} className="text-red-500" /> Failed</span>
                <span className="flex items-center gap-1"><AlertCircle size={10} className="text-gray-400" /> Unverified</span>
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            {/* Listings */}
            {listings.length === 0 ? (
                <div className="card p-12 text-center">
                    <Shield size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <h2 className="font-bold text-gray-900 dark:text-white mb-1">No listings yet</h2>
                    <p className="text-sm text-gray-400 mb-5">
                        Create your first listing and upload credentials for a verified badge.
                    </p>
                    <Link to="/sell" className="btn-primary text-sm inline-flex items-center gap-2">
                        <Plus size={14} /> Create a Listing
                    </Link>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                    {listings.map(l => (
                        <ListingCard key={l.id} listing={l} onDelete={handleDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}