import { useEffect, useRef, useState } from "react";
import { auth } from "../../lib/firebase";
import { buildApiUrl } from "../../lib/apiBase";

const quickPrompts = [
  "When should I water a phalaenopsis?",
  "What does yellowing leaf mean?",
  "How much light do orchids need?",
];

const cannedResponses = [
  {
    test: /water|watering|thirst/i,
    text:
      "Water most orchids when the potting mix is close to dry, not on a fixed daily schedule. Roots should look silvery before watering and green again afterward.",
  },
  {
    test: /yellow|leaf|leaves/i,
    text:
      "A yellow leaf can mean normal aging, overwatering, or stress from temperature swings. Check whether the mix stays wet too long and whether only the oldest leaf is affected.",
  },
  {
    test: /light|sun|window/i,
    text:
      "Most common house orchids prefer bright, indirect light. An east window or filtered south light usually works better than harsh afternoon sun.",
  },
  {
    test: /root|roots/i,
    text:
      "Healthy orchid roots are usually firm. Green roots are hydrated, while silvery roots are ready for water. Mushy brown roots usually point to rot.",
  },
];

const defaultReply =
  "I can help with watering, light, roots, leaves, and basic orchid care planning. Ask a short question and I will give you a practical starting point.";

const initialMessages = [
  {
    id: 1,
    role: "assistant",
    text: "Ask about watering, light, roots, or leaf problems to get quick orchid-care guidance.",
  },
];

function buildReply(input) {
  const match = cannedResponses.find(({ test }) => test.test(input));
  return match ? match.text : defaultReply;
}

async function buildAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function CompanionChatTile() {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [usesRemoteChat, setUsesRemoteChat] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const sendMessage = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      text: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setIsTyping(true);

    try {
      const response = await fetch(buildApiUrl("/companion/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await buildAuthHeaders()),
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Companion chat request failed with ${response.status}.`);
      }

      const data = await response.json();
      const replyText = data?.reply?.trim();
      if (!replyText) {
        throw new Error("Companion chat payload was empty.");
      }

      setUsesRemoteChat(true);
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: replyText,
        },
      ]);
    } catch (error) {
      console.warn("Falling back to local orchid chat suggestions:", error);
      setUsesRemoteChat(false);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: buildReply(trimmed),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendMessage(draft);
  };

  return (
    <section className="flex h-[700px] flex-col rounded-2xl border border-border/60 bg-paper/95 p-4 text-dark shadow-lg dark:shadow-[0_18px_40px_-24px_rgba(2,6,23,0.8)]">
      <header className="mb-4 min-h-[84px]">
        <h2 className="text-xl font-bold text-gray-900">Orchid Care Chat</h2>
        <p className="text-sm text-gray-500">
          {usesRemoteChat
            ? "ChatGPT-backed orchid suggestions are active through the backend."
            : "A lightweight care assistant for quick orchid questions."}
        </p>
      </header>

      <div className="mb-4 flex min-h-[112px] flex-wrap content-start gap-2">
        {quickPrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => sendMessage(prompt)}
            disabled={isTyping}
            className="text-sm px-3 py-1.5 rounded-full bg-green-50 text-green-800 hover:bg-green-100 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto rounded-2xl bg-gray-50 p-4 space-y-3"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-6 ${
                message.role === "user"
                  ? "bg-green-600 text-white rounded-br-none"
                  : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-none px-4 py-2">
              <div className="flex gap-1">
                <span className="text-xl leading-none">.</span>
                <span className="text-xl leading-none">.</span>
                <span className="text-xl leading-none">.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask about watering, leaves, roots, or light"
          className="min-w-0 flex-1 border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={isTyping || !draft.trim()}
          className="bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </section>
  );
}
