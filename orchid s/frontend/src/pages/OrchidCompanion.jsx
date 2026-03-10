import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useMonitorData } from "../hooks/useMonitorData";
import { orchidQuizQuestions } from "../data/orchidQuizQuestions";
import "./OrchidCompanion.css";

const STORAGE = {
  watering: "oc-watering",
  rules: "oc-health-rules",
  tasks: "oc-care-tasks",
  tipOffset: "oc-tip-offset",
  favorites: "oc-tip-favorites",
};

const QUICK = [
  "How often should I water my orchid?",
  "How can I improve flowering?",
  "What to do when humidity is low?",
];

const DAILY_TIPS = [
  "Water in the morning so roots can dry slightly before night.",
  "Use bark-based mix for healthy orchid root airflow.",
  "Place orchids in bright indirect light for steady growth.",
  "Fertilize at low strength during active growth.",
  "Keep gentle airflow to reduce fungal issues.",
  "Repot when media breaks down or roots overfill the pot.",
  "Avoid standing water in orchid crowns after watering.",
  "Wipe leaves regularly to improve light absorption.",
  "A cooler night can support spike initiation.",
  "Healthy roots should be firm, not mushy.",
  "Use humidity trays but keep pots above water level.",
  "Rotate your pot to balance growth habit.",
];

const HEALTH_DEFAULTS = {
  temperature: { min: 18, max: 28, weight: 30, label: "Temperature", unit: "C", source: "temperature" },
  humidity: { min: 45, max: 70, weight: 25, label: "Humidity", unit: "%", source: "humidity" },
  light: { min: 2500, max: 18000, weight: 25, label: "Light", unit: "lx", source: "lux" },
  air: { min: 0, max: 170, weight: 20, label: "MQ135 / Air", unit: "", source: "mq135" },
};

const TASK_TYPES = ["watering", "fertilizing", "repotting", "checkup"];
const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const fmtDateInput = (d) => {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const y = x.getFullYear();
  const m = `${x.getMonth() + 1}`.padStart(2, "0");
  const day = `${x.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fmtDate = (d) => {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "--";
  return x.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const fmtMetric = (v, unit) => {
  const n = toNum(v);
  if (n === null) return "--";
  const digits = unit === "lx" || unit === "" ? 0 : 1;
  return unit ? `${n.toFixed(digits)} ${unit}` : n.toFixed(digits);
};
const readStore = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};
const writeStore = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
};
const sortTasks = (rows) =>
  [...rows].sort((a, b) => (a.date === b.date ? a.title.localeCompare(b.title) : a.date.localeCompare(b.date)));
const scoreRange = (value, min, max) => {
  const n = toNum(value);
  if (n === null) return 0;
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const span = Math.max(hi - lo, 1);
  if (n >= lo && n <= hi) return 100;
  const distance = n < lo ? lo - n : n - hi;
  return clamp(Math.round(100 - (distance / (span * 1.5)) * 100), 0, 100);
};
const scoreTone = (score) => {
  if (score >= 85) return { label: "Excellent", tone: "excellent" };
  if (score >= 70) return { label: "Good", tone: "good" };
  if (score >= 50) return { label: "Needs Attention", tone: "warning" };
  return { label: "Critical", tone: "critical" };
};
const countdownText = (target, now) => {
  if (!target) return { text: "Set the last watered date to start tracking.", overdue: false };
  const diff = target.getTime() - now;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const days = Math.floor(mins / 1440);
  const hrs = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  const short = `${days}d ${hrs}h ${m}m`;
  return diff >= 0 ? { text: `${short} remaining`, overdue: false } : { text: `Overdue by ${short}`, overdue: true };
};

export default function OrchidCompanion() {
  const { latest } = useMonitorData();
  const [nowMs, setNowMs] = useState(Date.now());

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [guideTitle, setGuideTitle] = useState("Orchid Companion Care Studio");
  const [guideSubtitle, setGuideSubtitle] = useState("Track care, score health, plan tasks, and practice with daily orchid learning.");
  const [quickQuestions, setQuickQuestions] = useState(QUICK);
  const [guideStatus, setGuideStatus] = useState({ loading: true, error: "" });
  const [messages, setMessages] = useState([
    { id: "welcome", role: "assistant", text: "Ask about watering, light, humidity, temperature, or blooming." },
  ]);

  const [watering, setWatering] = useState(() => {
    const saved = readStore(STORAGE.watering, {});
    return {
      lastWatered: typeof saved?.lastWatered === "string" ? saved.lastWatered : "",
      intervalDays: Math.round(clamp(toNum(saved?.intervalDays) ?? 5, 1, 30)),
    };
  });

  const [rules, setRules] = useState(() => ({ ...HEALTH_DEFAULTS, ...(readStore(STORAGE.rules, {}) || {}) }));
  const [editRules, setEditRules] = useState(false);

  const [tasks, setTasks] = useState(() => {
    const raw = readStore(STORAGE.tasks, []);
    if (!Array.isArray(raw)) return [];
    return sortTasks(
      raw
        .map((t, i) => ({
          id: String(t?.id || `task-${Date.now()}-${i}`),
          title: String(t?.title || "").trim(),
          type: TASK_TYPES.includes(t?.type) ? t.type : "checkup",
          date: String(t?.date || "").trim(),
          notes: String(t?.notes || "").trim(),
        }))
        .filter((t) => t.title && t.date)
    );
  });
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [taskDraft, setTaskDraft] = useState(() => ({
    id: "",
    title: "",
    type: "watering",
    date: fmtDateInput(new Date()),
    notes: "",
  }));
  const [taskError, setTaskError] = useState("");

  const [tipOffset, setTipOffset] = useState(() => Math.trunc(toNum(readStore(STORAGE.tipOffset, 0)) || 0));
  const [favoriteTips, setFavoriteTips] = useState(() => {
    const raw = readStore(STORAGE.favorites, []);
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : [];
  });

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizScore, setQuizScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setGuideStatus({ loading: true, error: "" });
      try {
        const [guideRes, quickRes] = await Promise.all([api.get("/companion/care-guide"), api.get("/companion/quick-questions")]);
        if (!mounted) return;
        if (guideRes?.data?.title) setGuideTitle(guideRes.data.title);
        if (guideRes?.data?.subtitle) setGuideSubtitle(guideRes.data.subtitle);
        if (Array.isArray(quickRes?.data?.questions) && quickRes.data.questions.length) {
          setQuickQuestions(quickRes.data.questions.slice(0, 5));
        }
      } catch (err) {
        if (!mounted) return;
        setGuideStatus({ loading: false, error: err.response?.data?.detail || "Companion guide load failed." });
        return;
      }
      if (mounted) setGuideStatus({ loading: false, error: "" });
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => writeStore(STORAGE.watering, watering), [watering]);
  useEffect(() => writeStore(STORAGE.rules, rules), [rules]);
  useEffect(() => writeStore(STORAGE.tasks, tasks), [tasks]);
  useEffect(() => writeStore(STORAGE.tipOffset, tipOffset), [tipOffset]);
  useEffect(() => writeStore(STORAGE.favorites, favoriteTips), [favoriteTips]);

  const sensors = useMemo(
    () => ({
      temperature: toNum(latest?.temperature),
      humidity: toNum(latest?.humidity),
      lux: toNum(latest?.lux),
      mq135: toNum(latest?.mq135),
    }),
    [latest]
  );

  const lastWateredDate = useMemo(() => {
    if (!watering.lastWatered) return null;
    const d = new Date(watering.lastWatered);
    return Number.isNaN(d.getTime()) ? null : d;
  }, [watering.lastWatered]);
  const nextWateringDate = useMemo(() => {
    if (!lastWateredDate) return null;
    const d = new Date(lastWateredDate);
    d.setDate(d.getDate() + Math.max(1, Math.round(toNum(watering.intervalDays) ?? 1)));
    return d;
  }, [lastWateredDate, watering.intervalDays]);
  const wateringCountdown = useMemo(() => countdownText(nextWateringDate, nowMs), [nextWateringDate, nowMs]);

  const health = useMemo(() => {
    const keys = Object.keys(HEALTH_DEFAULTS);
    const safeRules = keys.reduce((acc, key) => {
      const def = HEALTH_DEFAULTS[key];
      const c = rules?.[key] || {};
      acc[key] = {
        ...def,
        min: toNum(c.min) ?? def.min,
        max: toNum(c.max) ?? def.max,
        weight: clamp(Math.round(toNum(c.weight) ?? def.weight), 1, 100),
      };
      return acc;
    }, {});
    const totalWeight = keys.reduce((sum, key) => sum + safeRules[key].weight, 0) || 1;
    let score = 0;
    const breakdown = keys.map((key) => {
      const rule = safeRules[key];
      const value = sensors[rule.source];
      const itemScore = scoreRange(value, rule.min, rule.max);
      score += (itemScore * rule.weight) / totalWeight;
      return { key, value, itemScore, ...rule };
    });
    return { score: clamp(Math.round(score), 0, 100), tone: scoreTone(clamp(Math.round(score), 0, 100)), breakdown };
  }, [rules, sensors]);

  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!map[t.date]) map[t.date] = [];
      map[t.date].push(t);
    });
    return map;
  }, [tasks]);

  const monthCells = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const first = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i += 1) cells.push(null);
    for (let d = 1; d <= count; d += 1) cells.push(new Date(y, m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const monthLabel = useMemo(
    () =>
      month.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [month]
  );

  const today = fmtDateInput(new Date(nowMs));
  const selectedDayTasks = tasksByDate[taskDraft.date] || [];
  const upcomingTasks = useMemo(() => sortTasks(tasks.filter((t) => t.date >= today)).slice(0, 8), [tasks, today]);

  const tipBase = useMemo(() => {
    const d = new Date(nowMs);
    d.setHours(0, 0, 0, 0);
    const epochDay = Math.floor(d.getTime() / 86400000);
    return ((epochDay % DAILY_TIPS.length) + DAILY_TIPS.length) % DAILY_TIPS.length;
  }, [nowMs]);
  const tipIndex = ((tipBase + tipOffset) % DAILY_TIPS.length + DAILY_TIPS.length) % DAILY_TIPS.length;
  const activeTip = DAILY_TIPS[tipIndex];
  const isFavTip = favoriteTips.includes(activeTip);

  const totalQuiz = orchidQuizQuestions.length;
  const currentQuiz = orchidQuizQuestions[quizIndex];
  const selectedQuizOption = quizAnswers[quizIndex];
  const answeredNow = selectedQuizOption !== undefined;
  const answeredCount = Object.keys(quizAnswers).length;
  const quizPercent = Math.round((quizScore / totalQuiz) * 100);
  const quizTone = scoreTone(quizPercent);

  const askCompanion = async (question) => {
    const trimmed = String(question || "").trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: trimmed }].slice(-12));
    setInput("");
    setSending(true);
    try {
      const res = await api.post("/companion/chat", { message: trimmed, ...sensors });
      const text = res?.data?.response || "No response from assistant.";
      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, role: "assistant", text }].slice(-12));
      if (Array.isArray(res?.data?.suggestions) && res.data.suggestions.length) {
        setQuickQuestions(res.data.suggestions.slice(0, 5));
      }
    } catch (err) {
      const text = err.response?.data?.detail || "Companion service is not reachable right now.";
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", text }].slice(-12));
    } finally {
      setSending(false);
    }
  };

  const saveTask = (event) => {
    event.preventDefault();
    const title = taskDraft.title.trim();
    if (!title || !taskDraft.date) {
      setTaskError("Task title and date are required.");
      return;
    }
    const payload = {
      id: taskDraft.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      type: TASK_TYPES.includes(taskDraft.type) ? taskDraft.type : "checkup",
      date: taskDraft.date,
      notes: taskDraft.notes.trim(),
    };
    setTasks((prev) => sortTasks(taskDraft.id ? prev.map((t) => (t.id === taskDraft.id ? payload : t)) : [...prev, payload]));
    setTaskError("");
    setTaskDraft((prev) => ({ ...prev, id: "", title: "", type: "watering", notes: "" }));
  };

  return (
    <div className="orchid-companion-page">
      <section className="oc-hero panel">
        <div className="oc-hero-copy">
          <p className="kicker">Orchid Companion</p>
          <h1 className="oc-title">{guideTitle}</h1>
          <p className="oc-subtitle">{guideSubtitle}</p>
          {guideStatus.error && <p className="oc-error-text">{guideStatus.error}</p>}
          {guideStatus.loading && <p className="oc-muted-text">Loading companion guide...</p>}
        </div>
      </section>

      <section className="oc-grid oc-primary-grid">
        <article className="oc-card">
          <div className="oc-card-head">
            <h2>Companion Chat</h2>
            <p>Ask your orchid care question with live sensor context.</p>
          </div>
          <div className="oc-chip-row">
            {quickQuestions.map((q, i) => (
              <button key={`${q}-${i}`} type="button" className="oc-chip" onClick={() => askCompanion(q)} disabled={sending}>
                {q}
              </button>
            ))}
          </div>
          <div className="oc-chat-box">
            {messages.map((m) => (
              <div key={m.id} className={`oc-chat-bubble ${m.role === "user" ? "oc-chat-user" : "oc-chat-assistant"}`}>
                {m.text}
              </div>
            ))}
          </div>
          <form className="oc-form-row" onSubmit={(e) => { e.preventDefault(); askCompanion(input); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Orchid Companion..." className="oc-input" />
            <button type="submit" className="oc-primary-btn" disabled={sending}>{sending ? "Sending..." : "Send"}</button>
          </form>
        </article>

        <article className="oc-card oc-water-card">
          <div className="oc-card-head">
            <h2>Watering Countdown Timer</h2>
            <p>Track last watered date and next watering countdown.</p>
          </div>
          <div className="oc-water-metric">
            <div><span className="oc-metric-label">Last watered</span><strong>{lastWateredDate ? fmtDate(lastWateredDate) : "--"}</strong></div>
            <div><span className="oc-metric-label">Next watering</span><strong>{nextWateringDate ? fmtDate(nextWateringDate) : "--"}</strong></div>
          </div>
          <div className={`oc-countdown ${wateringCountdown.overdue ? "is-overdue" : ""}`}>{wateringCountdown.text}</div>
          <div className="oc-control-grid">
            <label>
              Last watered date
              <input
                type="date"
                value={lastWateredDate ? fmtDateInput(lastWateredDate) : ""}
                className="oc-input"
                onChange={(e) => setWatering((prev) => ({ ...prev, lastWatered: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : "" }))}
              />
            </label>
            <label>
              Interval (days)
              <input
                type="number"
                min={1}
                max={30}
                value={watering.intervalDays}
                className="oc-input"
                onChange={(e) => {
                  const n = toNum(e.target.value);
                  if (n === null) return;
                  setWatering((prev) => ({ ...prev, intervalDays: Math.round(clamp(n, 1, 30)) }));
                }}
              />
            </label>
          </div>
          <button type="button" className="oc-primary-btn" onClick={() => setWatering((prev) => ({ ...prev, lastWatered: new Date().toISOString() }))}>
            Mark as Watered
          </button>
        </article>
      </section>

      <section className="oc-grid oc-secondary-grid">
        <article className="oc-card">
          <div className="oc-card-head"><h2>Orchid Health Score</h2><p>0-100 score from temperature, humidity, light and MQ135.</p></div>
          <div className="oc-health-top">
            <div className={`oc-health-score tone-${health.tone.tone}`}>
              <span className="oc-health-score-value">{health.score}</span>
              <span className="oc-health-score-label">{health.tone.label}</span>
            </div>
            <div className="oc-health-controls">
              <button type="button" className="oc-soft-btn" onClick={() => setEditRules((v) => !v)}>{editRules ? "Hide Rules" : "Edit Rules"}</button>
              <button type="button" className="oc-soft-btn" onClick={() => setRules({ ...HEALTH_DEFAULTS })}>Reset Rules</button>
            </div>
          </div>
          <div className="oc-breakdown-table">
            <div className="oc-breakdown-head"><span>Metric</span><span>Current</span><span>Score</span><span>Weight %</span></div>
            {health.breakdown.map((item) => (
              <div key={item.key} className="oc-breakdown-row">
                <span>{item.label}</span><span>{fmtMetric(item.value, item.unit)}</span><span>{item.itemScore}</span><span>{item.weight}</span>
              </div>
            ))}
          </div>
          {editRules && (
            <div className="oc-rule-grid">
              {Object.keys(HEALTH_DEFAULTS).map((key) => (
                <div key={key} className="oc-rule-card">
                  <p>{HEALTH_DEFAULTS[key].label}</p>
                  <label>Min<input type="number" className="oc-input" value={rules[key].min} onChange={(e) => { const n = toNum(e.target.value); if (n !== null) setRules((prev) => ({ ...prev, [key]: { ...prev[key], min: n } })); }} /></label>
                  <label>Max<input type="number" className="oc-input" value={rules[key].max} onChange={(e) => { const n = toNum(e.target.value); if (n !== null) setRules((prev) => ({ ...prev, [key]: { ...prev[key], max: n } })); }} /></label>
                  <label>Weight<input type="number" className="oc-input" min={1} max={100} value={rules[key].weight} onChange={(e) => { const n = toNum(e.target.value); if (n !== null) setRules((prev) => ({ ...prev, [key]: { ...prev[key], weight: clamp(Math.round(n), 1, 100) } })); }} /></label>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="oc-card">
          <div className="oc-card-head"><h2>Orchid Care Tips of the Day</h2><p>Date-based tips with quick favorite save.</p></div>
          <div className="oc-tip-main"><p>{activeTip}</p></div>
          <div className="oc-tip-actions">
            <button type="button" className="oc-primary-btn" onClick={() => setTipOffset((v) => v + 1)}>Next Tip</button>
            <button type="button" className="oc-soft-btn" onClick={() => setFavoriteTips((prev) => (prev.includes(activeTip) ? prev.filter((x) => x !== activeTip) : [activeTip, ...prev].slice(0, 30)))}>{isFavTip ? "Unfavorite Tip" : "Favorite Tip"}</button>
          </div>
          <div className="oc-favorites">
            <p>Favorite tips</p>
            {favoriteTips.length ? <ul className="oc-favorite-list">{favoriteTips.slice(0, 5).map((tip) => <li key={tip}>{tip}</li>)}</ul> : <span className="oc-muted-text">No favorites yet.</span>}
          </div>
        </article>
      </section>

      <section className="oc-card">
        <div className="oc-card-head"><h2>Orchid Care Calendar</h2><p>Monthly planner with task add/edit and upcoming view.</p></div>
        <div className="oc-calendar-layout">
          <div className="oc-calendar-panel">
            <div className="oc-calendar-toolbar">
              <button type="button" className="oc-soft-btn" onClick={() => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>Prev</button>
              <strong>{monthLabel}</strong>
              <button type="button" className="oc-soft-btn" onClick={() => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>Next</button>
            </div>
            <div className="oc-calendar-grid">
              {WEEK.map((d) => <div key={d} className="oc-weekday">{d}</div>)}
              {monthCells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} className="oc-day-cell is-empty" />;
                const key = fmtDateInput(day);
                const isToday = key === today;
                const isSelected = key === taskDraft.date;
                const count = (tasksByDate[key] || []).length;
                return (
                  <button key={key} type="button" className={`oc-day-cell ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`} onClick={() => setTaskDraft((prev) => ({ ...prev, date: key }))}>
                    <span className="oc-day-number">{day.getDate()}</span>
                    {count > 0 && <span className="oc-day-dot">{count}</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="oc-calendar-side">
            <form onSubmit={saveTask} className="oc-task-form">
              <label>Task title<input type="text" className="oc-input" value={taskDraft.title} onChange={(e) => setTaskDraft((prev) => ({ ...prev, title: e.target.value }))} placeholder="Add orchid care task" /></label>
              <label>Task type<select className="oc-input" value={taskDraft.type} onChange={(e) => setTaskDraft((prev) => ({ ...prev, type: e.target.value }))}>{TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              <label>Date<input type="date" className="oc-input" value={taskDraft.date} onChange={(e) => setTaskDraft((prev) => ({ ...prev, date: e.target.value }))} /></label>
              <label>Notes<textarea rows={3} className="oc-input" value={taskDraft.notes} onChange={(e) => setTaskDraft((prev) => ({ ...prev, notes: e.target.value }))} /></label>
              {taskError && <p className="oc-error-text">{taskError}</p>}
              <div className="oc-inline-actions">
                <button type="submit" className="oc-primary-btn">{taskDraft.id ? "Update Task" : "Add Task"}</button>
                {taskDraft.id && <button type="button" className="oc-soft-btn" onClick={() => setTaskDraft((prev) => ({ ...prev, id: "", title: "", type: "watering", notes: "" }))}>Cancel</button>}
              </div>
            </form>
            <div className="oc-task-lists">
              <div>
                <p className="oc-list-title">Selected Day Tasks</p>
                {selectedDayTasks.length ? (
                  <div className="oc-task-list">
                    {selectedDayTasks.map((t) => (
                      <div key={t.id} className="oc-task-item">
                        <div>
                          <span className={`oc-task-type type-${t.type}`}>{t.type}</span>
                          <strong>{t.title}</strong>
                          {t.notes && <p>{t.notes}</p>}
                        </div>
                        <div className="oc-task-actions">
                          <button type="button" className="oc-soft-btn" onClick={() => setTaskDraft({ ...t })}>Edit</button>
                          <button type="button" className="oc-soft-btn danger" onClick={() => { setTasks((prev) => prev.filter((x) => x.id !== t.id)); if (taskDraft.id === t.id) setTaskDraft((prev) => ({ ...prev, id: "", title: "", type: "watering", notes: "" })); }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <span className="oc-muted-text">No tasks for this day.</span>}
              </div>
              <div>
                <p className="oc-list-title">Upcoming Tasks</p>
                {upcomingTasks.length ? (
                  <div className="oc-task-list">
                    {upcomingTasks.map((t) => (
                      <div key={t.id} className="oc-task-item compact">
                        <div><span className={`oc-task-type type-${t.type}`}>{t.type}</span><strong>{t.title}</strong><small>{fmtDate(t.date)}</small></div>
                      </div>
                    ))}
                  </div>
                ) : <span className="oc-muted-text">No upcoming tasks.</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="oc-card">
        <div className="oc-card-head"><h2>Orchid Care Quiz</h2><p>10+ multiple-choice questions with instant feedback.</p></div>
        {!quizDone ? (
          <div className="oc-quiz-wrap">
            <div className="oc-quiz-progress"><span>Question {quizIndex + 1} / {totalQuiz}</span><span>Score: {quizScore} | Answered: {answeredCount}</span></div>
            <h3>{currentQuiz.question}</h3>
            <div className="oc-options">
              {currentQuiz.options.map((opt, idx) => {
                let cls = "oc-option";
                if (answeredNow && idx === currentQuiz.answerIndex) cls += " correct";
                if (answeredNow && idx === selectedQuizOption && idx !== currentQuiz.answerIndex) cls += " incorrect";
                return <button key={`${currentQuiz.id}-${opt}`} type="button" className={cls} disabled={answeredNow} onClick={() => { if (answeredNow) return; setQuizAnswers((prev) => ({ ...prev, [quizIndex]: idx })); if (idx === currentQuiz.answerIndex) setQuizScore((s) => s + 1); }}>{opt}</button>;
              })}
            </div>
            {answeredNow && <div className={`oc-quiz-feedback ${selectedQuizOption === currentQuiz.answerIndex ? "ok" : "bad"}`}><p>{selectedQuizOption === currentQuiz.answerIndex ? "Correct answer." : "Not quite."}</p><span>{currentQuiz.explanation}</span></div>}
            <div className="oc-inline-actions">
              <button type="button" className="oc-primary-btn" disabled={!answeredNow} onClick={() => { if (!answeredNow) return; if (quizIndex === totalQuiz - 1) setQuizDone(true); else setQuizIndex((i) => i + 1); }}>{quizIndex === totalQuiz - 1 ? "Finish Quiz" : "Next Question"}</button>
            </div>
          </div>
        ) : (
          <div className="oc-quiz-result">
            <div className={`oc-health-score tone-${quizTone.tone}`}><span className="oc-health-score-value">{quizPercent}%</span><span className="oc-health-score-label">{quizTone.label}</span></div>
            <p>Final score: {quizScore} out of {totalQuiz}</p>
            <button type="button" className="oc-primary-btn" onClick={() => { setQuizDone(false); setQuizIndex(0); setQuizAnswers({}); setQuizScore(0); }}>Restart Quiz</button>
          </div>
        )}
      </section>
    </div>
  );
}
