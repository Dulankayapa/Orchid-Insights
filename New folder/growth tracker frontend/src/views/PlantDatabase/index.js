import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

const firebaseConfig = {
  apiKey: 'AIzaSyD0lET_4Qpi-W2t0M4OpPGT5NeR2wlyiD0',
  authDomain: 'orchid-enviromental-monitor-d.firebaseapp.com',
  databaseURL: 'https://orchid-enviromental-monitor-d-default-rtdb.firebaseio.com',
  projectId: 'orchid-enviromental-monitor-d',
};

function PlantDatabase() {
  const [rows, setRows] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sensorLatest, setSensorLatest] = useState(null);
  const [sensorLogs, setSensorLogs] = useState([]);

  const filtered = useMemo(() => {
    if (!appliedQuery.trim()) return rows;
    const term = appliedQuery.trim().toLowerCase();
    return rows.filter((p) => p.id.toLowerCase().includes(term));
  }, [appliedQuery, rows]);

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true);
      setError('');
      try {
        const [plantsResp, latestResp, logsResp] = await Promise.all([
          axios.get(`${firebaseConfig.databaseURL}/plants.json`),
          axios.get(`${firebaseConfig.databaseURL}/orchidData/latest.json`),
          axios.get(`${firebaseConfig.databaseURL}/orchidData/logs.json`),
        ]);

        const raw = plantsResp.data || {};
        const mapped = Object.entries(raw).map(([id, data]) => {
          const planting_date = data?.planting_date || data?.plantingDate || '';
          const heights = data?.heights || [];
          const height_mm = data?.height_mm ?? data?.height ?? data?.current_height ?? null;
          return {
            id,
            planting_date,
            heights: Array.isArray(heights) ? heights : [],
            height_mm,
            cultivar: data?.cultivar || data?.variety || '',
          };
        });

        // Build a synthetic Jar-01 from sensor feed
        const latest = latestResp.data || null;
        const normalizedLatest = latest ? normalizeSensor(latest) : null;
        const logsRaw = logsResp.data || {};
        const logsArr = Object.values(logsRaw || {}).map(normalizeSensor);
        logsArr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        logsArr.reverse();
        setSensorLatest(normalizedLatest);
        setSensorLogs(logsArr);
        const heightsFromLogs = logsArr.slice(0, 50).map((row) => ({
          date: row.timestamp ? new Date(row.timestamp).toLocaleString() : '-',
          height_mm: row.plant_height_mm ?? row.distance_mm ?? null,
        }));
        const jarSensor = {
          id: 'Jar-01',
          planting_date: '-',
          heights: heightsFromLogs,
          height_mm: normalizedLatest?.plant_height_mm ?? normalizedLatest?.distance_mm ?? null,
          cultivar: 'Sensor feed',
        };

        const combined = [jarSensor, ...mapped.filter((r) => r.id !== 'Jar-01')];
        setRows(combined);
        if (combined[0]) setSelectedId(combined[0].id);
      } catch (err) {
        const msg = err.response?.data?.detail || err.message || 'Failed to load Firebase plants';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchRows();
  }, []);

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
      {error && <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
      {loading && <p className="text-sm text-slate-300">Loading plants from Firebase…</p>}

      <SensorPanel latest={sensorLatest} logs={sensorLogs} />

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
              Filter by Jar/Plant ID and click a row to inspect details and history (live from Firebase).
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
                const latestHeight = plant.height_mm ?? latest?.height_mm ?? null;
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
                      {latestHeight != null ? `${latestHeight} mm` : '-'}
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
        <h2 className="text-3xl font-semibold leading-tight"> plant database</h2>
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

function normalizeSensor(val) {
  const ts = normalizeTimestamp(val.timestamp);
  return {
    ...val,
    timestamp: ts,
    lux: Number(val.lux ?? val.light ?? val.lx ?? 0),
    temperature: Number(val.temperature ?? val.temp ?? 0),
    humidity: Number(val.humidity ?? val.hum ?? 0),
    mq135: Number(val.mq135 ?? val.mq ?? 0),
    distance_mm: Number(val.distance_mm ?? val.distance ?? val.dist ?? 0),
    plant_height_mm: Number(val.plant_height_mm ?? val.height_mm ?? 0),
  };
}

function fmtMaybe(v, fn) {
  if (v === null || v === undefined) return '—';
  return fn ? fn(v) : v;
}

function SensorPanel({ latest, logs }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur p-6 shadow-xl shadow-black/30 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Sensor feed</p>
          <h3 className="text-xl font-semibold text-white">Live readings from /orchidData</h3>
        </div>
        <span className="text-xs text-slate-400 px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">
          Logs: {logs?.length ?? 0}
        </span>
      </div>

      <div className="grid sm:grid-cols-5 gap-3">
        <SensorCard label="Temp" value={fmtMaybe(latest?.temperature, (v) => `${v.toFixed(1)} °C`)} />
        <SensorCard label="Humidity" value={fmtMaybe(latest?.humidity, (v) => `${v.toFixed(1)} %`)} />
        <SensorCard label="Light" value={fmtMaybe(latest?.lux, (v) => `${Math.round(v)} lx`)} />
        <SensorCard label="MQ135" value={fmtMaybe(latest?.mq135, (v) => `${v}`)} />
        <SensorCard label="Distance" value={fmtMaybe(latest?.distance_mm, (v) => `${v} mm`)} />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 max-h-72 overflow-auto">
        <table className="min-w-full text-xs text-left text-slate-200">
          <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-400 bg-slate-900/80">
            <tr>
              <th className="px-3 py-2">Jar</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Temp</th>
              <th className="px-3 py-2">Hum</th>
              <th className="px-3 py-2">Lux</th>
              <th className="px-3 py-2">MQ</th>
              <th className="px-3 py-2">Dist</th>
            </tr>
          </thead>
          <tbody>
            {logs.slice(0, 80).map((row, idx) => (
              <tr key={idx} className="border-t border-slate-800">
                <td className="px-3 py-2 text-slate-400">Jar-01</td>
                <td className="px-3 py-2 text-slate-400">{row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}</td>
                <td className="px-3 py-2">{fmtMaybe(row.temperature, (v) => v.toFixed(1))}</td>
                <td className="px-3 py-2">{fmtMaybe(row.humidity, (v) => v.toFixed(1))}</td>
                <td className="px-3 py-2">{fmtMaybe(row.lux, (v) => Math.round(v))}</td>
                <td className="px-3 py-2">{fmtMaybe(row.mq135, (v) => v)}</td>
                <td className="px-3 py-2">{fmtMaybe(row.distance_mm, (v) => v)}</td>
              </tr>
            ))}
            {!logs.length && (
              <tr>
                <td colSpan={7} className="px-3 py-3 text-center text-slate-400">
                  Waiting for sensor logs from Firebase…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

function SensorCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-white mt-1">{value ?? '—'}</p>
    </div>
  );
}

function normalizeTimestamp(ts) {
  const n = Number(ts);
  const now = Date.now();
  if (!Number.isFinite(n)) return now;
  // If value looks like millis() uptime (small), fall back to "now" to avoid 1970 dates
  if (n < 1e12) return now;
  return n;
}
