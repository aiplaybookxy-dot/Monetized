/**
 * src/main.jsx
 *
 * Provider order matters:
 *   BrowserRouter  → must wrap everything that uses useNavigate/Link
 *   ThemeProvider  → reads localStorage, applies .dark class to <html>
 *   AuthProvider   → reads localStorage tokens, exposes user state
 *   App            → all routes and pages
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    </StrictMode>
);