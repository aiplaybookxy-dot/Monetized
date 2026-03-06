/**
 * src/pages/payment/Verify.jsx
 *
 * Landing page after Paystack redirects the buyer back.
 *
 * Flow:
 *  1. Call backend /payments/verify/ immediately.
 *  2. Backend calls Paystack directly and funds the order on the spot.
 *  3. If backend returns 'pending' (Paystack slow), poll every 3s up to 5×.
 *  4. Show success / processing / failed state accordingly.
 */
import { useEffect, useState, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader, Clock, ShieldCheck } from "lucide-react";
import api from "../../services/api";

const FUNDED_STATUSES = ["funded", "in_provision", "completed"];
const MAX_POLLS       = 5;
const POLL_INTERVAL   = 3000; // ms

export default function PaymentVerifyPage() {
    const [params]              = useSearchParams();
    const navigate              = useNavigate();
    const [state, setState]     = useState("loading");
    const [orderId, setOrderId] = useState(null);
    const [attempts, setAttempts] = useState(0);
    const pollRef               = useRef(null);

    const verify = async (reference) => {
        try {
            const res = await api.get(`/payments/verify/?reference=${reference}`);
            const { status, order_id } = res.data;

            setOrderId(order_id);

            if (FUNDED_STATUSES.includes(status)) {
                clearInterval(pollRef.current);
                setState("success");
            } else if (status === "cancelled" || status === "failed") {
                clearInterval(pollRef.current);
                setState("failed");
            } else {
                // Still 'pending' — keep polling
                setState("processing");
            }
        } catch {
            clearInterval(pollRef.current);
            setState("failed");
        }
    };

    useEffect(() => {
        const reference = params.get("reference") || params.get("trxref");
        if (!reference) { setState("failed"); return; }

        // First call immediately
        verify(reference);

        // Poll every 3s up to MAX_POLLS times in case backend returns 'pending'
        let count = 0;
        pollRef.current = setInterval(() => {
            count += 1;
            setAttempts(count);
            if (count >= MAX_POLLS) {
                clearInterval(pollRef.current);
                // After max polls still processing — show processing state
                // with a link to orders page
                setState(prev => prev === "success" ? "success" : "processing_timeout");
                return;
            }
            verify(reference);
        }, POLL_INTERVAL);

        return () => clearInterval(pollRef.current);
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center px-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-10 text-center max-w-sm w-full">

                {/* ── Loading / first check ── */}
                {state === "loading" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center mx-auto mb-5">
                            <Loader size={28} className="text-brand-500 animate-spin" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Verifying Payment…
                        </h2>
                        <p className="text-sm text-gray-400">
                            Confirming your payment with Paystack.
                        </p>
                    </>
                )}

                {/* ── Processing / polling ── */}
                {state === "processing" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mx-auto mb-5">
                            <Clock size={28} className="text-amber-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Payment Processing…
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            Your payment was received. We're waiting for final confirmation from Paystack.
                        </p>
                        {/* Animated dots */}
                        <div className="flex items-center justify-center gap-1.5 mb-4">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                        i < attempts % 5
                                            ? "bg-brand-500 scale-110"
                                            : "bg-gray-200 dark:bg-gray-700"
                                    }`}
                                />
                            ))}
                        </div>
                        <p className="text-xs text-gray-400">
                            Checking… ({attempts}/{MAX_POLLS})
                        </p>
                    </>
                )}

                {/* ── Timeout — still pending after all polls ── */}
                {state === "processing_timeout" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-5">
                            <ShieldCheck size={28} className="text-blue-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Payment Received
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Your payment was received and is being confirmed. 
                            Check your orders page in a few seconds — your order will appear there.
                        </p>
                        <div className="space-y-2">
                            {orderId ? (
                                <Link
                                    to={`/orders/${orderId}`}
                                    className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm block text-center transition-colors"
                                >
                                    View Order →
                                </Link>
                            ) : (
                                <Link
                                    to="/orders"
                                    className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm block text-center transition-colors"
                                >
                                    Go to My Orders →
                                </Link>
                            )}
                        </div>
                    </>
                )}

                {/* ── Success ── */}
                {state === "success" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-5">
                            <CheckCircle size={32} className="text-emerald-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Payment Confirmed!
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Your funds are secured in escrow. The seller has been notified
                            to upload the account credentials.
                        </p>
                        <div className="space-y-2">
                            {orderId && (
                                <Link
                                    to={`/orders/${orderId}`}
                                    className="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm block text-center transition-colors shadow-lg shadow-brand-500/25"
                                >
                                    View Order →
                                </Link>
                            )}
                            <Link
                                to="/orders"
                                className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm block text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                                All Orders
                            </Link>
                        </div>
                    </>
                )}

                {/* ── Failed ── */}
                {state === "failed" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-5">
                            <XCircle size={32} className="text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            Payment Failed
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            We couldn't verify your payment. No charge was made.
                            If you were charged, please contact support.
                        </p>
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white hover:opacity-90 text-white dark:text-gray-900 font-bold text-sm transition-opacity"
                        >
                            ← Go Back
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}