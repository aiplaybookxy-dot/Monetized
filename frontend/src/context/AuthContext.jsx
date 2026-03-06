/**
 * src/context/AuthContext.jsx
 *
 * login() now RETURNS the user object so Login.jsx can
 * read the role and redirect to the correct portal immediately.
 */
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user,    setUser]    = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchMe = useCallback(async () => {
        try {
            const r = await api.get("/auth/me/");
            setUser(r.data);
            return r.data;           // ← return user so callers can read role
        } catch {
            localStorage.removeItem("access_token");
            localStorage.removeItem("refresh_token");
            setUser(null);
            return null;
        }
    }, []);

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (token) {
            fetchMe().finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [fetchMe]);

    const login = async (email, password) => {
        const r = await api.post("/auth/login/", { email, password });
        const { access, refresh } = r.data;
        localStorage.setItem("access_token",  access);
        localStorage.setItem("refresh_token", refresh);
        const user = await fetchMe();   // ← returns user object
        return user;                    // ← Login.jsx reads role from this
    };

    const register = async (formData) => {
        await api.post("/auth/register/", formData);
    };

    const logout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user, loading,
            isAuthenticated: !!user,
            isLoading: loading,
            login, register, logout, fetchMe,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
    return ctx;
}