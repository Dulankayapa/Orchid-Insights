import { NavLink, Route, Routes } from "react-router-dom";
import { motion } from "framer-motion";

import Dashboard from "./pages/Dashboard.jsx";
import GrowthTracker from "./pages/GrowthTracker.jsx";
import GrowthHistory from "./pages/GrowthHistory.jsx";
import PlantDatabase from "./pages/PlantDatabase.jsx";
import FirebaseTable from "./pages/FirebaseTable.jsx";
import EnvMonitor from "./pages/EnvMonitor.jsx";
import CultureDetails from "./pages/CultureDetails.jsx";
import OrchidAIBot from "./components/monitor/OrchidAIBot.jsx";

import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";

const navItems = [
  { to: "/", label: "Dashboard", code: "📊" },
  { to: "/reculture", label: "Culture Details", code: "🧪" },
  { to: "/growth", label: "Growth Tracker", code: "📈" },
  { to: "/history", label: "Growth History", code: "🕒" },
  { to: "/plants", label: "Plant Database", code: "🌿" },
  { to: "/firebase", label: "Firebase Table", code: "🔥" },
  { to: "/monitor", label: "Env Monitor", code: "🌡️" },
];

const todayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
}).format(new Date());

export default function App() {
  return (
    <ThemeProvider>
      <div className="relative min-h-screen overflow-hidden bg-background text-dark transition-colors duration-300">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 left-0 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute right-0 top-10 h-72 w-72 rounded-full bg-secondary/15 blur-3xl" />
          <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="mx-auto flex min-h-screen max-w-[1600px]">
          <aside className="hidden lg:flex lg:w-80 lg:flex-col px-6 py-7">
            <div className="panel space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-secondary text-sm font-bold text-white shadow-[0_18px_32px_-20px_rgba(13,148,136,0.9)]">
                  OI
                </div>
                <div>
                  <p className="kicker">ORCHID INSIGHTS</p>
                </div>
              </div>

              <div className="panel-muted px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Today</p>
                <p className="mt-1 text-sm font-semibold text-dark">{todayLabel}</p>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-border/40 bg-paper/70 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-subtle">Theme</p>
                <ThemeToggle />
              </div>
            </div>

            <nav className="mt-7 space-y-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition ${
                      isActive
                        ? "border border-primary/35 bg-primary/12 text-primary shadow-[0_14px_32px_-24px_rgba(13,148,136,0.9)]"
                        : "border border-transparent text-subtle hover:border-border/50 hover:bg-paper/70 hover:text-dark"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-[13px] leading-none ${
                          isActive
                            ? "border-primary/45 bg-primary/15 text-primary"
                            : "border-border/45 bg-paper/75 text-subtle group-hover:text-dark"
                        }`}
                      >
                        {item.code}
                      </span>
                      <span className="flex-1 font-medium">{item.label}</span>
                      <span className={`text-xs ${isActive ? "text-primary/70" : "text-subtle/60"}`}>-&gt;</span>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="mt-4">
              <OrchidAIBot compact />
            </div>

            <div className="mt-auto panel-muted px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stack</p>
              <p className="mt-1 text-xs text-subtle">FastAPI + ML + Firebase</p>
            </div>
          </aside>

          <div className="min-w-0 flex-1">
            <header className="lg:hidden sticky top-0 z-20 border-b border-border/40 bg-paper/80 px-4 py-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="kicker">ORCHID INSIGHTS</p>
                </div>
                <ThemeToggle />
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                        isActive
                          ? "border-primary/35 bg-primary/12 text-primary"
                          : "border-border/40 bg-paper/80 text-subtle"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </header>

            <main className="px-4 py-8 sm:px-8 lg:px-10">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-6"
              >
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/reculture" element={<CultureDetails />} />
                  <Route path="/growth" element={<GrowthTracker />} />
                  <Route path="/history" element={<GrowthHistory />} />
                  <Route path="/plants" element={<PlantDatabase />} />
                  <Route path="/firebase" element={<FirebaseTable />} />
                  <Route path="/monitor" element={<EnvMonitor />} />
                </Routes>
              </motion.div>
            </main>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
