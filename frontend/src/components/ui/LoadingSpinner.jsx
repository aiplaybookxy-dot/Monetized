/**
 * src/components/ui/LoadingSpinner.jsx
 *
 * WHY fullscreen prop:
 * Used by App.jsx Suspense fallback — it wraps the entire viewport
 * while lazy chunks load. Without fullscreen, it renders inline and
 * produces a small spinner in the top-left corner on cold loads.
 */
export default function LoadingSpinner({ fullscreen = false }) {
    const spinner = (
        <div className="flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (fullscreen) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-gray-950 z-50">
                {spinner}
            </div>
        );
    }

    return spinner;
}