import { NavLink, Route, Routes } from "react-router-dom";
import { motion } from "framer-motion";

import Dashboard from "./pages/Dashboard.jsx";
import GrowthTracker from "./pages/GrowthTracker.jsx";
import GrowthHistory from "./pages/GrowthHistory.jsx";
import DiseaseDetector from "./pages/DiseaseDetector.jsx";
import PlantDatabase from "./pages/PlantDatabase.jsx";
import FirebaseTable from "./pages/FirebaseTable.jsx";
import EnvMonitor from "./pages/EnvMonitor.jsx";
import CareGuide from "./pages/CareGuide.jsx";
import CompanionDashboard from "./pages/CompanionDashboard.jsx";

import { ThemeProvider } from "./context/ThemeContext";
import ThemeToggle from "./components/ThemeToggle";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/growth", label: "Growth Tracker" },
  { to: "/history", label: "Growth History" },
  { to: "/disease", label: "Disease Detector" },
  { to: "/plants", label: "Plant Database" },
  { to: "/firebase", label: "Firebase Table" },
  { to: "/monitor", label: "Env Monitor" },
  { to: "/companion-dashboard", label: "Companion Dash" },
  { to: "/care", label: "Care Guide" },
];

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background text-dark transition-colors duration-300">
        <div className="flex">
          <aside className="hidden lg:flex lg:flex-col w-72 px-6 py-8 border-r border-border/40 glass h-screen sticky top-0">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-primary to-secondary shadow-glow" />
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-subtle">Orchid Lab</p>
                  <h1 className="text-xl font-semibold">Insights Suite</h1>
                </div>
              </div>
            </div>

            <ThemeToggle />

            <nav className="mt-8 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center justify-between rounded-xl px-3 py-3 text-sm transition ${isActive
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "text-subtle hover:text-primary hover:bg-primary/5"
                    }`
                  }
                >
                  <span>{item.label}</span>
                  <span className="text-xs opacity-50 text-subtle">→</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto pt-8 text-xs text-subtle opacity-70">FastAPI · ML · Firebase</div>
          </aside>

          <div className="flex-1 min-w-0">
            <header className="lg:hidden px-4 py-4 sticky top-0 bg-paper/80 border-b border-border/40 backdrop-blur z-20 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">Orchid Lab</p>
                <h1 className="text-lg font-semibold">Insights Suite</h1>
              </div>
              <ThemeToggle />
            </header>

            <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/growth" element={<GrowthTracker />} />
                  <Route path="/history" element={<GrowthHistory />} />
                  <Route path="/disease" element={<DiseaseDetector />} />
                  <Route path="/plants" element={<PlantDatabase />} />
                  <Route path="/firebase" element={<FirebaseTable />} />
                  <Route path="/monitor" element={<EnvMonitor />} />
                  <Route path="/care" element={<CareGuide />} />
                  <Route path="/companion-dashboard" element={<CompanionDashboard />} />
                </Routes>
              </motion.div>
            </main>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}
