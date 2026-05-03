import { useEffect, useState } from "react";
import { auth } from "../../lib/firebase";

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000"
).replace(/\/$/, "");
const REMINDER_STORAGE_KEY = "orchid-care-reminders";

const reminderTypes = [
  { value: "watering", label: "Watering" },
  { value: "fertilizing", label: "Fertilizing" },
  { value: "repotting", label: "Repotting" },
  { value: "misting", label: "Misting" },
];

function readStoredReminders() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error reading saved reminders:", error);
    return [];
  }
}

function writeStoredReminders(nextReminders) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(nextReminders));
}

function normalizeReminder(reminder) {
  return {
    id: reminder.id || crypto.randomUUID(),
    title: reminder.title || "",
    type: reminder.type || "watering",
    reminderTime: reminder.reminderTime || reminder.reminder_time || new Date().toISOString(),
  };
}

async function buildAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function sortReminders(reminders) {
  return [...reminders].sort(
    (left, right) => new Date(left.reminderTime).getTime() - new Date(right.reminderTime).getTime()
  );
}

export default function ReminderTile() {
  const [reminders, setReminders] = useState([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("watering");
  const [reminderTime, setReminderTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [usesRemoteReminders, setUsesRemoteReminders] = useState(false);

  const fetchReminders = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reminders`, {
        headers: await buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Reminder request failed with ${response.status}.`);
      }

      const data = await response.json();
      const nextReminders = Array.isArray(data) ? data.map(normalizeReminder) : [];
      setReminders(sortReminders(nextReminders));
      setUsesRemoteReminders(true);
    } catch (error) {
      console.warn("Using local reminder storage:", error);
      setReminders(sortReminders(readStoredReminders().map(normalizeReminder)));
      setUsesRemoteReminders(false);
    }
  };

  useEffect(() => {
    void fetchReminders();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !reminderTime) {
      return;
    }

    setLoading(true);

    const nextReminder = {
      id: crypto.randomUUID(),
      title: title.trim(),
      type,
      reminderTime: new Date(reminderTime).toISOString(),
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/reminders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await buildAuthHeaders()),
        },
        body: JSON.stringify({
          title: nextReminder.title,
          type: nextReminder.type,
          reminderTime: nextReminder.reminderTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`Reminder create request failed with ${response.status}.`);
      }

      await fetchReminders();
    } catch (error) {
      console.warn("Saving reminder locally:", error);
      const nextReminders = sortReminders([nextReminder, ...readStoredReminders().map(normalizeReminder)]);
      writeStoredReminders(nextReminders);
      setReminders(nextReminders);
      setUsesRemoteReminders(false);
    } finally {
      setTitle("");
      setType("watering");
      setReminderTime("");
      setLoading(false);
    }
  };

  const deleteReminder = async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/reminders/${id}`, {
        method: "DELETE",
        headers: await buildAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Reminder delete request failed with ${response.status}.`);
      }

      await fetchReminders();
    } catch (error) {
      console.warn("Deleting reminder locally:", error);
      const nextReminders = readStoredReminders()
        .map(normalizeReminder)
        .filter((reminder) => reminder.id !== id);
      writeStoredReminders(nextReminders);
      setReminders(sortReminders(nextReminders));
      setUsesRemoteReminders(false);
    }
  };

  return (
    <section className="flex h-fit flex-col self-start rounded-2xl border border-border/60 bg-paper/95 p-4 text-dark shadow-lg dark:shadow-[0_18px_40px_-24px_rgba(2,6,23,0.8)]">
      <header className="mb-4 min-h-[84px]">
        <h2 className="text-xl font-bold text-dark">Reminder Planner</h2>
        <p className="text-sm text-subtle">
          {usesRemoteReminders
            ? "Reminders are loading from the backend."
            : "Reminders are currently saved in this browser."}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg border border-border/50 bg-paper/80 p-3">
        <input
          type="text"
          placeholder="Reminder title (e.g., Water orchid)"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded border border-border/70 bg-paper px-3 py-2 text-dark placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30"
          required
        />
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="w-full rounded border border-border/70 bg-paper px-3 py-2 text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {reminderTypes.map((reminderType) => (
            <option key={reminderType.value} value={reminderType.value}>
              {reminderType.label}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={reminderTime}
          onChange={(event) => setReminderTime(event.target.value)}
          className="w-full rounded border border-border/70 bg-paper px-3 py-2 text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-green-600 py-2 text-white transition hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Adding..." : "+ Set Reminder"}
        </button>
      </form>

      <div>
        <h3 className="mb-2 font-semibold text-dark">Upcoming Reminders</h3>
        {reminders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/50 bg-paper/40 p-3">
            <p className="text-sm text-subtle">No reminders yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {reminders.map((reminder) => (
              <li
                key={reminder.id}
                className="flex items-start justify-between rounded-lg border border-border/60 bg-paper/90 p-3"
              >
                <div>
                  <span className="font-medium text-dark">{reminder.title}</span>
                  <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    {reminder.type}
                  </span>
                  <div className="mt-1 text-xs text-subtle">
                    {new Date(reminder.reminderTime).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => deleteReminder(reminder.id)}
                  className="text-sm text-red-500 transition hover:text-red-400"
                  aria-label={`Delete reminder ${reminder.title}`}
                  type="button"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
