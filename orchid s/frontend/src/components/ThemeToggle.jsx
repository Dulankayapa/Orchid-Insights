import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="relative h-8 w-14 rounded-full bg-slate-200 dark:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
            aria-label="Toggle Theme"
        >
            <motion.div
                className="absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-md flex items-center justify-center text-xs"
                animate={{ x: theme === "dark" ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
                {theme === "dark" ? "🌙" : "☀️"}
            </motion.div>
        </button>
    );
}
