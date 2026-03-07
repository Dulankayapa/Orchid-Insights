import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onValue, ref, set } from "firebase/database";
import { db } from "../lib/firebase";

const emptyRecultureRow = { date: "", note: "" };
const newRecultureRow = () => ({ ...emptyRecultureRow });

export default function CultureDetails() {
  const [form, setForm] = useState({
    jarId: "",
    cultureDate: "",
    rackNo: "",
    orchidType: "",
    nutrition: "",
    recultures: [newRecultureRow()],
  });
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoadingEntries(true);
    const entriesRef = ref(db, "recultureEntries");
    const unsubscribe = onValue(
      entriesRef,
      (snap) => {
        const data = snap.val() || {};
        const next = Object.entries(data)
          .map(([key, value]) => {
            const entry = value && typeof value === "object" ? value : {};
            return {
              jarId: entry.jarId || key,
              cultureDate: entry.cultureDate,
              rackNo: entry.rackNo,
              orchidType: entry.orchidType,
              nutrition: entry.nutrition,
              recultures: Array.isArray(entry.recultures) ? entry.recultures : [],
              updatedAt: entry.updatedAt,
            };
          })
          .filter((entry) => entry.jarId);
        setEntries(next);
        setEntriesError("");
        setLoadingEntries(false);
      },
      (err) => {
        setEntriesError(err?.message || "Failed to load Firebase entries");
        setEntries([]);
        setLoadingEntries(false);
      }
    );

    return () => unsubscribe();
  }, []);

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

  const handleSubmit = async (e) => {
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

    setSaving(true);
    try {
      await set(ref(db, `recultureEntries/${jarId}`), payload);
      setSelectedId(jarId);
      setStatus(`Saved ${jarId} with ${payload.recultures.length} re-culture dates.`);
    } catch (err) {
      setError(err?.message || "Failed to save to Firebase.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <Hero />

      <div className="grid lg:grid-cols-3 gap-6 relative">
        <div className="lg:col-span-2 space-y-6">
          <FormCard
            form={form}
            onFieldChange={handleField}
            onRecultureChange={handleRecultureChange}
            addRecultureRow={addRecultureRow}
            removeRecultureRow={removeRecultureRow}
            onSubmit={handleSubmit}
            clearForm={clearForm}
            status={status}
            error={error}
            entriesError={entriesError}
            loadingEntries={loadingEntries}
            saving={saving}
          />
        </div>
        <JarList entries={entries} selectedId={selectedId} onSelect={loadEntry} />
      </div>

      {selectedEntry && <Timeline entry={selectedEntry} />}
    </div>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="panel relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
      <div className="relative space-y-3">
        <p className="kicker">Re-culture planner</p>
        <h1 className="title-lg">Jar Meta Data</h1>
      </div>
    </motion.div>
  );
}

function FormCard({
  form,
  onFieldChange,
  onRecultureChange,
  addRecultureRow,
  removeRecultureRow,
  onSubmit,
  clearForm,
  status,
  error,
  entriesError,
  loadingEntries,
  saving,
}) {
  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Jar details</p>
          <h2 className="text-lg font-semibold text-dark">Create or update a jar</h2>
        </div>
        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary">Firebase</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Jar ID *">
          <input
            value={form.jarId}
            onChange={onFieldChange("jarId")}
            placeholder="e.g. Jar-42"
            className="input-shell"
          />
        </Field>
        <Field label="Culture date *">
          <input
            type="date"
            value={form.cultureDate}
            onChange={onFieldChange("cultureDate")}
            className="input-shell"
          />
          <p className="text-[11px] text-subtle mt-1">Entry date can differ from planting/culture date.</p>
        </Field>
        <Field label="Rack number *">
          <input
            value={form.rackNo}
            onChange={onFieldChange("rackNo")}
            placeholder="Rack or shelf location"
            className="input-shell"
          />
        </Field>
        <Field label="Orchid type *">
          <input
            value={form.orchidType}
            onChange={onFieldChange("orchidType")}
            placeholder="e.g. Phalaenopsis"
            className="input-shell"
          />
        </Field>
        <Field label="Nutrition / medium *">
          <textarea
            rows={3}
            value={form.nutrition}
            onChange={onFieldChange("nutrition")}
            placeholder="e.g. MS + 3% sucrose + BA. Add additives, hormones, notes."
            className="input-shell min-h-[96px] resize-y"
          />
        </Field>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-dark">Re-culture dates (optional)</p>
          <button
            type="button"
            onClick={addRecultureRow}
            className="btn-soft text-xs px-3 py-1.5"
          >
            Add re-culture details
          </button>
        </div>

        <div className="space-y-3">
          {form.recultures.length === 0 && (
            <div className="panel-muted border-dashed px-4 py-3 text-xs text-subtle">
              No re-culture dates yet. You can save the jar now and add dates later.
            </div>
          )}
          {form.recultures.map((row, idx) => (
            <div
              key={idx}
              className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-center rounded-2xl border border-border/45 bg-paper/70 px-4 py-3 shadow-sm"
            >
              <div className="space-y-1">
                <label className="text-xs text-subtle">Re-culture date {idx + 1}</label>
                <input
                  type="date"
                  value={row.date}
                  onChange={(e) => onRecultureChange(idx, "date", e.target.value)}
                  className="input-shell py-2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-subtle">Notes (optional)</label>
                <input
                  value={row.note || ""}
                  onChange={(e) => onRecultureChange(idx, "note", e.target.value)}
                  placeholder="Media change, split count, etc."
                  className="input-shell py-2"
                />
              </div>
              <div className="flex justify-end sm:justify-center items-center h-full">
                <button
                  type="button"
                  onClick={() => removeRecultureRow(idx)}
                  className="rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-700 hover:border-rose-300 transition"
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
          disabled={saving}
          className="btn-primary px-4 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save jar"}
        </button>
        <button
          type="button"
          onClick={clearForm}
          className="btn-soft px-4 py-3"
        >
          Clear
        </button>
      </div>

      {loadingEntries && !entriesError && (
        <p className="text-xs text-subtle">Loading Firebase entries...</p>
      )}
      {entriesError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-2">
          Firebase error: {entriesError}
        </p>
      )}

      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-primary"
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
            className="rounded-xl border border-rose-200/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}

function JarList({ entries, selectedId, onSelect }) {
  const [query, setQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) return entries;
    return entries.filter((entry) => entry.jarId.toLowerCase().includes(normalizedQuery));
  }, [entries, normalizedQuery]);

  useEffect(() => {
    if (!query.trim()) setSearchMessage("");
  }, [query]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!normalizedQuery) {
      setSearchMessage("Type a Jar ID to search.");
      return;
    }
    const match = entries.find((entry) => entry.jarId.toLowerCase() === normalizedQuery);
    if (match) {
      onSelect(match);
      setSearchMessage(`Loaded ${match.jarId} from search.`);
    } else {
      setSearchMessage("No jar found with that ID.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker">Jars</p>
          <h3 className="text-lg font-semibold text-dark">Saved records</h3>
        </div>
        <span className="text-xs text-subtle">{entries.length} total</span>
      </div>

      <form onSubmit={handleSearch} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Jar ID (e.g. Jar-12)"
            className="input-shell flex-1"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="btn-soft text-xs px-3 py-1.5"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="btn-primary text-xs px-3 py-1.5"
          >
            Search
          </button>
        </div>
        {searchMessage && <p className="text-[11px] text-subtle px-1">{searchMessage}</p>}
      </form>

      {entries.length ? (
        filteredEntries.length ? (
          <div className="space-y-2 max-h-[24rem] overflow-auto pr-1">
            {filteredEntries.map((entry) => {
              const nextReculture = entry.recultures.find((r) => new Date(r.date) >= new Date());
              const isSelected = selectedId && selectedId.toLowerCase() === entry.jarId.toLowerCase();
              return (
                <button
                  key={entry.jarId}
                  onClick={() => onSelect(entry)}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition shadow-sm ${
                    isSelected
                      ? "border-primary/35 bg-primary/10 text-primary shadow-md"
                      : "border-border/45 bg-paper/70 text-dark hover:border-primary/35 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{entry.jarId}</p>
                      <p className="text-xs text-subtle">
                        Culture: {entry.cultureDate} - Rack: {entry.rackNo || "---"} - {entry.orchidType || "Type N/A"}
                      </p>
                      <p className="text-[11px] text-subtle">Nutrition: {entry.nutrition || "Not noted"}</p>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                      {entry.recultures.length} dates
                    </span>
                  </div>
                  {nextReculture && (
                    <p className="text-xs text-primary mt-1">
                      Next re-culture: {nextReculture.date}
                      {nextReculture.note ? ` - ${nextReculture.note}` : ""}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState message="No jars match that ID. Try another search." />
        )
      ) : (
        <EmptyState message="No jars yet. Save one to see it here." />
      )}
    </motion.div>
  );
}

function Timeline({ entry }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker">Timeline</p>
          <h3 className="text-lg font-semibold text-dark">Re-culture trail for {entry.jarId}</h3>
        </div>
        <span className="text-xs text-primary px-3 py-1 rounded-full border border-primary/25 bg-primary/10">
          {entry.recultures.length} planned
        </span>
      </div>

      {entry.recultures.length === 0 ? (
        <div className="panel-muted border-dashed px-4 py-3 text-sm text-subtle">
          No re-culture dates logged yet. Add them later without changing the jar ID.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entry.recultures.map((row, idx) => (
            <div key={`${entry.jarId}-${row.date}-${idx}`} className="panel-muted px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-primary/85">Re-culture {idx + 1}</p>
              <p className="text-lg font-semibold text-dark mt-1">{row.date}</p>
              {row.note ? (
                <p className="text-sm text-subtle mt-1">{row.note}</p>
              ) : (
                <p className="text-sm text-subtle mt-1">No notes</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="panel-muted px-4 py-3 text-sm text-subtle">
        Culture date: {entry.cultureDate} - Rack: {entry.rackNo || "---"} - Orchid: {entry.orchidType || "Not specified"} - Nutrition: {entry.nutrition || "Not noted"}
      </div>
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm text-subtle space-y-2">
      <span className="text-dark">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ message }) {
  return (
    <div className="panel-muted px-4 py-8 text-center text-sm text-subtle">
      {message}
    </div>
  );
}
