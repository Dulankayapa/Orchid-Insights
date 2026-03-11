import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onValue, ref, remove, set, update } from "firebase/database";
import { db } from "../lib/firebase";
// Components
const emptyRecultureRow = { date: "", note: "" };
const newRecultureRow = () => ({ ...emptyRecultureRow });
const OPTIONS_PATH = "recultureOptions";
// Utility functions for normalizing and managing options
const normalizeOption = (value) => (value || "").trim();
const normalizeOptionKey = (value) => normalizeOption(value).toLowerCase();
// Ensures options are unique, cleaned, and sorted
const uniqueSortedOptions = (values) => {
  const map = new Map();
  (values || []).forEach((value) => {
    const cleaned = normalizeOption(value);
    if (!cleaned) return;
    map.set(normalizeOptionKey(cleaned), cleaned);
  });
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
};
// Builds options list from Firebase snapshot data
const buildOptionsFromSnapshot = (data) => {
  const racksRaw = Array.isArray(data?.racks) ? data.racks : Object.values(data?.racks || {});
  const orchidsRaw = Array.isArray(data?.orchids) ? data.orchids : Object.values(data?.orchids || {});
  return {
    racks: uniqueSortedOptions(racksRaw),
    orchids: uniqueSortedOptions(orchidsRaw),
  };
};
// Normalizes Jar ID input to ensure it starts with "J" followed by the rest of the input
const normalizeJarIdInput = (value) => {
  const next = (value || "").trimStart();
  if (!next) return value || "";
  return next[0].toLowerCase() === "j" ? `J${next.slice(1)}` : value;
};
// Builds options list from existing entries to seed Firebase options if they are missing
const buildOptionsFromEntries = (entries) => {
  const racks = new Map();
  const orchids = new Map();

  entries.forEach((entry) => {
    const rack = normalizeOption(entry.rackNo);
    if (rack) racks.set(normalizeOptionKey(rack), rack);
    const orchid = normalizeOption(entry.orchidType);
    if (orchid) orchids.set(normalizeOptionKey(orchid), orchid);
  });

  return {
    racks: Array.from(racks.values()).sort((a, b) => a.localeCompare(b)),
    orchids: Array.from(orchids.values()).sort((a, b) => a.localeCompare(b)),
  };
};
// Empty state component for displaying messages when there are no entries or options
export default function CultureDetails() {
  const [form, setForm] = useState({
    jarId: "",
    cultureDate: "",
    rackNo: "",
    orchidType: "",
    nutrition: "",
    addHormone: false,
    hormoneDetail: "",
    addSpecialNutrition: false,
    specialNutritionDetail: "",
    recultures: [newRecultureRow()],
  });
  const [entries, setEntries] = useState([]);// Firebase entries loaded from the database
  const [optionStore, setOptionStore] = useState({ racks: [], orchids: [] });// Options for racks and orchids loaded from Firebase
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsSeeded, setOptionsSeeded] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const isEditing = Boolean(selectedId);

  useEffect(() => {
    setOptionsLoading(true);
    setOptionsError("");
    const optionsRef = ref(db, OPTIONS_PATH);
    const unsubscribe = onValue(
      optionsRef,
      (snap) => {
        const next = buildOptionsFromSnapshot(snap.val() || {});
        setOptionStore(next);
        setOptionsLoading(false);
        setOptionsError("");
      },
      (err) => {
        setOptionsError(err?.message || "Failed to load Firebase options");
        setOptionsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

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
              addHormone: Boolean(entry.addHormone),
              hormoneDetail: entry.hormoneDetail || "",
              addSpecialNutrition: Boolean(entry.addSpecialNutrition),
              specialNutritionDetail: entry.specialNutritionDetail || "",
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

  useEffect(() => {
    if (optionsSeeded || optionsLoading) return;
    if (!entries.length) return;
    if (optionStore.racks.length || optionStore.orchids.length) {
      setOptionsSeeded(true);
      return;
    }

    const seeded = buildOptionsFromEntries(entries);
    if (!seeded.racks.length && !seeded.orchids.length) {
      setOptionsSeeded(true);
      return;
    }

    const updates = {};
    seeded.racks.forEach((rack) => {
      updates[`${OPTIONS_PATH}/racks/${normalizeOptionKey(rack)}`] = rack;
    });
    seeded.orchids.forEach((orchid) => {
      updates[`${OPTIONS_PATH}/orchids/${normalizeOptionKey(orchid)}`] = orchid;
    });

    update(ref(db), updates)
      .catch((err) => {
        setOptionsError(err?.message || "Failed to seed Firebase options");
      })
      .finally(() => {
        setOptionsSeeded(true);
      });
  }, [entries, optionStore, optionsLoading, optionsSeeded]);

  const selectedEntry = useMemo(() => {
    if (!selectedId) return null;
    return entries.find((e) => e.jarId.toLowerCase() === selectedId.toLowerCase()) || null;
  }, [entries, selectedId]);

  const rackOptions = optionStore.racks;
  const orchidOptions = optionStore.orchids;

  const handleField = (key) => (e) => {
    const nextValue = key === "jarId" ? normalizeJarIdInput(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: nextValue }));
  };

  const handleToggle = (key) => (e) => {
    const checked = Boolean(e.target.checked);
    setForm((prev) => {
      if (key === "addHormone" && !checked) {
        return { ...prev, addHormone: false, hormoneDetail: "" };
      }
      if (key === "addSpecialNutrition" && !checked) {
        return { ...prev, addSpecialNutrition: false, specialNutritionDetail: "" };
      }
      return { ...prev, [key]: checked };
    });
  };

  const applyOption = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setStatus("");
    setError("");
  };

  const addRackOption = (value) => {
    const cleaned = normalizeOption(value);
    if (!cleaned) return;
    setOptionsError("");
    set(ref(db, `${OPTIONS_PATH}/racks/${normalizeOptionKey(cleaned)}`), cleaned).catch((err) => {
      setOptionsError(err?.message || "Failed to save rack option");
    });
  };

  const updateRackOption = (fromValue, toValue) => {
    const cleaned = normalizeOption(toValue);
    if (!cleaned) return;
    const fromKey = normalizeOptionKey(fromValue);
    const toKey = normalizeOptionKey(cleaned);
    setOptionsError("");
    if (fromKey === toKey) {
      set(ref(db, `${OPTIONS_PATH}/racks/${toKey}`), cleaned).catch((err) => {
        setOptionsError(err?.message || "Failed to update rack option");
      });
      return;
    }
    update(ref(db), {
      [`${OPTIONS_PATH}/racks/${toKey}`]: cleaned,
      [`${OPTIONS_PATH}/racks/${fromKey}`]: null,
    }).catch((err) => {
      setOptionsError(err?.message || "Failed to update rack option");
    });
  };

  const deleteRackOption = (value) => {
    const key = normalizeOptionKey(value);
    if (!key) return;
    setOptionsError("");
    remove(ref(db, `${OPTIONS_PATH}/racks/${key}`)).catch((err) => {
      setOptionsError(err?.message || "Failed to delete rack option");
    });
  };

  const addOrchidOption = (value) => {
    const cleaned = normalizeOption(value);
    if (!cleaned) return;
    setOptionsError("");
    set(ref(db, `${OPTIONS_PATH}/orchids/${normalizeOptionKey(cleaned)}`), cleaned).catch((err) => {
      setOptionsError(err?.message || "Failed to save orchid option");
    });
  };

  const updateOrchidOption = (fromValue, toValue) => {
    const cleaned = normalizeOption(toValue);
    if (!cleaned) return;
    const fromKey = normalizeOptionKey(fromValue);
    const toKey = normalizeOptionKey(cleaned);
    setOptionsError("");
    if (fromKey === toKey) {
      set(ref(db, `${OPTIONS_PATH}/orchids/${toKey}`), cleaned).catch((err) => {
        setOptionsError(err?.message || "Failed to update orchid option");
      });
      return;
    }
    update(ref(db), {
      [`${OPTIONS_PATH}/orchids/${toKey}`]: cleaned,
      [`${OPTIONS_PATH}/orchids/${fromKey}`]: null,
    }).catch((err) => {
      setOptionsError(err?.message || "Failed to update orchid option");
    });
  };

  const deleteOrchidOption = (value) => {
    const key = normalizeOptionKey(value);
    if (!key) return;
    setOptionsError("");
    remove(ref(db, `${OPTIONS_PATH}/orchids/${key}`)).catch((err) => {
      setOptionsError(err?.message || "Failed to delete orchid option");
    });
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

  // Loads a selected entry into the form for viewing/editing
  const loadEntry = (entry) => {
    setForm({
      jarId: entry.jarId,
      cultureDate: entry.cultureDate,
      rackNo: entry.rackNo,
      orchidType: entry.orchidType,
      nutrition: entry.nutrition || "",
      addHormone: Boolean(entry.addHormone),
      hormoneDetail: entry.hormoneDetail || "",
      addSpecialNutrition: Boolean(entry.addSpecialNutrition),
      specialNutritionDetail: entry.specialNutritionDetail || "",
      recultures: entry.recultures && entry.recultures.length ? entry.recultures : [],
    });
    setSelectedId(entry.jarId);
    setStatus("");
    setError("");
  };

  // Clears the form to allow creating a new entry, and resets status and error messages
  const clearForm = () => {
    setForm({
      jarId: "",
      cultureDate: "",
      rackNo: "",
      orchidType: "",
      nutrition: "",
      addHormone: false,
      hormoneDetail: "",
      addSpecialNutrition: false,
      specialNutritionDetail: "",
      recultures: [newRecultureRow()],
    });
    setSelectedId("");
    setStatus("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    const jarId = normalizeJarIdInput(form.jarId).trim();
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
    if (form.addHormone && !form.hormoneDetail.trim()) {
      setError("Enter hormone details or untick Add hormone.");
      return;
    }
    if (form.addSpecialNutrition && !form.specialNutritionDetail.trim()) {
      setError("Enter special nutrition details or untick Add special nutrition.");
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
      addHormone: Boolean(form.addHormone),
      hormoneDetail: form.addHormone ? form.hormoneDetail.trim() : "",
      addSpecialNutrition: Boolean(form.addSpecialNutrition),
      specialNutritionDetail: form.addSpecialNutrition ? form.specialNutritionDetail.trim() : "",
      recultures: cleanedRecultures.sort((a, b) => new Date(a.date) - new Date(b.date)),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      await set(ref(db, `recultureEntries/${jarId}`), payload);
      setSelectedId(jarId);
      addRackOption(form.rackNo);
      addOrchidOption(form.orchidType);
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
          <OptionsPanel
            rackOptions={rackOptions}
            orchidOptions={orchidOptions}
            currentRack={form.rackNo}
            currentOrchid={form.orchidType}
            onSelectRack={(value) => applyOption("rackNo", value)}
            onSelectOrchid={(value) => applyOption("orchidType", value)}
            onAddRack={addRackOption}
            onUpdateRack={updateRackOption}
            onDeleteRack={deleteRackOption}
            onAddOrchid={addOrchidOption}
            onUpdateOrchid={updateOrchidOption}
            onDeleteOrchid={deleteOrchidOption}
            optionsLoading={optionsLoading}
            optionsError={optionsError}
          />
          <FormCard
            form={form}
            onFieldChange={handleField}
            onToggleField={handleToggle}
            rackOptions={rackOptions}
            orchidOptions={orchidOptions}
            isEditing={isEditing}
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
        <p className="kicker">Orchid Culture Manager</p>
        <h1 className="title-lg">OrchiLab</h1>
      </div>
    </motion.div>
  );
}

function FormCard({
  form,
  onFieldChange,
  onToggleField,
  rackOptions,
  orchidOptions,
  isEditing,
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearForm}
            className="btn-soft text-xs px-3 py-1.5"
          >
            Add new jar
          </button>
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary">Firebase</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Jar ID *">
          <input
            value={form.jarId}
            onChange={onFieldChange("jarId")}
            placeholder="e.g. Jar-42"
            disabled={isEditing}
            className={`input-shell ${isEditing ? "bg-paper/60 text-subtle cursor-not-allowed" : ""}`}
          />
        </Field>
        <Field label="Culture date *">
          <input
            type="date"
            value={form.cultureDate}
            onChange={onFieldChange("cultureDate")}
            disabled={isEditing}
            className={`input-shell ${isEditing ? "bg-paper/60 text-subtle cursor-not-allowed" : ""}`}
          />
          <p className="text-[11px] text-subtle mt-1">Entry date can differ from planting/culture date.</p>
        </Field>
        <Field label="Rack number *">
          <input
            value={form.rackNo}
            onChange={onFieldChange("rackNo")}
            placeholder="Rack or shelf location"
            list="rack-options"
            className="input-shell"
          />
          <datalist id="rack-options">
            {rackOptions.map((rack) => (
              <option key={rack} value={rack} />
            ))}
          </datalist>
        </Field>
        <Field label="Orchid type *">
          <input
            value={form.orchidType}
            onChange={onFieldChange("orchidType")}
            placeholder="e.g. Phalaenopsis"
            list="orchid-options"
            className="input-shell"
          />
          <datalist id="orchid-options">
            {orchidOptions.map((orchid) => (
              <option key={orchid} value={orchid} />
            ))}
          </datalist>
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

      <div className="rounded-2xl border border-border/45 bg-paper/70 px-4 py-4 space-y-3">
        <p className="text-sm font-semibold text-dark">Additives (optional)</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={Boolean(form.addHormone)}
              onChange={onToggleField("addHormone")}
              className="accent-primary"
            />
            Add hormone
          </label>
          <label className="flex items-center gap-2 text-sm text-dark">
            <input
              type="checkbox"
              checked={Boolean(form.addSpecialNutrition)}
              onChange={onToggleField("addSpecialNutrition")}
              className="accent-primary"
            />
            Add special nutrition
          </label>
        </div>

        {form.addHormone && (
          <Field label="Hormone details *">
            <input
              value={form.hormoneDetail || ""}
              onChange={onFieldChange("hormoneDetail")}
              placeholder="e.g. BA 1.0 mg/L + NAA 0.1 mg/L"
              className="input-shell py-2"
            />
          </Field>
        )}

        {form.addSpecialNutrition && (
          <Field label="Special nutrition details *">
            <input
              value={form.specialNutritionDetail || ""}
              onChange={onFieldChange("specialNutritionDetail")}
              placeholder="e.g. coconut water 10% + activated charcoal"
              className="input-shell py-2"
            />
          </Field>
        )}
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
          Reset form
        </button>
      </div>

      {isEditing && (
        <p className="text-xs text-subtle">
          Jar ID and culture date are locked while editing. Use "Add new jar" to create a new record.
        </p>
      )}

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

function OptionsPanel({
  rackOptions,
  orchidOptions,
  currentRack,
  currentOrchid,
  onSelectRack,
  onSelectOrchid,
  onAddRack,
  onUpdateRack,
  onDeleteRack,
  onAddOrchid,
  onUpdateOrchid,
  onDeleteOrchid,
  optionsLoading,
  optionsError,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Options</p>
          <h2 className="text-lg font-semibold text-dark">Rack & orchid categories</h2>
          <p className="text-sm text-subtle">
            Pick from saved values, or type a new one in the form below.
          </p>
        </div>
        <span className="text-xs text-subtle">
          {rackOptions.length + orchidOptions.length} total
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <OptionGroup
          label="Rack list"
          options={rackOptions}
          currentValue={currentRack}
          emptyMessage="No racks saved yet."
          onSelect={onSelectRack}
          onAdd={onAddRack}
          onUpdate={onUpdateRack}
          onDelete={onDeleteRack}
          inputPlaceholder="Add rack (e.g. R-3A)"
        />
        <OptionGroup
          label="Orchid category"
          options={orchidOptions}
          currentValue={currentOrchid}
          emptyMessage="No orchid types saved yet."
          onSelect={onSelectOrchid}
          onAdd={onAddOrchid}
          onUpdate={onUpdateOrchid}
          onDelete={onDeleteOrchid}
          inputPlaceholder="Add orchid (e.g. Phalaenopsis)"
        />
      </div>

      {optionsLoading && !optionsError && (
        <p className="text-xs text-subtle">Loading options from Firebase...</p>
      )}
      {optionsError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-2">
          Firebase options error: {optionsError}
        </p>
      )}
    </motion.div>
  );
}

function OptionGroup({
  label,
  options,
  currentValue,
  emptyMessage,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  inputPlaceholder,
}) {
  const [draft, setDraft] = useState("");
  const [filter, setFilter] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [editingOriginal, setEditingOriginal] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [addError, setAddError] = useState("");
  const [updateError, setUpdateError] = useState("");

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedFilter) return options;
    return options.filter((option) => option.toLowerCase().includes(normalizedFilter));
  }, [options, normalizedFilter]);

  const startEdit = (value) => {
    setEditingOriginal(value);
    setEditingValue(value);
  };

  const cancelEdit = () => {
    setEditingOriginal("");
    setEditingValue("");
  };

  const submitAdd = () => {
    const cleaned = normalizeOption(draft);
    if (!cleaned) return;
    if (options.some((item) => normalizeOptionKey(item) === normalizeOptionKey(cleaned))) {
      setAddError("Already exists.");
      return;
    }
    onAdd(cleaned);
    setDraft("");
    setAddError("");
  };

  const submitUpdate = () => {
    const cleaned = normalizeOption(editingValue);
    if (!cleaned) return;
    if (normalizeOptionKey(cleaned) !== normalizeOptionKey(editingOriginal)) {
      if (options.some((item) => normalizeOptionKey(item) === normalizeOptionKey(cleaned))) {
        setUpdateError("Already exists.");
        return;
      }
    }
    onUpdate(editingOriginal, cleaned);
    cancelEdit();
    setUpdateError("");
  };

  const selectOption = (value) => {
    onSelect(value);
    setIsOpen(false);
    setFilter("");
  };

  return (
    <div className="panel-muted px-4 py-3 space-y-2">
      <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">{label}</p>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (addError) setAddError("");
          }}
          placeholder={inputPlaceholder}
          className="input-shell py-2"
        />
        <button type="button" onClick={submitAdd} className="btn-primary text-xs px-3 py-2">
          Add
        </button>
      </div>
      {addError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-1.5">
          {addError}
        </p>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between rounded-xl border border-border/45 bg-paper/80 px-3 py-2 text-sm text-dark transition hover:border-primary/35"
      >
        <span className="text-left">
          <span className="block font-medium">{label}</span>
          {currentValue?.trim() && (
            <span className="block text-xs text-subtle">{currentValue}</span>
          )}
        </span>
        <span className="text-xs text-subtle">{isOpen ? "Hide" : "Show"}</span>
      </button>

      {isOpen && (
        <div className="rounded-xl border border-border/45 bg-paper/70 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search..."
              className="input-shell py-2"
            />
            <button type="button" onClick={() => setFilter("")} className="btn-soft text-xs px-3 py-2">
              Clear
            </button>
          </div>

          {filteredOptions.length ? (
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {filteredOptions.map((option) =>
                editingOriginal === option ? (
                  <div
                    key={option}
                    className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-xl border border-border/45 bg-paper/80 px-3 py-2"
                  >
                    <input
                      value={editingValue}
                      onChange={(e) => {
                        setEditingValue(e.target.value);
                        if (updateError) setUpdateError("");
                      }}
                      className="input-shell py-2 flex-1"
                    />
                    <button type="button" onClick={submitUpdate} className="btn-primary text-xs px-3 py-2">
                      Update
                    </button>
                    <button type="button" onClick={cancelEdit} className="btn-soft text-xs px-3 py-2">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(option);
                        cancelEdit();
                        setUpdateError("");
                      }}
                      className="rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 hover:border-rose-300 transition"
                    >
                      Delete
                    </button>
                    {updateError && (
                      <p className="text-xs text-rose-700 rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-1.5 w-full">
                        {updateError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    key={option}
                    className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 rounded-xl border border-border/45 bg-paper/80 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => selectOption(option)}
                      className="text-sm font-semibold text-dark hover:text-primary transition"
                    >
                      {option}
                    </button>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => startEdit(option)} className="btn-soft text-xs px-3 py-2">
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(option)}
                        className="rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 hover:border-rose-300 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-xs text-subtle">{options.length ? "No matches." : emptyMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="panel-muted px-4 py-8 text-center text-sm text-subtle">
      {message}
    </div>
  );
}

