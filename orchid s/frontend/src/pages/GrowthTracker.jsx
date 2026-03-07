import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../lib/api";
import { db } from "../lib/firebase";
import { ref, onValue, query, limitToLast } from "firebase/database";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

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
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [plantRecords, setPlantRecords] = useState([]);
  const [plantFetchError, setPlantFetchError] = useState("");
  const [cultureEntries, setCultureEntries] = useState([]);
  const [cultureError, setCultureError] = useState("");
  const demoIds = useMemo(() => {
    const ids = new Set();
    plantRecords.forEach((p) => p.id && ids.add(p.id));
    cultureEntries.forEach((e) => e.jarId && ids.add(e.jarId));
    return Array.from(ids);
  }, [plantRecords, cultureEntries]);
  const demoIdHint = useMemo(() => demoIds.join(", "), [demoIds]);
  const [jarId, setJarId] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [currentHeight, setCurrentHeight] = useState("");
  const [manualAgeDays, setManualAgeDays] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [analyzedHeight, setAnalyzedHeight] = useState(null);
  const [analyzedJarId, setAnalyzedJarId] = useState("");
  const [sensorLatest, setSensorLatest] = useState(null);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [sensorError, setSensorError] = useState("");

  const plantRecord = useMemo(() => {
    if (!jarId) return null;
    const id = jarId.trim().toLowerCase();
    return plantRecords.find((p) => String(p.id).toLowerCase() === id) || null;
  }, [jarId, plantRecords]);

  const cultureRecord = useMemo(() => {
    if (!jarId) return null;
    const id = jarId.trim().toLowerCase();
    return cultureEntries.find((entry) => String(entry.jarId).toLowerCase() === id) || null;
  }, [jarId, cultureEntries]);

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

  useEffect(() => {
    // Live latest
    const latestRef = ref(db, "orchidData/latest");
    const offLatest = onValue(
      latestRef,
      (snap) => {
        const val = snap.val();
        setSensorLatest(val ? normalizeSensor(val) : null);
      },
      (err) => setSensorError(err.message || "Failed to read latest sensor data")
    );
    // History (last 150)
    const historyRef = query(ref(db, "orchidData/logs"), limitToLast(150));
    const offHist = onValue(
      historyRef,
      (snap) => {
        const raw = snap.val() || {};
        const rows = Object.values(raw || {}).map(normalizeSensor);
        rows.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        rows.reverse();
        setSensorHistory(rows);
      },
      (err) => setSensorError(err.message || "Failed to read history")
    );
    return () => {
      offLatest();
      offHist();
    };
  }, []);

  const derivedAgeDays = useMemo(() => {
    if (!plantingDate) return null;
    const planted = new Date(plantingDate);
    if (Number.isNaN(planted.getTime())) return null;
    const diffMs = new Date().setHours(0, 0, 0, 0) - planted.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, [plantingDate]);

  useEffect(() => {
    if (!jarId.trim()) {
      setPlantingDate("");
      setCurrentHeight("");
      return;
    }

    if (cultureRecord?.cultureDate) {
      setPlantingDate(cultureRecord.cultureDate);
    } else if (plantRecord?.planting_date) {
      setPlantingDate(plantRecord.planting_date);
    } else {
      setPlantingDate("");
    }

    const latestHeight = resolveCurrentHeight(plantRecord);
    if (latestHeight !== undefined && latestHeight !== null) {
      setCurrentHeight(String(latestHeight));
    } else {
      setCurrentHeight("");
    }
  }, [jarId, plantRecord, cultureRecord]);

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

    if (!plantingDate) {
      setError("Select a Jar/Plant ID that has culture data so planting date can be loaded.");
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
      setAnalyzedJarId(jarId);
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

  return (
    <div className="space-y-8">
      <Hero />
      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-2 space-y-4">
          <FormCard
            onSubmit={submit}
            jarId={jarId}
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
            cultureRecord={cultureRecord}
            demoIds={demoIds}
            demoIdHint={demoIdHint}
            plantFetchError={plantFetchError}
            cultureError={cultureError}
          />
          <PlantHistoryCard plantRecord={plantRecord} demoIdHint={demoIdHint} />
          <SensorPanel latest={sensorLatest} history={sensorHistory} error={sensorError} />
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
  return {
    ...val,
    timestamp: ts,
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

function FormCard({
  onSubmit,
  jarId,
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
  cultureRecord,
  demoIds,
  demoIdHint,
  plantFetchError,
  cultureError,
}) {
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
        <Field label="Jar / Plant ID (optional)">
          <input
            value={jarId}
            onChange={(e) => setJarId(e.target.value)}
            placeholder={demoIds.length ? `e.g. ${demoIds[0]}` : "Enter Jar ID"}
            className="input-shell"
          />
        </Field>
        <Field label="Planting date (from culture data)">
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
          <input
            type="number"
            step="0.1"
            value={currentHeight}
            readOnly
            disabled
            placeholder="Auto-filled from plant record"
            className="input-shell bg-paper/70 text-subtle"
          />
        </Field>
        <Field label="Age (days) - optional override">
          <input
            type="number"
            value={manualAgeDays}
            readOnly
            disabled
            placeholder={derivedAgeDays !== null ? `Auto: ${derivedAgeDays}` : "Auto-calculated once ID loads"}
            className="input-shell bg-paper/70 text-subtle"
          />
        </Field>
      </div>

      {!cultureRecord && jarId && (
        <p className="text-xs text-amber-800 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          No culture entry found for "{jarId}". Planting date and age come from the culture table. Try {demoIdHint || "a known ID"}.
        </p>
      )}
      {!plantRecord && jarId && (
        <p className="text-xs text-amber-800 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
          No plant height record found for "{jarId}". Current height is pulled from the plant record.
        </p>
      )}
      {cultureRecord && (
        <div className="panel-muted grid sm:grid-cols-2 gap-3 p-3 text-xs text-subtle">
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
      <p className="text-xs text-subtle">Today: {today}</p>
      {cultureRecord && plantRecord && (
        <p className="text-xs text-primary rounded-lg border border-primary/25 bg-primary/10 px-3 py-2">
          Planting date and age from culture data; latest height from plant record.
        </p>
      )}
      {cultureRecord && !plantRecord && (
        <p className="text-xs text-primary rounded-lg border border-primary/25 bg-primary/10 px-3 py-2">
          Planting date and age loaded from culture data. Height is missing for this jar.
        </p>
      )}

      <div className="panel-muted grid sm:grid-cols-2 gap-3 p-3 text-xs text-subtle">
        <p>Tip: current date defaults to today automatically.</p>
        <p>Units: millimeters.</p>
      </div>

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

      {latest ? (
        <div className="grid grid-cols-2 gap-3 text-sm">
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
                <span className="text-subtle">{formatTs(row.timestamp)}</span>
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


