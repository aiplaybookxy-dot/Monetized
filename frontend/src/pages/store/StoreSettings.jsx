/**
 * src/pages/store/StoreSettings.jsx
 *
 * Seller manages their store:
 *   - Create store if none exists
 *   - Edit name, slug, description, logo, Facebook Pixel ID
 *   - Copy store link (the shareable URL)
 *   - View real-time analytics (page views + leads)
 */
import { useState, useEffect } from "react";
import {
    Store, Link2, Copy, Check, BarChart3, Eye,
    MousePointerClick, TrendingUp, Save, AlertCircle, CheckCircle,
    ExternalLink,
} from "lucide-react";
import api from "../../services/api";

function CopyLink({ slug }) {
    const [copied, setCopied] = useState(false);
    const url = `${window.location.origin}/m/${slug}`;

    const copy = () => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    return (
        <div className="flex items-center gap-2 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-xl border border-brand-200 dark:border-brand-800">
            <Link2 size={14} className="text-brand-500 flex-shrink-0" />
            <span className="text-sm font-mono text-brand-700 dark:text-brand-300 truncate flex-1">{url}</span>
            <div className="flex items-center gap-1.5 flex-shrink-0">
                <a href={url} target="_blank" rel="noreferrer"
                    className="p-1.5 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 text-brand-500 transition-colors">
                    <ExternalLink size={13} />
                </a>
                <button onClick={copy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors">
                    {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy Link</>}
                </button>
            </div>
        </div>
    );
}

function StatBox({ icon: Icon, label, value, color }) {
    return (
        <div className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={16} className="text-white" />
            </div>
            <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{value ?? "—"}</p>
            </div>
        </div>
    );
}

export default function StoreSettingsPage() {
    const [store,     setStore]     = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [saving,    setSaving]    = useState(false);
    const [success,   setSuccess]   = useState("");
    const [error,     setError]     = useState("");

    const [form, setForm] = useState({
        store_name: "", slug: "", description: "", pixel_id: "", is_active: true,
    });
    const [logo, setLogo] = useState(null);

    const set = (f) => (e) => {
        let val = e.target.value;
        if (f === "slug") val = val.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
        setForm(p => ({ ...p, [f]: val }));
    };

    useEffect(() => {
        Promise.all([
            api.get("/store/").catch(() => null),
            api.get("/store/analytics/").catch(() => null),
        ]).then(([storeRes, analyticsRes]) => {
            if (storeRes?.data && !storeRes.data.detail) {
                setStore(storeRes.data);
                setForm({
                    store_name: storeRes.data.store_name || "",
                    slug:       storeRes.data.slug       || "",
                    description:storeRes.data.description|| "",
                    pixel_id:   storeRes.data.pixel_id   || "",
                    is_active:  storeRes.data.is_active  ?? true,
                });
            }
            if (analyticsRes?.data) setAnalytics(analyticsRes.data);
        }).finally(() => setLoading(false));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true); setError(""); setSuccess("");
        try {
            const data = new FormData();
            Object.entries(form).forEach(([k, v]) => data.append(k, v));
            if (logo) data.append("logo", logo);

            const method = store ? "patch" : "post";
            const res = await api[method]("/store/", data, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setStore(res.data);
            setForm({
                store_name: res.data.store_name,
                slug:       res.data.slug,
                description:res.data.description,
                pixel_id:   res.data.pixel_id,
                is_active:  res.data.is_active,
            });
            setSuccess(store ? "Store updated!" : "Store created! Share your link below.");
            setTimeout(() => setSuccess(""), 4000);
        } catch (err) {
            const d = err.response?.data;
            setError(typeof d === "object" ? Object.values(d).flat()[0] : "Failed to save store.");
        } finally { setSaving(false); }
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-16 card animate-pulse" />)}
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Store size={22} className="text-brand-500" /> My Store
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {store ? "Manage your storefront — share the link with your audience." : "Create your store to start selling."}
                </p>
            </div>

            {/* Store Link — shown only if store exists */}
            {store && (
                <div className="card p-5 space-y-2">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Link2 size={14} className="text-brand-500" /> Your Store Link
                    </p>
                    <CopyLink slug={store.slug} />
                    <p className="text-xs text-gray-400">
                        Share this link on social media, WhatsApp, or run Facebook Ads pointing here.
                    </p>
                </div>
            )}

            {/* Analytics — shown only if store exists */}
            {store && analytics && (
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <BarChart3 size={14} className="text-brand-500" /> Store Analytics
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatBox icon={Eye}             label="Total Views"   value={analytics.total_views}    color="bg-brand-500" />
                        <StatBox icon={MousePointerClick} label="Total Leads" value={analytics.total_leads}    color="bg-emerald-500" />
                        <StatBox icon={Eye}             label="Views Today"   value={analytics.views_today}    color="bg-amber-500" />
                        <StatBox icon={TrendingUp}      label="Leads Today"   value={analytics.leads_today}    color="bg-purple-500" />
                    </div>

                    {/* 7-day bar chart */}
                    <div className="card p-4">
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">Last 7 Days</p>
                        <div className="flex items-end justify-between gap-1 h-24">
                            {analytics.daily_breakdown?.map((day, i) => {
                                const maxV = Math.max(...analytics.daily_breakdown.map(d => d.views), 1);
                                const maxL = Math.max(...analytics.daily_breakdown.map(d => d.leads), 1);
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                                        <div className="w-full flex gap-0.5 items-end h-16">
                                            <div
                                                className="flex-1 bg-brand-400 dark:bg-brand-600 rounded-t transition-all"
                                                style={{ height: `${(day.views / maxV) * 100}%`, minHeight: day.views ? "3px" : "0" }}
                                                title={`${day.views} views`}
                                            />
                                            <div
                                                className="flex-1 bg-emerald-400 dark:bg-emerald-600 rounded-t transition-all"
                                                style={{ height: `${(day.leads / maxL) * 100}%`, minHeight: day.leads ? "3px" : "0" }}
                                                title={`${day.leads} leads`}
                                            />
                                        </div>
                                        <p className="text-[9px] text-gray-400">{day.date.split(" ")[1]}</p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-4 mt-2">
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="w-2.5 h-2.5 rounded-sm bg-brand-400 inline-block" /> Views
                            </span>
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Leads
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Store form */}
            <div className="card p-6">
                <h2 className="font-semibold text-gray-900 dark:text-white mb-4">
                    {store ? "Edit Store" : "Create Your Store"}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    {success && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm">
                            <CheckCircle size={14} /> {success}
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                            <AlertCircle size={14} /> {error}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Store Name *</label>
                        <input value={form.store_name} onChange={set("store_name")} className="input" required placeholder="e.g. Vida's Account Shop" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Store URL Slug *</label>
                        <div className="flex items-center input gap-0 !p-0 overflow-hidden">
                            <span className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-400 text-sm border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
                                /m/
                            </span>
                            <input
                                value={form.slug} onChange={set("slug")}
                                className="flex-1 px-3 py-2.5 bg-transparent outline-none text-sm"
                                required placeholder="vida-store"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Lowercase letters, numbers, hyphens only.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
                        <textarea value={form.description} onChange={set("description")}
                            rows={3} maxLength={1000} className="input resize-none"
                            placeholder="Tell visitors what you're selling…" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Store Logo</label>
                        <input type="file" accept="image/*"
                            onChange={e => setLogo(e.target.files[0])}
                            className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-brand-50 file:text-brand-600 file:text-sm file:font-medium hover:file:bg-brand-100 dark:file:bg-brand-900/20" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                            Facebook Pixel ID
                        </label>
                        <input value={form.pixel_id} onChange={set("pixel_id")} className="input font-mono"
                            placeholder="e.g. 1234567890123456" />
                        <p className="text-xs text-gray-400 mt-1">
                            Fires PageView + Lead events automatically. Get your ID from Facebook Events Manager.
                        </p>
                    </div>

                    <div className="flex items-center justify-between py-2">
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">Store Active</p>
                            <p className="text-xs text-gray-400">When off, your store shows a "not available" page.</p>
                        </div>
                        <button type="button" onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                            className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors ${
                                form.is_active ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                            <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform ${
                                form.is_active ? "translate-x-6" : "translate-x-1"}`} />
                        </button>
                    </div>

                    <button type="submit" disabled={saving}
                        className="btn-primary w-full flex items-center justify-center gap-2">
                        {saving
                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <Save size={14} />}
                        {saving ? "Saving…" : store ? "Save Changes" : "Create Store"}
                    </button>
                </form>
            </div>
        </div>
    );
}