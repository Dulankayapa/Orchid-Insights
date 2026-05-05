import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Line } from "react-chartjs-2";
import { useLocation, useNavigate } from "react-router-dom";
import jsQR from "jsqr";//webcam live scan + upload scan with jsQR fallback
import {
  Chart as ChartJS, //Chart as ChartJS
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Legend,
  Filler,
  CategoryScale,
} from "chart.js";
import "chartjs-adapter-date-fns";
import { api } from "../lib/api";
import { db } from "../lib/firebase";
import { encodeFirebaseKeySegment } from "../lib/firebaseKeys";
import { ref, onValue, query, limitToLast, limitToFirst, orderByChild, push, update } from "firebase/database";
import { useTheme } from "../context/ThemeContext";

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Filler, CategoryScale);

const MAX_VALID_HEIGHT_MM = 190;

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const sanitizeHeightMm = (value) => {
  const num = toNumber(value);
  if (num === null) return null;
  return num <= MAX_VALID_HEIGHT_MM ? num : null;
};

const excelSerialToIsoDate = (serial) => {
  if (!Number.isFinite(serial)) return "";
  const wholeDays = Math.trunc(serial);
  const dayFraction = serial - wholeDays;
  const msInDay = 24 * 60 * 60 * 1000;
  const excelEpochUtc = Date.UTC(1899, 11, 30);
  const dt = new Date(excelEpochUtc + wholeDays * msInDay + Math.round(dayFraction * msInDay));
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().slice(0, 10);
};

const toIsoDate = (value) => {
  if (value === undefined || value === null || value === "") return "";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    if (value > 10000000000) {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
    }
    if (value > 1000000000) {
      const dt = new Date(value * 1000);
      return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
    }
    if (value > 20000 && value < 100000) {
      return excelSerialToIsoDate(value);
    }
    return "";
  }

  const raw = String(value).trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(raw)) {
    const [aRaw, bRaw, cRaw] = raw.split(/[./-]/);
    const a = Number(aRaw);
    const b = Number(bRaw);
    let c = Number(cRaw);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return "";
    if (c < 100) c += c >= 70 ? 1900 : 2000;

    const toIso = (day, month, year) => {
      const dt = new Date(Date.UTC(year, month - 1, day));
      if (Number.isNaN(dt.getTime())) return "";
      if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return "";
      return dt.toISOString().slice(0, 10);
    };

    if (a > 12 && b <= 12) return toIso(a, b, c);
    if (b > 12 && a <= 12) return toIso(b, a, c);
    if (a > 12 && b > 12) return "";

    // Ambiguous dates like 3/8/2026: prefer a non-future interpretation.
    const dmyIso = toIso(a, b, c);
    const mdyIso = toIso(b, a, c);
    if (!dmyIso) return mdyIso;
    if (!mdyIso) return dmyIso;

    const todayIso = new Date().toISOString().slice(0, 10);
    const dmyPast = dmyIso <= todayIso;
    const mdyPast = mdyIso <= todayIso;
    if (dmyPast && !mdyPast) return dmyIso;
    if (mdyPast && !dmyPast) return mdyIso;

    return mdyIso;
  }

  const numericRaw = Number(raw);
  if (Number.isFinite(numericRaw)) {
    return toIsoDate(numericRaw);
  }

  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
};

const isoDateToUtcTimestamp = (isoDate) => {
  const iso = toIsoDate(isoDate);
  if (!iso) return null;
  const ts = Date.parse(`${iso}T12:00:00Z`);
  return Number.isFinite(ts) ? ts : null;
};

const normalizeId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "").toLowerCase();
  const jarMatch = compact.match(/^jar0*(\d+)$/);
  if (jarMatch) return `jar${Number(jarMatch[1])}`;
  const jMatch = compact.match(/^j0*(\d+)$/);
  if (jMatch) return `jar${Number(jMatch[1])}`;
  const numericMatch = compact.match(/^0*(\d+)$/);
  if (numericMatch) return `jar${Number(numericMatch[1])}`;
  return compact;
};

const canonicalJarKey = (value) => {
  const norm = normalizeId(value);
  if (!norm) return "";
  const match = norm.match(/^jar(\d+)$/);
  if (match) return `Jar${match[1]}`;
  return value?.toString()?.trim() || "";
};

const canonicalPlantId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw;
};

const splitJarInputs = (value) =>
  Array.from(
    new Set(
      String(value || "")
        .split(/[\s,;]+/)
        .map((id) => id.trim())
        .filter(Boolean)
    )
  );

const coerceTimestamp = (value) => {
  const num = toNumber(value);
  if (num === null) return null;
  return num < 10000000000 ? num * 1000 : num;
};

const normalizeHeightEntry = (entry) => {
  if (entry === undefined || entry === null) return null;
  if (typeof entry === "number") {
    const num = sanitizeHeightMm(entry);
    return num === null ? null : { height_mm: num };
  }
  if (typeof entry === "string") {
    const num = sanitizeHeightMm(entry);
    return num === null ? null : { height_mm: num };
  }
  if (typeof entry !== "object") return null;
  const sourceTag = String(entry.source || entry.origin || "").toLowerCase();
  if (sourceTag.includes("dataset-biweekly") || sourceTag.includes("mock")) return null;

  const heightMm = toNumber(entry.height_mm ?? entry.height ?? entry.heightMm ?? entry.heightMM ?? entry.current_height);
  const heightCm = toNumber(entry.height_cm ?? entry.heightCm);
  const resolvedHeight = heightMm ?? (heightCm !== null ? heightCm * 10 : null);
  const sanitizedHeight = sanitizeHeightMm(resolvedHeight);
  if (sanitizedHeight === null) return null;

  const ts = coerceTimestamp(entry.timestamp ?? entry.ts ?? entry.time ?? entry.logged_at ?? entry.loggedAt);
  const date = entry.date || entry.recorded_at || entry.recordedAt || (ts ? new Date(ts).toISOString().split("T")[0] : null);

  return {
    ...entry,
    height_mm: sanitizedHeight,
    timestamp: ts,
    date,
  };
};

const normalizeHeights = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list.map(normalizeHeightEntry).filter(Boolean);
};

const normalizePlantRecord = (plant) => {
  if (!plant) return null;
  const extra = plant.extra || {};
  const heights = normalizeHeights(
    plant.heights ??
      extra.heights ??
      extra.height_history ??
      extra.heightHistory ??
      extra.growth_logs ??
      extra.growthLogs
  );
  const planting_date = toIsoDate(
    plant.planting_date || plant.plantingDate || extra.planting_date || extra.plantingDate || ""
  );
  const height_mm = toNumber(
    plant.height_mm ?? plant.height ?? plant.current_height ?? extra.height_mm ?? extra.height ?? extra.current_height
  );

  return {
    ...plant,
    id: plant.id ?? extra.id ?? "",
    planting_date,
    height_mm: sanitizeHeightMm(height_mm),
    cultivar: plant.cultivar ?? extra.cultivar ?? extra.orchidType,
    location: plant.location ?? extra.location ?? (extra.rackNo ? `Rack ${extra.rackNo}` : undefined),
    heights,
  };
};

const normalizePlantSnapshot = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map((item, idx) => normalizePlantRecord({ id: item?.id ?? String(idx), ...(item || {}) }))
      .filter(Boolean);
  }

  return Object.entries(data)
    .map(([key, value]) => normalizePlantRecord({ id: key, ...(value || {}) }))
    .filter(Boolean);
};

const normalizeCultureRecord = (key, value) => {
  const entry = value && typeof value === "object" ? value : {};
  const jarId = String(entry.jarId || key || "").trim();
  if (!jarId) return null;

  const rawRecultures = Array.isArray(entry.recultures)
    ? entry.recultures
    : entry.recultures && typeof entry.recultures === "object"
      ? Object.values(entry.recultures)
      : [];

  const recultures = rawRecultures
    .map((row) => {
      const rec = row && typeof row === "object" ? row : {};
      const date = toIsoDate(
        rec.date ||
          rec.cultureDate ||
          rec.planting_date ||
          rec.plantingDate ||
          rec.eventDate ||
          rec.event_date ||
          rec.timestamp ||
          rec.time ||
          ""
      );
      if (!date) return null;
      return { ...rec, date };
    })
    .filter(Boolean);

  const explicitCultureDate = toIsoDate(
    entry.cultureDate ||
      entry.culture_date ||
      entry.planting_date ||
      entry.plantingDate ||
      entry.start_date ||
      entry.startDate ||
      entry.inoculation_date ||
      entry.inoculationDate ||
      entry.sowing_date ||
      entry.sowingDate ||
      ""
  );
  const earliestRecultureDate = recultures.map((r) => r.date).sort()[0] || "";
  const cultureDate = [explicitCultureDate, earliestRecultureDate].filter(Boolean).sort()[0] || "";

  return {
    jarId,
    cultureDate,
    rackNo: entry.rackNo ?? entry.rack_no ?? entry.rack ?? "",
    orchidType: entry.orchidType || entry.cultivar || entry.type || "",
    nutrition: entry.nutrition || "",
    recultures,
    updatedAt: entry.updatedAt || entry.updated_at || null,
  };
};

const toIsoDateFromTimestamp = (value) => {
  const ts = coerceTimestamp(value);
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toISOString().slice(0, 10);
};

const calculateAgeDaysFromIso = (isoDate) => {
  const normalized = toIsoDate(isoDate);
  if (!normalized) return null;
  const planted = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(planted.getTime())) return null;
  const diffMs = new Date().setHours(0, 0, 0, 0) - planted.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
};

const normalizeJarIdInput = (value) => {
  const next = (value || "").trimStart();
  if (!next) return value || "";
  if (/^j(ar)?\d+/i.test(next)) {
    return next[0].toLowerCase() === "j" ? `J${next.slice(1)}` : value;
  }
  return value;
};

const parseJarIdFromQrPayload = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";

  if (/^jar:/i.test(raw)) {
    return normalizeJarIdInput(raw.replace(/^jar:/i, "").trim());
  }

  try {
    const parsed = new URL(raw);
    const fromQuery = parsed.searchParams.get("jar") || parsed.searchParams.get("jarId") || parsed.searchParams.get("id");
    if (fromQuery) return normalizeJarIdInput(fromQuery);
  } catch {
    // Keep raw value when it's not a URL.
  }

  return normalizeJarIdInput(raw);
};

const deriveIdAliases = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const aliases = new Set();
  const add = (candidate) => {
    const normalized = normalizeId(candidate);
    if (normalized) aliases.add(normalized);
  };

  add(raw);
  add(canonicalJarKey(raw));
  add(canonicalPlantId(raw));

  const compact = raw.replace(/[\s_-]+/g, "").toLowerCase();
  const jMatch = compact.match(/^j0*(\d+)$/);
  if (jMatch) {
    const num = Number(jMatch[1]);
    add(`jar${num}`);
    add(String(num));
  }

  return Array.from(aliases);
};

export default function GrowthTracker() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const location = useLocation();
  const navigate = useNavigate();

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [plantRecords, setPlantRecords] = useState([]);
  const [plantFetchError, setPlantFetchError] = useState("");
  const [cultureEntries, setCultureEntries] = useState([]);
  const [cultureError, setCultureError] = useState("");
  const [jarId, setJarId] = useState("");
  const enteredJarIds = useMemo(() => splitJarInputs(jarId), [jarId]);
  const activeJarId = enteredJarIds[0] || "";
  const activeIdAliases = useMemo(() => deriveIdAliases(activeJarId), [activeJarId]);
  const activeCanonicalId = useMemo(() => canonicalPlantId(activeJarId), [activeJarId]);
  const [plantingDate, setPlantingDate] = useState("");
  const [currentHeight, setCurrentHeight] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [analyzedHeight, setAnalyzedHeight] = useState(null);
  const [analyzedJarId, setAnalyzedJarId] = useState("");
  const [sensorLatest, setSensorLatest] = useState(null);
  const [jarLive, setJarLive] = useState(null);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [sensorError, setSensorError] = useState("");
  const [heightLogError, setHeightLogError] = useState("");
  const [jarPersistStatus, setJarPersistStatus] = useState("");
  const [jarPersistError, setJarPersistError] = useState("");
  const [analysisSaveStatus, setAnalysisSaveStatus] = useState("");
  const [analysisSaveError, setAnalysisSaveError] = useState("");
  const [firstGrowthTimestamp, setFirstGrowthTimestamp] = useState(null);
  const [firstGlobalGrowthTimestamp, setFirstGlobalGrowthTimestamp] = useState(null);
  const [ageSourceLabel, setAgeSourceLabel] = useState("");
  const lastHeightLoggedRef = useRef({ ts: 0, height: null });
  const createdJarIdsRef = useRef(new Set());

  const cultureMap = useMemo(() => {
    const map = new Map();
    cultureEntries.forEach((entry) => {
      deriveIdAliases(entry?.jarId).forEach((key) => {
        if (!key) return;
        if (!map.has(key)) {
          map.set(key, entry);
        }
      });
    });
    return map;
  }, [cultureEntries]);

  const mergedPlantRecords = useMemo(() => {
    const map = new Map();

    plantRecords.forEach((plant) => {
      const key = normalizeId(plant?.id);
      if (!key) return;
      map.set(key, plant);
    });

    cultureEntries.forEach((entry) => {
      const key = normalizeId(entry?.jarId);
      if (!key) return;

      const existing = map.get(key) || {};
      const merged = normalizePlantRecord({
        ...existing,
        id: existing.id || entry.jarId,
        planting_date: toIsoDate(existing.planting_date || entry.cultureDate || ""),
        cultivar: existing.cultivar || entry.orchidType || undefined,
        location: existing.location || (entry.rackNo ? `Rack ${entry.rackNo}` : undefined),
        nutrition: existing.nutrition || entry.nutrition || undefined,
        recultures: existing.recultures || entry.recultures || [],
      });
      if (merged) map.set(key, merged);
    });

    return Array.from(map.values());
  }, [cultureEntries, plantRecords]);

  const demoIds = useMemo(() => mergedPlantRecords.map((p) => p.id).filter(Boolean), [mergedPlantRecords]);
  const demoIdHint = useMemo(() => demoIds.join(", "), [demoIds]);

  const plantRecord = useMemo(() => {
    if (!activeJarId || !activeIdAliases.length) return null;
    return (
      mergedPlantRecords.find((p) => {
        const norm = normalizeId(p.id);
        return norm && activeIdAliases.includes(norm);
      }) || null
    );
  }, [activeJarId, activeIdAliases, mergedPlantRecords]);

  const cultureRecord = useMemo(() => {
    if (!activeJarId || !activeIdAliases.length) return null;
    for (const alias of activeIdAliases) {
      const row = cultureMap.get(alias);
      if (row) return row;
    }
    return null;
  }, [activeJarId, activeIdAliases, cultureMap]);

  const routeJarId = useMemo(
    () => canonicalJarKey(activeJarId) || activeCanonicalId || jarId || "",
    [activeJarId, activeCanonicalId, jarId]
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search || "");
    const incoming = params.get("jar") || params.get("jarId") || params.get("id");
    if (!incoming) return;
    const normalized = parseJarIdFromQrPayload(incoming);
    setJarId((prev) => (prev ? prev : normalized));
  }, [location.search]);

  useEffect(() => {
    if (!routeJarId) return;
    const params = new URLSearchParams(location.search || "");//search
    if (params.get("jar") === routeJarId) return;
    params.set("jar", routeJarId);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [routeJarId, location.pathname, location.search, navigate]);

  useEffect(() => {
    setPlantFetchError("");

    const plantsRef = ref(db, "plants");//plants
    const unsubscribe = onValue(
      plantsRef,
      (snap) => {
        const normalized = normalizePlantSnapshot(snap.val());
        setPlantRecords(normalized);
        setPlantFetchError("");
      },
      (err) => {
        const message = err?.message || "Failed to load plant records from Firebase";
        setPlantFetchError(message);
        setPlantRecords([]);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const entriesRef = ref(db, "recultureEntries");//recultureEntries
    const unsubscribe = onValue(
      entriesRef,
      (snap) => {
        const data = snap.val() || {};
        const next = Object.entries(data).map(([key, value]) => normalizeCultureRecord(key, value)).filter(Boolean);
        setCultureEntries(next);
        setCultureError("");
      },
      (err) => {
        setCultureError(err?.message || "Failed to load culture entries");
        setCultureEntries([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const recordSourceError = useMemo(
    () => [plantFetchError].filter(Boolean).join(" | "),
    [plantFetchError]
  );

  useEffect(() => {
    if (!enteredJarIds.length) {
      setJarPersistStatus("");
      setJarPersistError("");
      return;
    }

    const knownIds = new Set(mergedPlantRecords.map((record) => normalizeId(record?.id)).filter(Boolean));
    const candidates = enteredJarIds
      .map((raw) => {
        const normalized = normalizeId(raw);
        const canonicalId = canonicalPlantId(raw);
        return { raw, normalized, canonicalId };
      })
      .filter(({ normalized, canonicalId }) => {
        if (!normalized || !canonicalId) return false;
        if (knownIds.has(normalized)) return false;
        if (createdJarIdsRef.current.has(normalized)) return false;
        return true;
      });

    if (!candidates.length) {
      return;
    }

    candidates.forEach(({ normalized }) => createdJarIdsRef.current.add(normalized));
    let cancelled = false;

    Promise.allSettled(
      candidates.map(async ({ canonicalId }) => {
        const baseRecord = {
          id: canonicalId,
          planting_date: null,
          height_mm: null,
          cultivar: null,
          updated_at: new Date().toISOString(),
        };

        try {
          const resp = await api.put(`/env/plants/${encodeURIComponent(canonicalId)}`, baseRecord);
          return { ok: true, canonicalId, record: normalizePlantRecord(resp?.data) || normalizePlantRecord(baseRecord), via: "api" };//env/plants
        } catch (apiErr) {
          try {
            // Fallback to direct RTDB write when backend env is not configured.
            await update(ref(db, `plants/${canonicalId}`), baseRecord);
            return { ok: true, canonicalId, record: normalizePlantRecord(baseRecord), via: "firebase" };
          } catch (firebaseErr) {
            const apiMessage = apiErr?.response?.data?.detail || apiErr?.message || "API save failed";
            const firebaseMessage = firebaseErr?.message || "Firebase save failed";
            return { ok: false, canonicalId, message: `${apiMessage}; ${firebaseMessage}` };
          }
        }
      })
    )
      .then((results) => {
        if (cancelled) return;

        const saved = [];
        const savedViaFallback = [];
        const failed = [];

        results.forEach((result, index) => {
          const { normalized, canonicalId } = candidates[index];
          if (result.status === "fulfilled" && result.value?.ok) {
            const normalizedRecord = result.value?.record;
            if (normalizedRecord) {
              setPlantRecords((prev) => {
                const exists = prev.some((row) => normalizeId(row?.id) === normalizeId(normalizedRecord.id));
                if (exists) return prev;
                return [...prev, normalizedRecord];
              });
            }
            saved.push(canonicalId);
            if (result.value?.via === "firebase") {
              savedViaFallback.push(canonicalId);
            }
            return;
          }

          createdJarIdsRef.current.delete(normalized);
          const message = result.value?.message || result.reason?.message || "Failed to save Jar ID";//Failed to save Jar ID
          failed.push(`${canonicalId} (${message})`);
        });

        if (saved.length) {
          const fallbackHint = savedViaFallback.length
            ? ` Saved via Firebase fallback: ${savedViaFallback.join(", ")}.`
            : "";
          setJarPersistStatus(`Saved IDs for future searches: ${saved.join(", ")}.${fallbackHint}`);
        } else {
          setJarPersistStatus("");
        }
        setJarPersistError(failed.length ? failed.join(" | ") : "");
      })
      .catch((err) => {
        if (cancelled) return;
        setJarPersistStatus("");
        setJarPersistError(err?.message || "Failed to save Jar IDs");
      });

    return () => {
      cancelled = true;
    };
  }, [enteredJarIds, mergedPlantRecords]);

  useEffect(() => {
    const latestRef = ref(db, "orchidData/latest");
    const off = onValue(
      latestRef,
      (snap) => {
        const val = snap.val();
        setSensorLatest(val ? normalizeSensor(val) : null);
      },
      (err) => setSensorError(err.message || "Failed to read latest sensor data")
    );
    return () => off();
  }, []);

  useEffect(() => {
    setSensorHistory([]);
    const unsubs = [];
    const aliasSet = new Set(activeIdAliases);
    const byJarRowsBySource = new Map();
    let globalRows = [];
    let orchidRows = [];

    const mergeAndSet = () => {
      const byTs = new Map();
      const byJarRows = Array.from(byJarRowsBySource.values()).flat();
      [...orchidRows, ...globalRows, ...byJarRows].forEach((row) => {
        const ts = Number(row?.timestamp);
        if (!Number.isFinite(ts)) return;
        byTs.set(ts, row);
      });
      const rows = Array.from(byTs.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      rows.reverse();
      setSensorHistory(rows);
    };

    if (activeCanonicalId) {
      const byJarPathIds = Array.from(
        new Set(
          [activeCanonicalId, activeJarId, canonicalJarKey(activeJarId)]
            .map((value) => String(value || "").trim())
            .filter(Boolean)
        )
      );
      byJarPathIds.forEach((pathId) => {
        const byJarRef = query(
          ref(db, `growthLogsByJar/${encodeFirebaseKeySegment(pathId)}`),
          limitToLast(150)
        );
        const offByJar = onValue(
          byJarRef,
          (snap) => {
            const rows = Object.values(snap.val() || {}).map((row) =>
              normalizeSensor({
                ...(row || {}),
                jarId: row?.jarId || row?.jar_id || pathId,
              })
            );
            byJarRowsBySource.set(pathId, rows);
            mergeAndSet();
          },
          (err) => {
            byJarRowsBySource.set(pathId, []);
            mergeAndSet();
            setSensorError(err.message || `Failed to read ${pathId} history`);
          }
        );
        unsubs.push(offByJar);
      });
    }

    if (aliasSet.size) {
      const globalRef = query(ref(db, "growthLogs"), limitToLast(800));
      const offGlobal = onValue(
        globalRef,
        (snap) => {
          const filtered = Object.values(snap.val() || {}).filter((row) => {
            if (!row || typeof row !== "object") return false;
            const aliases = [
              row.jarId,
              row.jar_id,
              row.id,
              row.jar,
              row.jarKey,
              row.plantId,
              row.plant_id,
            ]
              .map((value) => normalizeId(value))
              .filter(Boolean);
            return aliases.some((id) => aliasSet.has(id));
          });
          globalRows = filtered.map(normalizeSensor);
          mergeAndSet();
        },
        (err) => setSensorError(err.message || "Failed to read growth logs")
      );
      unsubs.push(offGlobal);
    }

    if (!activeCanonicalId) {
      const orchidRef = query(ref(db, "orchidData/logs"), limitToLast(150));
      const offOrchid = onValue(
        orchidRef,
        (snap) => {
          orchidRows = Object.values(snap.val() || {}).map(normalizeSensor);
          mergeAndSet();
        },
        (err) => setSensorError(err.message || "Failed to read sensor history")
      );
      unsubs.push(offOrchid);
    }

    return () => {
      unsubs.forEach((off) => off && off());
    };
  }, [activeCanonicalId, activeIdAliases]);

  useEffect(() => {
    if (!activeCanonicalId) {
      setFirstGrowthTimestamp(null);
      return undefined;
    }
    const firstRef = query(
      ref(db, `growthLogsByJar/${encodeFirebaseKeySegment(activeCanonicalId)}`),
      orderByChild("timestamp"),
      limitToFirst(1)
    );
    const off = onValue(
      firstRef,
      (snap) => {
        const data = snap.val() || {};
        const row = Object.values(data)[0];
        const ts = coerceTimestamp(row?.timestamp ?? row?.ts ?? row?.time ?? row?.logged_at ?? row?.created_at);
        setFirstGrowthTimestamp(Number.isFinite(ts) ? ts : null);
      },
      () => setFirstGrowthTimestamp(null)
    );
    return () => off();
  }, [activeCanonicalId]);

  useEffect(() => {
    if (!activeJarId) {
      setFirstGlobalGrowthTimestamp(null);
      return undefined;
    }

    const targetIds = new Set(
      [activeJarId, activeCanonicalId, canonicalJarKey(activeJarId), canonicalPlantId(activeJarId)]
        .map((value) => normalizeId(value))
        .filter(Boolean)
    );
    if (!targetIds.size) {
      setFirstGlobalGrowthTimestamp(null);
      return undefined;
    }

    const logsRef = query(ref(db, "growthLogs"), limitToLast(800));
    const off = onValue(
      logsRef,
      (snap) => {
        const rows = Object.values(snap.val() || {});
        let earliestTs = null;

        rows.forEach((row) => {
          if (!row || typeof row !== "object") return;
          const matched = [
            row.jarId,
            row.jar_id,
            row.id,
            row.jar,
            row.jarKey,
            row.plantId,
            row.plant_id,
          ]
            .map((candidate) => normalizeId(candidate))
            .some((candidate) => candidate && targetIds.has(candidate));
          if (!matched) return;

          const ts = coerceTimestamp(row.timestamp ?? row.ts ?? row.time ?? row.logged_at ?? row.created_at);
          if (!Number.isFinite(ts)) return;
          earliestTs = earliestTs === null ? ts : Math.min(earliestTs, ts);
        });

        setFirstGlobalGrowthTimestamp(earliestTs);
      },
      () => setFirstGlobalGrowthTimestamp(null)
    );

    return () => off();
  }, [activeJarId, activeCanonicalId]);

  // Listen to per-jar RTDB nodes (e.g., Jar1, Jar2...) to capture live height for that jar.
  useEffect(() => {
    if (!activeJarId) {
      setJarLive(null);
      return undefined;
    }
    const jarKey = canonicalJarKey(activeJarId);
    if (!jarKey) return undefined;
    setJarLive(null);

    const jarRef = ref(db, jarKey);
    const off = onValue(
      jarRef,
      (snap) => {
        const val = snap.val();
        const normalized = val ? normalizeSensor({ ...val, jarId: jarKey }) : null;
        setJarLive(normalized);
      },
      (err) => setSensorError(err.message || "Failed to read jar live data")
    );
    return () => off();
  }, [activeJarId]);

  useEffect(() => {
    lastHeightLoggedRef.current = { ts: 0, height: null };
  }, [activeCanonicalId]);

  // Mirror live height readings into Firebase (growthLogs) so they are captured as soon as the sensor reports them.
  useEffect(() => {
    setHeightLogError("");
    const liveReading = jarLive ?? sensorLatest;
    if (!liveReading) return;

    const liveHeight = sanitizeHeightMm(liveReading.height_mm ?? liveReading.height);
    if (liveHeight === null) return;

    const ts = Number(liveReading.timestamp) || Date.now();

    const last = lastHeightLoggedRef.current;
    const isDuplicate =
      last && last.height !== null && Math.abs(liveHeight - last.height) < 0.1 && Math.abs(ts - last.ts) < 3000;
    if (isDuplicate) return;

    const sourceJarId =
      activeJarId || liveReading.jarId || liveReading.jar_id || liveReading.id || canonicalJarKey(activeJarId) || null;
    const canonicalId = canonicalPlantId(sourceJarId);
    if (!canonicalId) return;

    const temperature = toNumber(liveSource.temperature ?? liveSource.temp);
    const humidity = toNumber(liveSource.humidity ?? liveSource.hum);
    const lux = toNumber(liveSource.lux ?? liveSource.light ?? liveSource.lx);
    const mq135 = toNumber(liveSource.mq135 ?? liveSource.mq ?? liveSource.gas);

    const payload = {
      height_mm: liveHeight,
      height_cm: Number((liveHeight / 10).toFixed(1)),
      temperature,
      humidity,
      lux,
      mq135,
      timestamp: ts,
      jarId: canonicalId,
      source: "sensor",
    };

    const normalizedPlantingDate = toIsoDate(plantingDate);
    const plantUpdatePayload = {
      id: canonicalId,
      height_mm: liveHeight,
      temperature,
      humidity,
      lux,
      mq135,
      timestamp: ts,
      updated_at: new Date(ts).toISOString(),
    };
    if (normalizedPlantingDate) {
      plantUpdatePayload.planting_date = normalizedPlantingDate;
    }

    Promise.all([
      push(ref(db, "growthLogs"), payload),
      push(ref(db, `growthLogsByJar/${encodeFirebaseKeySegment(canonicalId)}`), payload),
      update(ref(db, `plants/${canonicalId}`), plantUpdatePayload),
    ])
      .then(() => {
        lastHeightLoggedRef.current = { ts, height: liveHeight };
      })
      .catch((err) => setHeightLogError(err?.message || "Failed to write live jar data to Firebase"));
  }, [sensorLatest, jarLive, activeJarId, plantingDate]);

  const oldestPlantHistoryTimestamp = useMemo(() => {
    const timestamps = [];
    (plantRecord?.heights || []).forEach((row) => {
      const ts = coerceTimestamp(row?.timestamp ?? row?.ts) ?? (row?.date ? Date.parse(row.date) : null);
      if (Number.isFinite(ts)) timestamps.push(ts);
    });
    if (!timestamps.length) return null;
    return Math.min(...timestamps);
  }, [plantRecord]);

  const oldestSensorHistoryTimestamp = useMemo(() => {
    const timestamps = (sensorHistory || [])
      .map((row) => coerceTimestamp(row?.timestamp ?? row?.ts ?? row?.time))
      .filter((ts) => Number.isFinite(ts));
    if (!timestamps.length) return null;
    return Math.min(...timestamps);
  }, [sensorHistory]);
  const resolvedPlantingInfo = useMemo(() => {
    if (!activeJarId) return { date: "", source: "" };

    const todayIso = new Date().toISOString().slice(0, 10);
    const candidates = [];
    const pushCandidate = (rawValue, source, rank) => {
      const iso = toIsoDate(rawValue);
      if (!iso || iso > todayIso) return;
      candidates.push({ iso, source, rank });
    };

    pushCandidate(cultureRecord?.cultureDate, "Culture details", 1);
    pushCandidate(plantRecord?.planting_date, "Plant record", 2);

    const earliestReculture = Array.isArray(cultureRecord?.recultures)
      ? cultureRecord.recultures
          .map((row) => toIsoDate(row?.date || row?.cultureDate || row?.timestamp || ""))
          .filter(Boolean)
          .sort()[0]
      : "";
    pushCandidate(earliestReculture, "Reculture trail", 3);

    pushCandidate(toIsoDateFromTimestamp(firstGrowthTimestamp), "Earliest growth log", 4);
    pushCandidate(toIsoDateFromTimestamp(firstGlobalGrowthTimestamp), "Global growth log", 5);
    pushCandidate(toIsoDateFromTimestamp(oldestSensorHistoryTimestamp), "Sensor history", 6);
    pushCandidate(toIsoDateFromTimestamp(oldestPlantHistoryTimestamp), "Plant height history", 7);

    if (!candidates.length) return { date: "", source: "" };
    // Prioritize culture-derived date when present for the selected Plant ID.
    candidates.sort((a, b) => {
      if (a.iso === b.iso) return a.rank - b.rank;
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.iso.localeCompare(b.iso);
    });
    return { date: candidates[0].iso, source: candidates[0].source };
  }, [
    activeJarId,
    cultureRecord,
    plantRecord,
    firstGrowthTimestamp,
    firstGlobalGrowthTimestamp,
    oldestSensorHistoryTimestamp,
    oldestPlantHistoryTimestamp,
  ]);

  const effectivePlantingDate = resolvedPlantingInfo.date || toIsoDate(plantingDate) || "";

  const derivedAgeDays = useMemo(() => calculateAgeDaysFromIso(effectivePlantingDate), [effectivePlantingDate]);

  useEffect(() => {
    if (!activeJarId) {
      setPlantingDate("");
      setCurrentHeight("");
      setAgeSourceLabel("");
      return;
    }

    const normalizedPlanting = resolvedPlantingInfo.date || "";
    const currentPlanting = toIsoDate(plantingDate);
    if (normalizedPlanting !== currentPlanting) {
      setPlantingDate(normalizedPlanting);
    }
    setAgeSourceLabel(resolvedPlantingInfo.source || "");
  }, [activeJarId, plantRecord, plantingDate, resolvedPlantingInfo]);

  const clearAnalysisState = () => {
    setError("");
    setResult(null);
    setAnalyzedJarId("");
    setAnalyzedHeight(null);
    setAnalysisSaveStatus("");
    setAnalysisSaveError("");
  };

  const handleNewHeight = () => {
    clearAnalysisState();
    setCurrentHeight("");
  };

  useEffect(() => {
    setCurrentHeight("");
    setError("");
    setResult(null);
    setAnalyzedJarId("");
    setAnalyzedHeight(null);
    setAnalysisSaveStatus("");
    setAnalysisSaveError("");
  }, [activeJarId]);

  const submit = async (e) => {
    e.preventDefault();
    clearAnalysisState();

    const resolvedHeight = sanitizeHeightMm(currentHeight || fallbackHeight);

    if (!activeCanonicalId) {
      setError("Enter a Jar/Plant ID before analysis so the result can be saved to the plant database.");
      return;
    }

    const normalizedPlanting = toIsoDate(plantingDate) || resolvedPlantingInfo.date;
    if (!normalizedPlanting) {
      setError("No planting date found in Firebase for this jar. Add culture date or keep streaming growth logs.");
      return;
    }

    if (resolvedHeight === null) {
      setError("Current height must come from live sensor stream. Wait for a fresh reading for this Jar/Plant ID.");
      return;
    }

    const payload = {
      planting_date: normalizedPlanting,
      current_height_mm: resolvedHeight,
      age_days: derivedAgeDays ?? undefined,
    };

    setLoading(true);
    try {
      const resp = await api.post("/growth/analyze", payload);
      setResult(resp.data);
      setAnalyzedHeight(resolvedHeight);
      setAnalyzedJarId(activeCanonicalId);

      const heightMm = resolvedHeight;
      const plantPayload = {
        id: activeCanonicalId,
        planting_date: normalizedPlanting,
        height_mm: heightMm,
        cultivar: plantRecord?.cultivar || null,
        updated_at: new Date().toISOString(),
      };

      const mergeSavedRecord = (saved) => {
        const normalizedSaved = normalizePlantRecord(saved);
        if (!normalizedSaved) return;
        setPlantRecords((prev) => {
          const idx = prev.findIndex((row) => normalizeId(row?.id) === normalizeId(normalizedSaved.id));
          if (idx === -1) return [...prev, normalizedSaved];
          const next = [...prev];
          next[idx] = { ...next[idx], ...normalizedSaved };
          return next;
        });
      };

      try {
        const saveResp = await api.put(`/env/plants/${encodeURIComponent(activeCanonicalId)}`, plantPayload);
        mergeSavedRecord(saveResp?.data || plantPayload);
        setAnalysisSaveStatus(`Saved to plant database as ${activeCanonicalId}.`);
      } catch (apiErr) {
        try {
          await update(ref(db, `plants/${activeCanonicalId}`), plantPayload);
          mergeSavedRecord(plantPayload);
          setAnalysisSaveStatus(`Saved to plant database as ${activeCanonicalId} (Firebase fallback).`);
        } catch (firebaseErr) {
          const apiMessage = apiErr?.response?.data?.detail || apiErr?.message || "API save failed";
          const firebaseMessage = firebaseErr?.message || "Firebase save failed";
          setAnalysisSaveError(`${apiMessage}; ${firebaseMessage}`);
        }
      }
    } catch (err) {
      const message = err.response?.data?.detail || err.response?.data || err.message || "Request failed";
      setError(typeof message === "string" ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  const displayLabel = result?.predicted_label;
  const displayProbabilities = useMemo(() => {
    const base = result?.probabilities || {};
    const labels = ["below_expected", "within_expected", "above_expected"];
    return Object.fromEntries(labels.map((l) => [l, Number(base[l]) || 0]));
  }, [result]);

  const predictedPillClass = useMemo(() => {
    if (!displayLabel) return "border-border/45 bg-paper/70 text-subtle";
    const label = String(displayLabel).toLowerCase();
    if (label.includes("below")) return "border-accent/25 bg-accent/10 text-accent";
    if (label.includes("within") || label.includes("normal")) return "border-primary/25 bg-primary/10 text-primary";
    if (label.includes("above")) return "border-secondary/25 bg-secondary/10 text-secondary";
    return "border-border/45 bg-paper/70 text-subtle";
  }, [displayLabel]);

  const liveSource = useMemo(() => jarLive ?? sensorLatest, [jarLive, sensorLatest]);
  const liveHeight = sanitizeHeightMm(liveSource?.height_mm ?? liveSource?.height);
  const liveTimestamp = liveSource?.timestamp ?? liveSource?.ts ?? null;

  const heightPoints = useMemo(() => {
    const pts = [];
    if (Array.isArray(plantRecord?.heights)) {
      plantRecord.heights.forEach((row) => {
        const ts = coerceTimestamp(row.timestamp ?? row.ts) ?? (row.date ? Date.parse(row.date) : null);
        const h = sanitizeHeightMm(row.height_mm ?? row.height);
        if (ts && h !== null) pts.push({ x: ts, y: h, source: "record" });
      });
    }
    (sensorHistory || []).forEach((row) => {
      const ts = Number(row.timestamp);
      const h = sanitizeHeightMm(row.height_mm ?? row.height);
      if (Number.isFinite(ts) && h !== null) pts.push({ x: ts, y: h, source: "sensor" });
    });
    const latestPoint = liveSource;
    if (latestPoint) {
      const ts = Number(latestPoint.timestamp);
      const h = sanitizeHeightMm(latestPoint.height_mm ?? latestPoint.height);
      if (Number.isFinite(ts) && h !== null) pts.push({ x: ts, y: h, source: "latest" });
    }
    pts.sort((a, b) => a.x - b.x);
    return pts.slice(-120); // keep last 120 points
  }, [plantRecord, sensorHistory, liveSource]);

  const fallbackHeight = useMemo(() => {
    if (!heightPoints.length) return null;
    return heightPoints[heightPoints.length - 1]?.y ?? null;
  }, [heightPoints]);

  // Listen directly to Firebase plants/{id} for real-time planting date/height updates
  useEffect(() => {
    if (!activeCanonicalId) return undefined;
    const plantRef = ref(db, `plants/${activeCanonicalId}`);
    const off = onValue(
      plantRef,
      (snap) => {
        const val = snap.val();
        if (!val) return;
        const planted = toIsoDate(
          val.planting_date ||
            val.plantingDate ||
            val.cultureDate ||
            val.culture_date ||
            ""
        );
        if (planted) setPlantingDate(planted);
      },
      (err) => setPlantFetchError(err?.message || "Failed to read plant record from Firebase")
    );
    return () => off();
  }, [activeCanonicalId]);

  useEffect(() => {
    if (liveHeight !== null && liveHeight !== undefined) {
      setCurrentHeight(String(liveHeight));
    }
  }, [liveHeight]);

  useEffect(() => {
    if (!currentHeight && fallbackHeight !== null) {
      setCurrentHeight(String(fallbackHeight));
    }
  }, [currentHeight, fallbackHeight]);

  return (
    <div className="space-y-8">
      <Hero />
      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <FormCard
            onSubmit={submit}
            onNewHeight={handleNewHeight}
            jarId={jarId}
            activeJarId={activeJarId}
            enteredJarCount={enteredJarIds.length}
            setJarId={setJarId}
            plantingDate={plantingDate}
            setPlantingDate={setPlantingDate}
            currentHeight={currentHeight}
            setCurrentHeight={setCurrentHeight}
            derivedAgeDays={derivedAgeDays}
            today={today}
            ageSourceLabel={ageSourceLabel}
            loading={loading}
            error={error}
            plantRecord={plantRecord}
            cultureRecord={cultureRecord}
            demoIds={demoIds}
            demoIdHint={demoIdHint}
            plantFetchError={recordSourceError}
            cultureError={cultureError}
            heightLogError={heightLogError}
            jarPersistStatus={jarPersistStatus}
            jarPersistError={jarPersistError}
            analysisSaveStatus={analysisSaveStatus}
            analysisSaveError={analysisSaveError}
            liveHeight={liveHeight}
            liveTimestamp={liveTimestamp}
          />
          <HeightChartCard isLight={isLight} points={heightPoints} />
        </div>
        <ResultCard
          result={result}
          jarId={analyzedJarId}
          currentHeight={analyzedHeight}
          predictedPillClass={predictedPillClass}
          displayLabel={displayLabel}
          displayProbabilities={displayProbabilities}
        />
      </div>
    </div>
  );
}

function normalizeSensor(val) {
  const ts = Number(val.timestamp) || Date.now();
  const heightMmRaw =
    toNumber(
      val.height_mm ??
        val.height ??
        val.heightMm ??
        val.heightMM ??
        val.plantHeight ??
        val.distance_mm ??
        val.distanceMm ??
        val.level_mm
    ) ?? null;
  const heightCmRaw = toNumber(val.height_cm ?? val.heightCm ?? val.distance_cm ?? val.distanceCm ?? val.level_cm) ?? null;
  const height_mm = sanitizeHeightMm(heightMmRaw ?? (heightCmRaw !== null ? heightCmRaw * 10 : null));

  return {
    ...val,
    timestamp: ts,
    height_mm,
    height_cm: height_mm !== null ? Number((height_mm / 10).toFixed(1)) : heightCmRaw,
    lux: Number(val.lux ?? val.light ?? val.lx ?? 0),
    temperature: Number(val.temperature ?? val.temp ?? 0),
    humidity: Number(val.humidity ?? val.hum ?? 0),
    mq135: Number(val.mq135 ?? val.mq ?? 0),
  };
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
      <div className="relative space-y-3 max-w-3xl">
        <p className="kicker">Growth insight</p>
        <h2 className="title-lg">Orchid growth tracker</h2>
      </div>
    </motion.div>
  );
}

// FormCard component web camera scanner
function FormCard({
  onSubmit,
  onNewHeight,
  jarId,
  activeJarId,
  enteredJarCount,
  setJarId,
  plantingDate,
  setPlantingDate,
  currentHeight,
  setCurrentHeight,
  derivedAgeDays,
  today,
  ageSourceLabel,
  loading,
  error,
  plantRecord,
  cultureRecord,
  demoIds,
  demoIdHint,
  plantFetchError,
  jarPersistStatus,
  jarPersistError,
  analysisSaveStatus,
  analysisSaveError,
  liveHeight,
  liveTimestamp,
  cultureError,
  heightLogError,
}) {
  const [cameraOpen, setCameraOpen] = useState(false); // true when webcam scanner UI is open
  const [scanBusy, setScanBusy] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [cameraDevices, setCameraDevices] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraLoopTimeoutRef = useRef(null);
  const decodeCanvasRef = useRef(null);
  const barcodeDetectorRef = useRef(null);
  const uploadInputRef = useRef(null);
  const selectedCameraIdRef = useRef("");

  useEffect(() => {
    selectedCameraIdRef.current = selectedCameraId;
  }, [selectedCameraId]);

  const getCameraLabel = (device, index) => {
    const label = String(device?.label || "").trim();
    return label || `Camera ${index + 1}`;
  };

  const refreshCameraDevices = async (preferredDeviceId = "") => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((device) => device.kind === "videoinput");
      setCameraDevices(videoInputs);

      if (!videoInputs.length) {
        setSelectedCameraId("");
        return videoInputs;
      }

      const requestedDeviceId = preferredDeviceId || selectedCameraIdRef.current;
      const hasRequestedDevice =
        requestedDeviceId && videoInputs.some((device) => device.deviceId === requestedDeviceId);

      if (hasRequestedDevice) {
        if (selectedCameraIdRef.current !== requestedDeviceId) {
          setSelectedCameraId(requestedDeviceId);
        }
      } else {
        const rearCamera = videoInputs.find((device) => /back|rear|environment/i.test(device.label || ""));
        const fallbackDeviceId = rearCamera?.deviceId || videoInputs[0]?.deviceId || "";
        if (fallbackDeviceId && selectedCameraIdRef.current !== fallbackDeviceId) {
          setSelectedCameraId(fallbackDeviceId);
        }
      }

      return videoInputs;
    } catch {
      return [];
    }
  };

  const stopCameraScan = () => {
    if (cameraLoopTimeoutRef.current) {
      clearTimeout(cameraLoopTimeoutRef.current);
      cameraLoopTimeoutRef.current = null;
    }
    const stream = cameraStreamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.pause?.();
      cameraVideoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => () => stopCameraScan(), []);

  useEffect(() => {
    refreshCameraDevices();
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) return undefined;
    const handleDeviceChange = () => {
      refreshCameraDevices();
    };
    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
  }, []);

  useEffect(() => {
    if (!cameraOpen || !cameraStreamRef.current || !cameraVideoRef.current) return; 
    const videoEl = cameraVideoRef.current;
    if (videoEl.srcObject !== cameraStreamRef.current) {
      videoEl.srcObject = cameraStreamRef.current;
    }
    videoEl.play?.().catch(() => {});
  }, [cameraOpen]);

  const getBarcodeDetector = async () => {
    if (barcodeDetectorRef.current) return barcodeDetectorRef.current;
    if (typeof window === "undefined" || !window.BarcodeDetector) return null;
    try {
      let detector = null;
      if (typeof window.BarcodeDetector.getSupportedFormats === "function") {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (Array.isArray(formats) && formats.includes("qr_code")) {
          detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        }
      }
      if (!detector) detector = new window.BarcodeDetector();
      barcodeDetectorRef.current = detector;
      return detector;
    } catch {
      return null;
    }
  };

  // Fallback QR code detection using jsQR library when BarcodeDetector is unavailable or fails.
  const detectWithJsQr = (source) => {
    if (!source || typeof document === "undefined") return [];
    const sourceWidth = Number(source.videoWidth || source.naturalWidth || source.width || 0);
    const sourceHeight = Number(source.videoHeight || source.naturalHeight || source.height || 0);
    if (!sourceWidth || !sourceHeight) return [];

    const maxSide = 960;
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    if (!decodeCanvasRef.current) decodeCanvasRef.current = document.createElement("canvas");
    const canvas = decodeCanvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return [];

    try {
      ctx.drawImage(source, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const result = jsQR(imageData.data, width, height, { inversionAttempts: "attemptBoth" });
      return result?.data ? [{ rawValue: result.data }] : [];
    } catch {
      return [];
    }
  };

  const detectQrFromSource = async (source) => {
    const detector = await getBarcodeDetector();
    if (detector) {
      try {
        const detections = await detector.detect(source);
        if (detections?.length) return detections;
      } catch {
        // Fallback to jsQR.
      }
    }
    return detectWithJsQr(source);
  };

  const applyScannedQrResult = (rawValue, sourceLabel = "QR") => {
    const parsed = parseJarIdFromQrPayload(rawValue);
    if (!parsed) {
      setScanStatus(`${sourceLabel} scan did not return a readable Jar/Plant ID.`);
      return false;
    }
    setJarId(parsed);
    setScanStatus(`Scanned ${parsed}.`);
    return true;
  };

  const runCameraDetectionLoop = async () => {
    if (!cameraStreamRef.current) return;
    try {
      const videoEl = cameraVideoRef.current;
      if (videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        const detections = await detectQrFromSource(videoEl);
        const rawValue = detections?.[0]?.rawValue;
        if (rawValue) {
          const parsed = applyScannedQrResult(rawValue, "Camera QR");
          if (parsed) {
            stopCameraScan();
            return;
          }
        }
      }
    } catch {
      // keep scanner loop alive
    }
    cameraLoopTimeoutRef.current = window.setTimeout(runCameraDetectionLoop, 250);
  };

  const startCameraScan = async (requestedDeviceId = "", forceRestart = false) => {
    if (scanBusy) return;

    if (cameraOpen && !forceRestart) {
      stopCameraScan();
      setScanStatus("Camera scan stopped.");
      return;
    }
    if (cameraOpen && forceRestart) {
      stopCameraScan();
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setScanStatus("Camera is not available in this browser.");
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || "")
    ) {
      setScanStatus("Camera access requires HTTPS (or localhost).");
      return;
    }

    const waitForVideoFrame = async (videoEl, timeoutMs = 2200) => {
      if (!videoEl) return false;
      const hasFrame = () => videoEl.videoWidth > 0 && videoEl.videoHeight > 0;
      if (hasFrame()) return true;
      return new Promise((resolve) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
          if (hasFrame()) {
            clearInterval(timer);
            resolve(true);
            return;
          }
          if (Date.now() - startedAt > timeoutMs) {
            clearInterval(timer);
            resolve(false);
          }
        }, 100);
      });
    };
// Try multiple constraint sets to maximize compatibility across different devices and browsers.
    setScanBusy(true);
    try {
      const preferredDeviceId = requestedDeviceId || selectedCameraIdRef.current;
      const attempts = preferredDeviceId
        ? [
            { video: { deviceId: { exact: preferredDeviceId } }, audio: false },
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            { video: true, audio: false },
          ]
        : [
            { video: { facingMode: { ideal: "environment" } }, audio: false },
            { video: { facingMode: "user" }, audio: false },
            { video: true, audio: false },
          ];
      let stream = null;
      let usedDeviceId = "";
      for (const constraints of attempts) {
        try {
          const candidate = await navigator.mediaDevices.getUserMedia(constraints);
          if (!candidate) continue;
          if (cameraVideoRef.current) {
            cameraVideoRef.current.srcObject = candidate;
            try {
              await cameraVideoRef.current.play();
            } catch {
              // continue to frame check
            }
            const ready = await waitForVideoFrame(cameraVideoRef.current);
            if (!ready) {
              candidate.getTracks().forEach((track) => track.stop());
              continue;
            }
          }
          usedDeviceId = candidate.getVideoTracks?.()[0]?.getSettings?.().deviceId || "";
          stream = candidate;
          break;
        } catch {
          // try next
        }
      }
      if (!stream) throw new Error("Unable to start camera stream.");

      cameraStreamRef.current = stream;
      if (usedDeviceId && usedDeviceId !== selectedCameraIdRef.current) {
        setSelectedCameraId(usedDeviceId);
      }
      await refreshCameraDevices(usedDeviceId);
      setCameraOpen(true);
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      if (cameraVideoRef.current) {
        const videoEl = cameraVideoRef.current;
        videoEl.srcObject = stream;
        try {
          await videoEl.play();
        } catch {
          // continue
        }
      }
      setScanStatus("Camera started. Show QR to fill Jar/Plant ID.");
      runCameraDetectionLoop();
    } catch (err) {
      stopCameraScan();
      const message =
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access and retry."
          : err?.name === "NotFoundError"
            ? "No camera device found."
            : err?.message || "Unable to start camera scan.";
      setScanStatus(message);
    } finally {
      setScanBusy(false);
    }
  };

  const handleCameraSelectionChange = async (e) => {
    const nextDeviceId = e.target.value || "";
    setSelectedCameraId(nextDeviceId);
    if (!cameraOpen) return;
    await startCameraScan(nextDeviceId, true);
  };
// Trigger file input click to select an image for QR scanning.
  const triggerUploadScan = () => {
    uploadInputRef.current?.click();
  };

  const handleUploadScan = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    stopCameraScan();
    setScanBusy(true);
    try {
      let detections = [];
      if (typeof createImageBitmap === "function") {
        const bitmap = await createImageBitmap(file);
        try {
          detections = await detectQrFromSource(bitmap);
        } finally {
          bitmap.close?.();
        }
      } else {
        const imageUrl = URL.createObjectURL(file);
        try {
          const image = new Image();
          await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
            image.src = imageUrl;
          });
          detections = await detectQrFromSource(image);
        } finally {
          URL.revokeObjectURL(imageUrl);
        }
      }

      const rawValue = detections?.[0]?.rawValue;
      if (!rawValue) {
        setScanStatus("No QR code detected in uploaded image.");
        return;
      }
      applyScannedQrResult(rawValue, "Uploaded QR");
    } catch (err) {
      setScanStatus(err?.message || "Failed to scan uploaded QR image.");
    } finally {
      setScanBusy(false);
    }
  };
// Render
  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Input</p>
          <h3 className="text-lg font-semibold mt-1 text-dark">Enter plant details</h3>
        </div>
        <StatusDot online />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Jar / Plant ID (optional, comma-separated supported)">
          <input
            value={jarId}
            onChange={(e) => setJarId(normalizeJarIdInput(e.target.value))}
            onPaste={(e) => {
              const pasted = e.clipboardData?.getData("text") || "";
              const parsed = parseJarIdFromQrPayload(pasted);
              if (!parsed) return;
              e.preventDefault();
              setJarId(parsed);
            }}
            placeholder={demoIds.length ? `e.g. ${demoIds[0]}` : "Enter Jar ID"}
            className="input-shell"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => startCameraScan()}
              disabled={scanBusy}
              className="btn-soft text-xs px-3 py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cameraOpen ? "Stop camera" : "Scan QR (camera)"}
            </button>
            <button
              type="button"
              onClick={triggerUploadScan}
              disabled={scanBusy}
              className="btn-soft text-xs px-3 py-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Scan QR (upload image)
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              onChange={handleUploadScan}
              className="hidden"
            />
          </div>
          {cameraDevices.length > 1 ? (
            <div className="mt-2 flex items-center gap-2">
              <label htmlFor="growth-tracker-camera-select" className="text-[11px] text-subtle whitespace-nowrap">
                Camera
              </label>
              <select
                id="growth-tracker-camera-select"
                value={selectedCameraId}
                onChange={handleCameraSelectionChange}
                disabled={scanBusy}
                className="input-shell py-1.5 text-xs"
              >
                {cameraDevices.map((device, index) => (
                  <option key={device.deviceId || `camera-${index}`} value={device.deviceId}>
                    {getCameraLabel(device, index)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {cameraOpen ? (
            <div className="mt-2 rounded-xl border border-border/45 bg-paper/70 p-2">
              <video
                ref={cameraVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full rounded-lg border border-border/35 bg-slate-900/90 max-h-40 object-contain"
              />
            </div>
          ) : null}
          {scanStatus ? <p className="text-[11px] text-subtle mt-1">{scanStatus}</p> : null}
          <p className="text-[11px] text-subtle mt-1">
            QR scan/paste supported. Payload can be only Jar ID (recommended) or a tracker link.
          </p>
        </Field>
        <Field label="Planting date (auto from Firebase)">
          <input
            type="text"
            value={plantingDate}
            readOnly
            disabled
            placeholder="Choose a Jar/Plant ID to load"
            className="input-shell bg-paper/70 text-subtle"
          />
        </Field>
        <Field label="Current height (mm) *">
          <div className="space-y-1">
            <input
              type="number"
              step="0.1"
              value={currentHeight}
              readOnly
              disabled
              placeholder={
                liveHeight !== null && liveHeight !== undefined
                  ? `Live: ${liveHeight} mm`
                  : "Waiting for live sensor reading"
              }
              className="w-full rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-500"
            />
            <p className="text-xs text-emerald-700">
              {liveHeight !== null && liveHeight !== undefined
                ? `Live: ${liveHeight} mm${liveTimestamp ? ` | ${new Date(liveTimestamp).toLocaleTimeString()}` : ""}`
                : "Waiting for live height from Firebase…"}
            </p>
          </div>
        </Field>
        <Field label="Age (days) - auto">
          <div className="space-y-1">
            <input
              type="number"
              value={derivedAgeDays ?? ""}
              readOnly
              disabled
              placeholder={derivedAgeDays !== null ? `Auto: ${derivedAgeDays}` : "Auto-calculated from Firebase"}
              className="input-shell bg-paper/70 text-subtle"
            />
            <p className="text-xs text-slate-600">
              {derivedAgeDays !== null
                ? `Auto age: ${derivedAgeDays} days${ageSourceLabel ? ` | Source: ${ageSourceLabel}` : ""}`
                : "Waiting for planting factors from Firebase..."}
            </p>
          </div>
        </Field>
      </div>

      {enteredJarCount > 1 && (
        <p className="text-xs text-sky-800 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          Multiple IDs detected. Live tracking and analysis currently use the first ID: {activeJarId}.
        </p>
      )}
      {!cultureRecord && jarId && (
        <p className="text-xs text-amber-800 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          No culture entry found for "{jarId}". Age will fallback to other Firebase factors (plant record and growth logs). Try {demoIdHint || "a known ID"}.
        </p>
      )}
      {!plantRecord && jarId && (
        <p className="text-xs text-amber-800 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          No record found for "{jarId}". Planting date and age come from database factors, and height waits for a live sensor reading. Try {demoIdHint || "a known ID"}.
        </p>
      )}
      {cultureRecord && (
        <div className="panel-muted grid sm:grid-cols-2 gap-3 p-3 text-xs text-subtle">
          <p>Planting: {plantingDate || "-"}</p>
          <p>Age: {derivedAgeDays !== null ? `${derivedAgeDays} days` : "-"}</p>
          <p className="sm:col-span-2">Age source: {ageSourceLabel || "Waiting for Firebase factors"}</p>
          <p>Rack: {cultureRecord.rackNo || "-"}</p>
          <p>Orchid: {cultureRecord.orchidType || "-"}</p>
          <p className="sm:col-span-2">Nutrition: {cultureRecord.nutrition || "-"}</p>
        </div>
      )}
      {plantFetchError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          Plant records unavailable: {plantFetchError}
        </p>
      )}
      {cultureError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          Culture entries unavailable: {cultureError}
        </p>
      )}
      {heightLogError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          Live height logging issue: {heightLogError}
        </p>
      )}
      {jarPersistError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          Could not save Jar ID: {jarPersistError}
        </p>
      )}
      {jarPersistStatus && (
        <p className="text-xs text-emerald-800 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          {jarPersistStatus}
        </p>
      )}
      {analysisSaveError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          Analysis result save failed: {analysisSaveError}
        </p>
      )}
      {analysisSaveStatus && (
        <p className="text-xs text-emerald-800 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          {analysisSaveStatus}
        </p>
      )}

      <p className="text-xs text-slate-600">Today: {today}</p>
      {plantRecord && (
        <p className="text-xs text-teal-800 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
          Planting date and age auto-filled from DB for {plantRecord.id}. Height comes from live sensor only.
        </p>
      )}

      <div className="panel-muted grid sm:grid-cols-2 gap-3 p-3 text-xs text-subtle">
        <p>Tip: current date defaults to today automatically.</p>
        <p>Units: millimeters.</p>
        <p className="sm:col-span-2">Live height readings auto-fill when the sensor streams and are logged to Firebase instantly.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onNewHeight}
          disabled={loading}
          className="btn-soft w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          New height
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner /> Analyzing...
            </span>
          ) : (
            "Analyze growth"
          )}
        </button>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-rose-200/60 bg-rose-500/10 px-4 py-3 text-sm text-rose-700"
          >
            Error: {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form >
  );
}

function ResultCard({ result, jarId, currentHeight, predictedPillClass, displayLabel, displayProbabilities }) {
  return (
    <div className="lg:col-span-3 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="panel space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="kicker">Prediction</p>
            <h3 className="text-lg font-semibold text-dark">Model output</h3>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary">
            <span className="h-2 w-2 rounded-full bg-primary shadow shadow-primary/40" />
            Live from FastAPI
          </div>
        </div>

        {!result && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-2xl border border-border/35 bg-paper/60 animate-pulse" />
            ))}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${predictedPillClass}`}>
                <span className="h-2 w-2 rounded-full bg-current opacity-80" />
                {displayLabel || "-"}
              </div>
              {jarId && (
                <div className="text-xs text-subtle px-3 py-1 rounded-full border border-border/45 bg-paper/70">
                  Jar/Plant: {jarId}
                </div>
              )}
              <div className="text-xs text-subtle px-3 py-1 rounded-full border border-border/45 bg-paper/70">
                Age: {result.age_days} days
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <StatCard title="Age (days)" value={result.age_days ?? "-"} hint="Days since planting" />
              <StatCard
                title="Expected range (mm)"
                value={result.expected_height_range ? `${result.expected_height_range[0]} - ${result.expected_height_range[1]}` : "-"}
                hint="Range sourced from dataset lookup"
              />
              <StatCard title="Current height (mm)" value={Number(currentHeight) || result?.plant_height_mm || "-"} hint="Value you provided" />
            </div>

            {displayProbabilities && (
              <div className="panel-muted p-5 space-y-4">
                <p className="text-sm text-dark font-semibold">Probability breakdown</p>
                <div className="grid gap-4">
                  {Object.entries(displayProbabilities).map(([label, prob]) => (
                    <ProbabilityBar key={label} label={label} value={prob} />
                  ))}
                </div>
              </div>
            )}

            <div className="panel-muted px-5 py-4 text-sm text-subtle">
              The model compares age-adjusted expected height range with your measurement to classify growth. Use the probability spread to judge confidence and watch for consistent shifts over time.
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
// SensorPanel component to display live Firebase data and recent history
function SensorPanel({ latest, history, error }) {
  const recent = (history || []).slice(0, 8);
  const formatTs = (ts) => {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? "--" : d.toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker">Sensor feed</p>
          <h4 className="text-lg font-semibold text-dark">Live Firebase data</h4>
        </div>
        <span className="text-xs text-primary px-3 py-1 rounded-full border border-primary/25 bg-primary/10">
          {latest ? "Streaming" : "Waiting..."}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-700">Sensor error: {error}</div>
      )}

      <p className="text-[11px] text-slate-600">
        Live height readings stream here and mirror to Firebase <code className="font-mono text-[10px]">growthLogs</code> automatically.
      </p>

      {latest ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SensorStat label="Height" value={`${latest.height_mm?.toFixed?.(1) ?? latest.height_mm ?? "-"} mm`} />
          <SensorStat label="Temperature" value={`${latest.temperature?.toFixed?.(1) ?? latest.temperature ?? "-"} \u00b0C`} />
          <SensorStat label="Humidity" value={`${latest.humidity?.toFixed?.(1) ?? latest.humidity ?? "-"} %`} />
          <SensorStat label="Light" value={`${latest.lux ?? "-"} lx`} />
          <SensorStat label="MQ135" value={latest.mq135 ?? "-"} />
          <SensorStat label="Timestamp" value={formatTs(latest.timestamp)} className="col-span-2" />
        </div>
      ) : (
        <p className="text-sm text-subtle">No live sensor reading yet. Confirm Firebase env vars or data feed.</p>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="kicker">Recent logs</p>
          <div className="space-y-2 max-h-56 overflow-auto pr-1">
            {recent.map((row, idx) => (
              <div
                key={`${row.timestamp}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-border/45 bg-paper/70 px-3 py-2 text-xs text-dark"
              >
                <span className="text-slate-600">{formatTs(row.timestamp)}</span>
                <span className="text-dark">
                  {row.temperature ?? "-"}\u00b0C \u00b7 {row.humidity ?? "-"}% \u00b7 {row.lux ?? "-"} lx \u00b7 MQ {row.mq135 ?? "-"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// PlantHistoryCard component to display plant history from Firebase-backed data
function PlantHistoryCard({ plantRecord, demoIdHint }) {
  const heights = plantRecord?.heights || [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker">Plant history</p>
          <h4 className="text-lg font-semibold text-dark">Plant profile & history</h4>
        </div>
        <span className="text-xs text-primary px-3 py-1 rounded-full border border-primary/25 bg-primary/10">Firebase</span>
      </div>

      {plantRecord && heights.length ? (
        <div className="space-y-2">
          {heights.map((row) => (
            <div
              key={`${plantRecord.id}-${row.date}`}
              className="flex items-center justify-between rounded-xl border border-border/45 bg-paper/70 px-3 py-2 text-sm text-dark"
            >
              <span className="text-subtle">{row.date}</span>
              <span className="font-semibold text-dark">{row.height_mm} mm</span>
            </div>
          ))}
        </div>
      ) : plantRecord ? (
        <div className="panel-muted px-4 py-3 text-sm text-subtle">
          No height history found for this Jar ID yet.
        </div>
      ) : (
        <div className="panel-muted px-4 py-3 text-sm text-subtle">
          Enter a Jar/Plant ID to auto-fill planting date and latest height. Known IDs: {demoIdHint || "n/a"}.
        </div>
      )}
    </motion.div>
  );
}

// Reusable Field component for form inputs
function Field({ label, children }) {
  return (
    <label className="block text-sm text-subtle space-y-2">
      <span className="text-dark">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="panel-muted p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] font-semibold text-primary/85">{title}</p>
      <p className="text-2xl font-semibold mt-2 text-dark">{value}</p>
      {hint && <p className="text-xs text-subtle mt-1">{hint}</p>}
    </div>
  );
}
// ProbabilityBar component to visualize class probabilities
function ProbabilityBar({ label, value }) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-subtle">
        <span className="font-semibold text-dark capitalize">{label.replace(/_/g, " ")}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-border/30 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35 }}
          className="h-full rounded-full bg-gradient-to-r from-primary via-secondary to-accent shadow-[0_0_18px_rgba(13,148,136,0.25)]"
        />
      </div>
    </div>
  );
}
// Simple spinner component using Framer Motion
function Spinner() {
  return (
    <motion.span
      className="inline-flex h-4 w-4 rounded-full border-2 border-white border-t-white/30"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    />
  );
}
// StatusDot component to indicate API connection status
function StatusDot({ online }) {
  return (
    <div className="flex items-center gap-2 text-xs text-primary">
      <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-primary shadow-[0_0_10px_rgba(13,148,136,0.7)]" : "bg-border"}`} />
      {online ? "API ready" : "Offline"}
    </div>
  );
}

function SensorStat({ label, value, className = "" }) {
  return (
    <div className={`panel-muted px-3 py-2 ${className}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-primary/85">{label}</p>
      <p className="text-sm font-semibold text-dark mt-1">{value}</p>
    </div>
  );
}

function ChartStat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-emerald-700">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-1">{value}</p>
      {hint && <p className="text-[11px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function HeightChartCard({ points, isLight }) {
  const HEIGHT_MIN_MM = 0;
  const HEIGHT_MAX_MM_BASE = 150;

  const chartPoints = useMemo(
    () =>
      (Array.isArray(points) ? points : [])
        .map((p) => {
          const x = Number(p?.x);
          const y = toNumber(p?.y);
          if (!Number.isFinite(x) || y === null) return null;
          return {
            ...p,
            x,
            y: Math.max(HEIGHT_MIN_MM, y),
          };
        })
        .filter(Boolean),
    [points]
  );

  const hasData = chartPoints.length > 0;
  const dynamicHeightMax = useMemo(() => {
    if (!hasData) return HEIGHT_MAX_MM_BASE;
    const maxVal = Math.max(...chartPoints.map((p) => p.y), HEIGHT_MIN_MM);
    const padded = maxVal + 10;
    return Math.max(HEIGHT_MAX_MM_BASE, Math.ceil(padded / 25) * 25);
  }, [hasData, chartPoints]);

  const chartStats = useMemo(() => {
    if (!hasData) return null;
    const cleaned = chartPoints.map((p) => ({
      x: p.x,
      y: p.y,
      source: p.source || "record",
    }));
    if (!cleaned.length) return null;

    cleaned.sort((a, b) => a.x - b.x);
    const values = cleaned.map((p) => p.y);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((sum, item) => sum + item, 0) / values.length;
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    const spread = max - min;
    const padding = spread === 0 ? Math.max(Math.abs(last.y) * 0.08, 0.2) : Math.max(spread * 0.35, 0.08);

    return {
      min,
      max,
      average,
      first,
      last,
      spread,
      change: last.y - first.y,
      count: cleaned.length,
      meanLine: [
        { x: first.x, y: Number(average.toFixed(3)) },
        { x: last.x, y: Number(average.toFixed(3)) },
      ],
    };
  }, [hasData, chartPoints]);

  const data = useMemo(
    () => ({
      datasets: [
        {
          label: "Height (mm)",
          data: chartPoints,
          parsing: false,
          spanGaps: true,
          borderColor: "rgba(5, 150, 105, 1)",
          borderWidth: 2.8,
          backgroundColor: "rgba(16, 185, 129, 0.22)",
          tension: 0.36,
          cubicInterpolationMode: "monotone",
          fill: true,
          pointBorderColor: "rgba(255, 255, 255, 0.95)",
          pointBorderWidth: 1,
          pointBackgroundColor: (ctx) => {
            const source = ctx.raw?.source;
            if (source === "latest") return "rgba(15, 118, 110, 1)";
            if (source === "sensor") return "rgba(16, 185, 129, 0.95)";
            return "rgba(59, 130, 246, 0.95)";
          },
          pointRadius: (ctx) => (ctx.raw?.source === "latest" ? 4.2 : 2.8),
          pointHoverRadius: 5.8,
        },
        ...(chartStats?.meanLine?.length === 2
          ? [
              {
                label: "Mean",
                data: chartStats.meanLine,
                parsing: false,
                borderColor: "rgba(71, 85, 105, 0.85)",
                borderWidth: 1.4,
                borderDash: [6, 4],
                pointRadius: 0,
                fill: false,
              },
            ]
          : []),
      ],
    }),
    [chartPoints, chartStats]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "nearest",
        intersect: false,
      },
      scales: {
        x: {
          type: "time",
          time: { unit: "day", tooltipFormat: "PPpp" },
          ticks: { color: "#475569", maxTicksLimit: 6 },
          grid: { color: "rgba(148, 163, 184, 0.18)" },
        },
        y: {
          min: HEIGHT_MIN_MM,
          max: dynamicHeightMax,
          title: { display: true, text: "mm", color: "#334155" },
          ticks: {
            color: "#334155",
            stepSize: dynamicHeightMax > 200 ? 50 : 25,
            callback: (value) => `${Number(value).toFixed(0)}`,
          },
          grid: { color: "rgba(148, 163, 184, 0.16)" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          titleColor: "#e2e8f0",
          bodyColor: "#f8fafc",
          callbacks: {
            label: (ctx) => `Height: ${Number(ctx.parsed.y).toFixed(2)} mm`,
            afterLabel: (ctx) => {
              const source = ctx.raw?.source;
              if (!source) return "";
              if (source === "latest") return "Source: Live stream";
              if (source === "sensor") return "Source: Sensor history";
              return "Source: Plant record";
            },
          },
        },
      },
    }),
    [chartStats, dynamicHeightMax]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className={`rounded-3xl p-5 space-y-4 shadow-[0_22px_60px_-30px_rgba(13,148,136,0.26)] ${
        isLight ? "bg-white border border-emerald-200 shadow-xl" : "border border-teal-100 bg-white/95"
      }`}
      style={{ minHeight: "360px" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-500">Growth</p>
          <h4 className="text-lg font-semibold text-slate-900">Height trend</h4>
          {chartStats?.last?.x ? (
            <p className="text-xs text-slate-500 mt-1">Last update: {new Date(chartStats.last.x).toLocaleString()}</p>
          ) : null}
        </div>
        <span className="text-xs text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 bg-emerald-50">
          {hasData ? "Live from Firebase" : "Waiting..."}
        </span>
      </div>

      {hasData ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <ChartStat label="Latest" value={`${chartStats?.last?.y?.toFixed?.(2) ?? "-"} mm`} />
            <ChartStat
              label="Change"
              value={`${(chartStats?.change ?? 0) >= 0 ? "+" : ""}${(chartStats?.change ?? 0).toFixed(2)} mm`}
              hint="oldest to latest"
            />
            <ChartStat
              label="Range"
              value={`${chartStats?.min?.toFixed?.(2) ?? "-"} to ${chartStats?.max?.toFixed?.(2) ?? "-"} mm`}
            />
            <ChartStat label="Samples" value={`${chartStats?.count ?? 0}`} hint={`Spread: ${(chartStats?.spread ?? 0).toFixed(2)} mm`} />
          </div>
          <div className="h-72 rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white p-3">
            <Line data={data} options={options} />
          </div>
        </>
      ) : (
        <div className="text-sm text-slate-700 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          No height points yet. Once a Jar is selected and either a plant history or live sensor height is available, the chart will populate automatically.
        </div>
      )}
    </motion.div>
  );
}


