import { NavLink, Route, Routes } from "react-router-dom";
import { motion } from "framer-motion";

import Dashboard from "./pages/Dashboard.jsx";
import GrowthTracker from "./pages/GrowthTracker.jsx";
import DiseaseDetector from "./pages/DiseaseDetector.jsx";
import PlantDatabase from "./pages/PlantDatabase.jsx";
import FirebaseTable from "./pages/FirebaseTable.jsx";
import EnvMonitor from "./pages/EnvMonitor.jsx";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/growth", label: "Growth Tracker" },
  { to: "/disease", label: "Disease Detector" },
  { to: "/plants", label: "Plant Database" },
  { to: "/firebase", label: "Firebase Table" },
  { to: "/monitor", label: "Env Monitor" },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-night via-slate-950 to-slate-900 text-slate-100">
      <div className="flex">
        <aside className="hidden lg:flex lg:flex-col w-72 px-6 py-8 border-r border-white/10 glass">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-glow" />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Orchid Lab</p>
              <h1 className="text-xl font-semibold">Insights Suite</h1>
            </div>
          </div>
          <nav className="mt-10 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-xl px-3 py-3 text-sm transition ${
                    isActive
                      ? "bg-emerald-500/10 text-white border border-emerald-400/50"
                      : "text-slate-300 hover:text-white hover:bg-white/5"
                  }`
                }
              >
                <span>{item.label}</span>
                <span className="text-xs text-slate-500">→</span>
              </NavLink>
            ))}
          </nav>
          <div className="mt-auto pt-8 text-xs text-slate-500">FastAPI · ML · Firebase</div>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="lg:hidden px-4 py-4 sticky top-0 bg-night/80 border-b border-white/10 backdrop-blur z-10">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Orchid Lab</p>
              <h1 className="text-lg font-semibold">Insights Suite</h1>
            </div>
          </header>

          <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/growth" element={<GrowthTracker />} />
                <Route path="/disease" element={<DiseaseDetector />} />
                <Route path="/plants" element={<PlantDatabase />} />
                <Route path="/firebase" element={<FirebaseTable />} />
                <Route path="/monitor" element={<EnvMonitor />} />
              </Routes>
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}
