import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

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

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [showStats, setShowStats] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [feedbackList, setFeedbackList] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [clipFrameIndex, setClipFrameIndex] = useState(0);
  const [failedClipFrames, setFailedClipFrames] = useState([]);

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
  const activeSensorServices = health
    ? [health.model_loaded, health.firebase_connected, health.status === "ok"].filter(Boolean).length
    : 0;
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
      value: health ? `${activeSensorServices}/3` : "--",
      icon: "\u{1F4F6}",
      detail: health ? "Core services reporting live" : "Waiting for health telemetry",
      trend: health ? "Live now" : "Pending",
      trendTone: health ? "text-primary" : "text-amber-600 dark:text-amber-400",
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
      value: error ? "1" : "0",
      icon: "\u{1F514}",
      detail: error ? "Health warning needs review" : "No blocking alerts",
      trend: error ? "Check now" : "All clear",
      trendTone: error ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="hero-glass relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/35 via-transparent to-primary/10 dark:from-white/5" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-stretch">
          <div className="space-y-4">
            <p className="kicker">Orchid Insights</p>
            <h2 className="title-lg">Orchid Insights Dashboard</h2>
            <p className="page-description max-w-3xl">
              Growth analytics, plant database operations, and real-time environmental monitoring in one modern workspace.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="chip-subtle">7 active modules</span>
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
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="dashboard-card dashboard-card-hover group relative overflow-hidden p-5"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.tone} opacity-[0.08] transition-opacity duration-200 group-hover:opacity-[0.16]`} />
            <div className="relative space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">{card.meta}</p>
                <span className="module-glyph">{card.icon}</span>
              </div>
              <h3 className="module-title">{card.title}</h3>
              <p className="page-description">{card.desc}</p>
              <p className="pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Open module</p>
            </div>
          </Link>
        ))}
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


