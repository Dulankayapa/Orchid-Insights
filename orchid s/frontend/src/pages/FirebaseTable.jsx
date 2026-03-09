import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db, resolvedDatabaseURL } from "../lib/firebase";

const JAR_PATHS = ["Jar1", "Jar2", "Jar3"];
const PLANTS_PATH = "plants";

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

const normalizePlant = (plantId, data) => ({
  id: plantId,
  temperature: toNumber(data?.temperature ?? data?.temp),
  humidity: toNumber(data?.humidity ?? data?.hum),
  lux: toNumber(data?.lux ?? data?.light ?? data?.lx),
  mq135: toNumber(data?.mq135 ?? data?.mq ?? data?.gas),
  height: toNumber(data?.height_mm ?? data?.height ?? data?.current_height),
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
  const [sensorReadings, setSensorReadings] = useState({});
  const [plantReadings, setPlantReadings] = useState({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const dbUrl = resolvedDatabaseURL;

  const rows = useMemo(() => {
    const merged = { ...sensorReadings };
    Object.entries(plantReadings).forEach(([id, row]) => {
      const base = merged[id] || emptyJar(id);
      merged[id] = {
        ...base,
        temperature: row.temperature ?? base.temperature,
        humidity: row.humidity ?? base.humidity,
        lux: row.lux ?? base.lux,
        mq135: row.mq135 ?? base.mq135,
        height: row.height ?? base.height,
      };
    });

    const ids = Array.from(new Set([...JAR_PATHS, ...Object.keys(merged)])).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    return ids.map((id) => merged[id] || emptyJar(id));
  }, [sensorReadings, plantReadings]);

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
          setSensorReadings((prev) => ({
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

    const plantsUnsub = onValue(
      ref(db, PLANTS_PATH),
      (snap) => {
        const raw = snap.val() || {};
        const normalized = Object.entries(raw).reduce((acc, [key, value]) => {
          acc[key] = normalizePlant(key, value || {});
          return acc;
        }, {});
        setPlantReadings(normalized);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to fetch saved plant IDs");
        setLoading(false);
      }
    );

    return () => {
      unsubs.forEach((off) => off());
      plantsUnsub();
    };
  }, [refreshKey]);

  // Polling fallback so the table still updates if realtime listeners fail.
  useEffect(() => {
    let pollId = null;

    const fetchJars = async () => {
      try {
        const base = dbUrl.replace(/\/$/, "");
        const jarResults = await Promise.all(
          JAR_PATHS.map(async (jarKey) => {
            const res = await fetch(`${base}/${jarKey}.json`);
            if (!res.ok) return [jarKey, emptyJar(jarKey)];
            const data = await res.json();
            return [jarKey, data ? normalizeJar(jarKey, data) : emptyJar(jarKey)];
          })
        );

        const plantsRes = await fetch(`${base}/${PLANTS_PATH}.json`);
        const plantsRaw = plantsRes.ok ? await plantsRes.json() : {};
        const plantNext = Object.entries(plantsRaw || {}).reduce((acc, [key, value]) => {
          acc[key] = normalizePlant(key, value || {});
          return acc;
        }, {});

        setSensorReadings(Object.fromEntries(jarResults));
        setPlantReadings(plantNext);
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
        <p className="mt-2 text-sm text-subtle md:text-base">
          Realtime readings from Jar1/Jar2/Jar3 plus saved Jar IDs from the database.
        </p>
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
