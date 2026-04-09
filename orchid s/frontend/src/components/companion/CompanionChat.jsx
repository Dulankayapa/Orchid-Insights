import React, { useState } from "react";
import { sendChatMessage } from "../../lib/companionApi";
import FeedbackWidget from "./FeedbackWidget";

export default function CompanionChat({ orchidId, sensorData }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const res = await sendChatMessage(text, sensorData?.temp, sensorData?.humidity, sensorData?.light, sensorData?.mq135);
      const botMsg = {
        role: "bot",
        content: res.response,
        confidence: res.confidence,
        suggestions: res.suggestions,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("chat", err);
      setMessages((prev) => [...prev, { role: "bot", content: "Sorry, I'm having trouble right now." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="companion-card h-full flex flex-col">
      <div className="flex-1 overflow-y-auto space-y-3">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[72%] rounded-xl p-3 text-sm ${msg.role === "user" ? "bg-primary/10" : "bg-surface"}`}>
              <p>{msg.content}</p>
              {msg.confidence !== undefined && (
                <p className="text-[11px] text-subtle mt-1">Confidence: {(msg.confidence * 100).toFixed(0)}%</p>
              )}
              {Array.isArray(msg.suggestions) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.suggestions.map((s, i) => (
                    <button key={i} type="button" onClick={() => setInput(s)} className="text-xs bg-surface px-2 py-1 rounded border">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {msg.role === "bot" && orchidId && <FeedbackWidget orchidId={orchidId} recommendationType="chat" />}
            </div>
          </div>
        ))}
        {loading && <div className="text-subtle text-sm">Typing...</div>}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="input-shell flex-1"
          placeholder="Ask about orchid care..."
        />
        <button type="button" onClick={handleSend} className="btn-primary px-4">
          Send
        </button>
      </div>
    </div>
  );
}
