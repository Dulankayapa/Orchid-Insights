import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db, resolvedDatabaseURL } from "../lib/firebase";

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
  const dbUrl = resolvedDatabaseURL;

  const rows = useMemo(() => JAR_PATHS.map((jarKey) => jarReadings[jarKey] || emptyJar(jarKey)), [jarReadings]);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const term = query.toLowerCase();
    return rows.filter((row) => row.id.toLowerCase().includes(term));
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

  // Polling fallback so the table still updates if realtime listeners fail.
  useEffect(() => {
    let pollId = null;

    const fetchJars = async () => {
      try {
        const base = dbUrl.replace(/\/$/, "");
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
      } catch {
        setError((prev) => prev || "Realtime fallback polling failed");
      }
    };

    fetchJars();
    pollId = setInterval(fetchJars, 5000);

    return () => {
      if (pollId) clearInterval(pollId);
    };
  }, [dbUrl]);

  return (
    <div className="space-y-6">
      <section className="panel">
        <p className="kicker">Firebase RTDB</p>
        <h2 className="title-lg mt-1">Live plant table</h2>
        <p className="mt-2 text-sm text-subtle md:text-base">Realtime readings from Jar1, Jar2, and Jar3.</p>
      </section>

      <section className="panel space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Rows: {filtered.length}
          </span>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Jar/Plant ID"
              className="input-shell w-[220px]"
            />
            <button onClick={() => setRefreshKey((prev) => prev + 1)} className="btn-soft" disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}
        {!error && loading && <p className="text-sm text-subtle">Waiting for realtime data...</p>}

        <div className="overflow-auto rounded-2xl border border-primary/15">
          <table className="min-w-full text-left text-sm text-slate-800">
            <thead className="bg-primary/8 text-xs uppercase tracking-[0.2em] text-subtle">
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
                <tr key={row.id} className="border-t border-primary/10 hover:bg-primary/5 transition">
                  <td className="px-4 py-3 font-semibold text-primary">{row.id}</td>
                  <td className="px-4 py-3 text-slate-600">{row.temperature ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.humidity ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.lux ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.mq135 ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.height ?? "--"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-subtle">
                    No rows match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
