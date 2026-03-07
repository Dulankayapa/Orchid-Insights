import { useMemo, useState } from "react";
import { useMonitorData } from "../../hooks/useMonitorData";

const LIMITS = {
  temperature: { min: 18, max: 35, unit: "C" },
  humidity: { min: 40, max: 80, unit: "%" },
  lux: { min: 50, max: 800, unit: "lx" },
  mq135: { min: 0, max: 2500, unit: "AQI" },
};

const QUICK_QUESTIONS = [
  "How do I care for orchids in hot weather?",
  "What should I do if humidity is low?",
  "How to fix slow plant height growth?",
  "Check my current environment and give actions.",
];

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const formatMetric = (value, unit) => (value === null ? "n/a" : `${value}${unit ? ` ${unit}` : ""}`);

const getLevel = (value, limits) => {
  if (value === null) return "unknown";
  if (value < limits.min) return "low";
  if (value > limits.max) return "high";
  return "good";
};

const average = (list) => {
  if (!list.length) return null;
  return list.reduce((sum, n) => sum + n, 0) / list.length;
};

const getTrend = (history, key) => {
  const values = (history || [])
    .map((row) => toNumber(row?.[key]))
    .filter((v) => v !== null)
    .slice(-12);

  if (values.length < 6) return "unknown";
  const middle = Math.floor(values.length / 2);
  const prevAvg = average(values.slice(0, middle));
  const currAvg = average(values.slice(middle));
  if (prevAvg === null || currAvg === null) return "unknown";

  const delta = currAvg - prevAvg;
  if (Math.abs(delta) < 0.75) return "stable";
  return delta > 0 ? "rising" : "falling";
};

const createBotAnswer = (question, { latest, history, alerts, growthLogs }) => {
  const q = String(question || "").toLowerCase();
  const temperature = toNumber(latest?.temperature);
  const humidity = toNumber(latest?.humidity);
  const light = toNumber(latest?.lux);
  const air = toNumber(latest?.mq135);
  const height = toNumber(latest?.height ?? latest?.height_mm);

  if (temperature === null && humidity === null && light === null && air === null) {
    return [
      "I cannot read live sensor values right now.",
      "Please check the Firebase feed, then ask again for condition-based care guidance.",
    ].join("\n");
  }

  const tempLevel = getLevel(temperature, LIMITS.temperature);
  const humLevel = getLevel(humidity, LIMITS.humidity);
  const lightLevel = getLevel(light, LIMITS.lux);
  const airLevel = getLevel(air, LIMITS.mq135);

  const topic = {
    temp: /temp|heat|cold|hot|cool/.test(q),
    humidity: /humidity|humid|dry|water|watering|root/.test(q),
    light: /light|lux|sun|shade/.test(q),
    air: /air|co2|gas|mq|ventilation/.test(q),
    height: /height|growth|stunted|tall|slow growth|size/.test(q),
    overall: /overall|environment|condition|all|check/.test(q),
  };

  if (!topic.temp && !topic.humidity && !topic.light && !topic.air && !topic.height && !topic.overall) {
    topic.overall = true;
  }

  const actions = [];

  if (topic.temp || topic.overall) {
    if (tempLevel === "low") actions.push("Raise temperature gradually by 1-2 C and avoid direct cold drafts.");
    if (tempLevel === "high") actions.push("Reduce midday heat load using airflow + light shading.");
    if (tempLevel === "good") actions.push("Temperature is in range; keep day/night swing near 6-10 C for better blooming.");
  }

  if (topic.humidity || topic.overall) {
    if (humLevel === "low") actions.push("Increase humidity with a tray/humidifier and reduce dry airflow spikes.");
    if (humLevel === "high") actions.push("Improve air circulation to reduce fungal risk at high humidity.");
    if (humLevel === "good") actions.push("Humidity is acceptable; keep watering consistent and roots aerated.");
  }

  if (topic.light || topic.overall) {
    if (lightLevel === "low") actions.push("Increase indirect light exposure duration or move closer to bright filtered light.");
    if (lightLevel === "high") actions.push("Use sheer shade during peak sun to prevent leaf stress.");
    if (lightLevel === "good") actions.push("Light level is balanced for stable growth.");
  }

  if (topic.air || topic.overall) {
    if (airLevel === "high") actions.push("Increase ventilation and check for stale enclosed air around plants.");
    if (airLevel === "good") actions.push("Air quality indicator is acceptable.");
  }

  if (topic.height) {
    const growthTrend = getTrend(history, "temperature");
    const humTrend = getTrend(history, "humidity");
    const latestGrowth = Array.isArray(growthLogs) && growthLogs.length ? growthLogs[0] : null;
    const growthLabel = latestGrowth?.predicted_label || latestGrowth?.classification || latestGrowth?.status || null;

    if (height !== null) actions.push(`Current reported plant height is ${height} mm. Track this weekly for trend confidence.`);
    actions.push("If height growth is slow, prioritize stable temperature, moderate humidity, and steady filtered light.");
    if (growthTrend !== "unknown") actions.push(`Temperature trend is ${growthTrend}; avoid sudden swings during active growth.`);
    if (humTrend !== "unknown") actions.push(`Humidity trend is ${humTrend}; keep root zone moisture and ambient humidity balanced.`);
    if (growthLabel) actions.push(`Latest growth classifier status: ${growthLabel}.`);
  }

  if (Array.isArray(alerts) && alerts.length) {
    actions.push(`Active alerts: ${alerts.slice(0, 2).map((a) => a.title).join(", ")}.`);
  }

  const snapshot = `Snapshot - Temp: ${formatMetric(temperature, "C")}, Humidity: ${formatMetric(humidity, "%")}, Light: ${formatMetric(light, "lx")}, Air: ${formatMetric(air, "AQI")}`;
  const lines = [snapshot, "Recommended actions:"];
  actions.forEach((item, idx) => lines.push(`${idx + 1}. ${item}`));

  if (!actions.length) {
    lines.push("1. Keep environment stable and ask a specific question for targeted care guidance.");
  }

  return lines.join("\n");
};

export default function OrchidAIBot({
  latest: latestProp,
  history: historyProp,
  alerts: alertsProp,
  growthLogs: growthLogsProp,
  compact = false,
}) {
  const monitor = useMonitorData();
  const latest = latestProp ?? monitor.latest;
  const history = historyProp ?? monitor.history;
  const alerts = alertsProp ?? monitor.alerts;
  const growthLogs = growthLogsProp ?? monitor.growthLogs;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "bot",
      text: "Ask me about orchid care, environment control, or height growth problems.",
    },
  ]);

  const context = useMemo(
    () => ({ latest, history, alerts, growthLogs }),
    [latest, history, alerts, growthLogs]
  );

  const askQuestion = (question) => {
    const q = String(question || "").trim();
    if (!q) return;

    const userMessage = { id: `u-${Date.now()}`, role: "user", text: q };
    const botMessage = {
      id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: "bot",
      text: createBotAnswer(q, context),
    };

    setMessages((prev) => [...prev, userMessage, botMessage].slice(-14));
    setInput("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    askQuestion(input);
  };

  return (
    <section className={`${compact ? "panel-muted p-3 space-y-3" : "panel space-y-4"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="kicker">Orchid Care</p>
          <h3 className={`${compact ? "text-base" : "text-xl"} font-semibold text-dark`}>
            {compact ? "Orchid Care" : "Small advanced care assistant"}
          </h3>
        </div>
        {!compact && (
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Context-aware
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(compact ? QUICK_QUESTIONS.slice(0, 2) : QUICK_QUESTIONS).map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => askQuestion(question)}
            className="rounded-lg border border-border/50 bg-paper px-2.5 py-1 text-xs text-subtle hover:border-primary/35 hover:text-primary"
          >
            {question}
          </button>
        ))}
      </div>

      <div className={`${compact ? "max-h-44" : "max-h-72"} space-y-2 overflow-y-auto rounded-2xl border border-border/40 bg-paper/65 p-3`}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded-xl px-3 py-2 text-sm whitespace-pre-line ${
              message.role === "user"
                ? "ml-auto max-w-[90%] border border-primary/25 bg-primary/10 text-dark"
                : "mr-auto max-w-[95%] border border-border/40 bg-paper text-dark"
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={compact ? "Ask orchid care question..." : "Ask about care, environment, or height problems..."}
          className="input-shell flex-1"
        />
        <button type="submit" className="btn-primary whitespace-nowrap">
          {compact ? "Ask" : "Ask Orchid Care"}
        </button>
      </form>
    </section>
  );
}
