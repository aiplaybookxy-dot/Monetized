import { useEffect } from "react";

/**
 * WHY a dedicated component instead of inline script tags:
 * React's useEffect runs after mount — this mirrors how the Facebook
 * Pixel SDK expects to be initialized (after DOM is ready).
 *
 * WHY validate pixelId before injection:
 * The pixel_id comes from user input in the Store admin panel.
 * Even though the backend strips non-numeric characters, the frontend
 * adds a second layer — never trust API data for DOM injection.
 *
 * WHY no npm package (react-facebook-pixel):
 * For a mobile storefront where LCP is critical, every KB counts.
 * The raw SDK initialization is 3 lines and adds zero bundle weight.
 */
export default function PixelTracker({ pixelId }) {
    useEffect(() => {
        // Second-layer validation — only numeric strings allowed
        if (!pixelId || !/^\d+$/.test(pixelId)) {
            console.warn("PixelTracker: invalid or missing pixel ID, skipping init.");
            return;
        }

        // Prevent double-initialization on re-renders
        if (window.fbq) return;

        // Standard Facebook Pixel base code — minified for performance
        !function (f, b, e, v, n, t, s) {
            if (f.fbq) return; n = f.fbq = function () {
                n.callMethod ?
                n.callMethod.apply(n, arguments) : n.queue.push(arguments)
            };
            if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
            n.queue = []; t = b.createElement(e); t.async = !0;
            t.src = v; s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s)
        }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

        window.fbq("init", pixelId);
        window.fbq("track", "PageView");

        return () => {
            // Cleanup: remove fbq on unmount to prevent memory leaks
            // if user navigates away from the storefront
            delete window.fbq;
            delete window._fbq;
        };
    }, [pixelId]);

    // No DOM output — this component is purely a side-effect runner
    return null;
}