import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { mockPlants } from "../data/mockPlants";

export default function GrowthHistory() {
  const [jarId, setJarId] = useState("");

  const record = useMemo(() => {
    if (!jarId) return null;
    const id = jarId.trim().toLowerCase();
    return mockPlants.find((p) => p.id.toLowerCase() === id) || null;
  }, [jarId]);

  const history = useMemo(() => {
    if (!record) return [];
    return (record.heights || [])
      .map((h) => {
        const ts = Date.parse(h.date);
        return { ...h, ts: Number.isFinite(ts) ? ts : null };
      })
      .filter((h) => h.ts !== null)
      .sort((a, b) => a.ts - b.ts);
  }, [record]);

  return (
    <div className="relative space-y-8 text-slate-900">
      <Backdrop />
      <Hero />
      <LookupCard jarId={jarId} setJarId={setJarId} record={record} history={history} />

      <div className="relative grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ChartCard record={record} history={history} />
          <HistoryList history={history} />
        </div>
        <SummaryCard record={record} history={history} />
      </div>
    </div>
  );
}

function LookupCard({ jarId, setJarId, record, history }) {
  const chips = mockPlants.map((p) => p.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl border border-fuchsia-100 bg-white/95 p-6 shadow-[0_20px_50px_-32px_rgba(217,70,239,0.2)] space-y-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary">Growth history</p>
          <h2 className="text-2xl font-semibold text-slate-900">Find a jar and see its trail</h2>
          <p className="text-sm text-slate-600 mt-1">Type a Jar ID and we will load the demo measurements already used in Growth Tracker.</p>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.4)] mt-1" aria-hidden />
      </div>

      <div className="grid md:grid-cols-[2fr_1fr] gap-4 items-end">
        <label className="space-y-2">
          <span className="text-xs uppercase tracking-[0.22em] text-slate-500">Jar / Plant ID</span>
          <input
            value={jarId}
            onChange={(e) => setJarId(e.target.value)}
            placeholder="Try Jar-12, Jar-07, Jar-19, Jar-03"
            className="w-full rounded-2xl border border-fuchsia-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-500 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition"
          />
        </label>
        <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 px-4 py-3 text-sm text-fuchsia-900 shadow-inner">
          {record ? (
            <p>
              Loaded <span className="font-semibold">{record.id}</span> - {history.length} measurements - Cultivar {record.cultivar}
            </p>
          ) : jarId ? (
            <p className="text-amber-800">No demo record for "{jarId}". Try one of the chips below.</p>
          ) : (
            <p>Pick a Jar ID to load its planting date and height history.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setJarId(chip)}
            className={`px-3 py-2 rounded-xl text-sm border transition ${chip.toLowerCase() === jarId.trim().toLowerCase()
                ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-800 shadow-sm"
                : "border-slate-200 bg-white hover:border-fuchsia-300 hover:text-primary"
              }`}
          >
            {chip}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ChartCard({ record, history }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    if (!history.length || !canvasRef.current) return;

    const dataPoints = history.map((row) => ({ x: row.ts, y: Number(row.height_mm) }));

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        datasets: [
          {
            label: record?.id || "Height",
            data: dataPoints,
            borderColor: "#d946ef", // primary (fuchsia-500)
            backgroundColor: "rgba(217, 70, 239, 0.15)",
            tension: 0.28,
            borderWidth: 2.4,
            pointRadius: 4,
            pointBackgroundColor: "#a21caf", // fuchsia-700
            pointBorderColor: "#fdf4ff", // background color
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        scales: {
          x: {
            type: "time",
            time: { unit: "day", tooltipFormat: "MMM d, yyyy" },
            grid: { color: "rgba(148,163,184,0.25)" },
            ticks: { color: "#334155" },
            title: { display: true, text: "Measurement date", color: "#0f172a" },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148,163,184,0.25)" },
            ticks: { color: "#334155" },
            title: { display: true, text: "Plant height (mm)", color: "#0f172a" },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            mode: "index",
            callbacks: {
              label: (ctx) => `Height: ${ctx.parsed.y} mm`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [history, record?.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl border border-fuchsia-100 bg-white/95 p-6 shadow-[0_22px_60px_-34px_rgba(217,70,239,0.2)] space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Trend line</p>
          <h3 className="text-xl font-semibold text-slate-900">Height over time</h3>
        </div>
        <span className="text-xs text-slate-500">{history.length} points</span>
      </div>
      <div className="h-80">
        {history.length ? (
          <canvas ref={canvasRef} />
        ) : (
          <EmptyState message="No measurements yet. Choose a demo Jar ID to see the line chart." />
        )}
      </div>
    </motion.div>
  );
}

function HistoryList({ history }) {
  const rows = [...history].reverse(); // newest first

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_42px_-32px_rgba(15,23,42,0.3)] space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">History</p>
          <h3 className="text-lg font-semibold text-slate-900">Logged measurements</h3>
        </div>
        <span className="text-xs text-slate-500">{rows.length ? "Latest first" : "Waiting for selection"}</span>
      </div>

      {rows.length ? (
        <div className="divide-y divide-slate-100">
          {rows.map((row, idx) => {
            const prev = rows[idx + 1];
            const delta = prev ? Number(row.height_mm) - Number(prev.height_mm) : null;
            return (
              <div key={row.ts} className="grid grid-cols-3 gap-3 py-3 text-sm text-slate-800">
                <span className="font-medium">{formatDate(row.ts)}</span>
                <span>{Number(row.height_mm).toFixed(1)} mm</span>
                <span className="text-slate-500">
                  {delta === null ? "-" : delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} mm vs prior`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState message="Measurement list will appear once a Jar ID is loaded." />
      )}
    </motion.div>
  );
}

function SummaryCard({ record, history }) {
  const latest = history.length ? history[history.length - 1] : null;
  const first = history[0];
  const avg = history.length ? history.reduce((sum, row) => sum + Number(row.height_mm), 0) / history.length : null;
  const delta = latest && first ? latest.height_mm - first.height_mm : null;

  const stats = [
    { label: "Planting date", value: record?.planting_date || "-" },
    { label: "Location", value: record?.location || "-" },
    { label: "Measurements", value: history.length ? `${history.length} entries` : "0 entries" },
    { label: "Latest height", value: latest ? `${latest.height_mm.toFixed(1)} mm` : "-" },
    { label: "Avg height", value: avg !== null ? `${avg.toFixed(1)} mm` : "-" },
    { label: "Change", value: delta !== null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} mm` : "-" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_48px_-30px_rgba(15,23,42,0.35)] space-y-5"
    >
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Snapshot</p>
        <h3 className="text-lg font-semibold text-slate-900">{record ? record.id : "Awaiting jar"}</h3>
        <p className="text-sm text-slate-600">Overview of planting metadata and simple stats from the demo dataset.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className="text-sm font-semibold text-slate-900 mt-1">{item.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl border border-fuchsia-100 bg-white/95 p-8 shadow-[0_25px_60px_-28px_rgba(217,70,239,0.2)]"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-white to-pink-50 pointer-events-none" />
      <div className="relative space-y-3">
        <p className="text-xs uppercase tracking-[0.32em] text-primary">Historical view</p>
        <h1 className="text-3xl font-semibold text-slate-900">Jar height history</h1>
        <p className="text-slate-700 text-sm md:text-base max-w-2xl">
          Query any Jar ID and review its recorded heights. The line chart uses the same demo data as Growth Tracker, with dates on the x-axis and height in millimeters on the y-axis.
        </p>
      </div>
    </motion.div>
  );
}

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-purple-50 via-white to-pink-50" />
      <div className="absolute inset-0 opacity-60 bg-[linear-gradient(90deg,rgba(168,85,247,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(236,72,153,0.06)_1px,transparent_1px)] bg-[size:52px_52px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(217,70,239,0.15),transparent_30%),radial-gradient(circle_at_72%_16%,rgba(168,85,247,0.15),transparent_32%),radial-gradient(circle_at_48%_82%,rgba(244,114,182,0.1),transparent_36%)]" />
    </div>
  );
}

function EmptyState({ message }) {
  return <div className="h-full flex items-center justify-center text-sm text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">{message}</div>;
}

function formatDate(ts) {
  if (!ts) return "-";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(ts));
  } catch {
    return "-";
  }
}
