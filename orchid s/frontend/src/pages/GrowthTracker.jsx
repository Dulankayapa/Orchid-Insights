import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
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
import { ref, onValue, query, limitToLast, push, update } from "firebase/database";
import { useTheme } from "../context/ThemeContext";

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Tooltip, Legend, Filler, CategoryScale);

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "").toLowerCase();
  const jarMatch = compact.match(/^jar0*(\d+)$/);
  if (jarMatch) return `jar${Number(jarMatch[1])}`;
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
  const norm = normalizeId(value);
  if (!norm) return "";
  const match = norm.match(/^jar(\d+)$/);
  if (match) return `jar-${String(Number(match[1])).padStart(2, "0")}`;
  return String(value || "").trim().toLowerCase();
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
  if (typeof entry === "number") return { height_mm: entry };
  if (typeof entry === "string") {
    const num = toNumber(entry);
    return num === null ? null : { height_mm: num };
  }
  if (typeof entry !== "object") return null;

  const heightMm = toNumber(entry.height_mm ?? entry.height ?? entry.heightMm ?? entry.heightMM ?? entry.current_height);
  const heightCm = toNumber(entry.height_cm ?? entry.heightCm);
  const resolvedHeight = heightMm ?? (heightCm !== null ? heightCm * 10 : null);
  if (resolvedHeight === null) return null;

  const ts = coerceTimestamp(entry.timestamp ?? entry.ts ?? entry.time ?? entry.logged_at ?? entry.loggedAt);
  const date = entry.date || entry.recorded_at || entry.recordedAt || (ts ? new Date(ts).toISOString().split("T")[0] : null);

  return {
    ...entry,
    height_mm: resolvedHeight,
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
  const planting_date =
    plant.planting_date || plant.plantingDate || extra.planting_date || extra.plantingDate || "";
  const height_mm = toNumber(
    plant.height_mm ?? plant.height ?? plant.current_height ?? extra.height_mm ?? extra.height ?? extra.current_height
  );

  return {
    ...plant,
    id: plant.id ?? extra.id ?? "",
    planting_date,
    height_mm,
    cultivar: plant.cultivar ?? extra.cultivar ?? extra.orchidType,
    location: plant.location ?? extra.location ?? (extra.rackNo ? `Rack ${extra.rackNo}` : undefined),
    heights,
  };
};

const normalizeRecultureRecord = (key, value) => {
  const base = value && typeof value === "object" ? value : {};
  const jar = String(base.jarId || key || "").trim();
  if (!jar) return null;

  return {
    id: jar,
    planting_date: base.cultureDate || base.culture_date || "",
    height_mm: null,
    cultivar: base.orchidType || base.cultivar || "",
    location: base.rackNo ? `Rack ${base.rackNo}` : undefined,
    heights: [],
    source: "reculture",
  };
};

const latestHeightFromHistory = (rows) => {
  if (!rows || !rows.length) return null;
  const enriched = rows
    .map((row) => {
      const ts = coerceTimestamp(row.timestamp ?? row.ts) ?? (row.date ? Date.parse(row.date) : null);
      return { row, ts: Number.isFinite(ts) ? ts : null };
    })
    .filter((item) => item.ts !== null);

  if (enriched.length) {
    enriched.sort((a, b) => b.ts - a.ts);
    return toNumber(enriched[0]?.row?.height_mm ?? enriched[0]?.row?.height);
  }

  return toNumber(rows[0]?.height_mm ?? rows[0]?.height);
};

const resolveCurrentHeight = (plant) => {
  const fromHistory = latestHeightFromHistory(plant?.heights || []);
  if (fromHistory !== null) return fromHistory;
  return toNumber(plant?.height_mm ?? plant?.height ?? plant?.current_height);
};

export default function GrowthTracker() {
  const { theme } = useTheme();
  const isLight = theme === "light";
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [plantRecords, setPlantRecords] = useState([]);
  const [plantFetchError, setPlantFetchError] = useState("");
  const [recultureRecords, setRecultureRecords] = useState([]);
  const [recultureError, setRecultureError] = useState("");
  const mergedPlantRecords = useMemo(() => {
    const byId = new Map();

    plantRecords.forEach((record) => {
      const key = normalizeId(record?.id);
      if (!key) return;
      byId.set(key, { ...record });
    });

    recultureRecords.forEach((record) => {
      const key = normalizeId(record?.id);
      if (!key) return;
      const existing = byId.get(key);
      if (!existing) {
        byId.set(key, { ...record });
        return;
      }
      byId.set(key, {
        ...existing,
        id: existing.id || record.id,
        planting_date: existing.planting_date || record.planting_date,
        cultivar: existing.cultivar || record.cultivar,
        location: existing.location || record.location,
      });
    });

    return Array.from(byId.values());
  }, [plantRecords, recultureRecords]);

  const demoIds = useMemo(() => mergedPlantRecords.map((p) => p.id).filter(Boolean), [mergedPlantRecords]);
  const demoIdHint = useMemo(() => demoIds.join(", "), [demoIds]);
  const [jarId, setJarId] = useState("");
  const enteredJarIds = useMemo(() => splitJarInputs(jarId), [jarId]);
  const activeJarId = enteredJarIds[0] || "";
  const activeCanonicalId = useMemo(() => canonicalPlantId(activeJarId), [activeJarId]);
  const [plantingDate, setPlantingDate] = useState("");
  const [currentHeight, setCurrentHeight] = useState("");
  const [manualAgeDays, setManualAgeDays] = useState("");
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
  const lastHeightLoggedRef = useRef({ ts: 0, height: null });
  const createdJarIdsRef = useRef(new Set());

  const plantRecord = useMemo(() => {
    if (!activeJarId) return null;
    const idNorm = normalizeId(activeJarId);
    return mergedPlantRecords.find((p) => normalizeId(p.id) === idNorm) || null;
  }, [activeJarId, mergedPlantRecords]);

  useEffect(() => {
    let active = true;
    setPlantFetchError("");

    api
      .get("/env/plants")
      .then((resp) => {
        if (!active) return;
        const data = Array.isArray(resp.data) ? resp.data : [];
        const normalized = data.map(normalizePlantRecord).filter(Boolean);
        setPlantRecords(normalized);
      })
      .catch((err) => {
        if (!active) return;
        const message = err.response?.data?.detail || err.message || "Failed to load plant records";
        setPlantFetchError(typeof message === "string" ? message : "Failed to load plant records");
        setPlantRecords([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setRecultureError("");
    const entriesRef = ref(db, "recultureEntries");
    const off = onValue(
      entriesRef,
      (snap) => {
        const data = snap.val() || {};
        const rows = Object.entries(data)
          .map(([key, value]) => normalizeRecultureRecord(key, value))
          .filter(Boolean);
        setRecultureRecords(rows);
      },
      (err) => {
        setRecultureError(err?.message || "Failed to load reculture entries");
        setRecultureRecords([]);
      }
    );
    return () => off();
  }, []);

  const recordSourceError = useMemo(
    () => [plantFetchError, recultureError].filter(Boolean).join(" | "),
    [plantFetchError, recultureError]
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
        const jarMatch = normalized.match(/^jar(\d+)$/);
        return { raw, normalized, canonicalId, isJar: Boolean(jarMatch) };
      })
      .filter(({ normalized, canonicalId, isJar }) => {
        if (!normalized || !canonicalId || !isJar) return false;
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
          return { ok: true, canonicalId, record: normalizePlantRecord(resp?.data) || normalizePlantRecord(baseRecord), via: "api" };
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
          const message = result.value?.message || result.reason?.message || "Failed to save Jar ID";
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
    const historyRef = activeCanonicalId
      ? query(ref(db, `growthLogsByJar/${activeCanonicalId}`), limitToLast(150))
      : query(ref(db, "orchidData/logs"), limitToLast(150));
    const off = onValue(
      historyRef,
      (snap) => {
        const raw = snap.val() || {};
        const rows = Object.values(raw || {}).map(normalizeSensor);
        rows.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        rows.reverse();
        setSensorHistory(rows);
      },
      (err) =>
        setSensorError(
          err.message ||
            (activeCanonicalId ? `Failed to read ${activeCanonicalId} history` : "Failed to read sensor history")
        )
    );
    return () => off();
  }, [activeCanonicalId]);

  // Listen to per-jar RTDB nodes (e.g., Jar1, Jar2...) to capture live height for that jar.
  useEffect(() => {
    if (!activeJarId) {
      setJarLive(null);
      return undefined;
    }
    const jarKey = canonicalJarKey(activeJarId);
    if (!jarKey) return undefined;

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

  // Autofill the current height field from the latest live sensor reading when a Jar is selected.
  useEffect(() => {
    if (!activeJarId) return;
    const liveHeight = toNumber(jarLive?.height_mm ?? jarLive?.height ?? sensorLatest?.height_mm ?? sensorLatest?.height);
    if (liveHeight === null) return;
    setCurrentHeight(String(liveHeight));
  }, [activeJarId, sensorLatest, jarLive]);

  useEffect(() => {
    lastHeightLoggedRef.current = { ts: 0, height: null };
  }, [activeCanonicalId]);

  // Mirror live height readings into Firebase (growthLogs) so they are captured as soon as the sensor reports them.
  useEffect(() => {
    setHeightLogError("");
    const liveSource = jarLive || sensorLatest;
    if (!liveSource) return;

    const liveHeight = toNumber(liveSource.height_mm ?? liveSource.height);
    if (liveHeight === null) return;

    const ts = Number(liveSource.timestamp) || Date.now();

    const last = lastHeightLoggedRef.current;
    const isDuplicate =
      last && last.height !== null && Math.abs(liveHeight - last.height) < 0.1 && Math.abs(ts - last.ts) < 3000;
    if (isDuplicate) return;

    const sourceJarId =
      activeJarId || liveSource.jarId || liveSource.jar_id || liveSource.id || canonicalJarKey(activeJarId) || null;
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

    Promise.all([
      push(ref(db, "growthLogs"), payload),
      push(ref(db, `growthLogsByJar/${canonicalId}`), payload),
      update(ref(db, `plants/${canonicalId}`), {
        id: canonicalId,
        planting_date: plantingDate || null,
        height_mm: liveHeight,
        temperature,
        humidity,
        lux,
        mq135,
        timestamp: ts,
        updated_at: new Date(ts).toISOString(),
      }),
    ])
      .then(() => {
        lastHeightLoggedRef.current = { ts, height: liveHeight };
      })
      .catch((err) => setHeightLogError(err?.message || "Failed to write live jar data to Firebase"));
  }, [sensorLatest, jarLive, activeJarId, plantingDate]);

  const derivedAgeDays = useMemo(() => {
    if (!plantingDate) return null;
    const planted = new Date(plantingDate);
    if (Number.isNaN(planted.getTime())) return null;
    const diffMs = new Date().setHours(0, 0, 0, 0) - planted.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, [plantingDate]);

  useEffect(() => {
    if (!activeJarId) {
      setPlantingDate("");
      return;
    }

    if (!plantRecord) {
      setPlantingDate("");
      return;
    }

    if (plantRecord.planting_date) setPlantingDate(plantRecord.planting_date);
    const latestHeight = resolveCurrentHeight(plantRecord);
    if (latestHeight !== undefined && latestHeight !== null) {
      setCurrentHeight(String(latestHeight));
    }
  }, [activeJarId, plantRecord]);

  useEffect(() => {
    if (derivedAgeDays === null) {
      setManualAgeDays("");
    } else {
      setManualAgeDays(String(derivedAgeDays));
    }
  }, [derivedAgeDays]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setAnalyzedJarId("");
    setAnalyzedHeight(null);

    if (!plantRecord || !plantingDate) {
      setError("Select a valid Jar/Plant ID so planting date can be loaded from the database.");
      return;
    }

    if (!currentHeight) {
      setError("Current height must be auto-filled from the record; choose a Jar/Plant ID that has a height entry.");
      return;
    }

    const payload = {
      planting_date: plantingDate,
      current_height_mm: Number(currentHeight),
      age_days: manualAgeDays ? Number(manualAgeDays) : undefined,
    };

    setLoading(true);
    try {
      const resp = await api.post("/growth/analyze", payload);
      setResult(resp.data);
      setAnalyzedHeight(Number(currentHeight));
      setAnalyzedJarId(activeJarId || jarId);
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
    if (!displayLabel) return "border-emerald-100 bg-emerald-50 text-emerald-700";
    const label = String(displayLabel).toLowerCase();
    if (label.includes("below")) return "border-amber-200 bg-amber-50 text-amber-800";
    if (label.includes("within") || label.includes("normal")) return "border-emerald-200 bg-emerald-50 text-emerald-800";
    if (label.includes("above")) return "border-sky-200 bg-sky-50 text-sky-800";
    return "border-slate-200 bg-slate-50 text-slate-700";
  }, [displayLabel]);

  const liveHeight = toNumber(jarLive?.height_mm ?? jarLive?.height ?? sensorLatest?.height_mm ?? sensorLatest?.height);
  const liveTimestamp = jarLive?.timestamp ?? sensorLatest?.timestamp ?? null;

  const heightPoints = useMemo(() => {
    const pts = [];
    if (Array.isArray(plantRecord?.heights)) {
      plantRecord.heights.forEach((row) => {
        const ts = coerceTimestamp(row.timestamp ?? row.ts) ?? (row.date ? Date.parse(row.date) : null);
        const h = toNumber(row.height_mm ?? row.height);
        if (ts && h !== null) pts.push({ x: ts, y: h, source: "record" });
      });
    }
    (sensorHistory || []).forEach((row) => {
      const ts = Number(row.timestamp);
      const h = toNumber(row.height_mm ?? row.height);
      if (Number.isFinite(ts) && h !== null) pts.push({ x: ts, y: h, source: "sensor" });
    });
    const latestPoint = jarLive || sensorLatest;
    if (latestPoint) {
      const ts = Number(latestPoint.timestamp);
      const h = toNumber(latestPoint.height_mm ?? latestPoint.height);
      if (Number.isFinite(ts) && h !== null) pts.push({ x: ts, y: h, source: "latest" });
    }
    pts.sort((a, b) => a.x - b.x);
    return pts.slice(-120); // keep last 120 points
  }, [plantRecord, sensorHistory, sensorLatest, jarLive]);

  // Listen directly to Firebase plants/{id} for real-time planting date/height updates
  useEffect(() => {
    if (!activeCanonicalId) return undefined;
    const plantRef = ref(db, `plants/${activeCanonicalId}`);
    const off = onValue(
      plantRef,
      (snap) => {
        const val = snap.val();
        if (!val) return;
        const planted = val.planting_date || val.plantingDate;
        if (planted) setPlantingDate(planted);
        const h = toNumber(val.height_mm ?? val.height ?? val.current_height);
        if (h !== null && h !== undefined && (liveHeight === null || liveHeight === undefined)) {
          setCurrentHeight(String(h));
        }
      },
      (err) => setPlantFetchError(err?.message || "Failed to read plant record from Firebase")
    );
    return () => off();
  }, [activeCanonicalId, liveHeight]);

  useEffect(() => {
    if (liveHeight !== null && liveHeight !== undefined) {
      setCurrentHeight(String(liveHeight));
    }
  }, [liveHeight]);

  return (
    <div className="space-y-8 relative text-slate-900">
      <BackgroundGrid />
      <Hero />
      <div className="grid lg:grid-cols-5 gap-6 items-start relative">
        <div className="lg:col-span-2 space-y-4">
          <FormCard
            isLight={isLight}
            onSubmit={submit}
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
            manualAgeDays={manualAgeDays}
            setManualAgeDays={setManualAgeDays}
            loading={loading}
            error={error}
            plantRecord={plantRecord}
            demoIds={demoIds}
            demoIdHint={demoIdHint}
            plantFetchError={recordSourceError}
            jarPersistStatus={jarPersistStatus}
            jarPersistError={jarPersistError}
            liveHeight={liveHeight}
            liveTimestamp={liveTimestamp}
          />
          <HeightChartCard isLight={isLight} points={heightPoints} />
        </div>
        <ResultCard
          isLight={isLight}
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
  const height_mm = heightMmRaw ?? (heightCmRaw !== null ? heightCmRaw * 10 : null);

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

function BackgroundGrid() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 via-white to-cyan-50" />
      <div className="absolute inset-0 opacity-70 bg-[linear-gradient(90deg,rgba(13,148,136,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(6,182,212,0.06)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(6,182,212,0.15),transparent_32%),radial-gradient(circle_at_78%_12%,rgba(13,148,136,0.15),transparent_28%),radial-gradient(circle_at_50%_82%,rgba(6,182,212,0.1),transparent_36%)]" />
    </div>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl border border-teal-100 bg-white/90 p-8 shadow-[0_25px_60px_-25px_rgba(13,148,136,0.15)]"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 pointer-events-none" />
      <div className="relative space-y-3 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Growth insight</p>
        <h2 className="text-3xl font-semibold leading-tight text-slate-900">Orchid growth tracker</h2>
      </div>
    </motion.div>
  );
}

function FormCard({
  isLight,
  onSubmit,
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
  manualAgeDays,
  setManualAgeDays,
  loading,
  error,
  plantRecord,
  demoIds,
  demoIdHint,
  plantFetchError,
  jarPersistStatus,
  jarPersistError,
  liveHeight,
  liveTimestamp,
}) {
  return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={`space-y-6 rounded-3xl text-slate-900 p-6 shadow-[0_28px_72px_-30px_rgba(13,148,136,0.3)] ${isLight ? "bg-white border border-emerald-200 shadow-xl" : "border border-teal-100 bg-white/95"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Input</p>
          <h3 className="text-xl font-semibold mt-1 text-slate-900">Enter plant details</h3>
        </div>
        <StatusDot online />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Jar / Plant ID (optional, comma-separated supported)">
          <input
            value={jarId}
            onChange={(e) => setJarId(e.target.value)}
            placeholder={demoIds.length ? `e.g. ${demoIds[0]}` : "Enter Jar ID"}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/60 focus:border-primary transition"
          />
        </Field>
        <Field label="Planting date (auto from DB)">
          <input
            type="text"
            value={plantingDate}
            readOnly
            disabled
            placeholder="Choose a Jar/Plant ID to load"
            className="w-full rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-500"
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
              placeholder={liveHeight !== null && liveHeight !== undefined ? `Live: ${liveHeight} mm` : "Auto-filled from plant record"}
              className="w-full rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-500"
            />
            <p className="text-xs text-emerald-700">
              {liveHeight !== null && liveHeight !== undefined
                ? `Live: ${liveHeight} mm${liveTimestamp ? ` • ${new Date(liveTimestamp).toLocaleTimeString()}` : ""}`
                : "Waiting for live height from Firebase…"}
            </p>
          </div>
        </Field>
        <Field label="Age (days) - optional override">
          <input
            type="number"
            value={manualAgeDays}
            readOnly
            disabled
            placeholder={derivedAgeDays !== null ? `Auto: ${derivedAgeDays}` : "Auto-calculated once ID loads"}
            className="w-full rounded-xl border border-teal-100 bg-teal-50 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-500"
          />
        </Field>
      </div>

      {enteredJarCount > 1 && (
        <p className="text-xs text-sky-800 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
          Multiple IDs detected. Live tracking and analysis currently use the first ID: {activeJarId}.
        </p>
      )}
      {!plantRecord && activeJarId && (
        <p className="text-xs text-amber-800 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          No record found for "{activeJarId}". Planting date, age, and current height are read-only and must come from the database. Try {demoIdHint || "a known ID"}.
        </p>
      )}
      {plantFetchError && (
        <p className="text-xs text-rose-700 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
          Plant records unavailable: {plantFetchError}
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
      <p className="text-xs text-slate-600">Today: {today}</p>
      {plantRecord && (
        <p className="text-xs text-teal-800 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2">
          Planting date, age, and latest height auto-filled from DB for {plantRecord.id}.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3 text-xs text-slate-600 bg-cyan-50/60 border border-cyan-100 rounded-2xl p-3">
        <p>Tip: current date defaults to today automatically.</p>
        <p>Units: millimeters.</p>
        <p className="sm:col-span-2">Live height readings auto-fill when the sensor streams and are logged to Firebase instantly.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-cyan-500 text-white font-semibold py-3 shadow-glow disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner /> Analyzing...
          </span>
        ) : (
          "Analyze growth"
        )}
      </button>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
          >
            Error: {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form >
  );
}

function ResultCard({ result, jarId, currentHeight, predictedPillClass, displayLabel, displayProbabilities, isLight }) {
  return (
    <div className="lg:col-span-3 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className={`rounded-3xl p-6 space-y-6 shadow-[0_28px_72px_-30px_rgba(13,148,136,0.3)] ${isLight ? "bg-white border border-emerald-200 shadow-xl" : "border border-teal-100 bg-white/95"}`}
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary">Prediction</p>
            <h3 className="text-xl font-semibold text-slate-900">Model output</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-teal-600">
            <span className="h-2 w-2 rounded-full bg-teal-400 shadow shadow-teal-400/40" />
            Live from FastAPI
          </div>
        </div>

        {!result && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-24 rounded-2xl border border-teal-100 bg-teal-50/60 animate-pulse" />
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
                <div className="text-xs text-slate-600 px-3 py-1 rounded-full border border-emerald-100 bg-emerald-50">
                  Jar/Plant: {jarId}
                </div>
              )}
              <div className="text-xs text-slate-600 px-3 py-1 rounded-full border border-emerald-100 bg-emerald-50">
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
              <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/60 to-cyan-50 p-5 space-y-4">
                <p className="text-sm text-slate-800 font-semibold">Probability breakdown</p>
                <div className="grid gap-4">
                  {Object.entries(displayProbabilities).map(([label, prob]) => (
                    <ProbabilityBar key={label} label={label} value={prob} />
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-teal-100 bg-white/90 px-5 py-4 text-sm text-slate-700">
              The model compares age-adjusted expected height range with your measurement to classify growth. Use the probability spread to judge confidence and watch for consistent shifts over time.
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
// SensorPanel component to display live Firebase data and recent history
function SensorPanel({ latest, history, error, isLight }) {
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
      className={`rounded-3xl p-5 space-y-4 shadow-[0_24px_60px_-30px_rgba(13,148,136,0.26)] ${isLight ? "bg-white border border-emerald-200 shadow-xl" : "border border-teal-100 bg-white/95"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Sensor feed</p>
          <h4 className="text-lg font-semibold text-slate-900">Live Firebase data</h4>
        </div>
        <span className="text-xs text-teal-700 px-3 py-1 rounded-full border border-teal-100 bg-teal-50">
          {latest ? "Streaming" : "Waiting..."}
        </span>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">Sensor error: {error}</div>
      )}

      <p className="text-[11px] text-slate-600">
        Live height readings stream here and mirror to Firebase <code className="font-mono text-[10px]">growthLogs</code> automatically.
      </p>

      {latest ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <SensorStat label="Height" value={`${latest.height_mm?.toFixed?.(1) ?? latest.height_mm ?? "-"} mm`} />
          <SensorStat label="Temperature" value={`${latest.temperature?.toFixed?.(1) ?? latest.temperature ?? "-"} C`} />
          <SensorStat label="Humidity" value={`${latest.humidity?.toFixed?.(1) ?? latest.humidity ?? "-"} %`} />
          <SensorStat label="Light" value={`${latest.lux ?? "-"} lx`} />
          <SensorStat label="MQ135" value={latest.mq135 ?? "-"} />
          <SensorStat label="Timestamp" value={formatTs(latest.timestamp)} className="col-span-2" />
        </div>
      ) : (
        <p className="text-sm text-slate-700">No live sensor reading yet. Confirm Firebase env vars or data feed.</p>
      )}

      {recent.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Recent logs</p>
          <div className="space-y-2 max-h-56 overflow-auto pr-1">
            {recent.map((row, idx) => (
              <div
                key={`${row.timestamp}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs text-slate-800"
              >
                <span className="text-slate-600">{formatTs(row.timestamp)}</span>
                <span className="text-slate-900">
                  {row.height_mm ?? "-"} mm | {row.temperature ?? "-"} C | {row.humidity ?? "-"}% | {row.lux ?? "-"} lx | MQ {row.mq135 ?? "-"}
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
function PlantHistoryCard({ plantRecord, isLight, demoIdHint }) {
  const heights = plantRecord?.heights || [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className={`rounded-3xl p-5 space-y-4 shadow-[0_22px_60px_-30px_rgba(13,148,136,0.26)] ${isLight ? "bg-white border border-emerald-200 shadow-xl" : "border border-teal-100 bg-white/95"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-500">Plant history</p>
          <h4 className="text-lg font-semibold text-slate-900">Plant profile & history</h4>
        </div>
        <span className="text-xs text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 bg-emerald-50">Firebase</span>
      </div>

      {plantRecord && heights.length ? (
        <div className="space-y-2">
          {heights.map((row) => (
            <div
              key={`${plantRecord.id}-${row.date}`}
              className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-slate-800"
            >
              <span className="text-slate-600">{row.date}</span>
              <span className="font-semibold text-slate-900">{row.height_mm} mm</span>
            </div>
          ))}
        </div>
      ) : plantRecord ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-700">
          No height history found for this Jar ID yet.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-slate-700">
          Enter a Jar/Plant ID to auto-fill planting date and latest height. Known IDs: {demoIdHint || "n/a"}.
        </div>
      )}
    </motion.div>
  );
}
// Reusable Field component for form inputs
function Field({ label, children }) {
  return (
    <label className="block text-sm text-slate-800 space-y-2">
      <span className="text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.25em] text-emerald-500">{title}</p>
      <p className="text-2xl font-semibold mt-2 text-slate-900">{value}</p>
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}
// ProbabilityBar component to visualize class probabilities
function ProbabilityBar({ label, value }) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-700">
        <span className="font-semibold capitalize">{label.replace(/_/g, " ")}</span>
        <span className="text-slate-500">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-emerald-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35 }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-rose-300 to-sky-400 shadow-[0_0_18px_rgba(16,185,129,0.25)]"
        />
      </div>
    </div>
  );
}
// Simple spinner component using Framer Motion
function Spinner() {
  return (
    <motion.span
      className="inline-flex h-4 w-4 rounded-full border-2 border-slate-900 border-t-slate-900/20"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
    />
  );
}
// StatusDot component to indicate API connection status
function StatusDot({ online }) {
  return (
    <div className="flex items-center gap-2 text-xs text-emerald-700">
      <span className={`h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]" : "bg-slate-300"}`} />
      {online ? "API ready" : "Offline"}
    </div>
  );
}

function SensorStat({ label, value, className = "" }) {
  return (
    <div className={`rounded-xl border border-emerald-100 bg-white px-3 py-2 ${className}`}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-500">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function HeightChartCard({ points, isLight }) {
  const hasData = points && points.length;
  const data = useMemo(
    () => ({
      datasets: [
        {
          label: "Height (mm)",
          data: points,
          parsing: false,
          spanGaps: true,
          borderColor: "rgba(16, 185, 129, 1)",
          backgroundColor: "rgba(16, 185, 129, 0.18)",
          tension: 0.25,
          fill: true,
          pointRadius: 2.5,
        },
      ],
    }),
    [points]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: "time",
          time: { unit: "day", tooltipFormat: "PPpp" },
          ticks: { color: "#475569" },
          grid: { color: "rgba(148, 163, 184, 0.15)" },
        },
        y: {
          title: { display: true, text: "mm" },
          ticks: { color: "#475569" },
          grid: { color: "rgba(148, 163, 184, 0.12)" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `Height: ${ctx.parsed.y} mm`,
          },
        },
      },
    }),
    []
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.08 }}
      className={`rounded-3xl p-5 space-y-4 shadow-[0_22px_60px_-30px_rgba(13,148,136,0.26)] ${
        isLight ? "bg-white border border-emerald-200 shadow-xl" : "border border-teal-100 bg-white/95"
      }`}
      style={{ minHeight: "320px" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-500">Growth</p>
          <h4 className="text-lg font-semibold text-slate-900">Height trend</h4>
        </div>
        <span className="text-xs text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 bg-emerald-50">
          {hasData ? "Live from Firebase" : "Waiting..."}
        </span>
      </div>

      {hasData ? (
        <div className="h-64">
          <Line data={data} options={options} />
        </div>
      ) : (
        <div className="text-sm text-slate-700 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          No height points yet. Once a Jar is selected and either a plant history or live sensor height is available, the chart will populate automatically.
        </div>
      )}
    </motion.div>
  );
}


