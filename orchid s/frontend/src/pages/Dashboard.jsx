import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { jsPDF } from "jspdf";
import { api } from "../lib/api";
import { useMonitorData } from "../hooks/useMonitorData";

const FEEDBACK_STORAGE_KEY = "orchid-insights-dashboard-feedback";

const cards = [
  {
    title: "Growth Tracker",
    to: "/growth",
    tone: "from-primary/35 to-secondary/30",
    icon: "\u{1F4C8}",
    meta: "Predictive",
    desc: "Model-backed growth classification and expected ranges.",
  },
  {
    title: "Growth History",
    to: "/history",
    tone: "from-accent/35 to-secondary/30",
    icon: "\u{1F552}",
    meta: "Analytics",
    desc: "Jar-based trend lines with comparison and rack filtering.",
  },
  {
    title: "Culture Details",
    to: "/reculture",
    tone: "from-secondary/35 to-primary/30",
    icon: "\u{1F9EA}",
    meta: "Operations",
    desc: "Manage culture and reculture entries, racks, orchids, and nutrition records.",
  },
  {
    title: "Plant Database",
    to: "/plants",
    tone: "from-emerald-400/35 to-primary/30",
    icon: "\u{1F33F}",
    meta: "Records",
    desc: "Searchable plant records synced from your backend.",
  },
  {
    title: "Firebase Table",
    to: "/firebase",
    tone: "from-orange-300/35 to-primary/30",
    icon: "\u{1F525}",
    meta: "Live Data",
    desc: "Live jar sensor values in a compact data table.",
  },
  {
    title: "Orchid Classifier",
    to: "/classifier",
    tone: "from-indigo-300/35 to-primary/30",
    icon: "\u{1F4F7}",
    meta: "Vision",
    desc: "Upload an orchid photo to predict class and OOD score.",
  },
  {
    title: "Env Monitor",
    to: "/monitor",
    tone: "from-sky-400/35 to-primary/30",
    icon: "\u{1F321}\uFE0F",
    meta: "Sensors",
    desc: "Real-time environment status with alerts and charts.",
  },
  {
    title: "Orchid Companion",
    to: "/companion",
    tone: "from-fuchsia-400/35 to-secondary/30",
    icon: "\u{1F916}",
    meta: "Assistant",
    desc: "Ask the assistant for orchid care and growth guidance using live monitor context.",
  },
];
const ORCHID_FRAME_DURATION_MS = 5000;
const orchidClipFrames = [
  "/orchid-clip/frame-1.jpg",
  "/orchid-clip/frame-2.jpg",
  "/orchid-clip/frame-3.jpg",
  "/orchid-clip/frame-4.jpg",
  "/orchid-clip/frame-5.jpg",
  "/orchid-clip/frame-6.jpg",
  "/orchid-clip/frame-7.jpg",
  "/orchid-clip/frame-8.jpg",
];
const isFiniteNumber = (value) => Number.isFinite(Number(value));
const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};
const DAY_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_WARNING_MIN_DAYS = 90;
const DASHBOARD_SLOW_RATE_CM_PER_DAY = 0.03;
const DASHBOARD_NO_GROWTH_RATE_CM_PER_DAY = 0.001;
const DASHBOARD_GROWTH_WARNING_MOCK = [
  {
    jarId: "Jar-104",
    plantingDate: "2026-01-18",
    heights: [
      { date: "2026-02-18", height_mm: 28 },
      { date: "2026-03-04", height_mm: 28 },
      { date: "2026-03-18", height_mm: 28 },
      { date: "2026-04-01", height_mm: 28 },
      { date: "2026-04-15", height_mm: 28 },
      { date: "2026-04-29", height_mm: 28 },
      { date: "2026-05-13", height_mm: 28 },
      { date: "2026-05-27", height_mm: 28 },
      { date: "2026-06-10", height_mm: 28 },
      { date: "2026-06-24", height_mm: 28 },
    ],
  },
];

const buildDashboardGrowthWarnings = (records) =>
  (records || [])
    .map((record) => {
      const points = (record?.heights || [])
        .map((row) => {
          const ts = Date.parse(`${row?.date || ""}T12:00:00Z`);
          const mm = Number(row?.height_mm);
          if (!Number.isFinite(ts) || !Number.isFinite(mm)) return null;
          return { ts, mm };
        })
        .filter(Boolean)
        .sort((a, b) => a.ts - b.ts);

      if (points.length < 2) return null;
      const first = points[0];
      const last = points[points.length - 1];
      const elapsedDays = (last.ts - first.ts) / DAY_MS;
      if (!Number.isFinite(elapsedDays) || elapsedDays <= 0) return null;

      const plantingTs = Date.parse(`${record?.plantingDate || ""}T12:00:00Z`);
      const daysSincePlanting = Number.isFinite(plantingTs) ? (last.ts - plantingTs) / DAY_MS : elapsedDays;
      if (!Number.isFinite(daysSincePlanting) || daysSincePlanting < DASHBOARD_WARNING_MIN_DAYS) return null;

      const growthRateCmPerDay = ((last.mm - first.mm) / 10) / elapsedDays;
      if (!Number.isFinite(growthRateCmPerDay)) return null;
      if (growthRateCmPerDay > DASHBOARD_SLOW_RATE_CM_PER_DAY) return null;

      return {
        jarId: String(record?.jarId || "").trim(),
        severity: growthRateCmPerDay <= DASHBOARD_NO_GROWTH_RATE_CM_PER_DAY ? "no growth" : "slow growth",
      };
    })
    .filter((row) => row?.jarId)
    .sort((a, b) => String(a.jarId).localeCompare(String(b.jarId), undefined, { numeric: true, sensitivity: "base" }));

export default function Dashboard() {
  const { latest: liveMonitorLatest, connectionStatus: monitorConnectionStatus } = useMonitorData();
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [showStats, setShowStats] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackList, setFeedbackList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [clipFrameIndex, setClipFrameIndex] = useState(0);
  const [failedClipFrames, setFailedClipFrames] = useState([]);
  const growthWarnings = useMemo(() => buildDashboardGrowthWarnings(DASHBOARD_GROWTH_WARNING_MOCK), []);

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message));
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setFeedbackList(parsed);
      }
    } catch {
      setFeedbackList([]);
    }
  }, []);

  const availableClipFrames = orchidClipFrames
    .map((src, index) => ({ src, index }))
    .filter((frame) => !failedClipFrames.includes(frame.index));

  useEffect(() => {
    if (availableClipFrames.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setClipFrameIndex((prev) => (prev + 1) % availableClipFrames.length);
    }, ORCHID_FRAME_DURATION_MS);

    return () => window.clearInterval(timer);
  }, [availableClipFrames.length]);

  useEffect(() => {
    setClipFrameIndex(0);
  }, [availableClipFrames.length]);

  const persistFeedback = (nextList) => {
    setFeedbackList(nextList);
    try {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      // ignore localStorage write errors
    }
  };

  const submitFeedback = (e) => {
    e.preventDefault();
    const message = feedback.trim();
    if (!message) {
      setFeedbackStatus("Please enter feedback before submitting.");
      return;
    }

    if (editingId) {
      const updated = feedbackList.map((item) =>
        item.id === editingId ? { ...item, message, updatedAt: new Date().toISOString() } : item
      );
      persistFeedback(updated);
      setFeedbackStatus("Feedback updated.");
      setEditingId(null);
      setFeedback("");
      return;
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      createdAt: new Date().toISOString(),
    };
    const updated = [entry, ...feedbackList].slice(0, 20);
    persistFeedback(updated);
    setFeedback("");
    setFeedbackStatus("Thank you. Your feedback has been submitted.");
  };

  const startEditFeedback = (item) => {
    setEditingId(item.id);
    setFeedback(item.message);
    setFeedbackStatus("Editing feedback. Update and save when ready.");
  };

  const cancelEditFeedback = () => {
    setEditingId(null);
    setFeedback("");
    setFeedbackStatus("Edit cancelled.");
  };

  const deleteFeedback = (id) => {
    const updated = feedbackList.filter((item) => item.id !== id);
    persistFeedback(updated);
    if (editingId === id) {
      setEditingId(null);
      setFeedback("");
    }
    setFeedbackStatus("Feedback deleted.");
  };

  const currentClipFrame = availableClipFrames.length
    ? availableClipFrames[clipFrameIndex % availableClipFrames.length]
    : null;
  const totalSensors = 4;
  const activeSensorCount = [
    liveMonitorLatest?.temperature,
    liveMonitorLatest?.humidity,
    liveMonitorLatest?.lux,
    liveMonitorLatest?.mq135,
  ].filter(isFiniteNumber).length;
  const hasLiveSensorStream = activeSensorCount > 0;
  const liveSensorTrend =
    monitorConnectionStatus === "connected"
      ? "Live now"
      : monitorConnectionStatus === "stale"
      ? "Stale feed"
      : "Pending";
  const liveSensorTrendTone =
    monitorConnectionStatus === "connected"
      ? "text-primary"
      : monitorConnectionStatus === "stale"
      ? "text-amber-600 dark:text-amber-400"
      : "text-rose-600 dark:text-rose-400";
  const growthWarningCount = growthWarnings.length;
  const growthWarningSummary = growthWarnings.map((item) => `${item.jarId} (${item.severity})`).join(", ");
  const totalAlerts = growthWarningCount + (error ? 1 : 0);
  const statItems = [
    {
      label: "Plants Monitored",
      value: "128",
      icon: "\u{1F33F}",
      detail: "Across 6 greenhouse zones",
      trend: "+6 this week",
      trendTone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Active Sensors",
      value: `${activeSensorCount}/${totalSensors}`,
      icon: "\u{1F4F6}",
      detail: hasLiveSensorStream
        ? `${activeSensorCount} of ${totalSensors} sensors reporting live`
        : "Waiting for real-time sensor telemetry",
      trend: liveSensorTrend,
      trendTone: liveSensorTrendTone,
    },
    {
      label: "Avg Humidity",
      value: health ? "62%" : "--",
      icon: "\u{1F4A7}",
      detail: "Rolling average over 24h",
      trend: "+1.8%",
      trendTone: "text-primary",
    },
    {
      label: "Growth Alerts",
      value: String(totalAlerts),
      icon: "\u{1F514}",
      detail: growthWarningCount
        ? `Growth warning: ${growthWarningSummary}`
        : error
        ? "Health warning needs review"
        : "No blocking alerts",
      trend: growthWarningCount ? `Review ${growthWarningCount} jar` : error ? "Check now" : "All clear",
      trendTone:
        growthWarningCount || error
          ? "text-rose-600 dark:text-rose-400"
          : "text-emerald-600 dark:text-emerald-400",
    },
  ];
  const handleExportDashboardReport = () => {
    const doc = new jsPDF();
    const generatedAt = new Date().toLocaleString();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentBottom = pageHeight - 16;
    const temperature = toNumber(liveMonitorLatest?.temperature);
    const humidity = toNumber(liveMonitorLatest?.humidity);
    const lux = toNumber(liveMonitorLatest?.lux);
    const mq135 = toNumber(liveMonitorLatest?.mq135);
    const moduleDetails = [
      ["Culture Details", "Manage culture and reculture records, rack placement, orchid type, and nutrition notes."],
      ["Growth Tracker", "Analyze plant growth using age and height to generate predictive growth status."],
      ["Growth History", "View jar-wise historical height trends with comparison and rack-based analysis."],
      ["Plant Database", "Browse and search stored orchid plant records synced from backend and Firebase."],
      ["Firebase Table", "Inspect live sensor payloads and merged values from Firebase in tabular form."],
      ["Env Monitor", "Track real-time temperature, humidity, light, air quality, alerts, and AI tips."],
      ["Orchid Companion", "Get context-aware orchid care guidance using live monitor sensor data."],
    ];

    doc.setFontSize(20);
    doc.text("Orchid Insights Dashboard Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${generatedAt}`, 14, 27);
    doc.text(`Live connection: ${String(monitorConnectionStatus || "unknown").toUpperCase()}`, 14, 33);

    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text("Live Snapshot", 14, 45);

    doc.setFontSize(10);
    const rows = [
      ["Temperature", temperature === null ? "--" : `${temperature.toFixed(1)} C`],
      ["Humidity", humidity === null ? "--" : `${humidity.toFixed(1)} %`],
      ["Light", lux === null ? "--" : `${Math.round(lux)} lx`],
      ["Air Quality (MQ135)", mq135 === null ? "--" : `${Math.round(mq135)}`],
      ["Active Sensors", `${activeSensorCount}/${totalSensors}`],
    ];

    let y = 53;
    const ensureSpace = (needed = 8) => {
      if (y + needed <= contentBottom) return;
      doc.addPage();
      y = 20;
    };

    rows.forEach(([label, value]) => {
      ensureSpace(7);
      doc.text(`${label}:`, 14, y);
      doc.text(value, 80, y);
      y += 7;
    });

    ensureSpace(10);
    doc.setFontSize(12);
    y += 8;
    doc.text("Module Details", 14, y);
    doc.setFontSize(10);
    y += 7;

    moduleDetails.forEach(([name, detail]) => {
      const wrapped = doc.splitTextToSize(`- ${name}: ${detail}`, 180);
      ensureSpace(wrapped.length * 5 + 2);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 5 + 2;
    });

    doc.save(`Orchid_Dashboard_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6">
      <section className="hero-glass modern-hero relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/35 via-transparent to-primary/10 dark:from-white/5" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-stretch">
          <div className="space-y-4">
            <p className="kicker">Orchid Insights</p>
            <h2 className="title-lg">Orchid Insights Dashboard</h2>
            <p className="page-description max-w-3xl">
              Growth analytics, plant database operations, and real-time environmental monitoring in one modern workspace.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="chip-subtle">{cards.length} active modules</span>
              <span className="chip-subtle">Live telemetry</span>
              <span className="chip-subtle">Team-ready workspace</span>
            </div>

            {health && (
              <div className="grid gap-3 sm:grid-cols-3">
                <StatusPill label="Growth model" ok={health.model_loaded} />
                <StatusPill label="Firebase" ok={health.firebase_connected} />
                <StatusPill label="API status" ok={health.status === "ok"} />
              </div>
            )}

            {error && (
              <p className="rounded-xl border border-rose-300/45 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                Health check failed: {error}
              </p>
            )}
          </div>

          <div className="hero-media-card group relative h-[230px] w-full sm:h-[280px] lg:h-[320px] xl:h-[340px]">
            {currentClipFrame ? (
              <img
                key={currentClipFrame.src}
                src={currentClipFrame.src}
                alt="Blooming orchid cluster"
                className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                loading="lazy"
                onError={() => {
                  setFailedClipFrames((prev) => {
                    if (prev.includes(currentClipFrame.index)) return prev;
                    return [...prev, currentClipFrame.index];
                  });
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-100 via-white to-teal-100 px-5 text-center text-sm font-medium text-slate-600">
                Add orchid images in <span className="mx-1 rounded bg-white/70 px-2 py-0.5 font-semibold text-slate-700">public/orchid-clip</span> to run the clip in one frame.
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/50 via-slate-900/5 to-transparent" />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="kicker">Live Snapshot</p>
            <p className="text-sm text-subtle">Quick health and monitoring summary.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportDashboardReport}
              className="btn-soft rounded-xl px-3 py-1.5 text-sm"
              title="Generate report"
              aria-label="Generate dashboard report"
            >
              <span className="text-base leading-none" aria-hidden="true">{"\u{1F4C4}"}</span>
              <span>Report</span>
            </button>
            <button
              type="button"
              onClick={() => setShowStats((prev) => !prev)}
              className="btn-soft btn-soft-emphasis rounded-xl px-3 py-1.5 text-sm"
              aria-expanded={showStats}
            >
              <span className="inline-flex h-2 w-2 rounded-full bg-primary" />
              {showStats ? "Hide Charts" : "Show Charts"}
            </button>
          </div>
        </div>

        {showStats ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {statItems.map((stat) => (
              <article key={stat.label} className="stat-card group">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-dark">{stat.value}</p>
                  </div>
                  <span className="stat-icon transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5">
                    {stat.icon}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <p className="text-subtle">{stat.detail}</p>
                  <span className={`font-semibold ${stat.trendTone}`}>{stat.trend}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="dashboard-card p-4 text-sm text-subtle">
            Charts are hidden. Click <span className="font-semibold text-dark">Show Charts</span> to display them.
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const isGrowthHistoryCard = card.to === "/history";
          const hasGrowthWarning = isGrowthHistoryCard && growthWarningCount > 0;
          return (
            <Link
              key={card.to}
              to={card.to}
              className="dashboard-card dashboard-card-hover group relative overflow-hidden p-5"
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.tone} opacity-[0.08] transition-opacity duration-200 group-hover:opacity-[0.16]`} />
              <div className="relative space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">{card.meta}</p>
                    {hasGrowthWarning ? (
                      <span className="inline-flex items-center rounded-full border border-rose-300/50 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700 dark:text-rose-300">
                        Alert
                      </span>
                    ) : null}
                  </div>
                  <span className="module-glyph">{card.icon}</span>
                </div>
                <h3 className="module-title">{card.title}</h3>
                <p className="page-description">{card.desc}</p>
                {hasGrowthWarning ? (
                  <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Warning jars: {growthWarningSummary}</p>
                ) : null}
                <p className="pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Open module</p>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="feedback-panel space-y-5">
        <div className="space-y-3">
          <div className="feedback-head">
            <div>
              <p className="kicker">Feedback</p>
              <h3 className="module-title">Share your feedback</h3>
              <p className="page-description">Help us improve this dashboard with practical input from daily use.</p>
            </div>
            <div className="feedback-pill">User voice matters</div>
          </div>
        </div>

        <form onSubmit={submitFeedback} className="space-y-3">
          <textarea
            value={feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              if (feedbackStatus) setFeedbackStatus("");
            }}
            rows={4}
            maxLength={500}
            placeholder="Write your feedback..."
            className="input-shell min-h-[124px] resize-y rounded-[16px]"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-subtle">{feedback.length}/500</p>
            <div className="flex gap-2">
              {editingId && (
                <button type="button" onClick={cancelEditFeedback} className="btn-soft">
                  Cancel Edit
                </button>
              )}
              <button type="submit" className="btn-primary px-5">
                {editingId ? "Update Feedback" : "Submit Feedback"}
              </button>
            </div>
          </div>
        </form>

        {feedbackStatus && (
          <p className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
            {feedbackStatus}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="module-title">Recent feedback</p>
            <span className="text-xs text-subtle">{feedbackList.length} stored</span>
          </div>
          {feedbackList.length ? (
            <div className="space-y-2.5">
              {feedbackList.slice(0, 5).map((item) => (
                <div key={item.id} className="dashboard-card dashboard-card-hover px-3.5 py-3">
                  <p className="text-sm text-dark">{item.message}</p>
                  <p className="mt-1 text-xs text-subtle">
                    {item.updatedAt
                      ? `Updated: ${new Date(item.updatedAt).toLocaleString()}`
                      : `Submitted: ${new Date(item.createdAt).toLocaleString()}`}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEditFeedback(item)}
                      className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/15"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFeedback(item.id)}
                      className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-rose-500/15 dark:text-rose-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-subtle">No feedback submitted yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatusPill({ label, ok }) {
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
        ok
          ? "border-emerald-300/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-300/45 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      <span className="font-medium">
        {label}: {ok ? "ready" : "unavailable"}
      </span>
    </div>
  );
}


