import { useEffect, useMemo, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { motion } from "framer-motion";

import Dashboard from "./pages/Dashboard.jsx";
import GrowthTracker from "./pages/GrowthTracker.jsx";
import GrowthHistory from "./pages/GrowthHistory.jsx";
import PlantDatabase from "./pages/PlantDatabase.jsx";
import FirebaseTable from "./pages/FirebaseTable.jsx";
import EnvMonitor from "./pages/EnvMonitor.jsx";
import CultureDetails from "./pages/CultureDetails.jsx";
import OrchidCompanion from "./pages/OrchidCompanion.jsx";
import OrchidClassifier from "./pages/OrchidClassifier.jsx";
import SidebarOrchidBloom from "./components/SidebarOrchidBloom.jsx";
import Footer from "./components/Footer.jsx";

import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";

const navItems = [
  { to: "/", label: "Dashboard", code: "\u{1F4CA}" },
  { to: "/reculture", label: "Culture Details", code: "\u{1F9EA}" },
  { to: "/growth", label: "Growth Tracker", code: "\u{1F4C8}" },
  { to: "/history", label: "Growth History", code: "\u{1F552}" },
  { to: "/plants", label: "Plant Database", code: "\u{1F33F}" },
  { to: "/firebase", label: "Firebase Table", code: "\u{1F525}" },
  { to: "/classifier", label: "Orchid Classifier", code: "\u{1F4F7}" },
  { to: "/monitor", label: "Env Monitor", code: "\u{1F321}\uFE0F" },
  { to: "/companion", label: "Orchid Companion", code: "\u{1F916}" },
];

const TIME_ZONE = "Asia/Colombo";
const LOCATION_LABEL = "Colombo, Sri Lanka";

export default function App() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: TIME_ZONE,
      }).format(now),
    [now]
  );

  const timeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: TIME_ZONE,
      }).format(now),
    [now]
  );

  return (
    <ThemeProvider>
      <div className="relative min-h-screen overflow-hidden bg-background text-dark transition-colors duration-300 selection:bg-primary/20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="aurora-blob aurora-1" />
          <div className="aurora-blob aurora-2 secondary" />
          <div className="aurora-blob aurora-3 accent" />
          <div className="grid-overlay" />
        </div>

        <div className="mx-auto flex min-h-screen max-w-[1600px]">
          <aside className="hidden lg:flex lg:w-80 lg:flex-col px-6 py-7">
            <div className="sidebar-spotlight space-y-5">
              <div className="flex items-center gap-3">
                <div className="brand-orb">{"\u{1F338}"}</div>
                <div>
                  <p className="topic-3d">ORCHID INSIGHTS</p>
                </div>
              </div>

              <div className="sidebar-modern-card px-4 py-3">
                <p className="sidebar-meta-label">Today</p>
                <div className="mt-2 space-y-1">
                  <p className="text-base font-semibold text-dark">{todayLabel}</p>
                  <p className="text-[13px] font-medium leading-5 text-dark [font-variant-numeric:tabular-nums]">
                    {timeLabel}
                  </p>
                  <p className="text-[12px] leading-5 text-subtle/95">{LOCATION_LABEL}</p>
                </div>
              </div>

              <div className="sidebar-modern-card flex items-center justify-between px-4 py-3">
                <p className="sidebar-label text-subtle/90">Theme</p>
                <ThemeToggle />
              </div>
            </div>

            <nav className="mt-7 space-y-1.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="group block"
                >
                  {({ isActive }) => (
                    <div
                      className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 transition-all duration-200 ${
                        isActive
                          ? "border-primary/30 bg-primary/10 text-primary shadow-[0_14px_28px_-22px_rgba(0,180,150,0.8)]"
                          : "border-transparent text-subtle hover:border-border/65 hover:bg-paper/85 hover:text-dark"
                      }`}
                    >
                      <span
                        className={`absolute left-0 top-2.5 h-[calc(100%-20px)] w-[3px] rounded-r-full bg-primary transition-opacity duration-200 ${
                          isActive ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      <span
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border text-[17px] leading-none transition-transform duration-200 ${
                          isActive
                            ? "scale-105 border-primary/35 bg-primary/15 text-primary"
                            : "border-border/45 bg-paper/75 text-subtle group-hover:scale-105 group-hover:text-dark"
                        }`}
                      >
                        {item.code}
                      </span>
                      <span className="sidebar-label flex-1">{item.label}</span>
                      <span className={`text-sm transition-colors duration-200 ${isActive ? "text-primary/80" : "text-subtle/60 group-hover:text-dark"}`}>-&gt;</span>
                    </div>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="mt-4">
              <SidebarOrchidBloom />
            </div>

            <div className="mt-auto panel-muted px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Stack</p>
              <p className="mt-1 text-xs text-subtle">FastAPI + ML + Firebase</p>
            </div>
          </aside>

          <div className="min-w-0 flex-1 flex flex-col">
            <header className="lg:hidden sticky top-0 z-20 border-b border-border/50 bg-gradient-to-r from-paper/95 via-paper/90 to-primary/10 px-4 py-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="kicker">ORCHID INSIGHTS</p>
                </div>
                <ThemeToggle />
              </div>

              <div className="mt-4 flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-1 sm:[&::-webkit-scrollbar]:hidden sm:[-ms-overflow-style:'none'] sm:[scrollbar-width:'none'] justify-start">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `whitespace-nowrap rounded-xl border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-border/45 bg-paper/90 text-subtle hover:border-border/75 hover:text-dark"
                      }`
                    }
                  >
                    <span className="mr-2">{item.code}</span>
                    <span>{item.label}</span>
                    <span className="ml-2 text-subtle">→</span>
                  </NavLink>
                ))}
              </div>
            </header>

            <main className="px-4 py-8 sm:px-8 lg:px-10 flex-1">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="space-y-6"
              >
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/reculture" element={<CultureDetails />} />
                  <Route path="/growth" element={<GrowthTracker />} />
                  <Route path="/history" element={<GrowthHistory />} />
                  <Route path="/plants" element={<PlantDatabase />} />
                  <Route path="/firebase" element={<FirebaseTable />} />
                  <Route path="/classifier" element={<OrchidClassifier />} />
                  <Route path="/monitor" element={<EnvMonitor />} />
                  <Route path="/companion" element={<OrchidCompanion />} />
                </Routes>
              </motion.div>
            </main>

            <Footer />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}


