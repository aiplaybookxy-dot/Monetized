import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
        // Force a single copy of React and React-DOM across all packages.
        // Without this, recharts (and other UI libs) bundle their own React
        // which causes the "Invalid hook call" and useContext(null) crash.
        dedupe: ["react", "react-dom", "react-router-dom"],
    },

    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
            },
        },
    },

    optimizeDeps: {
        // Pre-bundle heavy libs so Vite doesn't double-load them
        include: [
            "react",
            "react-dom",
            "react-router-dom",
            "recharts",
            "lucide-react",
        ],
    },
})