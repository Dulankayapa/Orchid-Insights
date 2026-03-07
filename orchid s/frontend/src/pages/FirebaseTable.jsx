import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../lib/firebase";

const JAR_PATHS = ["Jar1", "Jar2", "Jar3"];

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeJar = (jarKey, data) => ({
  id: jarKey,
  temperature: toNumber(data?.temperature ?? data?.teperature ?? data?.temp),
  humidity: toNumber(data?.humidity ?? data?.humidty ?? data?.hum),
  lux: toNumber(data?.lux ?? data?.light ?? data?.lx),
  mq135: toNumber(data?.mq135 ?? data?.mq ?? data?.gas),
  height: toNumber(data?.height ?? data?.height_mm ?? data?.heightCm),
});

const emptyJar = (jarKey) => ({
  id: jarKey,
  temperature: null,
  humidity: null,
  lux: null,
  mq135: null,
  height: null,
});

export default function FirebaseTable() {
  const [jarReadings, setJarReadings] = useState({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const DB_URL = import.meta.env.VITE_FIREBASE_DB_URL || "https://orchid-insights-c2456-default-rtdb.firebaseio.com";

  const rows = useMemo(() => {
    return JAR_PATHS.map((jarKey) => jarReadings[jarKey] || emptyJar(jarKey));
  }, [jarReadings]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const term = query.toLowerCase();
    return rows.filter((r) => r.id.toLowerCase().includes(term));
  }, [query, rows]);

  useEffect(() => {
    setLoading(true);
    setError("");
    const unsubs = JAR_PATHS.map((jarKey) =>
      onValue(
        ref(db, jarKey),
        (snap) => {
          const data = snap.val();
          setJarReadings((prev) => ({
            ...prev,
            [jarKey]: data ? normalizeJar(jarKey, data) : emptyJar(jarKey),
          }));
          setLoading(false);
        },
        (err) => {
          setError(err?.message || "Failed to fetch Firebase data");
          setLoading(false);
        }
      )
    );
    return () => unsubs.forEach((off) => off());
  }, [refreshKey]);

  // REST polling safety-net so live table still updates even if realtime listener fails.
  useEffect(() => {
    let pollId = null;

    const fetchJars = async () => {
      try {
        const base = DB_URL.replace(/\/$/, "");
        const results = await Promise.all(
          JAR_PATHS.map(async (jarKey) => {
            const res = await fetch(`${base}/${jarKey}.json`);
            if (!res.ok) return [jarKey, emptyJar(jarKey)];
            const data = await res.json();
            return [jarKey, data ? normalizeJar(jarKey, data) : emptyJar(jarKey)];
          })
        );

        const next = Object.fromEntries(results);
        setJarReadings((prev) => ({ ...prev, ...next }));
        setLoading(false);
      } catch (err) {
        setError((prev) => prev || "Realtime fallback polling failed");
      }
    };

    fetchJars();
    pollId = setInterval(fetchJars, 5000);

    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [DB_URL]);

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6 border border-pink-400/30">
        <p className="text-xs uppercase tracking-[0.25em] text-subtle">Firebase RTDB</p>
        <h2 className="text-2xl font-semibold text-dark">Live plant table</h2>
        <p className="text-slate-600 mt-2">Realtime readings from Jar1, Jar2, and Jar3.</p>
      </div>

      <div className="glass rounded-3xl p-6 border border-white/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-600">Rows: {filtered.length}</div>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Jar/Plant ID"
              className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/60 text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={() => setRefreshKey((prev) => prev + 1)}
              className="rounded-xl border border-pink-200 px-3 py-2 text-sm text-pink-700 hover:border-pink-400/60 hover:bg-pink-50"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}
        {!error && loading && <p className="text-sm text-slate-500">Waiting for realtime data...</p>}

        <div className="overflow-auto rounded-2xl border border-pink-100">
          <table className="min-w-full text-sm text-left text-slate-800">
            <thead className="text-xs uppercase tracking-[0.25em] text-subtle bg-pink-50/50">
              <tr>
                <th className="px-4 py-3">Jar ID</th>
                <th className="px-4 py-3">Temperature (C)</th>
                <th className="px-4 py-3">Humidity (%)</th>
                <th className="px-4 py-3">Lux</th>
                <th className="px-4 py-3">MQ135</th>
                <th className="px-4 py-3">Height (mm)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-pink-100 hover:bg-pink-50/30 transition">
                  <td className="px-4 py-3 font-semibold text-primary-dark">{row.id}</td>
                  <td className="px-4 py-3 text-slate-600">{row.temperature ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.humidity ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.lux ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.mq135 ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.height ?? "--"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-slate-400">
                    No rows match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

