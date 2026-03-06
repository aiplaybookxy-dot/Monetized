import { useState } from "react";
import { X, ShieldCheck, AlertCircle } from "lucide-react";
import api from "../../services/api";

export default function GuestCheckoutModal({ listing, storeSlug, onClose }) {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleCheckout = async () => {
        if (!email || !email.includes("@")) {
            setError("Please enter a valid email address.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const r = await api.post(`/m/${storeSlug}/checkout/`, {
                email,
                listing_id: listing.id,
            });
            // Redirect to Paystack hosted payment page
            window.location.href = r.data.authorization_url;
        } catch (err) {
            setError(
                err.response?.data?.error || "Checkout failed. Please try again."
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                <div className="flex items-start justify-between mb-5">
                    <div>
                        <h2 className="font-bold text-gray-900 dark:text-white">Secure Checkout</h2>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{listing.title}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={18} />
                    </button>
                </div>

                {/* Price */}
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 mb-5 text-center">
                    <p className="text-xs text-gray-400 mb-1">Total Amount</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        ₦{Number(listing.price).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Protected by Escrow</p>
                </div>

                {/* Email input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                        Your Email Address
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="input"
                        autoFocus
                    />
                    <p className="text-xs text-gray-400 mt-1.5">
                        A new account will be created for you automatically if you don't have one.
                    </p>
                </div>

                {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs mb-4">
                        <AlertCircle size={13} /> {error}
                    </div>
                )}

                <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                >
                    {loading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <ShieldCheck size={15} />
                            Pay with Paystack
                        </>
                    )}
                </button>
                <p className="text-[10px] text-gray-400 text-center mt-3">
                    🔒 Your payment is secured by Paystack + Escrow protection
                </p>
            </div>
        </div>
    );
}