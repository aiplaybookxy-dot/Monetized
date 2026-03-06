/**
 * src/pages/sell/ListingVaultUpload.jsx
 *
 * Pre-listing credential vault page.
 * Seller opens this after creating a draft to submit credentials BEFORE
 * the listing goes to moderator review.
 *
 * Route: /sell/listings/:id/vault
 *
 * After submitting, moderator verifies and the listing gets a
 * "Platform Verified" badge on the public storefront.
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    Shield, Eye, EyeOff, Lock, CheckCircle, AlertCircle,
    ArrowLeft, Info, ShieldCheck,
} from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

const CUSTODY_LABELS = {
    0: { label: "Not Verified",          color: "text-gray-400",           bg: "bg-gray-100 dark:bg-gray-800"                               },
    1: { label: "OGE Custody",           color: "text-amber-600",          bg: "bg-amber-50 dark:bg-amber-900/20"                          },
    2: { label: "Pre-Verified Vault",    color: "text-blue-600",           bg: "bg-blue-50 dark:bg-blue-900/20"                            },
    3: { label: "Full Platform Custody", color: "text-emerald-600",        bg: "bg-emerald-50 dark:bg-emerald-900/20"                      },
};

function PasswordField({ label, value, onChange, placeholder }) {
    const [show, setShow] = useState(false);
    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {label}
            </label>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="input pr-10"
                    required
                />
                <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                    {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
            </div>
        </div>
    );
}

export default function ListingVaultUploadPage() {
    const { id }   = useParams();
    const navigate = useNavigate();

    const [listing,  setListing]  = useState(null);
    const [loading,  setLoading]  = useState(true);
    const [saving,   setSaving]   = useState(false);
    const [success,  setSuccess]  = useState(false);
    const [error,    setError]    = useState("");
    const [form, setForm] = useState({
        username:       "",
        password:       "",
        oge:            "",
        transfer_notes: "",
    });

    useEffect(() => {
        api.get(`/listings/${id}/`)
            .then(r => setListing(r.data))
            .catch(() => setError("Could not load listing."))
            .finally(() => setLoading(false));
    }, [id]);

    const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            await api.post(`/listings/${id}/vault/`, form);
            setSuccess(true);
        } catch (err) {
            const d = err.response?.data;
            setError(
                typeof d === "object"
                    ? Object.values(d).flat().join(" · ")
                    : "Failed to upload credentials."
            );
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>
    );

    if (error && !listing) return (
        <div className="card p-8 text-center max-w-md mx-auto">
            <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
            <p className="text-sm text-red-500">{error}</p>
            <Link to="/sell/listings" className="btn-primary mt-4 text-sm inline-flex">← Back</Link>
        </div>
    );

    if (success) return (
        <div className="card p-10 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <ShieldCheck size={28} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Credentials Vaulted
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                A moderator will verify your credentials and your listing will receive a
                <strong> Platform Verified</strong> badge once approved.
            </p>
            <Link to="/sell/listings" className="btn-primary text-sm inline-flex items-center gap-2">
                <ArrowLeft size={14} /> Back to My Listings
            </Link>
        </div>
    );

    const custody = CUSTODY_LABELS[listing?.custody_level ?? 0];

    return (
        <div className="max-w-xl mx-auto space-y-5">
            <Link
                to="/sell/listings"
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
                <ArrowLeft size={14} /> Back to listings
            </Link>

            <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Shield size={18} className="text-brand-500" />
                    Upload Credentials to Vault
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{listing?.title}</span>
                    {" "}· @{listing?.account_handle}
                </p>
            </div>

            {/* Custody level badge */}
            <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${custody.bg} ${custody.color}`}>
                <Lock size={14} />
                Custody Level: <strong>{custody.label}</strong>
                {listing?.credential_status === "VERIFIED" && (
                    <span className="ml-auto flex items-center gap-1 text-emerald-500 text-xs font-semibold">
                        <CheckCircle size={12} /> Verified
                    </span>
                )}
            </div>

            {/* Why this matters */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                <div className="flex items-start gap-2.5">
                    <Info size={14} className="text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1.5">
                        <p><strong>Why upload credentials now?</strong></p>
                        <p>Listings with verified credentials get a <strong>Platform Verified</strong> badge
                        and are 3× more likely to sell. The moderator verifies your account is real and
                        the follower count matches.</p>
                        <p>Credentials are encrypted with AES-256 and only decrypted when a moderator
                        verifies or a buyer makes a purchase.</p>
                    </div>
                </div>
            </div>

            {/* Form */}
            {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="card p-6 space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Username / Handle
                    </label>
                    <input
                        type="text"
                        value={form.username}
                        onChange={set("username")}
                        placeholder="Account username"
                        className="input"
                        required
                    />
                </div>

                <PasswordField
                    label="Account Password"
                    value={form.password}
                    onChange={set("password")}
                    placeholder="Current account password"
                />

                <PasswordField
                    label="Original Gmail / Recovery Email (OGE)"
                    value={form.oge}
                    onChange={set("oge")}
                    placeholder="original.gmail@gmail.com"
                />

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Transfer Notes (optional)
                    </label>
                    <textarea
                        value={form.transfer_notes}
                        onChange={set("transfer_notes")}
                        placeholder="2FA backup codes, important notes for the buyer…"
                        className="input resize-none"
                        rows={3}
                    />
                </div>

                {/* Security reminder */}
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                        <Shield size={12} className="flex-shrink-0 mt-0.5" />
                        Credentials are encrypted end-to-end. Never enter your platform credentials
                        elsewhere. EscrowMarket will never ask for your password via email or chat.
                    </p>
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                >
                    {saving
                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        : <><Lock size={14} /> Submit to Encrypted Vault</>
                    }
                </button>
            </form>
        </div>
    );
}