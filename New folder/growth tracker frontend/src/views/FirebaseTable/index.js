import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';

const firebaseConfig = {
  apiKey: 'AIzaSyD0lET_4Qpi-W2t0M4OpPGT5NeR2wlyiD0',
  authDomain: 'orchid-enviromental-monitor-d.firebaseapp.com',
  databaseURL: 'https://orchid-enviromental-monitor-d-default-rtdb.firebaseio.com',
  projectId: 'orchid-enviromental-monitor-d',
};

function FirebaseTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [createPayload, setCreatePayload] = useState({
    id: '',
    planting_date: '',
    height_mm: '',
    cultivar: '',
  });
  const [creating, setCreating] = useState(false);

  const [sensorLatest, setSensorLatest] = useState(null);
  const [sensorLogs, setSensorLogs] = useState([]);
  const [sensorError, setSensorError] = useState(null);

  const filtered = useMemo(() => {
    if (!appliedQuery.trim()) return rows;
    const term = appliedQuery.trim().toLowerCase();
    return rows.filter((r) => r.id.toLowerCase().includes(term));
  }, [rows, appliedQuery]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setSensorError(null);
    try {
      const [plantsResp, latestResp, logsResp] = await Promise.all([
        axios.get(`${firebaseConfig.databaseURL}/plants.json`),
        axios.get(`${firebaseConfig.databaseURL}/orchidData/latest.json`),
        axios.get(`${firebaseConfig.databaseURL}/orchidData/logs.json`),
      ]);

      const rawPlants = plantsResp.data || {};
      const mapped = Object.entries(rawPlants).map(([id, data]) => {
        const plantingDate = data?.planting_date || data?.plantingDate || '-';
        const height = data?.height_mm ?? data?.height ?? data?.current_height ?? null;
        const updated = data?.updated_at || data?.timestamp || data?.recorded_at || null;
        const cultivar = data?.cultivar || data?.variety || null;
        return { id, planting_date: plantingDate, height_mm: height, updated_at: updated, cultivar };
      });
      const latest = latestResp.data || null;
      const normalizedLatest = latest ? normalizeSensor(latest) : null;
      setSensorLatest(normalizedLatest);

      const logsRaw = logsResp.data || {};
      const logsArr = Object.values(logsRaw || {}).map(normalizeSensor);
      logsArr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      logsArr.reverse();
      setSensorLogs(logsArr);

      // Ensure Jar-01 exists reflecting the sensor feed
      const jarId = 'Jar-01';
      const sensorRow = {
        id: jarId,
        planting_date: '-',
        height_mm: normalizedLatest?.distance_mm ?? normalizedLatest?.mq135 ?? null,
        updated_at: normalizedLatest?.timestamp ? new Date(normalizedLatest.timestamp).toISOString() : null,
        cultivar: 'Sensor feed',
      };
      const filtered = mapped.filter((r) => r.id !== jarId);
      filtered.unshift(sensorRow);
      setRows(filtered);
    } catch (err) {
      console.error(err);
      const message = err.response?.data || err.message || 'Failed to fetch Firebase data';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onSearch = (e) => {
    e?.preventDefault();
    setAppliedQuery(query);
  };

  const onCreate = async (e) => {
    e.preventDefault();
    setError(null);
    if (!createPayload.id.trim()) {
      setError('Please provide an ID for the new record.');
      return;
    }
    setCreating(true);
    const body = {
      planting_date: createPayload.planting_date || null,
      height_mm: createPayload.height_mm ? Number(createPayload.height_mm) : null,
      cultivar: createPayload.cultivar || null,
      updated_at: new Date().toISOString(),
    };
    try {
      await axios.put(`${firebaseConfig.databaseURL}/plants/${createPayload.id}.json`, body);
      await fetchData();
      setCreatePayload({ id: '', planting_date: '', height_mm: '', cultivar: '' });
    } catch (err) {
      console.error(err);
      const message = err.response?.data || err.message || 'Failed to create record';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setCreating(false);
    }
  };

  const onDelete = async (id) => {
    setError(null);
    try {
      await axios.delete(`${firebaseConfig.databaseURL}/plants/${id}.json`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      console.error(err);
      const message = err.response?.data || err.message || 'Failed to delete record';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    }
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
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Firebase realtime DB</p>
            <h3 className="text-xl font-semibold text-white">Plants + Sensor feed</h3>
            <p className="text-slate-300 text-sm mt-1">Plant CRUD plus live sensor history from /orchidData.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">Rows: {filtered.length}</span>
            <button
              type="button"
              onClick={fetchData}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 border border-slate-700 px-3 py-1.5 text-slate-200 hover:border-emerald-400/60 transition"
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        <form onSubmit={onSearch} className="flex flex-col sm:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Jar/Plant ID"
            className="flex-1 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-blue-500 text-slate-900 font-semibold px-4 py-2.5 shadow-lg shadow-emerald-500/25"
          >
            Search
          </button>
        </form>
 

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            Error: {error}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 overflow-auto rounded-2xl border border-slate-800 bg-slate-900/60">
            <table className="min-w-full text-sm text-left text-slate-200">
              <thead className="text-xs uppercase tracking-[0.25em] text-slate-400 bg-slate-900/70">
                <tr>
                  <th className="px-4 py-3">Jar ID</th>
                  <th className="px-4 py-3">Planting date</th>
                  <th className="px-4 py-3">Height (mm)</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Cultivar</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-semibold">{row.id}</td>
                    <td className="px-4 py-3 text-slate-300">{row.planting_date || '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{row.height_mm ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{row.updated_at || '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{row.cultivar || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDelete(row.id)}
                        className="text-xs px-3 py-1 rounded-lg border border-rose-500/40 text-rose-200 hover:bg-rose-500/10 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-5 text-center text-slate-400">
                      No rows match "{appliedQuery}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-200">Sensor latest</p>
              <span className="text-xs text-slate-400">
                {sensorLatest?.timestamp ? new Date(sensorLatest.timestamp).toLocaleTimeString() : '—'}
              </span>
            </div>
            {sensorError && (
              <p className="text-xs text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{sensorError}</p>
            )}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Metric label="Temp" value={fmtMaybe(sensorLatest?.temperature, (v) => `${v.toFixed(1)} °C`)} />
              <Metric label="Humidity" value={fmtMaybe(sensorLatest?.humidity, (v) => `${v.toFixed(1)} %`)} />
              <Metric label="Light" value={fmtMaybe(sensorLatest?.lux, (v) => `${Math.round(v)} lx`)} />
              <Metric label="MQ135" value={fmtMaybe(sensorLatest?.mq135, (v) => `${v}`)} />
              <Metric label="Distance" value={fmtMaybe(sensorLatest?.distance_mm, (v) => `${v} mm`)} />
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 max-h-64 overflow-auto">
              <table className="min-w-full text-xs text-left text-slate-200">
                <thead className="text-[11px] uppercase tracking-[0.2em] text-slate-400 bg-slate-900/80">
                  <tr>
                    <th className="px-3 py-2">Jar</th>
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">T</th>
                    <th className="px-3 py-2">H</th>
                    <th className="px-3 py-2">Lux</th>
                    <th className="px-3 py-2">MQ</th>
                  </tr>
                </thead>
                <tbody>
                  {sensorLogs.slice(0, 80).map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-400">Jar-01</td>
                      <td className="px-3 py-2 text-slate-400">
                        {row.timestamp ? new Date(row.timestamp).toLocaleTimeString() : '—'}
                      </td>
                      <td className="px-3 py-2">{fmtMaybe(row.temperature, (v) => v.toFixed(1))}</td>
                      <td className="px-3 py-2">{fmtMaybe(row.humidity, (v) => v.toFixed(1))}</td>
                      <td className="px-3 py-2">{fmtMaybe(row.lux, (v) => Math.round(v))}</td>
                      <td className="px-3 py-2">{fmtMaybe(row.mq135, (v) => v)}</td>
                    </tr>
                  ))}
                  {!sensorLogs.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-3 text-center text-slate-400">
                        Waiting for sensor logs from /orchidData/logs…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
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
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Live data</p>
        <h2 className="text-3xl font-semibold leading-tight">Firebase plants + sensors</h2>
        <p className="text-slate-300 text-sm md:text-base">
          Reads plant rows and the ESP32 sensor stream from /orchidData (latest + logs) in Firebase Realtime Database.
        </p>
      </div>
    </motion.div>
  );
}

export default FirebaseTable;

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

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-white mt-1">{value ?? '—'}</p>
    </div>
  );
}

function fmtMaybe(v, fn) {
  if (v === null || v === undefined) return '—';
  return fn ? fn(v) : v;
}

function normalizeTimestamp(ts) {
  const n = Number(ts);
  const now = Date.now();
  if (!Number.isFinite(n)) return now;
  if (n < 1e12) return now;
  return n;
}
