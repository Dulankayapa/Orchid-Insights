import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onValue, push, ref, remove, set, update } from "firebase/database";
import { jsPDF } from "jspdf";
import { db } from "../lib/firebase";
import { encodeFirebaseKeySegment } from "../lib/firebaseKeys";
// Components
const emptyRecultureRow = { date: "", note: "" };
const newRecultureRow = () => ({ ...emptyRecultureRow });
const newSplitJarRow = () => ({
  newJarId: "",
  recultureDate: "",
  nutritionType: "",
  rackLocation: "",
  plantCount: "",
  notes: "",
});
const newSameJarReculture = () => ({
  recultureDate: "",
  nutritionType: "",
  plantCount: "",
  notes: "",
});
const NEW_CULTURE = "NEW_CULTURE";
const RECULTURE_WITHOUT_SUB = "WITHOUT_SUBCULTURE";
const RECULTURE_WITH_SUB = "WITH_SUBCULTURE";
const REMOVAL_REASON_CONTAMINATION = "CONTAMINATION";
const REMOVAL_REASON_GREENHOUSE = "MOVED_TO_GREENHOUSE";
const REMOVAL_REASON_OPTIONS = [
  { value: REMOVAL_REASON_CONTAMINATION, label: "Contamination" },
  { value: REMOVAL_REASON_GREENHOUSE, label: "Moved to greenhouse" },
];
const OPTIONS_PATH = "recultureOptions";
const LABEL_TYPE_ALL = "all";
const LABEL_TYPE_CULTURE = "culture";
const LABEL_TYPE_RECULTURE = "reculture";
const PRINT_MODE_JAR = "jar";
const PRINT_MODE_RACK = "rack";
const LABEL_WIDTH_IN = 2;
const LABEL_HEIGHT_IN = 0.7;
const QR_SIZE_IN = 0.52;
const IN_TO_MM = 25.4;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const LABEL_COLUMNS = 3;
const LABEL_X_GAP_MM = 4;
const LABEL_Y_GAP_MM = 4;
const LABEL_MARGIN_Y_MM = 12;

const normalizeDateValue = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toISOString().slice(0, 10);
};

const buildQrImageUrl = (jarId) => {
  const payload = String(jarId || "").trim();
  if (!payload) return "";
  return `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&margin=1&size=300&dark=111827&light=ffffff`;
};

const fetchQrDataUrlForJarId = async (jarId) => {
  const url = buildQrImageUrl(jarId);
  if (!url || typeof fetch !== "function") return "";
  const response = await fetch(url);
  if (!response.ok) throw new Error(`QR request failed (${response.status})`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result?.toString() || "");
    reader.onerror = () => reject(new Error("QR read failed"));
    reader.readAsDataURL(blob);
  });
};

const buildJarLabelRows = (entries) => {
  const rows = [];
  (entries || []).forEach((entry) => {
    const jarId = String(entry?.jarId || "").trim();
    if (!jarId) return;

    const parentJarId = normalizeLinkedJarId(entry?.directParentJarId || entry?.parentJarId || "");
    const cultureDate = normalizeDateValue(entry?.cultureDate);
    const createdByReculture = Boolean(parentJarId);

    if (cultureDate) {
      rows.push({
        id: `${createdByReculture ? "child" : "culture"}:${normalizeOptionKey(jarId)}:${cultureDate}`,
        jarId,
        type: createdByReculture ? LABEL_TYPE_RECULTURE : LABEL_TYPE_CULTURE,
        eventDate: cultureDate,
        eventLabel: createdByReculture ? "Re-culture date" : "Culture date",
        orchidType: entry?.orchidType || "",
        rackNo: entry?.rackNo || "",
      });
    }

    const recRows = Array.isArray(entry?.recultures) ? entry.recultures : [];
    recRows.forEach((row, idx) => {
      const date = normalizeDateValue(row?.date || row?.recultureDate || row?.cultureDate || "");
      if (!date) return;
      rows.push({
        id: `reculture:${normalizeOptionKey(jarId)}:${date}:${idx}`,
        jarId,
        type: LABEL_TYPE_RECULTURE,
        eventDate: date,
        eventLabel: "Re-culture date",
        orchidType: entry?.orchidType || "",
        rackNo: entry?.rackNo || "",
      });
    });
  });

  return rows.sort((a, b) => {
    const dateA = a.eventDate || "";
    const dateB = b.eventDate || "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    return a.jarId.localeCompare(b.jarId, undefined, { numeric: true, sensitivity: "base" });
  });
};
// Utility functions for normalizing and managing options
const normalizeOption = (value) => (value || "").trim();
const normalizeOptionKey = (value) => normalizeOption(value).toLowerCase();
const getRemovalReasonLabel = (value) => {
  const option = REMOVAL_REASON_OPTIONS.find((item) => item.value === value);
  return option?.label || "Removed";
};
const findRackTypeConflict = ({ entries, rackNo, orchidType, ignoreJarId = "" }) => {
  const rackKey = normalizeOptionKey(rackNo);
  const orchidKey = normalizeOptionKey(orchidType);
  const ignoreKey = normalizeOptionKey(ignoreJarId);
  if (!rackKey || !orchidKey) return null;

  for (const entry of entries || []) {
    const entryJarKey = normalizeOptionKey(entry?.jarId);
    if (ignoreKey && entryJarKey === ignoreKey) continue;
    if (normalizeOptionKey(entry?.rackNo) !== rackKey) continue;
    const existingTypeKey = normalizeOptionKey(entry?.orchidType);
    if (!existingTypeKey || existingTypeKey === orchidKey) continue;
    return {
      rackNo: entry?.rackNo || rackNo,
      orchidType: entry?.orchidType || "",
      jarId: entry?.jarId || "",
    };
  }
  return null;
};
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
const normalizeLinkedJarId = (value) => normalizeJarIdInput(value || "").trim();
const readDirectParentJarId = (entry) =>
  normalizeLinkedJarId(
    entry?.directParentJarId ||
      entry?.direct_parent_jar_id ||
      entry?.sourceJarId ||
      entry?.source_jar_id ||
      entry?.parentJarId ||
      entry?.parentJarID ||
      entry?.parentJar ||
      entry?.parent_id ||
      entry?.parent_jar_id ||
      ""
  );
const normalizeRecultureMode = (value, parentJarId = "") => {
  const raw = String(value || "").trim().toLowerCase();
  if (["subculture", "sub_culture", "split", "with_subculture", "with-subculture"].includes(raw)) return "subculture";
  if (["samejar", "same_jar", "same", "reculture", "without_subculture", "without-subculture", "new_culture"].includes(raw)) return "sameJar";
  return parentJarId ? "subculture" : "sameJar";
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
    recultureMode: "sameJar",
    parentJarId: "",
    cultureDate: "",
    rackNo: "",
    orchidType: "",
    nutrition: "",
    plantCount: "",
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
  const [reculturePanelOpen, setReculturePanelOpen] = useState(false);
  const [recultureSearch, setRecultureSearch] = useState("");
  const [selectedRecultureJarId, setSelectedRecultureJarId] = useState("");
  const [recultureType, setRecultureType] = useState("");
  const [sameJarReculture, setSameJarReculture] = useState(newSameJarReculture());
  const [splitRows, setSplitRows] = useState([newSplitJarRow()]);
  const [jarLabelOpen, setJarLabelOpen] = useState(false);
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
            const directParentJarId = readDirectParentJarId(entry);
            const parentJarId = directParentJarId;
            return {
              jarId: entry.jarId || key,
              recultureMode: normalizeRecultureMode(
                entry.recultureMode || entry.reCultureMode || entry.reculture_type,
                parentJarId
              ),
              parentJarId,
              directParentJarId,
              cultureDate: entry.cultureDate || entry.culture_date || entry.plant_date || "",
              rackNo: entry.rackNo || entry.rack_location || "",
              orchidType: entry.orchidType || entry.plant_type || "",
              nutrition: entry.nutrition || entry.nutrition_type || "",
              plantCount: entry.plantCount ?? entry.plant_count ?? entry.seedCount ?? entry.seed_count ?? "",
              addHormone: Boolean(entry.addHormone),
              hormoneDetail: entry.hormoneDetail || "",
              addSpecialNutrition: Boolean(entry.addSpecialNutrition),
              specialNutritionDetail: entry.specialNutritionDetail || "",
              recultures: Array.isArray(entry.recultures) ? entry.recultures : [],
              isRemoved: Boolean(entry.isRemoved || entry.removed || entry.status === "removed"),
              removedReason: entry.removedReason || entry.removalReason || entry.removed_reason || "",
              removedAt: entry.removedAt || entry.removed_at || "",
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
  const selectedRecultureEntry = useMemo(() => {
    if (!selectedRecultureJarId) return null;
    return entries.find((e) => e.jarId.toLowerCase() === selectedRecultureJarId.toLowerCase()) || null;
  }, [entries, selectedRecultureJarId]);

  const rackOptions = optionStore.racks;
  const orchidOptions = optionStore.orchids;
  const recultureSearchRows = useMemo(() => {
    const activeEntries = entries.filter((entry) => !entry.isRemoved);
    const term = recultureSearch.trim().toLowerCase();
    if (!term) return activeEntries.slice(0, 8);
    return activeEntries.filter((entry) => {
      const haystack = [
        entry.jarId,
        entry.orchidType,
        entry.rackNo,
      ]
        .map((v) => String(v || "").toLowerCase())
        .join(" ");
      return haystack.includes(term);
    }).slice(0, 12);
  }, [entries, recultureSearch]);

  const handleField = (key) => (e) => {
    const nextValue = ["jarId", "parentJarId"].includes(key) ? normalizeJarIdInput(e.target.value) : e.target.value;
    setForm((prev) => ({ ...prev, [key]: nextValue }));
  };
  const openReculturePanel = () => {
    setReculturePanelOpen(true);
    setRecultureType("");
    setSameJarReculture(newSameJarReculture());
    setSplitRows([newSplitJarRow()]);
    setRecultureSearch("");
    setSelectedRecultureJarId(selectedId || "");
    setStatus("Search and select an existing jar to start re-culturing.");
    setError("");
  };
  const closeReculturePanel = () => {
    setReculturePanelOpen(false);
    setRecultureType("");
    setSameJarReculture(newSameJarReculture());
    setSplitRows([newSplitJarRow()]);
    setRecultureSearch("");
    setSelectedRecultureJarId("");
    setStatus("");
    setError("");
  };
  const selectRecultureSource = (entry) => {
    if (!entry?.jarId) return;
    const sourceId = entry.jarId;
    setSelectedRecultureJarId(sourceId);
    setSelectedId(sourceId);
    setRecultureSearch(sourceId);
    setRecultureType("");
    setSameJarReculture({
      ...newSameJarReculture(),
      plantCount: String(entry.plantCount || "").trim(),
    });
    setSplitRows([newSplitJarRow()]);
    setStatus(`Selected ${sourceId}. Choose re-culture option.`);
    setError("");
  };
  const updateSameJarRecultureField = (key, value) => {
    setSameJarReculture((prev) => ({ ...prev, [key]: value }));
  };
  const updateSplitRow = (idx, key, value) => {
    setSplitRows((prev) => prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row)));
  };
  const addSplitRow = () => {
    setSplitRows((prev) => [...prev, newSplitJarRow()]);
  };
  const removeSplitRow = (idx) => {
    setSplitRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [newSplitJarRow()];
    });
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

  // Loads a selected entry into the form for viewing/editing
  const loadEntry = (entry) => {
    const normalizedParent = readDirectParentJarId(entry);
    setForm({
      jarId: entry.jarId,
      recultureMode: normalizeRecultureMode(entry.recultureMode || entry.reculture_type, normalizedParent),
      parentJarId: normalizedParent,
      cultureDate: entry.cultureDate,
      rackNo: entry.rackNo,
      orchidType: entry.orchidType,
      nutrition: entry.nutrition || "",
      plantCount: entry.plantCount ?? "",
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
      recultureMode: "sameJar",
      parentJarId: "",
      cultureDate: "",
      rackNo: "",
      orchidType: "",
      nutrition: "",
      plantCount: "",
      addHormone: false,
      hormoneDetail: "",
      addSpecialNutrition: false,
      specialNutritionDetail: "",
      recultures: [newRecultureRow()],
    });
    setSelectedId("");
    setReculturePanelOpen(false);
    setRecultureSearch("");
    setSelectedRecultureJarId("");
    setRecultureType("");
    setSameJarReculture(newSameJarReculture());
    setSplitRows([newSplitJarRow()]);
    setStatus("");
    setError("");
  };

  const markJarRemoved = async (jarId, removalReason) => {
    const targetJarId = normalizeLinkedJarId(jarId);
    if (!targetJarId) return;
    if (!REMOVAL_REASON_OPTIONS.some((option) => option.value === removalReason)) {
      setStatus("");
      setError("Select a valid removal reason.");
      return;
    }

    const targetEntry = entries.find((entry) => normalizeOptionKey(entry.jarId) === normalizeOptionKey(targetJarId));
    if (!targetEntry) {
      setStatus("");
      setError(`Jar ${targetJarId} was not found.`);
      return;
    }
    if (targetEntry.isRemoved) {
      setStatus("");
      setError(`Jar ${targetJarId} is already marked as removed.`);
      return;
    }

    const reasonLabel = getRemovalReasonLabel(removalReason);
    const shouldMark =
      typeof window === "undefined"
        ? true
        : window.confirm(`Mark ${targetJarId} as removed (${reasonLabel})?`);
    if (!shouldMark) return;

    const nowIso = new Date().toISOString();
    const removalDate = nowIso.slice(0, 10);
    const updatedRecultures = [
      ...(Array.isArray(targetEntry.recultures) ? targetEntry.recultures : []),
      {
        date: removalDate,
        note: `End of lab life: ${reasonLabel}`,
        recultureType: "REMOVED",
        removedReason: removalReason,
        createdAt: nowIso,
      },
    ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await update(ref(db, `recultureEntries/${encodeFirebaseKeySegment(targetJarId)}`), {
        isRemoved: true,
        removed: true,
        status: "removed",
        removedReason: removalReason,
        removalReason: removalReason,
        removed_reason: removalReason,
        removedAt: nowIso,
        removed_at: nowIso,
        recultures: updatedRecultures,
        updatedAt: nowIso,
      });
      if (normalizeOptionKey(selectedRecultureJarId) === normalizeOptionKey(targetJarId)) {
        setSelectedRecultureJarId("");
      }
      await appendCultureRecord({
        jar_id: targetJarId,
        parent_jar_id: targetEntry.parentJarId || "",
        plant_date: targetEntry.cultureDate || "",
        plant_type: targetEntry.orchidType || "",
        nutrition_type: targetEntry.nutrition || "",
        rack_location: targetEntry.rackNo || "",
        plant_count: String(targetEntry.plantCount || ""),
        seed_count: String(targetEntry.plantCount || ""),
        reculture_type: "REMOVED",
        reculture_date: removalDate,
        removed_reason: removalReason,
        created_at: nowIso,
      });
      setStatus(`Marked ${targetJarId} as removed: ${reasonLabel}.`);
    } catch (err) {
      setError(err?.message || `Failed to mark ${targetJarId} as removed.`);
    } finally {
      setSaving(false);
    }
  };

  const restoreJarRemoval = async (jarId) => {
    const targetJarId = normalizeLinkedJarId(jarId);
    if (!targetJarId) return;

    const shouldRestore =
      typeof window === "undefined"
        ? true
        : window.confirm(`Restore ${targetJarId} as active jar?`);
    if (!shouldRestore) return;

    const nowIso = new Date().toISOString();
    setSaving(true);
    setStatus("");
    setError("");
    try {
      await update(ref(db, `recultureEntries/${encodeFirebaseKeySegment(targetJarId)}`), {
        isRemoved: false,
        removed: false,
        status: "active",
        removedReason: "",
        removalReason: "",
        removed_reason: "",
        removedAt: "",
        removed_at: "",
        updatedAt: nowIso,
      });
      setStatus(`Restored ${targetJarId} as active.`);
    } catch (err) {
      setError(err?.message || `Failed to restore ${targetJarId}.`);
    } finally {
      setSaving(false);
    }
  };

  const deleteJarEntry = async (jarId) => {
    const targetJarId = normalizeLinkedJarId(jarId);
    if (!targetJarId) return;

    const childJars = entries
      .filter((entry) => normalizeOptionKey(entry.directParentJarId || entry.parentJarId) === normalizeOptionKey(targetJarId))
      .map((entry) => entry.jarId);
    if (childJars.length) {
      setStatus("");
      setError(`Cannot delete ${targetJarId}. Delete child jars first: ${childJars.join(", ")}.`);
      return;
    }

    const shouldDelete =
      typeof window === "undefined"
        ? true
        : window.confirm(`Delete saved jar ${targetJarId}? This action cannot be undone.`);
    if (!shouldDelete) return;

    setSaving(true);
    setStatus("");
    setError("");
    try {
      await remove(ref(db, `recultureEntries/${encodeFirebaseKeySegment(targetJarId)}`));
      if (normalizeOptionKey(selectedId) === normalizeOptionKey(targetJarId)) {
        clearForm();
      }
      if (normalizeOptionKey(selectedRecultureJarId) === normalizeOptionKey(targetJarId)) {
        setSelectedRecultureJarId("");
      }
      setStatus(`Deleted ${targetJarId}.`);
    } catch (err) {
      setError(err?.message || `Failed to delete ${targetJarId}.`);
    } finally {
      setSaving(false);
    }
  };

  const appendCultureRecord = async (record) => {
    const recRef = push(ref(db, "cultureRecords"));
    const recordId = recRef.key || String(Date.now());
    await set(recRef, { ...record, id: recordId });
    return recordId;
  };

  const handleRecultureSubmit = async () => {
    const source = selectedRecultureEntry;
    if (!source?.jarId) {
      setError("Select a source jar from the search table before re-culturing.");
      return;
    }
    if (source.isRemoved) {
      setError(
        `Jar ${source.jarId} is marked as removed (${getRemovalReasonLabel(source.removedReason)}). Restore it before re-culturing.`
      );
      return;
    }
    if (![RECULTURE_WITHOUT_SUB, RECULTURE_WITH_SUB].includes(recultureType)) {
      setError("Select reculture option: WITH_SUBCULTURE or WITHOUT_SUBCULTURE.");
      return;
    }

    const nowIso = new Date().toISOString();
    const sourceJarId = source.jarId;
    const sourceOrchidType = (source.orchidType || "").trim();
    const sourceEntryKey = encodeFirebaseKeySegment(sourceJarId);

    if (recultureType === RECULTURE_WITHOUT_SUB) {
      const recultureDate = (sameJarReculture.recultureDate || "").trim();
      const nutritionType = (sameJarReculture.nutritionType || "").trim();
      const plantCount = String(sameJarReculture.plantCount || "").trim();
      const notes = (sameJarReculture.notes || "").trim();

      if (!recultureDate) {
        setError("Reculture date is required for reculture without subculture.");
        return;
      }
      if (!nutritionType) {
        setError("Nutrition type is required for reculture without subculture.");
        return;
      }
      if (!plantCount) {
        setError("Plant count is required for reculture without subculture.");
        return;
      }

      const updatedRecultures = [
        ...(Array.isArray(source.recultures) ? source.recultures : []),
        {
          date: recultureDate,
          note: notes || "Reculture without subculture",
          nutritionType,
          recultureType: RECULTURE_WITHOUT_SUB,
          createdAt: nowIso,
        },
      ].sort((a, b) => new Date(a.date) - new Date(b.date));

      const updatedEntry = {
        ...source,
        id: sourceJarId,
        jarId: sourceJarId,
        recultureMode: "sameJar",
        parentJarId: source.parentJarId || "",
        nutrition: nutritionType,
        nutrition_type: nutritionType,
        plantCount,
        plant_count: plantCount,
        seedCount: plantCount,
        seed_count: plantCount,
        recultures: updatedRecultures,
        updatedAt: nowIso,
      };

      setSaving(true);
      try {
        await set(ref(db, `recultureEntries/${sourceEntryKey}`), updatedEntry);
        await appendCultureRecord({
          jar_id: sourceJarId,
          parent_jar_id: source.parentJarId || "",
          plant_date: source.cultureDate || "",
          plant_type: source.orchidType || "",
          nutrition_type: nutritionType,
          rack_location: source.rackNo || "",
          plant_count: plantCount,
          seed_count: plantCount,
          reculture_type: RECULTURE_WITHOUT_SUB,
          reculture_date: recultureDate,
          created_at: nowIso,
        });
        setStatus(`Saved reculture update under same jar ${sourceJarId}. QR label is ready in Jar list.`);
        setSameJarReculture(newSameJarReculture());
      } catch (err) {
        setError(err?.message || "Failed to save reculture update.");
      } finally {
        setSaving(false);
      }
      return;
    }

    const preparedRows = splitRows
      .map((row) => ({
        newJarId: normalizeJarIdInput(row.newJarId).trim(),
        recultureDate: (row.recultureDate || "").trim(),
        nutritionType: (row.nutritionType || "").trim(),
        rackLocation: (row.rackLocation || "").trim(),
        plantCount: String(row.plantCount || "").trim(),
        notes: (row.notes || "").trim(),
      }))
      .filter((row) => row.newJarId || row.recultureDate || row.nutritionType || row.rackLocation || row.plantCount || row.notes);

    if (!preparedRows.length) {
      setError("Add at least one new child jar row for sub-culture split.");
      return;
    }

    const seenJarIds = new Set();
    for (const row of preparedRows) {
      if (!row.newJarId) {
        setError("New jar ID is required for every sub-culture row.");
        return;
      }
      if (!row.recultureDate) {
        setError(`Reculture date is required for ${row.newJarId}.`);
        return;
      }
      if (!row.nutritionType) {
        setError(`Nutrition type is required for ${row.newJarId}.`);
        return;
      }
      if (!row.rackLocation) {
        setError(`Rack location is required for ${row.newJarId}.`);
        return;
      }
      if (!row.plantCount) {
        setError(`Plant count is required for ${row.newJarId}.`);
        return;
      }
      if (!sourceOrchidType) {
        setError(`Source jar ${sourceJarId} has no orchid type. Set orchid type before sub-culture split.`);
        return;
      }
      const rackConflict = findRackTypeConflict({
        entries,
        rackNo: row.rackLocation,
        orchidType: sourceOrchidType,
        ignoreJarId: row.newJarId,
      });
      if (rackConflict) {
        setError(
          `Rack ${rackConflict.rackNo} already uses orchid type ${rackConflict.orchidType} (jar ${rackConflict.jarId}). One rack can only contain one orchid type.`
        );
        return;
      }
      const normalized = normalizeOptionKey(row.newJarId);
      if (seenJarIds.has(normalized)) {
        setError(`Duplicate child jar ID detected: ${row.newJarId}.`);
        return;
      }
      seenJarIds.add(normalized);
      const alreadyExists = entries.some((entry) => normalizeOptionKey(entry.jarId) === normalized);
      if (alreadyExists) {
        setError(`Child jar ID already exists: ${row.newJarId}. Use another ID.`);
        return;
      }
      const dotIndex = row.newJarId.lastIndexOf(".");
      if (dotIndex > 0) {
        const directParentFromId = row.newJarId.slice(0, dotIndex).trim();
        if (normalizeOptionKey(directParentFromId) !== normalizeOptionKey(sourceJarId)) {
          setError(
            `Child jar ${row.newJarId} must be added under ${directParentFromId}. Select that jar as source to continue.`
          );
          return;
        }
      }
    }

    const firstDate = preparedRows
      .map((row) => row.recultureDate)
      .sort()[0];
    const newJarIds = preparedRows.map((row) => row.newJarId);
    const parentRecultureNote = `Sub-cultured to: ${newJarIds.join(", ")}`;
    const updatedParentRecultures = [
      ...(Array.isArray(source.recultures) ? source.recultures : []),
      {
        date: firstDate,
        note: parentRecultureNote,
        recultureType: RECULTURE_WITH_SUB,
        createdAt: nowIso,
      },
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    setSaving(true);
    try {
      const writeTasks = [];
      writeTasks.push(
        set(ref(db, `recultureEntries/${sourceEntryKey}`), {
          ...source,
          jarId: sourceJarId,
          recultures: updatedParentRecultures,
          updatedAt: nowIso,
        })
      );

      preparedRows.forEach((row) => {
        const childEntry = {
          id: row.newJarId,
          jarId: row.newJarId,
          parentJarId: sourceJarId,
          parent_jar_id: sourceJarId,
          directParentJarId: sourceJarId,
          direct_parent_jar_id: sourceJarId,
          sourceJarId: sourceJarId,
          source_jar_id: sourceJarId,
          cultureDate: row.recultureDate,
          culture_date: row.recultureDate,
          rackNo: row.rackLocation,
          rack_location: row.rackLocation,
          orchidType: sourceOrchidType,
          plant_type: sourceOrchidType,
          nutrition: row.nutritionType,
          nutrition_type: row.nutritionType,
          plantCount: row.plantCount,
          plant_count: row.plantCount,
          seedCount: row.plantCount,
          seed_count: row.plantCount,
          recultureMode: "subculture",
          recultureType: RECULTURE_WITH_SUB,
          reculture_type: RECULTURE_WITH_SUB,
          recultureDate: row.recultureDate,
          reculture_date: row.recultureDate,
          recultures: [],
          createdAt: nowIso,
          created_at: nowIso,
          updatedAt: nowIso,
        };
        const childEntryKey = encodeFirebaseKeySegment(row.newJarId);
        writeTasks.push(set(ref(db, `recultureEntries/${childEntryKey}`), childEntry));
        writeTasks.push(
          appendCultureRecord({
            jar_id: row.newJarId,
            parent_jar_id: sourceJarId,
            source_jar_id: sourceJarId,
            plant_date: row.recultureDate,
            plant_type: sourceOrchidType,
            nutrition_type: row.nutritionType,
            rack_location: row.rackLocation,
            plant_count: row.plantCount,
            seed_count: row.plantCount,
            reculture_type: RECULTURE_WITH_SUB,
            reculture_date: row.recultureDate,
            created_at: nowIso,
          })
        );
      });

      await Promise.all(writeTasks);
      setStatus(`Saved sub-culture split from ${sourceJarId} into ${newJarIds.join(", ")}. QR labels are ready in Jar list.`);
      setSplitRows([newSplitJarRow()]);
    } catch (err) {
      setError(err?.message || "Failed to save sub-culture split.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    if (reculturePanelOpen) {
      await handleRecultureSubmit();
      return;
    }
    if (isEditing) {
      setError('Selected jar is preview-only. Use "Add new jar" to create, or "Add re-culture details" to update.');
      return;
    }

    const jarId = normalizeJarIdInput(form.jarId).trim();
    const recultureMode = normalizeRecultureMode(form.recultureMode, form.parentJarId);
    const parentJarId = normalizeLinkedJarId(recultureMode === "subculture" ? form.parentJarId : "");
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
    if (!String(form.plantCount || "").trim()) {
      setError("Plant count is required.");
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
    if (parentJarId && parentJarId.toLowerCase() === jarId.toLowerCase()) {
      setError("Parent Jar ID cannot be the same as Jar ID.");
      return;
    }
    const rackConflict = findRackTypeConflict({
      entries,
      rackNo: form.rackNo,
      orchidType: form.orchidType,
      ignoreJarId: jarId,
    });
    if (rackConflict) {
      setError(
        `Rack ${rackConflict.rackNo} already uses orchid type ${rackConflict.orchidType} (jar ${rackConflict.jarId}). One rack can only contain one orchid type.`
      );
      return;
    }

    const cleanedRecultures = form.recultures
      .map((row) => ({ date: row.date, note: row.note?.trim() || "" }))
      .filter((row) => row.date);
    if (recultureMode === "subculture" && !cleanedRecultures.length) {
      setError("Re-culture date is required for sub-culture split.");
      return;
    }
    if (recultureMode === "subculture" && !parentJarId) {
      setError("Parent Jar ID is required for sub-culture split.");
      return;
    }
    const effectiveRecultureType =
      cleanedRecultures.length > 0
        ? recultureMode === "subculture"
          ? RECULTURE_WITH_SUB
          : RECULTURE_WITHOUT_SUB
        : NEW_CULTURE;

    const payload = {
      id: jarId,
      jarId,
      recultureMode,
      parentJarId,
      jar_id: jarId,
      parent_jar_id: parentJarId,
      cultureDate: form.cultureDate,
      plant_date: form.cultureDate,
      rackNo: form.rackNo,
      rack_location: form.rackNo,
      orchidType: form.orchidType,
      plant_type: form.orchidType,
      nutrition: form.nutrition,
      nutrition_type: form.nutrition,
      plantCount: form.plantCount || "",
      plant_count: form.plantCount || "",
      seedCount: form.plantCount || "",
      seed_count: form.plantCount || "",
      addHormone: Boolean(form.addHormone),
      hormoneDetail: form.addHormone ? form.hormoneDetail.trim() : "",
      addSpecialNutrition: Boolean(form.addSpecialNutrition),
      specialNutritionDetail: form.addSpecialNutrition ? form.specialNutritionDetail.trim() : "",
      recultures: cleanedRecultures.sort((a, b) => new Date(a.date) - new Date(b.date)),
      reculture_type: effectiveRecultureType,
      reculture_date: cleanedRecultures.length ? cleanedRecultures[cleanedRecultures.length - 1].date : "",
      isRemoved: false,
      removed: false,
      status: "active",
      removedReason: "",
      removalReason: "",
      removed_reason: "",
      removedAt: "",
      removed_at: "",
      created_at: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const entryKey = encodeFirebaseKeySegment(jarId);
      await set(ref(db, `recultureEntries/${entryKey}`), payload);
      await appendCultureRecord({
        jar_id: jarId,
        parent_jar_id: parentJarId,
        plant_date: form.cultureDate,
        plant_type: form.orchidType,
        nutrition_type: form.nutrition,
        rack_location: form.rackNo,
        plant_count: form.plantCount || "",
        seed_count: form.plantCount || "",
        reculture_type: payload.reculture_type,
        reculture_date: payload.reculture_date,
        created_at: payload.created_at,
      });
      setSelectedId(jarId);
      addRackOption(form.rackNo);
      addOrchidOption(form.orchidType);
      setStatus(
        `Saved ${jarId} with ${payload.recultures.length} re-culture dates${
          recultureMode === "subculture" && parentJarId ? ` (sub-culture from ${parentJarId})` : ""
        }. QR label is ready in Jar list.`
      );
    } catch (err) {
      setError(err?.message || "Failed to save to Firebase.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <Hero onOpenJarList={() => setJarLabelOpen(true)} />

      {jarLabelOpen && (
        <JarLabelManager
          entries={entries}
          onClose={() => setJarLabelOpen(false)}
        />
      )}

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
            reculturePanelOpen={reculturePanelOpen}
            openReculturePanel={openReculturePanel}
            closeReculturePanel={closeReculturePanel}
            recultureSearch={recultureSearch}
            setRecultureSearch={setRecultureSearch}
            recultureSearchRows={recultureSearchRows}
            selectedRecultureEntry={selectedRecultureEntry}
            selectRecultureSource={selectRecultureSource}
            recultureType={recultureType}
            setRecultureType={setRecultureType}
            sameJarReculture={sameJarReculture}
            updateSameJarRecultureField={updateSameJarRecultureField}
            splitRows={splitRows}
            updateSplitRow={updateSplitRow}
            addSplitRow={addSplitRow}
            removeSplitRow={removeSplitRow}
            isEditing={isEditing}
            selectedEntry={selectedEntry}
            entries={entries}
            onMarkRemoved={markJarRemoved}
            onRestore={restoreJarRemoval}
            onSubmit={handleSubmit}
            clearForm={clearForm}
            status={status}
            error={error}
            entriesError={entriesError}
            loadingEntries={loadingEntries}
            saving={saving}
          />
        </div>
        <JarList
          entries={entries}
          selectedId={selectedId}
          onSelect={loadEntry}
          onMarkRemoved={markJarRemoved}
          onRestore={restoreJarRemoval}
          onDelete={deleteJarEntry}
          saving={saving}
        />
      </div>

      {selectedEntry && (
        <Timeline
          entry={selectedEntry}
          entries={entries}
          onMarkRemoved={markJarRemoved}
          onRestore={restoreJarRemoval}
          saving={saving}
        />
      )}
    </div>
  );
}

function Hero({ onOpenJarList }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="panel relative overflow-hidden"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-3">
          <p className="kicker">Orchid Culture Manager</p>
          <h1 className="title-lg">OrchiLab</h1>
        </div>
        <button
          type="button"
          onClick={onOpenJarList}
          className="btn-primary px-4 py-2 text-sm"
        >
          Jar list
        </button>
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
  reculturePanelOpen,
  openReculturePanel,
  closeReculturePanel,
  recultureSearch,
  setRecultureSearch,
  recultureSearchRows,
  selectedRecultureEntry,
  selectRecultureSource,
  recultureType,
  setRecultureType,
  sameJarReculture,
  updateSameJarRecultureField,
  splitRows,
  updateSplitRow,
  addSplitRow,
  removeSplitRow,
  isEditing,
  selectedEntry,
  entries,
  onMarkRemoved,
  onRestore,
  onSubmit,
  clearForm,
  status,
  error,
  entriesError,
  loadingEntries,
  saving,
}) {
  const previewMode = isEditing && !reculturePanelOpen;
  const rackSelectOptions = useMemo(
    () => uniqueSortedOptions([...(rackOptions || []), form.rackNo]),
    [rackOptions, form.rackNo]
  );
  const selectedParentEntry = useMemo(() => {
    const parentId = selectedEntry?.parentJarId;
    if (!parentId) return null;
    return (entries || []).find((entry) => normalizeOptionKey(entry.jarId) === normalizeOptionKey(parentId)) || null;
  }, [entries, selectedEntry]);
  const [detailRemovalReason, setDetailRemovalReason] = useState(REMOVAL_REASON_CONTAMINATION);

  useEffect(() => {
    if (!selectedEntry) return;
    if (selectedEntry.isRemoved && selectedEntry.removedReason) {
      setDetailRemovalReason(selectedEntry.removedReason);
      return;
    }
    setDetailRemovalReason(REMOVAL_REASON_CONTAMINATION);
  }, [selectedEntry]);
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
          <button
            type="button"
            onClick={openReculturePanel}
            className="btn-soft text-xs px-3 py-1.5"
          >
            Add re-culture details
          </button>
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs text-primary">Firebase</span>
        </div>
      </div>

      {!reculturePanelOpen && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Jar ID *">
              <input
                value={form.jarId}
                onChange={onFieldChange("jarId")}
                placeholder="e.g. Jar-42"
                disabled={previewMode}
                className={`input-shell ${previewMode ? "bg-paper/60 text-subtle cursor-not-allowed" : ""}`}
              />
            </Field>
            <Field label="Culture date *">
              <input
                type="date"
                value={form.cultureDate}
                onChange={onFieldChange("cultureDate")}
                disabled={previewMode}
                className={`input-shell ${previewMode ? "bg-paper/60 text-subtle cursor-not-allowed" : ""}`}
              />
              <p className="text-[11px] text-subtle mt-1">Entry date can differ from planting/culture date.</p>
            </Field>
            <Field label="Rack ID *">
              <select
                value={form.rackNo}
                onChange={onFieldChange("rackNo")}
                disabled={previewMode}
                className={`input-shell ${previewMode ? "bg-paper/60 text-subtle cursor-not-allowed" : ""}`}
              >
                <option value="">Select rack ID</option>
                {rackSelectOptions.map((rack) => (
                  <option key={rack} value={rack}>
                    {rack}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Orchid type *">
              <input
                value={form.orchidType}
                onChange={onFieldChange("orchidType")}
                placeholder="e.g. Phalaenopsis"
                list="orchid-options"
                disabled={previewMode}
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
                disabled={previewMode}
                className="input-shell min-h-[96px] resize-y"
              />
            </Field>
            <Field label="Plant count *">
              <input
                type="number"
                min="0"
                step="1"
                value={form.plantCount || ""}
                onChange={onFieldChange("plantCount")}
                placeholder="e.g. 12"
                disabled={previewMode}
                className="input-shell"
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
                  disabled={previewMode}
                  className="accent-primary"
                />
                Add hormone
              </label>
              <label className="flex items-center gap-2 text-sm text-dark">
                <input
                  type="checkbox"
                  checked={Boolean(form.addSpecialNutrition)}
                  onChange={onToggleField("addSpecialNutrition")}
                  disabled={previewMode}
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
                  disabled={previewMode}
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
                  disabled={previewMode}
                  className="input-shell py-2"
                />
              </Field>
            )}
          </div>
        </>
      )}

      {reculturePanelOpen ? (
        <RecultureWorkspace
          recultureSearch={recultureSearch}
          setRecultureSearch={setRecultureSearch}
          recultureSearchRows={recultureSearchRows}
          entries={entries}
          rackOptions={rackOptions}
          selectedRecultureEntry={selectedRecultureEntry}
          selectRecultureSource={selectRecultureSource}
          recultureType={recultureType}
          setRecultureType={setRecultureType}
          sameJarReculture={sameJarReculture}
          updateSameJarRecultureField={updateSameJarRecultureField}
          splitRows={splitRows}
          updateSplitRow={updateSplitRow}
          addSplitRow={addSplitRow}
          removeSplitRow={removeSplitRow}
          closeReculturePanel={closeReculturePanel}
        />
      ) : (
        <div className="panel-muted border-dashed px-4 py-3 text-xs text-subtle">
          Use <span className="font-semibold text-dark">Add re-culture details</span> to update existing jars.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || previewMode}
          className="btn-primary px-4 py-3 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : reculturePanelOpen ? "Save reculture" : "Save jar"}
        </button>
        <button
          type="button"
          onClick={clearForm}
          className="btn-soft px-4 py-3"
        >
          Reset form
        </button>
      </div>

      {previewMode && (
        <p className="text-xs text-subtle">
          Preview mode: selected jar data is read-only. Use "Add re-culture details" for updates or "Add new jar" for new records.
        </p>
      )}
      {previewMode && selectedEntry && (
        <div className="panel-muted px-4 py-3 text-xs text-subtle space-y-1">
          <p>
            Selected jar: <span className="font-semibold text-dark">{selectedEntry.jarId}</span>
          </p>
          <p>
            Parent jar: <span className="font-semibold text-dark">{selectedEntry.parentJarId || "Root jar"}</span>
          </p>
          {selectedParentEntry && (
            <p>
              Parent preview: Culture {selectedParentEntry.cultureDate || "-"} | Rack {selectedParentEntry.rackNo || "-"} | Nutrition{" "}
              {selectedParentEntry.nutrition || "-"}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/35 pt-3">
            {!selectedEntry.isRemoved && (
              <select
                value={detailRemovalReason}
                onChange={(e) => setDetailRemovalReason(e.target.value)}
                className="input-shell max-w-[230px] py-1.5 text-xs"
              >
                {REMOVAL_REASON_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
            {selectedEntry.isRemoved ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => onRestore(selectedEntry.jarId)}
                className="rounded-lg border border-emerald-200/70 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 hover:border-emerald-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Restore jar
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => onMarkRemoved(selectedEntry.jarId, detailRemovalReason)}
                className="rounded-lg border border-amber-200/70 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 hover:border-amber-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Mark as end of lab life
              </button>
            )}
          </div>
        </div>
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

function JarList({ entries, selectedId, onSelect, onMarkRemoved, onRestore, onDelete, saving }) {
  const [query, setQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [removeReasonByJar, setRemoveReasonByJar] = useState({});

  const normalizedQuery = query.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) return entries;
    return entries.filter((entry) => entry.jarId.toLowerCase().includes(normalizedQuery));
  }, [entries, normalizedQuery]);
  const childCountByParent = useMemo(() => {
    const map = new Map();
    entries.forEach((entry) => {
      const parentKey = normalizeOptionKey(entry.directParentJarId || entry.parentJarId);
      if (!parentKey) return;
      map.set(parentKey, (map.get(parentKey) || 0) + 1);
    });
    return map;
  }, [entries]);

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
              const nextReculture = entry.isRemoved
                ? null
                : entry.recultures.find((r) => new Date(r.date) >= new Date());
              const isSelected = selectedId && selectedId.toLowerCase() === entry.jarId.toLowerCase();
              const childCount = childCountByParent.get(normalizeOptionKey(entry.jarId)) || 0;
              return (
                <div
                  key={entry.jarId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelect(entry)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(entry);
                    }
                  }}
                  className={`w-full text-left rounded-xl border px-4 py-3 transition shadow-sm cursor-pointer ${
                    isSelected
                      ? "border-primary/35 bg-primary/10 text-primary shadow-md"
                      : entry.isRemoved
                        ? "border-amber-300/55 bg-amber-50/60 text-dark hover:border-amber-400/70"
                      : "border-border/45 bg-paper/70 text-dark hover:border-primary/35 hover:bg-primary/5"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{entry.jarId}</p>
                      <p className="text-xs text-subtle">
                        Culture: {entry.cultureDate} - Rack: {entry.rackNo || "---"} - {entry.orchidType || "Type N/A"}
                      </p>
                      <p className="text-[11px] text-subtle">
                        Parent: {entry.parentJarId || "Root jar"} - Children: {childCount}
                      </p>
                      <p className="text-[11px] text-subtle">Nutrition: {entry.nutrition || "Not noted"}</p>
                    </div>
                    {entry.isRemoved ? (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-amber-700">Removed</span>
                    ) : (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-subtle">
                        {entry.recultures.length} dates
                      </span>
                    )}
                  </div>
                  {entry.isRemoved && (
                    <p className="text-xs text-amber-700 mt-1">
                      Removed: {getRemovalReasonLabel(entry.removedReason)}
                      {entry.removedAt ? ` on ${normalizeDateValue(entry.removedAt) || entry.removedAt}` : ""}
                    </p>
                  )}
                  {nextReculture && (
                    <p className="text-xs text-primary mt-1">
                      Next re-culture: {nextReculture.date}
                      {nextReculture.note ? ` - ${nextReculture.note}` : ""}
                    </p>
                  )}
                  <div
                    className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t border-border/35 pt-2"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {!entry.isRemoved && (
                      <select
                        value={removeReasonByJar[entry.jarId] || REMOVAL_REASON_CONTAMINATION}
                        onChange={(e) =>
                          setRemoveReasonByJar((prev) => ({ ...prev, [entry.jarId]: e.target.value }))
                        }
                        className="input-shell max-w-[210px] py-1.5 text-xs"
                      >
                        {REMOVAL_REASON_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {entry.isRemoved ? (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onRestore(entry.jarId)}
                        className="rounded-lg border border-emerald-200/70 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 hover:border-emerald-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onMarkRemoved(entry.jarId, removeReasonByJar[entry.jarId] || REMOVAL_REASON_CONTAMINATION)}
                        className="rounded-lg border border-amber-200/70 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 hover:border-amber-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Mark removed
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onDelete(entry.jarId)}
                      className="rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-700 hover:border-rose-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      Delete
                    </button>
                  </div>
                </div>
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

function JarLabelManager({ entries, onClose }) {
  const qrCacheRef = useRef(new Map());
  const selectionInitializedRef = useRef(false);
  const [typeFilter, setTypeFilter] = useState(LABEL_TYPE_ALL);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [jarQuery, setJarQuery] = useState("");
  const [rackFilter, setRackFilter] = useState("");
  const [orchidFilter, setOrchidFilter] = useState("");
  const [printMode, setPrintMode] = useState(PRINT_MODE_JAR);
  const [includeRackOrchid, setIncludeRackOrchid] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [removedIds, setRemovedIds] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [actionError, setActionError] = useState("");

  const allRows = useMemo(() => buildJarLabelRows(entries), [entries]);
  const removedSet = useMemo(() => new Set(removedIds), [removedIds]);

  const availableRows = useMemo(
    () => allRows.filter((row) => !removedSet.has(row.id)),
    [allRows, removedSet]
  );
  const rackOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableRows
            .map((row) => String(row.rackNo || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    [availableRows]
  );
  const orchidOptions = useMemo(
    () =>
      Array.from(
        new Set(
          availableRows
            .map((row) => String(row.orchidType || "").trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [availableRows]
  );

  const filteredRows = useMemo(() => {
    const term = jarQuery.trim().toLowerCase();
    const from = normalizeDateValue(fromDate);
    const to = normalizeDateValue(toDate);
    const rackKey = normalizeOptionKey(rackFilter);
    const orchidKey = normalizeOptionKey(orchidFilter);

    return availableRows.filter((row) => {
      if (typeFilter !== LABEL_TYPE_ALL && row.type !== typeFilter) return false;
      if (from && row.eventDate && row.eventDate < from) return false;
      if (to && row.eventDate && row.eventDate > to) return false;
      if (rackKey && normalizeOptionKey(row.rackNo) !== rackKey) return false;
      if (orchidKey && normalizeOptionKey(row.orchidType) !== orchidKey) return false;
      if (!term) return true;
      const haystack = [row.jarId, row.orchidType, row.rackNo, row.eventDate]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      return haystack.includes(term);
    });
  }, [availableRows, fromDate, jarQuery, orchidFilter, rackFilter, toDate, typeFilter]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRows = useMemo(
    () => availableRows.filter((row) => selectedSet.has(row.id)),
    [availableRows, selectedSet]
  );
  const selectedRackRows = useMemo(() => {
    const byRack = new Map();
    selectedRows.forEach((row) => {
      const rackNo = String(row.rackNo || "").trim() || "-";
      const orchidType = String(row.orchidType || "").trim() || "-";
      const key = `${normalizeOptionKey(rackNo)}|${normalizeOptionKey(orchidType)}`;
      if (byRack.has(key)) return;
      byRack.set(key, {
        id: `rack:${key}`,
        rackNo,
        orchidType,
      });
    });
    return Array.from(byRack.values());
  }, [selectedRows]);
  const printableRows = useMemo(
    () => (printMode === PRINT_MODE_RACK ? selectedRackRows : selectedRows),
    [printMode, selectedRackRows, selectedRows]
  );
  const allSelected = useMemo(
    () => availableRows.length > 0 && selectedRows.length === availableRows.length,
    [availableRows.length, selectedRows.length]
  );
  const allFilteredSelected = useMemo(
    () => filteredRows.length > 0 && filteredRows.every((row) => selectedSet.has(row.id)),
    [filteredRows, selectedSet]
  );

  useEffect(() => {
    const validIds = new Set(availableRows.map((row) => row.id));
    setSelectedIds((prev) => prev.filter((id) => validIds.has(id)));
    if (!selectionInitializedRef.current && availableRows.length) {
      setSelectedIds(availableRows.map((row) => row.id));
      selectionInitializedRef.current = true;
    }
  }, [availableRows]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
    setActionError("");
  };

  const selectAllFiltered = () => {
    setSelectedIds((prev) => {
      const merged = new Set(prev);
      filteredRows.forEach((row) => merged.add(row.id));
      return Array.from(merged);
    });
    setActionError("");
  };

  const selectAll = () => {
    setSelectedIds(availableRows.map((row) => row.id));
    setActionError("");
  };

  const deselectAll = () => {
    setSelectedIds([]);
    setActionError("");
  };

  const toggleAllFiltered = (checked) => {
    if (checked) {
      setSelectedIds((prev) => {
        const merged = new Set(prev);
        filteredRows.forEach((row) => merged.add(row.id));
        return Array.from(merged);
      });
    } else {
      const filteredIdSet = new Set(filteredRows.map((row) => row.id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    }
    setActionError("");
  };

  const keepOnlyFiltered = () => {
    setSelectedIds(filteredRows.map((row) => row.id));
    setActionError("");
  };

  const removeSelectedFromQueue = () => {
    if (!selectedRows.length) {
      setActionError("Select at least one label to remove from print queue.");
      return;
    }
    setRemovedIds((prev) => {
      const next = new Set(prev);
      selectedRows.forEach((row) => next.add(row.id));
      return Array.from(next);
    });
    setSelectedIds((prev) => {
      const removeSet = new Set(selectedRows.map((row) => row.id));
      return prev.filter((id) => !removeSet.has(id));
    });
    setActionError("");
  };

  const restoreRemoved = () => {
    setRemovedIds([]);
    setActionError("");
  };

  const escapeHtml = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const createPrintWindow = () => {
    if (!printableRows.length) {
      setActionError("Select at least one label before printing.");
      return;
    }
    const win = window.open("", "_blank", "width=1200,height=900");
    if (!win) {
      setActionError("Popup blocked. Allow popups to print labels.");
      return;
    }

    const labelHtml = printableRows
      .map((row) => {
        const isRackMode = printMode === PRINT_MODE_RACK;
        if (isRackMode) {
          return `
            <div class="label rack-only">
              <div class="meta">
                <p class="jar">Rack: ${escapeHtml(row.rackNo || "-")}</p>
                <p class="date">Orchid: ${escapeHtml(row.orchidType || "-")}</p>
                <p class="type">Rack label</p>
              </div>
            </div>
          `;
        }

        const qrSrc = buildQrImageUrl(row.jarId);
        const rackLine = includeRackOrchid
          ? `<p class="rack">Rack: ${escapeHtml(row.rackNo || "-")} | Orchid: ${escapeHtml(row.orchidType || "-")}</p>`
          : "";
        return `
          <div class="label">
            <div class="meta">
              <p class="jar">${escapeHtml(row.jarId)}</p>
              <p class="date">${escapeHtml(row.eventLabel)}: ${escapeHtml(row.eventDate || "-")}</p>
              <p class="type">${row.type === LABEL_TYPE_CULTURE ? "Culture" : "Re-culture"}</p>
              ${rackLine}
            </div>
            <img src="${qrSrc}" alt="QR ${escapeHtml(row.jarId)}" />
          </div>
        `;
      })
      .join("");

    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Jar Labels</title>
        <style>
          @page { size: A4; margin: 10mm; }
          body { margin: 0; font-family: Arial, sans-serif; background: #fff; color: #111827; }
          .sheet {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            box-sizing: border-box;
            padding: 12mm 10mm;
            display: grid;
            grid-template-columns: repeat(3, 2in);
            justify-content: center;
            gap: 4mm;
          }
          .label {
            width: 2in;
            height: 0.7in;
            box-sizing: border-box;
            border: 0.6px solid #111827;
            border-radius: 2mm;
            padding: 1.1mm 2mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 2mm;
            overflow: hidden;
          }
          .label.rack-only {
            justify-content: flex-start;
          }
          .label.rack-only .meta {
            min-width: 100%;
          }
          .meta { min-width: 0; flex: 1; }
          .jar {
            margin: 0;
            font-size: 9pt;
            font-weight: 700;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .date {
            margin: 1mm 0 0;
            font-size: 6.2pt;
            line-height: 1.1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .type { margin: 0.6mm 0 0; font-size: 5.8pt; color: #374151; line-height: 1.05; }
          .rack {
            margin: 0.5mm 0 0;
            font-size: 5.3pt;
            color: #4b5563;
            line-height: 1.05;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          img { width: 0.52in; height: 0.52in; object-fit: contain; border: 0.3px solid #d1d5db; }
        </style>
      </head>
      <body>
        <div class="sheet">${labelHtml}</div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.onload = () => {
      setTimeout(() => {
        win.print();
      }, 400);
    };
    setActionError("");
  };

  const getQrDataUrl = async (jarId) => {
    const key = String(jarId || "").trim();
    if (!key) return "";
    if (qrCacheRef.current.has(key)) return qrCacheRef.current.get(key);
    const dataUrl = await fetchQrDataUrlForJarId(key);
    qrCacheRef.current.set(key, dataUrl);
    return dataUrl;
  };

  const downloadPdf = async () => {
    if (!printableRows.length) {
      setActionError("Select at least one label before PDF download.");
      return;
    }

    setPdfLoading(true);
    setActionError("");
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      const labelWidthMm = LABEL_WIDTH_IN * IN_TO_MM;
      const labelHeightMm = LABEL_HEIGHT_IN * IN_TO_MM;
      const qrSizeMm = QR_SIZE_IN * IN_TO_MM;
      const rowsPerPage = Math.floor((A4_HEIGHT_MM - LABEL_MARGIN_Y_MM * 2 + LABEL_Y_GAP_MM) / (labelHeightMm + LABEL_Y_GAP_MM));
      const labelsPerPage = Math.max(1, rowsPerPage * LABEL_COLUMNS);
      const marginX = Math.max(
        8,
        (A4_WIDTH_MM - (LABEL_COLUMNS * labelWidthMm + (LABEL_COLUMNS - 1) * LABEL_X_GAP_MM)) / 2
      );

      for (let idx = 0; idx < printableRows.length; idx += 1) {
        const row = printableRows[idx];
        const slot = idx % labelsPerPage;
        if (idx > 0 && slot === 0) doc.addPage();

        const col = slot % LABEL_COLUMNS;
        const rowIndex = Math.floor(slot / LABEL_COLUMNS);
        const x = marginX + col * (labelWidthMm + LABEL_X_GAP_MM);
        const y = LABEL_MARGIN_Y_MM + rowIndex * (labelHeightMm + LABEL_Y_GAP_MM);

        doc.setDrawColor(17, 24, 39);
        doc.setLineWidth(0.2);
        doc.roundedRect(x, y, labelWidthMm, labelHeightMm, 1.2, 1.2);

        if (printMode === PRINT_MODE_RACK) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(`Rack: ${row.rackNo || "-"}`, x + 2.2, y + 6.6, { maxWidth: labelWidthMm - 4 });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.6);
          doc.text(`Orchid: ${row.orchidType || "-"}`, x + 2.2, y + 11.8, { maxWidth: labelWidthMm - 4 });
          doc.setFontSize(5.8);
          doc.text("Rack label", x + 2.2, y + 15.8, { maxWidth: labelWidthMm - 4 });
        } else {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.text(String(row.jarId || "-"), x + 2.2, y + 5.8, { maxWidth: labelWidthMm - qrSizeMm - 6 });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.1);
          doc.text(`${row.eventLabel}: ${row.eventDate || "-"}`, x + 2.2, y + 10.6, {
            maxWidth: labelWidthMm - qrSizeMm - 6,
          });
          doc.text(row.type === LABEL_TYPE_CULTURE ? "Culture" : "Re-culture", x + 2.2, y + 13.9, {
            maxWidth: labelWidthMm - qrSizeMm - 6,
          });
          if (includeRackOrchid) {
            doc.setFontSize(5.3);
            doc.text(`Rack: ${row.rackNo || "-"} | Orchid: ${row.orchidType || "-"}`, x + 2.2, y + 16.6, {
              maxWidth: labelWidthMm - qrSizeMm - 6,
            });
          }

          try {
            const qrDataUrl = await getQrDataUrl(row.jarId);
            if (qrDataUrl) {
              doc.addImage(
                qrDataUrl,
                "PNG",
                x + labelWidthMm - qrSizeMm - 1.8,
                y + (labelHeightMm - qrSizeMm) / 2,
                qrSizeMm,
                qrSizeMm
              );
            }
          } catch {
            // Keep PDF generation running even if one QR image fails.
          }
        }
      }

      doc.save(`jar-labels-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      setActionError(err?.message || "Failed to generate PDF labels.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto w-full max-w-[1200px] rounded-2xl border border-border/50 bg-paper shadow-2xl space-y-4 p-4 sm:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="kicker">Jar list</p>
            <h3 className="text-xl font-semibold text-dark">QR label preview and print</h3>
            <p className="text-sm text-subtle">
              Label size: {LABEL_WIDTH_IN}" x {LABEL_HEIGHT_IN}" | QR payload: Jar ID only
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-soft px-3 py-2 text-sm">
            Close
          </button>
        </div>

        <div className="grid lg:grid-cols-7 gap-3">
          <Field label="Label output">
            <select
              value={printMode}
              onChange={(e) => setPrintMode(e.target.value)}
              className="input-shell"
            >
              <option value={PRINT_MODE_JAR}>Jar labels</option>
              <option value={PRINT_MODE_RACK}>Rack labels (rack + orchid)</option>
            </select>
          </Field>
          <Field label="Type">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="input-shell"
            >
              <option value={LABEL_TYPE_ALL}>Both types</option>
              <option value={LABEL_TYPE_CULTURE}>Culture</option>
              <option value={LABEL_TYPE_RECULTURE}>Re-culture</option>
            </select>
          </Field>
          <Field label="From date">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="input-shell"
            />
          </Field>
          <Field label="To date">
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="input-shell"
            />
          </Field>
          <Field label="Jar search">
            <input
              value={jarQuery}
              onChange={(e) => setJarQuery(normalizeJarIdInput(e.target.value))}
              placeholder="e.g. Jar-001"
              className="input-shell"
            />
          </Field>
          <Field label="Rack">
            <select
              value={rackFilter}
              onChange={(e) => setRackFilter(e.target.value)}
              className="input-shell"
            >
              <option value="">All racks</option>
              {rackOptions.map((rack) => (
                <option key={rack} value={rack}>
                  {rack}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Orchid type">
            <select
              value={orchidFilter}
              onChange={(e) => setOrchidFilter(e.target.value)}
              className="input-shell"
            >
              <option value="">All orchid types</option>
              {orchidOptions.map((orchid) => (
                <option key={orchid} value={orchid}>
                  {orchid}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="inline-flex items-center gap-2 rounded-lg border border-border/55 bg-paper/70 px-3 py-1.5 text-dark">
            <input
              type="checkbox"
              checked={includeRackOrchid}
              onChange={(e) => setIncludeRackOrchid(Boolean(e.target.checked))}
              disabled={printMode === PRINT_MODE_RACK}
              className="accent-primary"
            />
            Show rack + orchid on label
          </label>
          <button type="button" onClick={selectAll} className="btn-soft px-3 py-1.5">
            {allSelected ? "All selected" : "Select all"}
          </button>
          <button type="button" onClick={deselectAll} className="btn-soft px-3 py-1.5">
            Deselect all
          </button>
          <button type="button" onClick={selectAllFiltered} className="btn-soft px-3 py-1.5">
            Select filtered
          </button>
          <button type="button" onClick={keepOnlyFiltered} className="btn-soft px-3 py-1.5">
            Keep only filtered
          </button>
          <button type="button" onClick={removeSelectedFromQueue} className="btn-soft px-3 py-1.5">
            Remove selected
          </button>
          <button type="button" onClick={restoreRemoved} className="btn-soft px-3 py-1.5">
            Restore removed
          </button>
          <button type="button" onClick={createPrintWindow} className="btn-primary px-3 py-1.5">
            Print selected
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            disabled={pdfLoading}
            className="btn-primary px-3 py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {pdfLoading ? "Building PDF..." : "Download PDF"}
          </button>
          <span className="text-subtle">
            Filtered: {filteredRows.length} | Selected: {selectedRows.length} | Printable: {printableRows.length} | Removed: {removedIds.length}
          </span>
        </div>
        {printMode === PRINT_MODE_RACK && (
          <p className="text-[11px] text-subtle">
            Rack label mode prints unique Rack + Orchid combinations from selected rows.
          </p>
        )}

        {actionError && (
          <p className="text-xs text-rose-700 rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-2">
            {actionError}
          </p>
        )}

        <div className="grid xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)] gap-4">
          <div className="rounded-xl border border-border/45 bg-paper/75 overflow-hidden">
            <div className="px-3 py-2 border-b border-border/45 text-sm font-semibold text-dark">
              Label rows
            </div>
            <div className="max-h-[24rem] overflow-auto">
              {filteredRows.length ? (
                <table className="w-full text-xs">
                  <thead className="bg-paper/80 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left">
                        <label className="inline-flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={(e) => toggleAllFiltered(Boolean(e.target.checked))}
                            className="accent-primary"
                          />
                          Pick
                        </label>
                      </th>
                      <th className="px-2 py-2 text-left">Jar ID</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Rack</th>
                      <th className="px-2 py-2 text-left">Orchid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-border/35">
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedSet.has(row.id)}
                            onChange={() => toggleSelected(row.id)}
                            className="accent-primary"
                          />
                        </td>
                        <td className="px-2 py-2 text-dark font-medium">{row.jarId}</td>
                        <td className="px-2 py-2 text-subtle">
                          {row.type === LABEL_TYPE_CULTURE ? "Culture" : "Re-culture"}
                        </td>
                        <td className="px-2 py-2 text-subtle">{row.eventDate || "-"}</td>
                        <td className="px-2 py-2 text-subtle">{row.rackNo || "-"}</td>
                        <td className="px-2 py-2 text-subtle">{row.orchidType || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-3 py-4 text-xs text-subtle">No rows match current filters.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border/45 bg-paper/70 p-3 overflow-auto">
            <p className="text-xs font-semibold text-dark mb-2">A4 preview (3 labels per row)</p>
            <div className="overflow-auto rounded-lg border border-border/40 bg-slate-100 p-3">
              <div
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  margin: "0 auto",
                  background: "#ffffff",
                  padding: "12mm 10mm",
                  boxSizing: "border-box",
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 2in)",
                  justifyContent: "center",
                  gap: "4mm",
                }}
              >
                {printableRows.length ? (
                  printableRows.map((row) => (
                    <div
                      key={`preview-${row.id}`}
                      style={{
                        width: "2in",
                        height: "0.7in",
                        border: "0.6px solid #111827",
                        borderRadius: "2mm",
                        padding: "1.1mm 2mm",
                        boxSizing: "border-box",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "2mm",
                        overflow: "hidden",
                        color: "#111827",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        {printMode === PRINT_MODE_RACK ? (
                          <>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "9pt",
                                fontWeight: 700,
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              Rack: {row.rackNo || "-"}
                            </p>
                            <p
                              style={{
                                margin: "1mm 0 0",
                                fontSize: "6.4pt",
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              Orchid: {row.orchidType || "-"}
                            </p>
                            <p style={{ margin: "0.8mm 0 0", fontSize: "6pt", lineHeight: 1.1, color: "#374151" }}>
                              Rack label
                            </p>
                          </>
                        ) : (
                          <>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "9pt",
                                fontWeight: 700,
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {row.jarId}
                            </p>
                            <p
                              style={{
                                margin: "1mm 0 0",
                                fontSize: "6.2pt",
                                lineHeight: 1.1,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {row.eventLabel}: {row.eventDate || "-"}
                            </p>
                            <p style={{ margin: "0.8mm 0 0", fontSize: "6pt", lineHeight: 1.1, color: "#374151" }}>
                              {row.type === LABEL_TYPE_CULTURE ? "Culture" : "Re-culture"}
                            </p>
                          </>
                        )}
                        {printMode !== PRINT_MODE_RACK && includeRackOrchid && (
                          <p
                            style={{
                              margin: "0.5mm 0 0",
                              fontSize: "5.3pt",
                              lineHeight: 1.05,
                              color: "#4b5563",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            Rack: {row.rackNo || "-"} | Orchid: {row.orchidType || "-"}
                          </p>
                        )}
                      </div>
                      {printMode !== PRINT_MODE_RACK && (
                        <img
                          src={buildQrImageUrl(row.jarId)}
                          alt={`QR ${row.jarId}`}
                          style={{
                            width: "0.52in",
                            height: "0.52in",
                            objectFit: "contain",
                            border: "0.3px solid #d1d5db",
                          }}
                        />
                      )}
                    </div>
                  ))
                ) : (
                  <p style={{ gridColumn: "1 / -1", fontSize: "10pt", color: "#6b7280", margin: 0 }}>
                    Select labels from the table to preview and print.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function RecultureWorkspace({
  recultureSearch,
  setRecultureSearch,
  recultureSearchRows,
  entries,
  rackOptions,
  selectedRecultureEntry,
  selectRecultureSource,
  recultureType,
  setRecultureType,
  sameJarReculture,
  updateSameJarRecultureField,
  splitRows,
  updateSplitRow,
  addSplitRow,
  removeSplitRow,
  closeReculturePanel,
}) {
  const selectedSourceParentEntry = useMemo(() => {
    const parentId = selectedRecultureEntry?.parentJarId;
    if (!parentId) return null;
    return (entries || []).find((entry) => normalizeOptionKey(entry.jarId) === normalizeOptionKey(parentId)) || null;
  }, [entries, selectedRecultureEntry]);
  const splitRackOptions = useMemo(
    () => uniqueSortedOptions([...(rackOptions || []), ...splitRows.map((row) => row.rackLocation)]),
    [rackOptions, splitRows]
  );

  return (
    <div className="space-y-4 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="kicker">Reculture Workflow</p>
          <p className="text-sm text-subtle">Step 1: search and select an existing source jar.</p>
        </div>
        <button type="button" onClick={closeReculturePanel} className="btn-soft text-xs px-3 py-1.5">
          Close re-culture
        </button>
      </div>

      <div className="space-y-2">
        <input
          value={recultureSearch}
          onChange={(e) => setRecultureSearch(normalizeJarIdInput(e.target.value))}
          placeholder="Search Jar ID, type, or rack..."
          className="input-shell"
        />
        <div className="max-h-48 overflow-auto rounded-xl border border-border/45 bg-paper/80">
          {recultureSearchRows.length ? (
            recultureSearchRows.map((entry) => {
              const isSelected =
                selectedRecultureEntry && selectedRecultureEntry.jarId.toLowerCase() === entry.jarId.toLowerCase();
              return (
                <button
                  key={entry.jarId}
                  type="button"
                  onClick={() => selectRecultureSource(entry)}
                  className={`w-full border-b border-border/35 px-3 py-2 text-left text-sm transition last:border-b-0 ${
                    isSelected ? "bg-primary/15 text-primary" : "hover:bg-primary/5 text-dark"
                  }`}
                >
                  <p className="font-semibold">{entry.jarId}</p>
                  <p className="text-xs text-subtle">
                    Culture {entry.cultureDate || "-"} | Rack {entry.rackNo || "-"} | {entry.orchidType || "Type N/A"}
                  </p>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-3 text-xs text-subtle">No jars match the search.</div>
          )}
        </div>
      </div>

      {selectedRecultureEntry ? (
        <div className="space-y-3">
          <div className="panel-muted px-4 py-3 text-sm text-dark">
            <p className="font-semibold">Step 2: selected source jar</p>
            <p className="text-xs text-subtle mt-1">
              Jar: {selectedRecultureEntry.jarId} | Plant type: {selectedRecultureEntry.orchidType || "-"} | Rack:{" "}
              {selectedRecultureEntry.rackNo || "-"}
            </p>
            <p className="text-xs text-subtle mt-1">
              Parent jar: {selectedRecultureEntry.parentJarId || "Root jar"}
            </p>
            {selectedSourceParentEntry && (
              <p className="text-xs text-subtle mt-1">
                Parent preview: Culture {selectedSourceParentEntry.cultureDate || "-"} | Rack {selectedSourceParentEntry.rackNo || "-"} |
                {" "}Nutrition {selectedSourceParentEntry.nutrition || "-"}
              </p>
            )}
          </div>

          <div className="panel-muted px-4 py-3 space-y-3">
            <p className="font-semibold text-sm text-dark">Step 3: choose re-culture option</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRecultureType(RECULTURE_WITHOUT_SUB)}
                className={`rounded-xl border px-3 py-2 text-sm text-left transition ${
                  recultureType === RECULTURE_WITHOUT_SUB
                    ? "border-primary/45 bg-primary/10 text-primary"
                    : "border-border/45 bg-paper/70 text-dark hover:border-primary/25"
                }`}
              >
                Reculture WITHOUT Subculture
              </button>
              <button
                type="button"
                onClick={() => setRecultureType(RECULTURE_WITH_SUB)}
                className={`rounded-xl border px-3 py-2 text-sm text-left transition ${
                  recultureType === RECULTURE_WITH_SUB
                    ? "border-primary/45 bg-primary/10 text-primary"
                    : "border-border/45 bg-paper/70 text-dark hover:border-primary/25"
                }`}
              >
                Reculture WITH Subculture
              </button>
            </div>
          </div>

          {recultureType === RECULTURE_WITHOUT_SUB && (
            <div className="space-y-3 rounded-xl border border-border/45 bg-paper/70 px-4 py-3">
              <p className="text-sm font-semibold text-dark">Without subculture (same jar ID)</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Jar ID">
                  <input value={selectedRecultureEntry.jarId} readOnly className="input-shell bg-paper/60 text-subtle" />
                </Field>
                <Field label="Re-culture date *">
                  <input
                    type="date"
                    value={sameJarReculture.recultureDate}
                    onChange={(e) => updateSameJarRecultureField("recultureDate", e.target.value)}
                    className="input-shell"
                  />
                </Field>
                <Field label="Nutrition type *">
                  <input
                    value={sameJarReculture.nutritionType}
                    onChange={(e) => updateSameJarRecultureField("nutritionType", e.target.value)}
                    placeholder="e.g. fresh MS + additives"
                    className="input-shell"
                  />
                </Field>
                <Field label="Plant count *">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={sameJarReculture.plantCount}
                    onChange={(e) => updateSameJarRecultureField("plantCount", e.target.value)}
                    placeholder="e.g. 20"
                    className="input-shell"
                  />
                </Field>
                <Field label="Notes">
                  <input
                    value={sameJarReculture.notes}
                    onChange={(e) => updateSameJarRecultureField("notes", e.target.value)}
                    placeholder="Media replaced, contamination check..."
                    className="input-shell"
                  />
                </Field>
              </div>
            </div>
          )}

          {recultureType === RECULTURE_WITH_SUB && (
            <div className="space-y-3 rounded-xl border border-border/45 bg-paper/70 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-dark">With subculture (split into new jars)</p>
                <button type="button" onClick={addSplitRow} className="btn-soft text-xs px-3 py-1.5">
                  Add child jar
                </button>
              </div>
              {splitRows.map((row, idx) => (
                <div key={idx} className="rounded-xl border border-border/40 bg-paper/80 px-3 py-3">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Field label={`New jar ID ${idx + 1} *`}>
                      <input
                        value={row.newJarId}
                        onChange={(e) => updateSplitRow(idx, "newJarId", normalizeJarIdInput(e.target.value))}
                        placeholder={`e.g. ${selectedRecultureEntry.jarId}.${idx + 1}`}
                        className="input-shell"
                      />
                    </Field>
                    <Field label="Parent jar ID">
                      <input
                        value={selectedRecultureEntry.jarId}
                        readOnly
                        className="input-shell bg-paper/60 text-subtle"
                      />
                    </Field>
                    <Field label="Re-culture date *">
                      <input
                        type="date"
                        value={row.recultureDate}
                        onChange={(e) => updateSplitRow(idx, "recultureDate", e.target.value)}
                        className="input-shell"
                      />
                    </Field>
                    <Field label="Nutrition type *">
                      <input
                        value={row.nutritionType}
                        onChange={(e) => updateSplitRow(idx, "nutritionType", e.target.value)}
                        placeholder="e.g. MS + BA"
                        className="input-shell"
                      />
                    </Field>
                    <Field label="Rack ID *">
                      <select
                        value={row.rackLocation}
                        onChange={(e) => updateSplitRow(idx, "rackLocation", e.target.value)}
                        className="input-shell"
                      >
                        <option value="">Select rack ID</option>
                        {splitRackOptions.map((rack) => (
                          <option key={rack} value={rack}>
                            {rack}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Plant count *">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={row.plantCount}
                        onChange={(e) => updateSplitRow(idx, "plantCount", e.target.value)}
                        placeholder="e.g. 20"
                        className="input-shell"
                      />
                    </Field>
                    <Field label="Notes">
                      <input
                        value={row.notes}
                        onChange={(e) => updateSplitRow(idx, "notes", e.target.value)}
                        placeholder="Optional"
                        className="input-shell"
                      />
                    </Field>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeSplitRow(idx)}
                      className="rounded-lg border border-rose-200/60 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-700 hover:border-rose-300 transition"
                    >
                      Remove child
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="panel-muted border-dashed px-4 py-3 text-xs text-subtle">
          Select a source jar to continue.
        </div>
      )}
    </div>
  );
}

function Timeline({ entry, entries, onMarkRemoved, onRestore, saving }) {
  const entryById = useMemo(() => {
    const map = new Map();
    (entries || []).forEach((item) => {
      const key = normalizeOptionKey(item?.jarId);
      if (!key) return;
      map.set(key, item);
    });
    return map;
  }, [entries]);

  const childJars = entries
    .filter((candidate) => normalizeOptionKey(candidate.directParentJarId || candidate.parentJarId) === normalizeOptionKey(entry.jarId))
    .map((candidate) => candidate.jarId)
    .sort((a, b) => a.localeCompare(b));
  const parentChain = useMemo(() => {
    const chain = [];
    const seen = new Set([normalizeOptionKey(entry.jarId)]);
    let cursor = entry.parentJarId || "";
    let level = 1;

    while (cursor) {
      const key = normalizeOptionKey(cursor);
      if (!key || seen.has(key)) break;
      seen.add(key);
      chain.push({ level, jarId: cursor });
      const parentEntry = entryById.get(key);
      cursor = parentEntry?.directParentJarId || parentEntry?.parentJarId || "";
      level += 1;
    }
    return chain;
  }, [entry.jarId, entry.parentJarId, entryById]);

  const relationRows = useMemo(() => {
    const rows = [{ relation: "Selected jar", jarId: entry.jarId }];
    if (parentChain.length) {
      parentChain.forEach((row) => {
        rows.push({
          relation: row.level === 1 ? "Parent jar" : `Ancestor ${row.level}`,
          jarId: row.jarId,
        });
      });
    } else {
      rows.push({ relation: "Parent jar", jarId: "Root jar" });
    }
    if (childJars.length) {
      childJars.forEach((jarId, idx) => {
        rows.push({ relation: `Child ${idx + 1}`, jarId });
      });
    } else {
      rows.push({ relation: "Child jars", jarId: "None" });
    }
    return rows;
  }, [entry.jarId, parentChain, childJars]);
  const historyRows = useMemo(
    () =>
      [...(Array.isArray(entry.recultures) ? entry.recultures : [])].sort(
        (a, b) => new Date(a?.date || 0) - new Date(b?.date || 0)
      ),
    [entry.recultures]
  );
  const [timelineRemovalReason, setTimelineRemovalReason] = useState(REMOVAL_REASON_CONTAMINATION);

  useEffect(() => {
    if (entry.isRemoved && entry.removedReason) {
      setTimelineRemovalReason(entry.removedReason);
      return;
    }
    setTimelineRemovalReason(REMOVAL_REASON_CONTAMINATION);
  }, [entry.isRemoved, entry.removedReason, entry.jarId]);

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
          {historyRows.length} events
        </span>
      </div>

      {historyRows.length === 0 ? (
        <div className="panel-muted border-dashed px-4 py-3 text-sm text-subtle">
          No re-culture dates logged yet. Add them later without changing the jar ID.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {historyRows.map((row, idx) => (
            <div key={`${entry.jarId}-${row.date}-${idx}`} className="panel-muted px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-primary/85">
                {row?.recultureType === "REMOVED" ? "End of lab life" : `Re-culture ${idx + 1}`}
              </p>
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
      <div className="panel-muted px-4 py-3 text-sm text-subtle">
        Parent jar: {entry.parentJarId || "Root jar"} - Child jars: {childJars.length ? childJars.join(", ") : "None"}
      </div>
      <div className="panel-muted px-4 py-3 text-sm text-subtle space-y-2">
        <p className="font-semibold text-dark">Hierarchy last step</p>
        <p>
          {entry.isRemoved
            ? `Removed from lab (${getRemovalReasonLabel(entry.removedReason)}${entry.removedAt ? ` on ${normalizeDateValue(entry.removedAt) || entry.removedAt}` : ""}).`
            : "Jar is active in lab."}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {!entry.isRemoved && (
            <select
              value={timelineRemovalReason}
              onChange={(e) => setTimelineRemovalReason(e.target.value)}
              className="input-shell max-w-[230px] py-1.5 text-xs"
            >
              {REMOVAL_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
          {entry.isRemoved ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => onRestore(entry.jarId)}
              className="rounded-lg border border-emerald-200/70 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-700 hover:border-emerald-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Restore jar
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => onMarkRemoved(entry.jarId, timelineRemovalReason)}
              className="rounded-lg border border-amber-200/70 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 hover:border-amber-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Mark as end of lab life
            </button>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border/45 bg-paper/70 overflow-hidden">
        <p className="px-4 py-3 text-sm font-semibold text-dark border-b border-border/45">Jar relationship table</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper/80">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-subtle">Relation</th>
                <th className="px-4 py-2 text-left font-medium text-subtle">Jar ID</th>
              </tr>
            </thead>
            <tbody>
              {relationRows.map((row, idx) => (
                <tr key={`${row.relation}-${row.jarId}-${idx}`} className="border-t border-border/35">
                  <td className="px-4 py-2 text-subtle">{row.relation}</td>
                  <td className="px-4 py-2 text-dark font-medium">{row.jarId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

