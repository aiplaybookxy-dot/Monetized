/**
 * src/components/ui/ThemeToggle.jsx
 *
 * Dark/light mode toggle button.
 * Reads/writes via ThemeContext — localStorage persistence is handled there.
 *
 * WHY a standalone component:
 * ThemeToggle is used in DashboardLayout, ModeratorLayout, and the
 * public Storefront header. A single component avoids duplicating
 * the icon swap logic and ThemeContext hook call in three places.
 */
import { useContext } from "react";
import { Sun, Moon } from "lucide-react";
import { ThemeContext } from "../../context/ThemeContext";

export default function ThemeToggle() {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
        >
            {theme === "dark" ? (
                <Sun size={16} className="text-amber-400" />
            ) : (
                <Moon size={16} />
            )}
        </button>
    );
}