import { useState, useEffect } from "react";
import { ShieldAlert, Clock, User, DollarSign, CheckCircle, RotateCcw, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import api from "../../services/api";
import LoadingSpinner from "../../components/ui/LoadingSpinner";

function DisputeCard({ order, onResolved }) {
  const [expanded, setExpanded] = useState(false);
  const [decision, setDecision] = useState("release");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ageHours = order.dispute_age_hours;
  const urgencyColor =
    ageHours > 48 ? "text-red-500" :
    ageHours > 24 ? "text-amber-500" :
    "text-gray-400";

  const handleResolve = async () => {
    if (!note.trim()) { setError("A resolution note is required."); return; }
    setLoading(true);
    setError("");
    try {
      await api.post(`/mod/disputes/${order.id}/resolve/`, { decision, resolution_note: note });
      onResolved(order.id);
    } catch (err) {
      setError(err.response?.data?.error || "Resolution failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`card overflow-hidden ${ageHours > 48 ? "border-red-200 dark:border-red-800" : ""}`}>
      {/* Card header — always visible */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={16} className="text-rose-500" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">{order.listing?.title}</p>
            <p className="text-xs text-gray-400 mt-0.5 capitalize">{order.listing?.platform} · @{order.listing?.account_handle}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0 ml-4">
          <div className="text-right hidden sm:block">
            <p className="font-bold text-gray-900 dark:text-white text-sm">₦{Number(order.amount).toLocaleString()}</p>
            <p className={`text-xs flex items-center gap-1 justify-end ${urgencyColor}`}>
              <Clock size={10} />
              {ageHours?.toFixed(0)}h ago
            </p>
          </div>
          {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-700 p-5 space-y-5">
          {/* Parties */}
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { role: "Buyer",  person: order.buyer  },
              { role: "Seller", person: order.seller },
            ].map(({ role, person }) => (
              <div key={role} className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">{role}</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-600 text-xs font-bold">
                    {person?.username?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">@{person?.username}</p>
                    <p className="text-xs text-gray-400">{person?.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dispute reason */}
          {order.admin_notes && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-1">
                Buyer's Dispute Reason
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{order.admin_notes}</p>
            </div>
          )}

          {/* Resolution form */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Resolution Decision</p>

            {/* Decision toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setDecision("release")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  decision === "release"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                }`}
              >
                <CheckCircle size={15} />
                Release to Seller
              </button>
              <button
                onClick={() => setDecision("refund")}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
                  decision === "refund"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                    : "border-gray-200 dark:border-gray-700 text-gray-500 hover:border-gray-300"
                }`}
              >
                <RotateCcw size={15} />
                Refund Buyer
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Resolution Note <span className="text-red-500">*</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Explain your decision — this will be shown to both parties…"
                className="input resize-none text-sm"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                <AlertTriangle size={13} /> {error}
              </div>
            )}

            <button
              onClick={handleResolve}
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldAlert size={14} />
                  Confirm Resolution — {decision === "release" ? "Release to Seller" : "Refund Buyer"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DisputeManagerPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/mod/disputes/")
      .then((r) => setDisputes(r.data.results || r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleResolved = (orderId) => {
    setDisputes((prev) => prev.filter((d) => d.id !== orderId));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldAlert size={20} className="text-rose-500" /> Dispute Manager
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {disputes.length} open dispute{disputes.length !== 1 ? "s" : ""} — oldest first
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : disputes.length === 0 ? (
        <div className="card py-20 text-center">
          <CheckCircle size={44} className="text-emerald-400 mx-auto mb-3" />
          <p className="text-lg font-semibold text-gray-900 dark:text-white">All clear!</p>
          <p className="text-sm text-gray-400 mt-1">No open disputes to resolve.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <DisputeCard key={d.id} order={d} onResolved={handleResolved} />
          ))}
        </div>
      )}
    </div>
  );
}
