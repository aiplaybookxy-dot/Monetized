/**
 * src/pages/Home.jsx
 */
import { Link } from "react-router-dom";
import {
    ShieldCheck, Zap, Lock, ArrowRight,
    TrendingUp, Users, CheckCircle, Star,
} from "lucide-react";
import ThemeToggle from "../components/ui/ThemeToggle";

const FEATURES = [
    {
        icon: ShieldCheck,
        title: "Escrow Protected",
        desc: "Funds are held securely until you confirm credentials work. Zero risk of losing money.",
        color: "text-emerald-500",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
        border: "border-emerald-100 dark:border-emerald-900/40",
    },
    {
        icon: Lock,
        title: "AES-256 Vault",
        desc: "Account credentials are encrypted at rest and only decrypted when payment clears.",
        color: "text-brand-500",
        bg: "bg-brand-50 dark:bg-brand-900/20",
        border: "border-brand-100 dark:border-brand-900/40",
    },
    {
        icon: Zap,
        title: "Instant Settlement",
        desc: "Sellers are credited the moment buyers confirm. No waiting, no manual transfers.",
        color: "text-amber-500",
        bg: "bg-amber-50 dark:bg-amber-900/20",
        border: "border-amber-100 dark:border-amber-900/40",
    },
];

const STATS = [
    { label: "Accounts Traded",  value: "2,400+" },
    { label: "Satisfied Traders", value: "1,800+" },
    { label: "Avg. Transaction",  value: "₦185k"  },
    { label: "Dispute Rate",      value: "<0.4%"  },
];

const HOW = [
    { n: "01", title: "Browse Listings",    desc: "Find the social account you want with verified stats and platform details." },
    { n: "02", title: "Pay into Escrow",    desc: "Your funds are held securely. The seller cannot access them yet." },
    { n: "03", title: "Verify & Confirm",   desc: "Seller uploads credentials. You log in and test the account." },
    { n: "04", title: "Release & Done",     desc: "Confirm everything works and funds are instantly released to the seller." },
];

export default function HomePage() {
    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 font-ubuntu text-gray-900 dark:text-white">

            {/* ── Nav ──────────────────────────────────────────────────────── */}
            <nav className="fixed top-0 inset-x-0 z-30 bg-white/80 dark:bg-gray-950/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800/60">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2.5 font-bold text-gray-900 dark:text-white">
                        <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center shadow-sm">
                            <TrendingUp size={14} className="text-white" />
                        </div>
                        EscrowMarket
                    </Link>
                    <div className="flex items-center gap-1.5">
                        <ThemeToggle />
                        <Link to="/login"    className="btn-ghost text-sm px-4 hidden sm:inline-flex">Sign In</Link>
                        <Link to="/register" className="btn-primary text-sm px-4">Get Started</Link>
                    </div>
                </div>
            </nav>

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <section className="pt-32 pb-24 px-4 sm:px-6">
                <div className="max-w-4xl mx-auto text-center">

                    {/* Trust badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 border border-brand-100 dark:border-brand-800 text-brand-600 dark:text-brand-400 text-xs font-semibold mb-7">
                        <ShieldCheck size={12} />
                        Escrow-Secured · AES-256 Encrypted
                    </div>

                    <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-gray-900 dark:text-white leading-[1.1] tracking-tight mb-6">
                        Trade Social Accounts{" "}
                        <span className="relative inline-block">
                            <span className="text-brand-500">Without Risk</span>
                            <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 300 6" preserveAspectRatio="none">
                                <path d="M0 5 Q75 0 150 5 Q225 10 300 5" stroke="#6366f1" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.5"/>
                            </svg>
                        </span>
                    </h1>

                    <p className="text-lg sm:text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Our escrow system holds your payment until you verify the account credentials work.
                        No chargebacks, no scams — just clean, trustless trades.
                    </p>

                    <div className="flex items-center justify-center gap-3 flex-wrap">
                        <Link to="/register" className="btn-primary flex items-center gap-2 text-base px-7 py-3">
                            Start Trading Free <ArrowRight size={16} />
                        </Link>
                        <Link to="/login" className="btn-ghost flex items-center gap-2 text-base px-7 py-3 border border-gray-200 dark:border-gray-700">
                            Sign In
                        </Link>
                    </div>

                    {/* Social proof */}
                    <div className="mt-10 flex items-center justify-center gap-2 text-sm text-gray-400">
                        <div className="flex -space-x-2">
                            {["bg-violet-400","bg-emerald-400","bg-amber-400","bg-pink-400"].map((c, i) => (
                                <div key={i} className={`w-7 h-7 rounded-full ${c} border-2 border-white dark:border-gray-950 flex items-center justify-center text-white text-[10px] font-bold`}>
                                    {String.fromCharCode(65 + i)}
                                </div>
                            ))}
                        </div>
                        <span>Trusted by <strong className="text-gray-600 dark:text-gray-300">1,800+</strong> traders</span>
                        <div className="flex items-center gap-0.5 ml-1">
                            {[...Array(5)].map((_, i) => <Star key={i} size={11} className="fill-amber-400 text-amber-400" />)}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Stats ────────────────────────────────────────────────────── */}
            <section className="py-12 px-4 sm:px-6 bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800/60">
                <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                    {STATS.map((s) => (
                        <div key={s.label} className="text-center">
                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features ─────────────────────────────────────────────────── */}
            <section className="py-24 px-4 sm:px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            Built for trust. Optimised for speed.
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
                            Every feature protects both parties at every stage of the transaction.
                        </p>
                    </div>
                    <div className="grid md:grid-cols-3 gap-5">
                        {FEATURES.map(({ icon: Icon, title, desc, color, bg, border }) => (
                            <div key={title} className={`card p-7 border ${border}`}>
                                <div className={`w-11 h-11 rounded-2xl ${bg} flex items-center justify-center mb-5`}>
                                    <Icon size={20} className={color} />
                                </div>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How It Works ─────────────────────────────────────────────── */}
            <section className="py-24 px-4 sm:px-6 bg-gray-50 dark:bg-gray-900/50">
                <div className="max-w-4xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                            How it works
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400">Four steps from browsing to owning.</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {HOW.map(({ n, title, desc }) => (
                            <div key={n} className="card p-6">
                                <p className="text-4xl font-black text-brand-100 dark:text-brand-900/60 mb-3 leading-none">{n}</p>
                                <h3 className="font-bold text-gray-900 dark:text-white mb-1.5">{title}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ──────────────────────────────────────────────────────── */}
            <section className="py-24 px-4 sm:px-6">
                <div className="max-w-2xl mx-auto text-center">
                    <div className="card p-12">
                        <div className="w-14 h-14 rounded-2xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mx-auto mb-6">
                            <Users size={26} className="text-brand-500" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                            Ready to make your first trade?
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mb-7 max-w-sm mx-auto">
                            Join thousands trading monetised social accounts with full escrow protection.
                        </p>
                        <Link to="/register" className="btn-primary inline-flex items-center gap-2 text-base px-8 py-3">
                            Create Free Account <ArrowRight size={16} />
                        </Link>
                        <p className="text-xs text-gray-400 mt-4">
                            <CheckCircle size={11} className="inline mr-1 text-emerald-500" />
                            No credit card required
                        </p>
                    </div>
                </div>
            </section>

            {/* ── Footer ───────────────────────────────────────────────────── */}
            <footer className="border-t border-gray-100 dark:border-gray-800/60 py-8 px-4 sm:px-6">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                        <div className="w-5 h-5 bg-brand-500 rounded flex items-center justify-center">
                            <TrendingUp size={10} className="text-white" />
                        </div>
                        Monetized Market · © {new Date().getFullYear()}
                    </div>
                    <div className="flex gap-5">
                        {[
                            { to: "/login",    label: "Sign In"    },
                            { to: "/register", label: "Register"   },
                        ].map(({ to, label }) => (
                            <Link key={to} to={to} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
}