import { useState } from "react";
import { X, Flag, AlertTriangle, Upload, CheckCircle } from "lucide-react";
import api from "../../services/api";

/**
 * WHY evidence upload is separate from dispute creation:
 * Creating the dispute atomically sets Order → DISPUTED (funds frozen).
 * File uploads are separate POST requests — mixing them in one request
 * with FormData would complicate the atomic transaction on the backend.
 * Dispute first, evidence after — cleaner state management.
 */

const REASONS = [
    { value: "CREDENTIALS_INVALID",  label: "Credentials don't work" },
    { value: "ACCOUNT_NOT_AS_DESC",  label: "Account not as described" },
    { value: "SELLER_UNRESPONSIVE",  label: "Seller is unresponsive" },
    { value: "WRONG_ACCOUNT",        label: "Wrong account delivered" },
    { value: "ACCOUNT_RECOVERED",    label: "Account recovered by original owner" },
    { value: "OTHER",                label: "Other" },
];

export default function ReportProblemModal({ order, onClose, onSuccess }) {
    const [step, setStep]           = useState(1); // 1: describe, 2: evidence, 3: done
    const [dispute, setDispute]     = useState(null);
    const [reason, setReason]       = useState("");
    const [description, setDesc]    = useState("");
    const [files, setFiles]         = useState([]);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError]         = useState("");

    // Step 1 — Submit dispute
    const handleSubmit = async () => {
        if (!reason) { setError("Please select a reason."); return; }
        if (description.length < 20) { setError("Please provide at least 20 characters of description."); return; }
        setError("");
        setSubmitting(true);
        try {
            const r = await api.post("/disputes/", {
                order_id:    order.id,
                reason,
                description,
            });
            setDispute(r.data);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.error || err.response?.data?.detail || "Failed to open dispute.");
        } finally {
            setSubmitting(false);
        }
    };

    // Step 2 — Upload evidence files
    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files);
        if (files.length + selected.length > 10) {
            setError("Maximum 10 evidence files.");
            return;
        }
        setFiles((prev) => [...prev, ...selected]);
    };

    const removeFile = (idx) => setFiles((f) => f.filter((_, i) => i !== idx));

    const handleUploadEvidence = async () => {
        if (files.length === 0) {
            onSuccess(dispute);
            return;
        }
        setUploading(true);
        setError("");

        // Upload files sequentially — parallel uploads on mobile 3G can fail silently
        let failCount = 0;
        for (const file of files) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("caption", file.name);
            try {
                await api.post(`/disputes/${dispute.id}/evidence/`, fd, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
            } catch {
                failCount++;
            }
        }

        if (failCount > 0) {
            setError(`${failCount} file(s) failed to upload. The dispute is still open.`);
        }

        setStep(3);
        setUploading(false);
        setTimeout(() => onSuccess(dispute), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                            <Flag size={15} className="text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Report a Problem</h2>
                            <p className="text-xs text-gray-400">Step {step} of 3</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-5">
                    {/* ── Step 1: Describe ────────────────────────────────── */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                                    <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                                    Opening a dispute will freeze the funds and notify a moderator. Only proceed if you have a genuine problem.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    What's the issue? <span className="text-red-500">*</span>
                                </label>
                                <div className="space-y-2">
                                    {REASONS.map(({ value, label }) => (
                                        <label key={value} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                            reason === value
                                                ? "border-red-400 bg-red-50 dark:bg-red-900/20"
                                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                                        }`}>
                                            <input
                                                type="radio"
                                                name="reason"
                                                value={value}
                                                checked={reason === value}
                                                onChange={() => setReason(value)}
                                                className="text-red-500"
                                            />
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                                    Describe the problem <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDesc(e.target.value)}
                                    rows={4}
                                    placeholder="Explain what happened in detail. Include what you tried and what didn't work..."
                                    className="input resize-none"
                                    maxLength={3000}
                                />
                                <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/3000</p>
                            </div>

                            {error && (
                                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                    <AlertTriangle size={12} /> {error}
                                </p>
                            )}

                            <button
                                onClick={handleSubmit}
                                disabled={submitting}
                                className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm transition-colors"
                            >
                                {submitting
                                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <><Flag size={14} /> Open Dispute & Freeze Funds</>
                                }
                            </button>
                        </div>
                    )}

                    {/* ── Step 2: Evidence ─────────────────────────────────── */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Upload screenshots or screen recordings as evidence. This helps the moderator make a fair decision.
                                <span className="text-gray-400"> (Optional — max 10 files, 10MB each)</span>
                            </p>

                            {/* File list */}
                            {files.length > 0 && (
                                <div className="space-y-2">
                                    {files.map((f, i) => (
                                        <div key={i} className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl text-xs">
                                            <span className="truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                                            <button
                                                onClick={() => removeFile(i)}
                                                className="text-gray-400 hover:text-red-500 flex-shrink-0"
                                            >
                                                <X size={13} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 cursor-pointer hover:border-brand-400 transition-colors">
                                <Upload size={24} className="text-gray-300 mb-2" />
                                <span className="text-sm font-medium text-gray-500">Click to select files</span>
                                <span className="text-xs text-gray-400 mt-1">JPG, PNG, WebP, GIF, PDF</span>
                                <input
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>

                            {error && (
                                <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => { onSuccess(dispute); }}
                                    className="flex-1 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                                >
                                    Skip Evidence
                                </button>
                                <button
                                    onClick={handleUploadEvidence}
                                    disabled={uploading}
                                    className="flex-1 btn-primary flex items-center justify-center gap-2 text-sm"
                                >
                                    {uploading
                                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><Upload size={14} /> Submit Evidence</>
                                    }
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Done ─────────────────────────────────────── */}
                    {step === 3 && (
                        <div className="text-center py-4 space-y-3">
                            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                                <CheckCircle size={28} className="text-emerald-500" />
                            </div>
                            <p className="font-bold text-gray-900 dark:text-white">Dispute Opened</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                A moderator will review your case and notify all parties. Funds are frozen until resolution.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}