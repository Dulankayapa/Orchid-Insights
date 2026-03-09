import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useMonitorData } from "../hooks/useMonitorData";
import "./OrchidCompanion.css";

const fallbackQuickQuestions = [
  "How often should I water my orchid?",
  "How do I improve orchid flowering?",
  "What should I do when humidity is low?",
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMetric = (value, unit) => {
  const num = toNumber(value);
  if (num === null) return "--";
  const digits = unit === "lx" ? 0 : 1;
  return `${num.toFixed(digits)} ${unit}`;
};

export default function OrchidCompanion() {
  const { latest } = useMonitorData();
  const [guide, setGuide] = useState(null);
  const [quickQuestions, setQuickQuestions] = useState(fallbackQuickQuestions);
  const [loadingGuide, setLoadingGuide] = useState(true);
  const [guideError, setGuideError] = useState("");

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Ask about watering, light, humidity, temperature, or blooming and I will suggest practical steps.",
    },
  ]);

  useEffect(() => {
    let mounted = true;

    const loadCompanionData = async () => {
      setLoadingGuide(true);
      setGuideError("");
      try {
        const [guideRes, quickRes] = await Promise.all([
          api.get("/companion/care-guide"),
          api.get("/companion/quick-questions"),
        ]);
        if (!mounted) return;
        setGuide(guideRes.data);
        const questions = quickRes.data?.questions;
        if (Array.isArray(questions) && questions.length) {
          setQuickQuestions(questions.slice(0, 5));
        }
      } catch (err) {
        if (!mounted) return;
        setGuideError(err.response?.data?.detail || err.message || "Failed to load companion data.");
      } finally {
        if (mounted) setLoadingGuide(false);
      }
    };

    loadCompanionData();
    return () => {
      mounted = false;
    };
  }, []);

  const sensorPayload = useMemo(
    () => ({
      temperature: toNumber(latest?.temperature),
      humidity: toNumber(latest?.humidity),
      lux: toNumber(latest?.lux),
      mq135: toNumber(latest?.mq135),
    }),
    [latest]
  );

  const askCompanion = async (question) => {
    const trimmed = String(question || "").trim();
    if (!trimmed || sending) return;

    const userMessage = { id: `u-${Date.now()}`, role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage].slice(-12));
    setInput("");
    setSending(true);

    try {
      const res = await api.post("/companion/chat", {
        message: trimmed,
        ...sensorPayload,
      });
      const botText = res.data?.response || "No response from assistant.";
      const botMessage = {
        id: `b-${Date.now()}`,
        role: "assistant",
        text: botText,
      };
      setMessages((prev) => [...prev, botMessage].slice(-12));
      if (Array.isArray(res.data?.suggestions) && res.data.suggestions.length) {
        setQuickQuestions(res.data.suggestions.slice(0, 5));
      }
    } catch (err) {
      const fallback = err.response?.data?.detail || "Companion service is not reachable right now.";
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", text: fallback }].slice(-12));
    } finally {
      setSending(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    askCompanion(input);
  };

  return (
    <div className="orchid-companion-page care-guide-page">
      <div className="care-guide-container">
        <div className="care-guide-header">
          <h1 className="care-guide-title">{guide?.title || "Orchid Care Guide"}</h1>
          <p className="care-guide-subtitle">
            {guide?.subtitle || "Practical orchid care guidance with a live companion assistant."}
          </p>
        </div>

        <div className="care-section ai-bot-section">
          <h2 className="section-title-bot">💬 Orchid Companion</h2>
          <p className="bot-intro">Use quick questions or ask your own care question.</p>

          <div className="companion-live-grid">
            <div className="companion-live-card">
              <span>Temperature</span>
              <strong>{formatMetric(sensorPayload.temperature, "C")}</strong>
            </div>
            <div className="companion-live-card">
              <span>Humidity</span>
              <strong>{formatMetric(sensorPayload.humidity, "%")}</strong>
            </div>
            <div className="companion-live-card">
              <span>Light</span>
              <strong>{formatMetric(sensorPayload.lux, "lx")}</strong>
            </div>
            <div className="companion-live-card">
              <span>MQ135</span>
              <strong>{sensorPayload.mq135 === null ? "--" : sensorPayload.mq135.toFixed(0)}</strong>
            </div>
          </div>

          <div className="quick-chip-row">
            {quickQuestions.map((question) => (
              <button key={question} type="button" className="quick-chip" onClick={() => askCompanion(question)} disabled={sending}>
                {question}
              </button>
            ))}
          </div>

          <div className="companion-chat-box">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role === "user" ? "chat-user" : "chat-assistant"}`}>
                {msg.text}
              </div>
            ))}
          </div>

          <form onSubmit={onSubmit} className="companion-form">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask orchid companion..."
              className="companion-input"
            />
            <button type="submit" className="companion-send" disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>

        {guideError && <p className="companion-error">{guideError}</p>}
        {loadingGuide && <p className="companion-loading">Loading companion guide...</p>}

        <div className="care-sections">
          {(guide?.sections || []).map((section) => (
            <div key={section.id} className="care-section">
              <div className="section-header">
                <div className="section-icon">{section.icon}</div>
                <h2>{section.title}</h2>
              </div>

              <div className="section-content">
                {Array.isArray(section.tips) && section.tips.length > 0 && (
                  <ul className="tips-list">
                    {section.tips.map((tip, index) => (
                      <li key={`${section.id}-tip-${index}`} className="tip-item">
                        <span className="tip-bullet">✓</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {Array.isArray(section.problems) && section.problems.length > 0 && (
                  <div className="problems-list">
                    {section.problems.map((problem, idx) => (
                      <div key={`${section.id}-problem-${idx}`} className="problem-item">
                        <div className="problem-symptom">{problem.symptom}</div>
                        <div className="problem-cause">
                          <div>Cause: {problem.cause}</div>
                          <div>Fix: {problem.fix}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {section.warning && (
                  <div className="tip-box warning-box">
                    <span className="tip-label">Warning:</span>
                    <span>{section.warning}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
