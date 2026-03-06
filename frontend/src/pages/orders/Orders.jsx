import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Package, ArrowRight } from "lucide-react";
import api from "../../services/api";
import StatusBadge from "../../components/ui/StatusBadge";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

export default function OrdersPage() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("buying"); // "buying" | "selling"

    useEffect(() => {
        setLoading(true);
        const endpoint = tab === "buying" ? "/orders/" : "/orders/selling/";
        api.get(endpoint)
            .then((res) => setOrders(res.data.results || []))
            .catch(() => setOrders([]))
            .finally(() => setLoading(false));
    }, [tab]);

    return (
        <div className="max-w-3xl mx-auto space-y-5">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h1>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
                {[["buying", "My Purchases"], ["selling", "My Sales"]].map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setTab(key)}
                        className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === key
                                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                            }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <LoadingSpinner />
            ) : orders.length === 0 ? (
                <div className="card text-center py-16">
                    <Package size={40} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                        {tab === "buying" ? "You haven't made any purchases yet." : "No sales orders yet."}
                    </p>
                    {tab === "buying" && (
                        <Link to="/market" className="text-sm text-brand-500 hover:underline mt-2 inline-block">
                            Browse marketplace
                        </Link>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {orders.map((order) => (
                        <Link
                            key={order.id}
                            to={`/orders/${order.id}`}
                            className="card p-4 flex items-center justify-between gap-4 hover:shadow-card-hover transition-shadow group"
                        >
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <StatusBadge status={order.status} />
                                    <span className="text-xs text-gray-400 capitalize">{order.listing?.platform}</span>
                                </div>
                                <p className="font-medium text-gray-900 dark:text-white truncate">
                                    {order.listing?.title}
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    {tab === "buying" ? `Seller: @${order.seller?.username}` : `Buyer: @${order.buyer?.username}`}
                                    {" · "}
                                    {new Date(order.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="font-bold text-gray-900 dark:text-white">
                                    ₦{Number(order.amount).toLocaleString()}
                                </p>
                                <ArrowRight size={14} className="text-gray-400 group-hover:text-brand-500 transition-colors ml-auto mt-1" />
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}