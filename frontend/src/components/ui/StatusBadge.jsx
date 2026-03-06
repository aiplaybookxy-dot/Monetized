const STATUS_MAP = {
    pending: { label: "Pending", className: "badge-pending" },
    funded: { label: "Funded", className: "badge-funded" },
    in_provision: { label: "In Provision", className: "badge-provision" },
    completed: { label: "Completed", className: "badge-completed" },
    disputed: { label: "Disputed", className: "badge-disputed" },
    cancelled: { label: "Cancelled", className: "badge-pending" },
    refunded: { label: "Refunded", className: "badge-status bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
};

export default function StatusBadge({ status }) {
    const config = STATUS_MAP[status] || { label: status, className: "badge-pending" };
    return <span className={config.className}>{config.label}</span>;
}