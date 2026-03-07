import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      className="relative flex h-10 w-20 items-center rounded-full border border-border/40 bg-paper/80 px-1.5 text-subtle transition hover:border-primary/35"
      aria-label="Toggle Theme"
      type="button"
    >
      <motion.span
        className="absolute inset-y-1 left-1.5 w-8 rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_10px_20px_-12px_rgba(13,148,136,0.9)]"
        animate={{ x: isDark ? 36 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
      />
      <span className={`relative z-10 flex w-1/2 justify-center ${isDark ? "text-subtle/70" : "text-white"}`}>
        <SunIcon />
      </span>
      <span className={`relative z-10 flex w-1/2 justify-center ${isDark ? "text-white" : "text-subtle/70"}`}>
        <MoonIcon />
      </span>
    </button>
  );
}
