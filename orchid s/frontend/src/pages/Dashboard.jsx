import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const FEEDBACK_STORAGE_KEY = "orchid-insights-dashboard-feedback";

const cards = [
  { title: "Growth Tracker", to: "/growth", tone: "from-teal-500/55 to-cyan-500/45", desc: "Model-backed growth classification and expected ranges." },
  { title: "Growth History", to: "/history", tone: "from-cyan-500/55 to-blue-500/45", desc: "Jar-based trend lines with comparison and rack filtering." },
  { title: "Culture Details", to: "/reculture", tone: "from-indigo-500/55 to-violet-500/45", desc: "Manage culture/reculture entries, racks, orchids, and nutrition records." },
  { title: "Plant Database", to: "/plants", tone: "from-emerald-500/55 to-teal-500/45", desc: "Searchable plant records synced from your backend." },
  { title: "Firebase Table", to: "/firebase", tone: "from-orange-400/55 to-emerald-500/45", desc: "Live jar sensor values in a compact data table." },
  { title: "Env Monitor", to: "/monitor", tone: "from-sky-500/55 to-teal-500/45", desc: "Real-time environment status with alerts and charts." },
];
const ORCHID_CLIP_DURATION_MS = 5000;
const orchidClipFrames = [
  "/orchid-clip/frame-1.jpg",
  "/orchid-clip/frame-2.jpg",
  "/orchid-clip/frame-3.jpg",
  "/orchid-clip/frame-4.jpg",
];

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
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
  const clipStepMs = Math.max(900, Math.floor(ORCHID_CLIP_DURATION_MS / Math.max(availableClipFrames.length, 1)));

  useEffect(() => {
    if (availableClipFrames.length <= 1) return undefined;

    const timer = window.setInterval(() => {
      setClipFrameIndex((prev) => (prev + 1) % availableClipFrames.length);
    }, clipStepMs);

    return () => window.clearInterval(timer);
  }, [availableClipFrames.length, clipStepMs]);

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

  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:items-stretch">
          <div className="space-y-4">
            <p className="kicker">Orchid Insights</p>
            <h2 className="title-lg">Orchid Insights Dashboard</h2>
            <p className="max-w-3xl text-sm text-subtle md:text-base">
              Growth analytics, plant database operations, and real-time environmental monitoring in one modern workspace.
            </p>

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

          <div className="relative h-[230px] w-full overflow-hidden rounded-3xl border border-white/50 bg-white/60 shadow-[0_26px_60px_-35px_rgba(15,23,42,0.65)] sm:h-[280px] lg:h-[320px] xl:h-[340px]">
            {currentClipFrame ? (
              <img
                key={currentClipFrame.src}
                src={currentClipFrame.src}
                alt="Blooming orchid cluster"
                className="h-full w-full object-cover object-center"
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
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/35 via-transparent to-transparent" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group relative overflow-hidden rounded-3xl border border-border/45 bg-paper/85 p-5 shadow-[0_24px_55px_-35px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_28px_65px_-34px_rgba(13,148,136,0.55)]"
          >
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.tone} opacity-10 transition-opacity group-hover:opacity-20`} />
            <div className="relative space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-subtle">Module</p>
              <h3 className="text-xl font-semibold text-dark">{card.title}</h3>
              <p className="text-sm text-subtle">{card.desc}</p>
              <p className="pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Open -&gt;</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="panel space-y-4">
        <div className="space-y-3">
          <p className="kicker">Feedback</p>
          <div className="relative h-28 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-cyan-100 via-white to-emerald-100">
            <div className="absolute -left-6 top-6 h-20 w-20 rounded-full bg-cyan-300/35 blur-sm" />
            <div className="absolute left-10 top-2 h-16 w-16 rounded-full bg-rose-300/30 blur-sm" />
            <div className="absolute right-8 top-8 h-14 w-14 rounded-full bg-teal-300/35 blur-sm" />
            <div className="absolute right-2 top-2 h-20 w-20 rounded-full bg-emerald-300/30 blur-sm" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full border border-white/70 bg-white/65 px-4 py-1 text-sm font-semibold text-primary shadow-sm backdrop-blur">
                Orchid Bloom
              </div>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-dark">Share your feed back</h3>
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
            className="input-shell resize-y"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-subtle">{feedback.length}/500</p>
            <div className="flex gap-2">
              {editingId && (
                <button type="button" onClick={cancelEditFeedback} className="btn-soft">
                  Cancel Edit
                </button>
              )}
              <button type="submit" className="btn-primary">
                {editingId ? "Update Feedback" : "Submit Feedback"}
              </button>
            </div>
          </div>
        </form>

        {feedbackStatus && (
          <p className="rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary">
            {feedbackStatus}
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-semibold text-dark">Recent feedback</p>
          {feedbackList.length ? (
            <div className="space-y-2">
              {feedbackList.slice(0, 5).map((item) => (
                <div key={item.id} className="panel-muted px-3 py-2">
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
                      className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFeedback(item.id)}
                      className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-500/15 dark:text-rose-300"
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


