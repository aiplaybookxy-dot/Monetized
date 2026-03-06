/**
 * src/context/ThemeContext.jsx
 *
 * Global dark/light mode state.
 * Persists to localStorage and applies the `dark` class to <html>.
 *
 * WHY class on <html> not <body>:
 * Tailwind's `dark:` variants are triggered by the `dark` class on any
 * ancestor. Placing it on <html> (the topmost element) means every
 * descendant in the entire document tree can use `dark:` utilities.
 * Placing it on <body> would miss elements portalled outside <body>.
 *
 * Integration:
 *   1. Wrap <App /> in <ThemeProvider> inside main.jsx
 *   2. Import useContext(ThemeContext) or the ThemeToggle component
 *      wherever theme switching is needed
 */
import { createContext, useState, useEffect, useContext } from "react";

export const ThemeContext = createContext({
    theme: "light",
    toggleTheme: () => {},
});

// Named hook — this is what Settings.jsx and other components import
export function useTheme() {
    return useContext(ThemeContext);
}

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        // Initialise from localStorage, fallback to system preference
        const saved = localStorage.getItem("theme");
        if (saved) return saved;
        return window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light";
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === "dark") {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
        localStorage.setItem("theme", theme);
    }, [theme]);

    const toggleTheme = () =>
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));

    const setLight = () => setTheme("light");
    const setDark  = () => setTheme("dark");

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setLight, setDark }}>
            {children}
        </ThemeContext.Provider>
    );
}