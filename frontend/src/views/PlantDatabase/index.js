import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { mockPlants } from '../../data/mockPlants';

function PlantDatabase() {
  const [selectedId, setSelectedId] = useState(mockPlants[0]?.id || '');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');

  const filtered = useMemo(() => {
    if (!appliedQuery.trim()) return mockPlants;
    const term = appliedQuery.trim().toLowerCase();
    return mockPlants.filter((p) => p.id.toLowerCase().includes(term));
  }, [appliedQuery]);

  useEffect(() => {
    if (!filtered.length) return;
    if (!filtered.find((p) => p.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selectedPlant = useMemo(
    () => filtered.find((p) => p.id === selectedId) || filtered[0] || null,
    [filtered, selectedId]
  );

  const onSearch = (e) => {
    e?.preventDefault();
    setAppliedQuery(query);
  };

  return (
    <div className="space-y-8">
      <Hero />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur p-6 shadow-xl shadow-black/30 space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Spreadsheet view</p>
            <h3 className="text-xl font-semibold text-white">Plant database (mock)</h3>
            <p className="text-slate-300 text-sm mt-1">
              Filter by Jar/Plant ID and click a row to inspect details and history.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <StatusPill />
            <span className="px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">
              Rows: {filtered.length}
            </span>
          </div>
        </div>

        <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Jar ID (e.g., Jar-12)"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-blue-500 text-slate-900 font-semibold px-4 py-2.5 shadow-lg shadow-emerald-500/25"
          >
            Search
          </button>
        </form>

        <div className="overflow-auto rounded-2xl border border-slate-800 bg-slate-900/60">
          <table className="min-w-full text-sm text-left text-slate-200">
            <thead className="text-xs uppercase tracking-[0.25em] text-slate-400 bg-slate-900/70">
              <tr>
                <th className="px-4 py-3">Jar ID</th>
                <th className="px-4 py-3">Planting date</th>
                <th className="px-4 py-3">Age (days)</th>
                <th className="px-4 py-3">Last height</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((plant) => {
                const latest = plant.heights?.[0];
                const isActive = plant.id === selectedId;
                const planted = plant.planting_date ? new Date(plant.planting_date) : null;
                const ageDays =
                  planted && !Number.isNaN(planted.getTime())
                    ? Math.max(
                        0,
                        Math.floor(
                          (new Date().setHours(0, 0, 0, 0) - planted.setHours(0, 0, 0, 0)) /
                            (1000 * 60 * 60 * 24)
                        )
                      )
                    : '-';
                return (
                  <tr
                    key={plant.id}
                    onClick={() => setSelectedId(plant.id)}
                    className={`border-t border-slate-800 cursor-pointer transition ${
                      isActive ? 'bg-emerald-500/10 border-emerald-400/50' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-4 py-3 font-semibold">{plant.id}</td>
                    <td className="px-4 py-3 text-slate-300">{plant.planting_date}</td>
                    <td className="px-4 py-3 text-slate-300">{ageDays}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {latest ? `${latest.height_mm} mm (${latest.date})` : '-'}
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-slate-400">
                    No rows match "{appliedQuery}". Try Jar-12, Jar-07, Jar-19, or Jar-03.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {selectedPlant && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="grid lg:grid-cols-3 gap-6"
        >
          <div className="lg:col-span-1">
            <DetailCard plant={selectedPlant} />
          </div>
          <div className="lg:col-span-2">
            <HistoryCard plant={selectedPlant} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur p-8"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10 pointer-events-none" />
      <div className="relative space-y-3 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Plant database</p>
        <h2 className="text-3xl font-semibold leading-tight">Mock plant database</h2>
        <p className="text-slate-300 text-sm md:text-base">
          Explore preloaded plant IDs with planting dates and tracked heights. Use this as a stub for sensor-aligned
          database results before wiring to the real backend.
        </p>
      </div>
    </motion.div>
  );
}

function DetailCard({ plant }) {
  const latestHeight = plant?.heights?.[0]?.height_mm ?? '-';
  const latestDate = plant?.heights?.[0]?.date ?? '-';
  const ageDays = useMemo(() => {
    if (!plant?.planting_date) return null;
    const planted = new Date(plant.planting_date);
    if (Number.isNaN(planted.getTime())) return null;
    const diffMs = new Date().setHours(0, 0, 0, 0) - planted.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, [plant]);

  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-6 shadow-xl shadow-black/30 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Profile</p>
          <h3 className="text-xl font-semibold text-white">{plant?.id}</h3>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <StatCard title="Planting date" value={plant?.planting_date ?? '-'} />
        <StatCard title="Age (days)" value={ageDays ?? '-'} />
        <StatCard title="Latest height (mm)" value={latestHeight} hint={`Recorded ${latestDate}`} />
      </div>

      <div className="grid sm:grid-cols-1 gap-4">
        <MiniStat label="Records" value={`${plant?.heights?.length || 0} entries`} />
      </div>
    </div>
  );
}

function HistoryCard({ plant }) {
  const heights = plant?.heights || [];
  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-6 shadow-xl shadow-black/30 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Height history</p>
          <h4 className="text-lg font-semibold text-white">Recent measurements</h4>
        </div>
        <span className="text-xs text-slate-400 px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">
          Mock data
        </span>
      </div>

      {heights.length ? (
        <div className="space-y-2">
          {heights.map((row) => (
            <div
              key={`${plant.id}-${row.date}`}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
            >
              <span className="text-slate-400">{row.date}</span>
              <span className="font-semibold text-white">{row.height_mm} mm</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No measurements recorded.</p>
      )}
    </div>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
      <p className="text-2xl font-semibold mt-2 text-white">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{label}</p>
      <p className="text-lg font-semibold mt-1 text-white">{value || '-'}</p>
    </div>
  );
}

function StatusPill() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">
      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]" />
      Mock DB live
    </div>
  );
}

export default PlantDatabase;
