/**
 * src/services/api.js
 *
 * Hardened Axios instance — the single HTTP client for all API calls.
 *
 * Security Architecture:
 * ──────────────────────
 * 1. Authorization header attached automatically on every request
 *    WHY: Never scatter "Bearer " + token logic across 50 components.
 *    A single request interceptor is the correct single point of enforcement.
 *
 * 2. Silent token refresh via response interceptor
 *    WHY: Access tokens expire in 15 minutes (production setting).
 *    Without auto-refresh, users would be logged out mid-session every 15 minutes.
 *    The interceptor catches 401 responses, attempts a refresh, and retries
 *    the original request transparently — user never notices.
 *
 * 3. Refresh request uses a separate axios instance (refreshClient)
 *    WHY CRITICAL: If the main axios instance were used for refresh, a 401
 *    on the refresh endpoint would trigger another refresh attempt, creating
 *    an infinite retry loop that locks the browser. refreshClient has NO
 *    interceptors — it fails cleanly.
 *
 * 4. isRefreshing + failedRequestQueue prevents the "thundering herd" problem
 *    WHY: If 5 API calls fire simultaneously and all get 401, without queuing
 *    they all simultaneously attempt refresh — 5 concurrent refresh requests.
 *    Paystack, the vault, and notifications would all race. The queue ensures
 *    only ONE refresh happens; all others wait and retry with the new token.
 *
 * CORS Note:
 *    baseURL is set from VITE_API_URL (injected at Docker build time).
 *    In development: http://localhost:8000/api/v1
 *    In production:  https://api.yoursite.com/api/v1
 *    This is the ONLY place the API URL should be configured.
 *    Never hardcode an API URL in a component.
 */
import axios from "axios";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

// ── Primary API client ─────────────────────────────────────────────────────
const api = axios.create({
    baseURL: BASE_URL,
    timeout: 15000, // 15 second timeout — prevents hanging requests
    headers: {
        "Content-Type": "application/json",
    },
    // WHY withCredentials:
    // Required if you use httpOnly cookies for refresh tokens (more secure option).
    // Also ensures CORS preflight includes credentials — harmless if using
    // Authorization header only, but required for the cookie pattern.
    
});

// ── Refresh-only client — NO interceptors, clean fail ─────────────────────
const refreshClient = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    
});

// ── Token management helpers ───────────────────────────────────────────────
const TokenStore = {
    getAccess:  () => localStorage.getItem("access_token"),
    getRefresh: () => localStorage.getItem("refresh_token"),
    setAccess:  (t) => localStorage.setItem("access_token", t),
    setTokens:  (access, refresh) => {
        localStorage.setItem("access_token", access);
        if (refresh) localStorage.setItem("refresh_token", refresh);
    },
    clear: () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
    },
};

// ── Request Interceptor — Attach JWT ──────────────────────────────────────
api.interceptors.request.use(
    (config) => {
        const token = TokenStore.getAccess();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error),
);

// ── Response Interceptor — Silent Refresh ────────────────────────────────
let isRefreshing = false;
let failedRequestQueue = [];

const processQueue = (error, token = null) => {
    failedRequestQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedRequestQueue = [];
};

api.interceptors.response.use(
    // Pass successful responses through unchanged
    (response) => response,

    async (error) => {
        const originalRequest = error.config;

        // Only intercept 401 Unauthorized responses
        // _retry flag prevents infinite loops if refresh itself returns 401
        if (error.response?.status !== 401 || originalRequest._retry) {
            return Promise.reject(error);
        }

        // ── Queue concurrent requests while refresh is in progress ────────
        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedRequestQueue.push({ resolve, reject });
            }).then((token) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                return api(originalRequest);
            }).catch(Promise.reject);
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = TokenStore.getRefresh();
        if (!refreshToken) {
            // No refresh token → session is truly expired → force logout
            TokenStore.clear();
            window.location.href = "/login";
            return Promise.reject(error);
        }

        try {
            // Use refreshClient — NOT api — to avoid triggering this interceptor
            const response = await refreshClient.post("/auth/token/refresh/", {
                refresh: refreshToken,
            });

            const { access, refresh: newRefresh } = response.data;
            TokenStore.setTokens(access, newRefresh);

            // Update the original request's auth header
            originalRequest.headers.Authorization = `Bearer ${access}`;

            // Unblock all queued requests with the new token
            processQueue(null, access);

            return api(originalRequest);
        } catch (refreshError) {
            // Refresh failed (token expired or blacklisted) → force logout
            processQueue(refreshError, null);
            TokenStore.clear();
            window.location.href = "/login";
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    },
);

export default api;
export { TokenStore };