import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import './App.css';

import GrowthTracker from './views/GrowthTracker';
import Category2 from './views/Category2';
import Category3 from './views/Category3';
import Category4 from './views/Category4';
import Category5 from './views/Category5';
import HeightCheck from './views/HeightCheck';
import PlantDatabase from './views/PlantDatabase';
import FirebaseTable from './views/FirebaseTable';

const navItems = [
  { label: 'Dashboard', to: '/' },
  { label: 'Height Check', to: '/height-check' },
  { label: 'Growth Tracker', to: '/growth-tracker' },
  { label: 'Plant Database', to: '/plant-database' },
  { label: 'Firebase Data', to: '/firebase-data' },
  { label: 'Category 2', to: '/category2' },
  { label: 'Category 3', to: '/category3' },
  { label: 'Category 4', to: '/category4' },
  { label: 'Category 5', to: '/category5' },
];

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen text-slate-100">
        <div className="flex">
          <aside className="hidden lg:flex lg:flex-col w-72 bg-slate-900/60 border-r border-slate-800/80 backdrop-blur-lg min-h-screen px-6 py-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-blue-500 shadow-lg shadow-emerald-500/20" />
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Orchid Lab</p>
                <h1 className="text-xl font-semibold">Orchid Insights</h1>
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
                        ? 'bg-slate-800/80 text-white border border-slate-700'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-500">→</span>
                </NavLink>
              ))}
            </nav>
            <div className="mt-auto pt-8 text-xs text-slate-500">
              Powered by FastAPI + ML model
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <header className="lg:hidden px-6 py-4 flex items-center justify-between sticky top-0 bg-slate-900/80 backdrop-blur z-10 border-b border-slate-800">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Orchid Lab</p>
                <h1 className="text-lg font-semibold">Orchid Insights</h1>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Link className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 text-slate-900 font-semibold" to="/height-check">
                  Height Check
                </Link>
              </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 lg:px-10 py-10">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/height-check" element={<HeightCheck />} />
                <Route path="/growth-tracker" element={<GrowthTracker />} />
                <Route path="/plant-database" element={<PlantDatabase />} />
                <Route path="/firebase-data" element={<FirebaseTable />} />
                <Route path="/category2" element={<Category2 />} />
                <Route path="/category3" element={<Category3 />} />
                <Route path="/category4" element={<Category4 />} />
                <Route path="/category5" element={<Category5 />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
}

function Dashboard() {
  const cards = [
    { title: 'Height Check', to: '/height-check', desc: 'Pull the latest sensor-aligned height from the mock database.', tone: 'from-sky-400/80 to-emerald-500/70' },
    { title: 'Orchid Growth Tracker', to: '/growth-tracker', desc: 'Measure, predict, and benchmark orchid height vs age.', tone: 'from-emerald-400/80 to-blue-500/70' },
    { title: 'Plant Database', to: '/plant-database', desc: 'Browse mock plant IDs, planting dates, and height history.', tone: 'from-indigo-400/80 to-cyan-500/70' },
    { title: 'Firebase Data', to: '/firebase-data', desc: 'Live pull from Firebase Realtime DB into a table.', tone: 'from-amber-400/80 to-rose-500/70' },
    { title: 'Category 2', to: '/category2', desc: 'Placeholder module', tone: 'from-fuchsia-400/70 to-purple-500/60' },
    { title: 'Category 3', to: '/category3', desc: 'Placeholder module', tone: 'from-amber-300/70 to-orange-500/60' },
    { title: 'Category 4', to: '/category4', desc: 'Placeholder module', tone: 'from-cyan-300/70 to-sky-500/60' },
    { title: 'Category 5', to: '/category5', desc: 'Placeholder module', tone: 'from-lime-300/70 to-emerald-500/60' },
  ];

  return (
    <div className="space-y-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-8"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10 pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Growth AI</p>
            <h2 className="text-3xl font-semibold mt-2">Monitor orchid vitality in real time</h2>
            <p className="text-slate-300 mt-3 max-w-2xl">
              Send planting dates and current height to the FastAPI model and get an on-the-spot health classification
              with probability breakdowns and expected ranges.
            </p>
          </div>
          <Link
            to="/height-check"
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-blue-500 text-slate-900 font-semibold shadow-lg shadow-emerald-500/25"
          >
            Height Check <span className="text-slate-800">→</span>
          </Link>
        </div>
      </motion.div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((c, idx) => (
          <motion.div
            key={c.to}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * idx }}
            whileHover={{ y: -4, scale: 1.01 }}
            className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/50 backdrop-blur p-5"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${c.tone} opacity-20`} />
            <div className="relative space-y-2">
              <p className="text-[11px] uppercase tracking-[0.3em] text-slate-400">Module</p>
              <h3 className="text-xl font-semibold">{c.title}</h3>
              <p className="text-slate-300 text-sm leading-relaxed">{c.desc}</p>
              <Link to={c.to} className="inline-flex items-center text-sm font-semibold text-emerald-300 hover:text-emerald-200 transition">
                Explore <span className="ml-1 text-slate-400">→</span>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default App;
