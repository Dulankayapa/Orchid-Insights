import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { mockHeightReadings } from '../../data/mockHeightReadings';

function HeightCheck() {
  const plantOptions = useMemo(
    () => mockHeightReadings.map((row) => ({ id: row.id, label: row.id })),
    []
  );
  const [selectedId, setSelectedId] = useState(plantOptions[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [reading, setReading] = useState(null);
  const [history, setHistory] = useState(mockHeightReadings);

  const selectedPlant = useMemo(
    () => mockHeightReadings.find((row) => row.id === selectedId) || mockHeightReadings[0],
    [selectedId]
  );

  const fetchLatest = () => {
    setLoading(true);
    const now = new Date();
    setTimeout(() => {
      const jitter = (Math.random() * 2 - 1) * 1.2; // small sensor variation
      const newHeight = Number((selectedPlant.height_mm + jitter).toFixed(1));
      const nextReading = { ...selectedPlant, height_mm: newHeight, updated_at: now.toISOString() };
      setReading(nextReading);
      setHistory((prev) => [{ ...nextReading }, ...prev].slice(0, 6));
      setLoading(false);
    }, 520);
  };

  return (
    <div className="space-y-10">
      <Hero />

      <div className="grid gap-6 lg:grid-cols-5 items-start">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-2 space-y-6 rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur p-6 shadow-xl shadow-black/30"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sensor database</p>
              <h3 className="text-xl font-semibold mt-1">Height check</h3>
              <p className="text-slate-300 text-sm mt-2">
                Simulates hitting the sensor-aligned database to pull the freshest height for a jar.
              </p>
            </div>
            <StatusPill />
          </div>

          <Field label="Select plant / jar">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
            >
              {plantOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <button
            type="button"
            onClick={fetchLatest}
            disabled={!selectedId || loading}
            className="inline-flex items-center justify-center w-full gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-blue-500 text-slate-900 font-semibold py-3 shadow-lg shadow-emerald-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Fetching from database...' : 'Fetch height from database'}
          </button>

          <div className="text-xs text-slate-400 space-y-1">
            <p>Mocked response shows what a live sensor query would return.</p>
            <p>Data refresh includes a small random jitter to mimic noise.</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="lg:col-span-3 space-y-5"
        >
          <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-6 shadow-xl shadow-black/30 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Latest reading</p>
                <h3 className="text-xl font-semibold">Current height from mock DB</h3>
              </div>
              <span className="text-xs text-slate-400 px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">
                Sensor-aligned record
              </span>
            </div>

            {reading ? (
              <>
                <div className="grid md:grid-cols-3 gap-4">
                  <StatCard title="Height (mm)" value={reading.height_mm} hint="Pulled from sensor-backed table" />
                  <StatCard
                    title="Expected range (mm)"
                    value={
                      reading.expected_range
                        ? `${reading.expected_range[0]} - ${reading.expected_range[1]}`
                        : '-'
                    }
                    hint="Lookup from baseline"
                  />
                  <StatCard title="Last updated" value={formatDate(reading.updated_at)} hint={reading.signal_quality} />
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-2 text-sm text-slate-300">
                  <p>
                    Jar <span className="font-semibold text-white">{reading.id}</span> is currently at{' '}
                    <span className="font-semibold text-white">{reading.height_mm} mm</span>. Keep this tab as your
                    quick sensor sanity check while the full growth tracker stays focused on model scoring.
                  </p>
                </div>
              </>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="h-28 rounded-2xl border border-slate-800/70 bg-slate-800/30 animate-pulse" />
                ))}
              </div>
            )}
          </div>

          <HistoryList history={history} activeId={selectedId} />
        </motion.div>
      </div>
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
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sensor quick check</p>
        <h2 className="text-3xl font-semibold leading-tight">Height check</h2>
        <p className="text-slate-300 text-sm md:text-base">
          Skip the full model run and hit the database for the latest sensor-aligned height. Useful when you just want
          to confirm the current measurement without running predictions.
        </p>
      </div>
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm text-slate-200 space-y-2">
      <span className="text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
      <p className="text-2xl font-semibold mt-2 text-white">{value ?? '-'}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function HistoryList({ history, activeId }) {
  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-6 shadow-xl shadow-black/30 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Recent mock rows</p>
          <h3 className="text-lg font-semibold">Last database hits</h3>
        </div>
        <span className="text-xs text-slate-400 px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">
          Demo only
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {history.map((row, idx) => (
          <div
            key={`${row.id}-${row.updated_at}-${idx}`}
            className={`rounded-2xl border ${
              row.id === activeId ? 'border-emerald-500/40 bg-slate-900/70' : 'border-slate-800 bg-slate-900/50'
            } p-4 space-y-2`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-white">{row.id}</span>
              <span className="text-xs text-slate-400">{formatDate(row.updated_at)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>Height</span>
              <span className="font-semibold text-white">{row.height_mm} mm</span>
            </div>
          </div>
        ))}
      </div>
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

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default HeightCheck;
