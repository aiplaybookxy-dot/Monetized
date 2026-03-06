/**
 * src/pages/admin/PlatformSettings.jsx
 * Global platform configuration — commission rate, inspection window, maintenance mode.
 * Endpoints:
 *   GET   /api/v1/admin/settings/
 *   PATCH /api/v1/admin/settings/
 */
import { useEffect, useState } from "react";
import {
    Settings, Percent, Clock, Shield, Save, RefreshCw,
    ToggleLeft, ToggleRight, Info, CheckCircle, AlertTriangle
} from "lucide-react";
import api from "../../services/api";

function Toggle({ enabled, onChange, disabled }) {
    return (
        <button
            onClick={() => !disabled && onChange(!enabled)}
            disabled={disabled}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                enabled ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-600"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
        </button>
    );
}

function SettingRow({ icon: Icon, label, description, children }) {
    return (
        <div className="flex items-start justify-between gap-6 py-5 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <div className="flex items-start gap-3 flex-1">
                <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon size={14} className="text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-md">{description}</p>
                </div>
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

export default function PlatformSettingsPage() {
    const [settings, setSettings]   = useState(null);
    const [form, setForm]           = useState({});
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(false);
    const [toast, setToast]         = useState(null); // { type: "success"|"error", msg }

    const load = () => {
        setLoading(true);
        api.get("/admin/settings/")
            .then(r => {
                setSettings(r.data);
                setForm(r.data);
            })
            .catch(() => showToast("error", "Failed to load settings."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const showToast = (type, msg) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 3500);
    };

    const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

    const save = async () => {
        setSaving(true);
        try {
            await api.patch("/admin/settings/", form);
            setSettings(form);
            showToast("success", "Settings saved successfully.");
        } catch (e) {
            showToast("error", e.response?.data?.error || "Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const isDirty = JSON.stringify(form) !== JSON.stringify(settings);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <RefreshCw size={22} className="animate-spin text-brand-500" />
        </div>
    );

    return (
        <div className="space-y-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        Global configuration for the escrow marketplace
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} className="btn-ghost text-sm flex items-center gap-2">
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={save}
                        disabled={!isDirty || saving}
                        className="btn-primary text-sm flex items-center gap-2"
                    >
                        <Save size={14} />
                        {saving ? "Saving…" : "Save Changes"}
                    </button>
                </div>
            </div>

            {/* Toast */}
            {toast && (
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
                    toast.type === "success"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                }`}>
                    {toast.type === "success"
                        ? <CheckCircle size={15} />
                        : <AlertTriangle size={15} />
                    }
                    {toast.msg}
                </div>
            )}

            {/* Dirty warning */}
            {isDirty && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-sm">
                    <Info size={14} />
                    You have unsaved changes.
                </div>
            )}

            {/* Settings card */}
            <div className="card p-6">
                <div className="flex items-center gap-2 mb-1 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <Settings size={15} className="text-brand-500" />
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Escrow & Financials</h2>
                </div>

                <SettingRow
                    icon={Percent}
                    label="Platform Commission Rate"
                    description="Percentage deducted from each completed transaction as platform fee. Applied at order creation time."
                >
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={0}
                            max={50}
                            step={0.5}
                            value={form.commission_percent ?? 10}
                            onChange={e => set("commission_percent", parseFloat(e.target.value))}
                            className="input w-24 text-center text-sm font-bold"
                        />
                        <span className="text-sm text-gray-400 font-medium">%</span>
                    </div>
                </SettingRow>

                <SettingRow
                    icon={Clock}
                    label="Inspection Window (hours)"
                    description="How long the buyer has to verify credentials and either accept or dispute after the seller uploads credentials."
                >
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={1}
                            max={168}
                            step={1}
                            value={form.inspection_hours ?? 48}
                            onChange={e => set("inspection_hours", parseInt(e.target.value))}
                            className="input w-24 text-center text-sm font-bold"
                        />
                        <span className="text-sm text-gray-400 font-medium">hrs</span>
                    </div>
                </SettingRow>

                <SettingRow
                    icon={Shield}
                    label="Minimum Withdrawal Amount"
                    description="Sellers must have at least this balance before they can request a payout."
                >
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400 font-medium">₦</span>
                        <input
                            type="number"
                            min={0}
                            step={100}
                            value={form.min_withdrawal ?? 1000}
                            onChange={e => set("min_withdrawal", parseFloat(e.target.value))}
                            className="input w-32 text-sm font-bold"
                        />
                    </div>
                </SettingRow>
            </div>

            <div className="card p-6">
                <div className="flex items-center gap-2 mb-1 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <Shield size={15} className="text-brand-500" />
                    <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Platform Flags</h2>
                </div>

                <SettingRow
                    icon={ToggleRight}
                    label="Maintenance Mode"
                    description="Temporarily disables all new purchases while keeping existing orders accessible. Shows a maintenance banner to visitors."
                >
                    <Toggle
                        enabled={!!form.maintenance_mode}
                        onChange={v => set("maintenance_mode", v)}
                    />
                </SettingRow>

                <SettingRow
                    icon={ToggleRight}
                    label="New Registrations"
                    description="Allow new users to sign up. Disable to close registration during platform maintenance."
                >
                    <Toggle
                        enabled={!!form.registrations_open}
                        onChange={v => set("registrations_open", v)}
                    />
                </SettingRow>

                <SettingRow
                    icon={ToggleRight}
                    label="Auto-approve Listings"
                    description="Skip moderator approval for new listings. Not recommended for production — bypasses the content review queue."
                >
                    <Toggle
                        enabled={!!form.auto_approve_listings}
                        onChange={v => set("auto_approve_listings", v)}
                    />
                </SettingRow>

                <SettingRow
                    icon={ToggleRight}
                    label="Guest Checkout"
                    description="Allow non-registered users to purchase using only their email address. A silent account is created automatically."
                >
                    <Toggle
                        enabled={form.guest_checkout !== false}
                        onChange={v => set("guest_checkout", v)}
                    />
                </SettingRow>
            </div>
        </div>
    );
}