import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

const emptyRecultureRow = { date: "", note: "" };
const newRecultureRow = () => ({ ...emptyRecultureRow });

// Mock database seed for testing when no backend is wired up yet
const mockRecultureData = [
  {
    jarId: "Jar-12",
    cultureDate: "2024-11-02",
    rackNo: "R-3A",
    orchidType: "Phalaenopsis",
    nutrition: "MS medium + 2% sucrose",
    recultures: [
      { date: "2025-02-01", note: "Media refresh" },
      { date: "2025-05-10", note: "Split into 3" },
    ],
    updatedAt: "2025-05-10T10:00:00Z",
  },
  {
    jarId: "Jar-19",
    cultureDate: "2024-10-14",
    rackNo: "R-1C",
    orchidType: "Cattleya",
    nutrition: "Vacin & Went + coconut water",
    recultures: [
      { date: "2025-01-20", note: "Added GA3" },
      { date: "2025-04-22", note: "Reduced sucrose" },
      { date: "2025-07-15", note: "Rooting" },
    ],
    updatedAt: "2025-07-15T14:00:00Z",
  },
];

export default function CultureDetails() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [form, setForm] = useState({
    jarId: "",
    cultureDate: "",
    rackNo: "",
    orchidType: "",
    nutrition: "",
    recultures: [newRecultureRow()],
  });
  const [entries, setEntries] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("reculture-entries");
      if (raw) return JSON.parse(raw);
      return mockRecultureData;
    } catch {
      return mockRecultureData;
    }
  });
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    localStorage.setItem("reculture-entries", JSON.stringify(entries));
  }, [entries]);

  const selectedEntry = useMemo(() => {
    if (!selectedId) return null;
    return entries.find((e) => e.jarId.toLowerCase() === selectedId.toLowerCase()) || null;
  }, [entries, selectedId]);

  const handleField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleRecultureChange = (idx, key, value) => {
    setForm((prev) => {
      const next = prev.recultures.map((row, i) => (i === idx ? { ...row, [key]: value } : row));
      return { ...prev, recultures: next };
    });
  };

  const addRecultureRow = () => {
    setForm((prev) => ({ ...prev, recultures: [...prev.recultures, newRecultureRow()] }));
  };

  const removeRecultureRow = (idx) => {
    setForm((prev) => {
      const next = prev.recultures.filter((_, i) => i !== idx);
      return { ...prev, recultures: next };
    });
  };

  const loadEntry = (entry) => {
    setForm({
      jarId: entry.jarId,
      cultureDate: entry.cultureDate,
      rackNo: entry.rackNo,
      orchidType: entry.orchidType,
      nutrition: entry.nutrition || "",
      recultures: entry.recultures && entry.recultures.length ? entry.recultures : [],
    });
    setSelectedId(entry.jarId);
    setStatus("");
    setError("");
  };

  const clearForm = () => {
    setForm({ jarId: "", cultureDate: "", rackNo: "", orchidType: "", nutrition: "", recultures: [newRecultureRow()] });
    setSelectedId("");
    setStatus("");
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    const jarId = form.jarId.trim();
    if (!jarId) {
      setError("Jar ID is required.");
      return;
    }
    if (!form.cultureDate) {
      setError("Culture date is required.");
      return;
    }
    if (!form.rackNo.trim()) {
      setError("Rack number is required.");
      return;
    }
    if (!form.orchidType.trim()) {
      setError("Orchid type is required.");
      return;
    }
    if (!form.nutrition.trim()) {
      setError("Nutrition / medium is required.");
      return;
    }

    const cleanedRecultures = form.recultures
      .map((row) => ({ date: row.date, note: row.note?.trim() || "" }))
      .filter((row) => row.date);

    const payload = {
      jarId,
      cultureDate: form.cultureDate,
      rackNo: form.rackNo,
      orchidType: form.orchidType,
      nutrition: form.nutrition,
      recultures: cleanedRecultures.sort((a, b) => new Date(a.date) - new Date(b.date)),
      updatedAt: new Date().toISOString(),
    };

    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.jarId.toLowerCase() === jarId.toLowerCase());
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = payload;
        return next;
      }
      return [...prev, payload];
    });

    setSelectedId(jarId);
    setStatus(`Saved ${jarId} with ${payload.recultures.length} re-culture dates.`);
  };

  return (
    <div className="relative space-y-8 text-slate-900">
      <Backdrop />
      <Hero isLight={isLight} />

      <div className="grid lg:grid-cols-3 gap-6 relative">
        <div className="lg:col-span-2 space-y-6">
          <FormCard
            isLight={isLight}
            form={form}
            onFieldChange={handleField}
            onRecultureChange={handleRecultureChange}
            addRecultureRow={addRecultureRow}
            removeRecultureRow={removeRecultureRow}
            onSubmit={handleSubmit}
            clearForm={clearForm}
            status={status}
            error={error}
          />
        </div>
        <JarList isLight={isLight} entries={entries} selectedId={selectedId} onSelect={loadEntry} />
      </div>

      {selectedEntry && <Timeline isLight={isLight} entry={selectedEntry} />}
    </div>
  );
}

function Hero({ isLight }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={`relative overflow-hidden rounded-3xl p-8 shadow-[0_32px_80px_-30px_rgba(216,45,139,0.3)] ${isLight ? "bg-white border border-pink-200" : "border border-fuchsia-100 bg-white/95"}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-white to-pink-50 pointer-events-none" />
      <div className="relative space-y-3">
        <p className="text-xs uppercase tracking-[0.32em] text-primary font-bold">Re-culture planner</p>
        <h1 className="text-3xl font-semibold text-slate-900">Track jar metadata and re-culture cycles</h1>
        <p className="text-slate-700 text-sm md:text-base max-w-2xl">
          Add Jar ID, culture date, rack number, orchid type, and the nutrition/medium used. Log as many future re-culture dates as the plant needs; updating the same Jar ID replaces the prior record.
        </p>
      </div>
    </motion.div>
  );
}

function FormCard({
  isLight,
  form,
  onFieldChange,
  onRecultureChange,
  addRecultureRow,
  removeRecultureRow,
  onSubmit,
  clearForm,
  status,
  error,
}) {
  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`space-y-6 rounded-3xl p-6 shadow-[0_30px_78px_-30px_rgba(216,45,139,0.32)] ${isLight ? "bg-white border border-pink-200" : "border border-fuchsia-100 bg-white/95"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-primary font-bold">Jar details</p>
          <h2 className="text-xl font-semibold text-slate-900">Create or update a jar</h2>
        </div>
        <span className="text-xs text-slate-500">Local only</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Jar ID *">
          <input
            value={form.jarId}
            onChange={onFieldChange("jarId")}
            placeholder="e.g. Jar-42"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary"
          />
        </Field>
        <Field label="Culture date *">
          <input
            type="date"
            value={form.cultureDate}
            onChange={onFieldChange("cultureDate")}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary"
          />
          <p className="text-[11px] text-slate-500 mt-1">Entry date can differ from planting/culture date.</p>
        </Field>
        <Field label="Rack number *">
          <input
            value={form.rackNo}
            onChange={onFieldChange("rackNo")}
            placeholder="Rack or shelf location"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary"
          />
        </Field>
        <Field label="Orchid type *">
          <input
            value={form.orchidType}
            onChange={onFieldChange("orchidType")}
            placeholder="e.g. Phalaenopsis"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary"
          />
        </Field>
        <Field label="Nutrition / medium *">
          <textarea
            rows={3}
            value={form.nutrition}
            onChange={onFieldChange("nutrition")}
            placeholder="e.g. MS + 3% sucrose + BA. Add additives, hormones, notes."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary min-h-[96px] resize-vertical"
          />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Re-culture dates (optional)</p>
          <button
            type="button"
            onClick={addRecultureRow}
            className="text-xs rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-primary hover:border-primary hover:bg-primary/10 transition"
          >
            Add re-culture details
          </button>
        </div>

        <div className="space-y-3">
          {form.recultures.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              No re-culture dates yet. You can save the jar now and add dates later.
            </div>
          )}
          {form.recultures.map((row, idx) => (
            <div
              key={idx}
              className={`grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-center rounded-2xl border px-4 py-3 shadow-sm ${isLight ? "border-pink-100 bg-slate-50/60" : "border-pink-100 bg-slate-50/60"}`}
            >
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Re-culture date {idx + 1}</label>
                <input
                  type="date"
                  value={row.date}
                  onChange={(e) => onRecultureChange(idx, "date", e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-600">Notes (optional)</label>
                <input
                  value={row.note || ""}
                  onChange={(e) => onRecultureChange(idx, "note", e.target.value)}
                  placeholder="Media change, split count, etc."
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              <div className="flex justify-end sm:justify-center items-center h-full">
                <button
                  type="button"
                  onClick={() => removeRecultureRow(idx)}
                  className="text-xs text-rose-700 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded-lg hover:border-rose-300 transition"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-purple-500 text-white font-semibold px-4 py-3 shadow-glow"
        >
          Save jar
        </button>
        <button
          type="button"
          onClick={clearForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 hover:border-slate-300"
        >
          Clear
        </button>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {status}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}

function JarList({ entries, selectedId, onSelect, isLight }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className={`rounded-3xl p-6 shadow-[0_24px_65px_-30px_rgba(216,45,139,0.28)] space-y-4 ${isLight ? "bg-white border border-pink-200" : "border border-fuchsia-100 bg-white/95"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Jars</p>
          <h3 className="text-lg font-semibold text-slate-900">Saved records</h3>
        </div>
        <span className="text-xs text-slate-500">{entries.length} total</span>
      </div>

      {entries.length ? (
        <div className="space-y-2 max-h-[24rem] overflow-auto pr-1">
          {entries.map((entry) => {
            const nextReculture = entry.recultures.find((r) => new Date(r.date) >= new Date());
            return (
              <button
                key={entry.jarId}
                onClick={() => onSelect(entry)}
            className={`w-full text-left rounded-xl border px-4 py-3 transition shadow-sm ${selectedId && selectedId.toLowerCase() === entry.jarId.toLowerCase()
                    ? "border-pink-300 bg-primary/10 text-primary shadow-md"
                    : `${isLight ? "border-pink-100 bg-slate-50" : "border-pink-100 bg-slate-50/60"} hover:border-pink-300 hover:bg-primary/5 hover:shadow-md`
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">{entry.jarId}</p>
                    <p className="text-xs text-slate-600">
                      Culture: {entry.cultureDate} - Rack: {entry.rackNo || "---"} - {entry.orchidType || "Type N/A"}
                    </p>
                    <p className="text-[11px] text-slate-500">Nutrition: {entry.nutrition || "Not noted"}</p>
                  </div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                    {entry.recultures.length} dates
                  </span>
                </div>
                {nextReculture && (
                  <p className="text-xs text-emerald-700 mt-1">
                    Next re-culture: {nextReculture.date}
                    {nextReculture.note ? ` - ${nextReculture.note}` : ""}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState message="No jars yet. Save one to see it here." />
      )}
    </motion.div>
  );
}

function Timeline({ entry, isLight }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`rounded-3xl p-6 shadow-[0_26px_70px_-30px_rgba(216,45,139,0.28)] space-y-4 ${isLight ? "bg-white border border-pink-200" : "border border-fuchsia-100 bg-white/95"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-emerald-500">Timeline</p>
          <h3 className="text-lg font-semibold text-slate-900">Re-culture trail for {entry.jarId}</h3>
        </div>
        <span className="text-xs text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50">
          {entry.recultures.length} planned
        </span>
      </div>

      {entry.recultures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          No re-culture dates logged yet. Add them later without changing the jar ID.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entry.recultures.map((row, idx) => (
            <div key={`${entry.jarId}-${row.date}-${idx}`} className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600">Re-culture {idx + 1}</p>
              <p className="text-lg font-semibold text-slate-900 mt-1">{row.date}</p>
              {row.note ? <p className="text-sm text-slate-700 mt-1">{row.note}</p> : <p className="text-sm text-slate-500 mt-1">No notes</p>}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm text-slate-700">
        Culture date: {entry.cultureDate} - Rack: {entry.rackNo || "---"} - Orchid: {entry.orchidType || "Not specified"} - Nutrition: {entry.nutrition || "Not noted"}
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

function Field({ label, children }) {
  return (
    <label className="block text-sm text-slate-800 space-y-2">
      <span className="text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
      {message}
    </div>
  );
}
