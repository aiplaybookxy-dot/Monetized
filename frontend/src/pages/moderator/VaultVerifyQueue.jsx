/**
 * src/pages/moderator/VaultVerifyQueue.jsx
 *
 * Moderator page — shows all listings with an uploaded ListingVault
 * that hasn't been verified yet (credential_status = UNVERIFIED | STALE).
 *
 * Moderator can:
 *  1. View decrypted credentials (logged to ActivityLog server-side)
 *  2. Mark vault as verified (POST /listings/:id/vault/verify/)
 *  3. Optionally set a custody email (Level 1) or custody level (2/3)
 *
 * Route: /moderator/vault-queue
 */
import { useState, useEffect, useCallback } from "react";
import {
    Shield, Eye, EyeOff, CheckCircle, AlertCircle, RefreshCw,
    Lock, ShieldCheck, AlertTriangle, ChevronDown, ChevronUp,
    Copy, ExternalLink,
} from "lucide-react";
import api from "../../services/api";

const STATUS_CONFIG = {
    UNVERIFIED: { label: "Unverified",      color: "text-gray-500",   bg: "bg-gray-100 dark:bg-gray-800"                 },
    STALE:      { label: "Needs Re-verify", color: "text-amber-600",  bg: "bg-amber-100 dark:bg-amber-900/30"            },
    FAILED:     { label: "Creds Failed",    color: "text-red-600",    bg: "bg-red-100 dark:bg-red-900/30"                },
    VERIFIED:   { label: "Verified",        color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30"       },
    CUSTODY_HELD: { label: "Full Custody",  color: "text-brand-600",  bg: "bg-brand-100 dark:bg-brand-900/30"           },
};

const PLATFORM_ICON = {
    instagram: "📸", youtube: "▶️", tiktok: "🎵", twitter: "🐦",
    facebook: "👤", snapchat: "👻", twitch: "🎮", other: "🌐",
};

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {});
}

// ── Credential viewer ─────────────────────────────────────────────────────────
function VaultCredentials({ listingId }) {
    const [creds,   setCreds]   = useState(null);
    const [loading, setLoading] = useState(false);
    const [error,   setError]   = useState("");
    const [show,    setShow]    = useState({ password: false, oge: false });

    const load = async () => {
        setLoading(true);
        setError("");
        try {
            const r = await api.get(`/listings/${listingId}/vault/retrieve/`);
            setCreds(r.data);
        } catch (e) {
            setError(e.response?.data?.error || "Could not retrieve credentials.");
        } finally {
            setLoading(false);
        }
    };

    if (!creds && !loading && !error) {
        return (
            <button
                onClick={load}
                className="text-xs text-brand-500 hover:text-brand-600 font-semibold flex items-center gap-1.5 underline underline-offset-2"
            >
                <Eye size={12} /> View Credentials
            </button>
        );
    }

    if (loading) return <div className="text-xs text-gray-400">Loading…</div>;
    if (error)   return <div className="text-xs text-red-500">{error}</div>;

    const Field = ({ label, value, isSecret, secretKey }) => (
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-24 flex-shrink-0">{label}</span>
            <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-xs font-mono text-gray-900 dark:text-white truncate">
                    {isSecret && !show[secretKey] ? "••••••••••••" : value}
                </span>
                {isSecret && (
                    <button
                        onClick={() => setShow(s => ({ ...s, [secretKey]: !s[secretKey] }))}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                    >
                        {show[secretKey] ? <EyeOff size={11} /> : <Eye size={11} />}
                    </button>
                )}
                <button
                    onClick={() => copyToClipboard(value)}
                    className="text-gray-400 hover:text-brand-500 flex-shrink-0"
                    title="Copy"
                >
                    <Copy size={11} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-1.5 mb-2">
                <Lock size={11} className="text-brand-500" />
                <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Decrypted Credentials — This access is logged
                </span>
            </div>
            <Field label="Username"  value={creds.username} />
            <Field label="Password"  value={creds.password}  isSecret secretKey="password" />
            <Field label="OGE Email" value={creds.oge}       isSecret secretKey="oge" />
            {creds.transfer_notes && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-[11px] font-medium text-gray-500 mb-1">Transfer Notes</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">{creds.transfer_notes}</p>
                </div>
            )}
        </div>
    );
}

// ── Verify form ───────────────────────────────────────────────────────────────
function VerifyForm({ listing, onVerified }) {
    const [open,         setOpen]         = useState(false);
    const [custodyEmail, setCustodyEmail] = useState("");
    const [custodyLevel, setCustodyLevel] = useState("");
    const [saving,       setSaving]       = useState(false);
    const [error,        setError]        = useState("");

    const handleVerify = async () => {
        setSaving(true);
        setError("");
        try {
            const body = {};
            if (custodyEmail) body.custody_email  = custodyEmail;
            if (custodyLevel) body.custody_level  = parseInt(custodyLevel);
            await api.post(`/listings/${listing.id}/vault/verify/`, body);
            onVerified(listing.id);
        } catch (e) {
            setError(e.response?.data?.error || "Verification failed.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-3">
            {!open ? (
                <button
                    onClick={() => setOpen(true)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5"
                >
                    <ShieldCheck size={12} /> Verify Credentials
                </button>
            ) : (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 space-y-3">
                    <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                        <ShieldCheck size={12} /> Verify Vault — Optional Details
                    </p>

                    <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Custody Email (Level 1) — Optional
                        </label>
                        <input
                            type="email"
                            value={custodyEmail}
                            onChange={e => setCustodyEmail(e.target.value)}
                            placeholder="escrow-{uuid}@yourdomain.com"
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">
                            Set this if you've changed the account's recovery email to a platform-owned address.
                        </p>
                    </div>

                    <div>
                        <label className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                            Custody Level — Optional
                        </label>
                        <select
                            value={custodyLevel}
                            onChange={e => setCustodyLevel(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        >
                            <option value="">Keep current level</option>
                            <option value="1">Level 1 — OGE Email Custody</option>
                            <option value="2">Level 2 — Pre-Vaulted (default)</option>
                            <option value="3">Level 3 — Full Platform Custody</option>
                        </select>
                    </div>

                    {error && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle size={11} /> {error}
                        </p>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={() => setOpen(false)}
                            className="flex-1 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleVerify}
                            disabled={saving}
                            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white transition-colors flex items-center justify-center gap-1"
                        >
                            {saving
                                ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <><ShieldCheck size={11} /> Confirm Verified</>
                            }
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Listing card ──────────────────────────────────────────────────────────────
function VaultCard({ listing, onVerified }) {
    const [expanded, setExpanded] = useState(false);
    const cfg = STATUS_CONFIG[listing.credential_status] || STATUS_CONFIG.UNVERIFIED;

    return (
        <div className="card p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-lg flex-shrink-0">
                        {PLATFORM_ICON[listing.platform] || "🌐"}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                {cfg.label}
                            </span>
                            <span className="text-[11px] text-gray-400">
                                Level {listing.custody_level}
                            </span>
                        </div>
                        <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{listing.title}</p>
                        <p className="text-xs text-gray-400">@{listing.account_handle} · {listing.platform}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                        ₦{Number(listing.price).toLocaleString("en-NG")}
                    </p>
                    <button
                        onClick={() => setExpanded(e => !e)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
                    >
                        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                </div>
            </div>

            {/* Seller */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="w-6 h-6 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center text-brand-600 text-xs font-bold flex-shrink-0">
                    {listing.seller?.username?.[0]?.toUpperCase()}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Seller: <span className="font-semibold text-gray-700 dark:text-gray-300">@{listing.seller?.username}</span>
                </p>
                {listing.account_url && (
                    <a
                        href={listing.account_url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-xs text-brand-500 hover:underline flex items-center gap-1"
                    >
                        <ExternalLink size={10} /> View Account
                    </a>
                )}
            </div>

            {/* Expanded — credentials + verify */}
            {expanded && (
                <div className="mt-3">
                    {listing.last_verified_at && (
                        <p className="text-[11px] text-gray-400 mb-2">
                            Last verified: {new Date(listing.last_verified_at).toLocaleString()}
                        </p>
                    )}
                    <VaultCredentials listingId={listing.id} />
                    {listing.credential_status !== "VERIFIED" && listing.credential_status !== "CUSTODY_HELD" && (
                        <VerifyForm listing={listing} onVerified={onVerified} />
                    )}
                    {(listing.credential_status === "VERIFIED" || listing.credential_status === "CUSTODY_HELD") && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                            <ShieldCheck size={13} /> Vault is verified
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function VaultVerifyQueue() {
    const [listings, setListings] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [filter,   setFilter]   = useState("pending"); // "pending" | "all"
    const [error,    setError]    = useState("");

    const load = useCallback(() => {
        setLoading(true);
        setError("");
        // Fetch all active/pending_review listings that have a vault
        api.get("/listings/?page_size=100")
            .then(r => {
                const all = r.data?.results || r.data || [];
                // Filter to only those with a listing vault
                const vaulted = all.filter(l => l.has_listing_vault);
                setListings(vaulted);
            })
            .catch(() => setError("Failed to load listings."))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleVerified = (listingId) => {
        setListings(ls =>
            ls.map(l =>
                l.id === listingId
                    ? { ...l, credential_status: "VERIFIED", is_platform_verified: true }
                    : l
            )
        );
    };

    const filtered = filter === "pending"
        ? listings.filter(l => !["VERIFIED", "CUSTODY_HELD"].includes(l.credential_status))
        : listings;

    const pendingCount = listings.filter(l => !["VERIFIED", "CUSTODY_HELD"].includes(l.credential_status)).length;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <Shield size={18} className="text-rose-500" />
                        Vault Verification Queue
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {pendingCount} listing{pendingCount !== 1 ? "s" : ""} awaiting credential verification
                    </p>
                </div>
                <button onClick={load} className="btn-ghost p-2">
                    <RefreshCw size={14} className={`text-gray-500 ${loading ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* Info banner */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                    Every credential access is logged with your user ID, IP address, and timestamp.
                    Only verify credentials you have personally tested against the actual account.
                    Verified listings display a <strong>Platform Verified</strong> badge to buyers.
                </p>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
                {[
                    { key: "pending", label: `Pending (${pendingCount})` },
                    { key: "all",     label: `All Vaulted (${listings.length})` },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setFilter(tab.key)}
                        className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors ${
                            filter === tab.key
                                ? "bg-rose-500 text-white"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-sm">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center h-40">
                    <RefreshCw size={20} className="animate-spin text-rose-500" />
                </div>
            )}

            {/* List */}
            {!loading && filtered.length === 0 && (
                <div className="card p-12 text-center">
                    <ShieldCheck size={40} className="text-emerald-400 mx-auto mb-3" />
                    <p className="font-bold text-gray-900 dark:text-white mb-1">
                        {filter === "pending" ? "Queue is clear!" : "No vaulted listings found"}
                    </p>
                    <p className="text-sm text-gray-400">
                        {filter === "pending"
                            ? "All vaulted listings have been verified."
                            : "No listings have uploaded credentials yet."
                        }
                    </p>
                </div>
            )}

            {!loading && filtered.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-4">
                    {filtered.map(l => (
                        <VaultCard key={l.id} listing={l} onVerified={handleVerified} />
                    ))}
                </div>
            )}
        </div>
    );
}