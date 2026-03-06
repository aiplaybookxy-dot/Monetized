/**
 * src/pages/NotFound.jsx
 */
import { Link, useNavigate } from "react-router-dom";
import { TrendingUp, ArrowLeft, Home } from "lucide-react";
import ThemeToggle from "../components/ui/ThemeToggle";

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-gray-950 font-ubuntu flex flex-col">

            {/* Top bar */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800/60">
                <Link to="/" className="flex items-center gap-2.5 font-bold text-gray-900 dark:text-white">
                    <div className="w-7 h-7 bg-brand-500 rounded-lg flex items-center justify-center">
                        <TrendingUp size={14} className="text-white" />
                    </div>
                    EscrowMarket
                </Link>
                <ThemeToggle />
            </div>

            {/* Content */}
            <div className="flex-1 flex items-center justify-center px-4 py-20">
                <div className="text-center max-w-md">

                    {/* Big 404 */}
                    <div className="relative mb-8 select-none">
                        <p className="text-[9rem] font-black leading-none text-gray-100 dark:text-gray-800/80">
                            404
                        </p>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-2xl bg-brand-500 flex items-center justify-center shadow-lg shadow-brand-500/30">
                                <TrendingUp size={28} className="text-white" />
                            </div>
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                        Page not found
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">
                        This page doesn't exist or may have been moved.
                        Let's get you back to somewhere useful.
                    </p>

                    <div className="flex items-center justify-center gap-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="btn-ghost flex items-center gap-2 border border-gray-200 dark:border-gray-700"
                        >
                            <ArrowLeft size={15} /> Go Back
                        </button>
                        <Link to="/" className="btn-primary flex items-center gap-2">
                            <Home size={15} /> Home
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}