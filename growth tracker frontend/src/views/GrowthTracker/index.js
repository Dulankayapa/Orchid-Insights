import React, { useEffect, useMemo, useState } from 'react';
// Axios for HTTP requests to backend API
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { mockPlants } from '../../data/mockPlants';

/**
 * Main GrowthTracker component
 * Handles user input, API communication, and result rendering
 */
function GrowthTracker() {
  const [jarId, setJarId] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [currentHeight, setCurrentHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [manualAgeDays, setManualAgeDays] = useState('');// Add manual age days
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [analyzedHeight, setAnalyzedHeight] = useState(null);
  const [analyzedJarId, setAnalyzedJarId] = useState('');
  const plantRecord = useMemo(() => {
    if (!jarId) return null;
    const id = jarId.trim().toLowerCase();
    return mockPlants.find((p) => p.id.toLowerCase() === id) || null;
  }, [jarId]);
  
  const derivedAgeDays = useMemo(() => {
    if (!plantingDate) return null;
    const planted = new Date(plantingDate);
    if (Number.isNaN(planted.getTime())) return null;
    const diffMs = new Date().setHours(0, 0, 0, 0) - planted.setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }, [plantingDate]);
  useEffect(() => {
    if (plantRecord) {
      if (plantRecord.planting_date) {
        setPlantingDate(plantRecord.planting_date);
      }
      const latestHeight = plantRecord.heights?.[0]?.height_mm;
      if (latestHeight !== undefined && latestHeight !== null) {
        setCurrentHeight(String(latestHeight));
      }
    }
  }, [plantRecord]);
  useEffect(() => {
    if (derivedAgeDays === null) {
      setManualAgeDays('');
      return;
    }
    setManualAgeDays(String(derivedAgeDays));
  }, [derivedAgeDays]);


  const backendBase = useMemo(() => {
    const base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  const displayOverride = useMemo(() => {
    // Ensure the UI shows a single, deterministic classification based on expected range vs last analyzed height
    if (!result?.expected_height_range) return null;
    const heightVal = Number(analyzedHeight ?? result?.plant_height_mm);
    if (!Number.isFinite(heightVal)) return null;
    const [minExpected, maxExpected] = result.expected_height_range;
    if (heightVal < minExpected) return { label: 'below_expected', probabilities: { below_expected: 1 } };
    if (heightVal > maxExpected) return { label: 'above_expected', probabilities: { above_expected: 1 } };
    return { label: 'within_expected', probabilities: { within_expected: 1 } };
  }, [result, analyzedHeight]);

  const displayLabel = displayOverride?.label || result?.predicted_label;
  const displayProbabilities = displayOverride?.probabilities || result?.probabilities;
  const normalizedProbabilities = useMemo(() => {
    const base = displayProbabilities || {};
    const labels = ['below_expected', 'within_expected', 'above_expected'];
    const entries = labels.map((label) => [label, Number(base[label]) || 0]);
    return Object.fromEntries(entries);
  }, [displayProbabilities]);

  const predictedPillClass = useMemo(() => {
    if (!displayLabel) return 'border-slate-700 bg-slate-800/60 text-slate-100';
    const label = String(displayLabel).toLowerCase();
    if (label.includes('below')) return 'border-amber-400/50 bg-amber-500/10 text-amber-100';
    if (label.includes('within') || label.includes('normal')) return 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100';
    if (label.includes('above')) return 'border-sky-400/60 bg-sky-500/10 text-sky-100';
    return 'border-slate-600 bg-slate-800/70 text-slate-100';
  }, [displayLabel]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!plantingDate || !currentHeight) {
      setError('Please provide planting date and current height in millimeters.');
      return;
    }

    // const payload = {
    //   planting_date: plantingDate,
    //   current_height_mm: Number(currentHeight),
    // };

    const payload = {
       planting_date: plantingDate,
       current_height_mm: Number(currentHeight),
       age_days: manualAgeDays ? Number(manualAgeDays) : undefined,
      };

    setLoading(true);
    try {
      const resp = await axios.post(`${backendBase}/analyze-growth`, payload, {
        headers: { 'Content-Type': 'application/json' },
      });
      setResult(resp.data);
      setAnalyzedHeight(Number(currentHeight));
      setAnalyzedJarId(jarId);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.detail || err.response?.data || err.message || 'Request failed';
      setError(typeof message === 'string' ? message : JSON.stringify(message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10">
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
          />

          <MockHistoryCard plantRecord={plantRecord} />
        </div>

        <ResultCard
          result={result}
          jarId={analyzedJarId}
          currentHeight={analyzedHeight}
          predictedPillClass={predictedPillClass}
          displayLabel={displayLabel}
          displayProbabilities={normalizedProbabilities}
        />
      </div>
    </div>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur p-8"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-blue-500/10 pointer-events-none" />
      <div className="relative space-y-3 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Growth insight</p>
        <h2 className="text-3xl font-semibold leading-tight">Growth tracker</h2>
        <p className="text-slate-300 text-sm md:text-base">
          Enter when you planted and the current height. We'll compare it to the usual range for plants this age and
          flag if it looks below or above the norm.
        </p>
      </div>
    </motion.div>
  );
}

// function FormCard({ onSubmit, jarId, setJarId, plantingDate, setPlantingDate, currentHeight, setCurrentHeight, loading, error }) {
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
  manualAgeDays,          // ✅ add
  setManualAgeDays,       // ✅ add
  loading,
  error,
  plantRecord,
}) {
  
return (
    <motion.form
      onSubmit={onSubmit}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="lg:col-span-2 space-y-6 rounded-3xl border border-slate-800/80 bg-slate-900/70 backdrop-blur p-6 shadow-xl shadow-black/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Input</p>
          <h3 className="text-xl font-semibold mt-1">Enter plant details</h3>
        </div>
        <StatusDot online />
      </div>

      <Field label="Jar / Plant ID (optional)">
        <input
          value={jarId}
          onChange={(e) => setJarId(e.target.value)}
          placeholder="e.g. Jar-12"
          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
        />
      </Field>
      {!plantRecord && jarId && (
        <p className="text-xs text-amber-200/90 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          No mock record for "{jarId}". Try Jar-12, Jar-07, Jar-19, or Jar-03.
        </p>
      )}
{/* 
      <Field label="Planting date *">
        <input
          type="date"
          value={plantingDate}
          onChange={(e) => setPlantingDate(e.target.value)}
          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
          required
        />
      </Field> */}
      
  <Field label="Planting date *">
    <input
      type="date"
      value={plantingDate}
      onChange={(e) => setPlantingDate(e.target.value)}
      className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
      required
    />
  </Field>
      <p className="text-xs text-slate-400">Today: {today}</p>
      {plantRecord && (
        <p className="text-xs text-emerald-200/80 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          Auto-filled from mock DB for {plantRecord.id}.
        </p>
      )}

      <Field label="Current height (mm) *">
  <input
    type="number"
    step="0.1"
    value={currentHeight}
    readOnly
    placeholder="Enter height in millimeters"
    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
    min="0"
  />
</Field>

      {/* <Field label="Current height (mm) *">
        <input
          type="number"
          step="0.1"
          value={currentHeight}
          onChange={(e) => setCurrentHeight(e.target.value)}
          placeholder="Enter height in millimeters"
          className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
          required
          min="0"
        />
      </Field> */}
      {/* <Field label="Age (days) - optional (testing)">
        <input
          type="number"
          value={manualAgeDays}
          onChange={(e) => setManualAgeDays(e.target.value)}
         placeholder={derivedAgeDays !== null ? `Auto: ${derivedAgeDays}` : 'e.g. 45'}
         className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
         min="0"
       />
      </Field> */}


      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        <p>Tip: current date defaults to today automatically.</p>
        <p>Units: millimeters.</p>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center justify-center w-full gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-blue-500 text-slate-900 font-semibold py-3 shadow-lg shadow-emerald-500/25 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner /> Analyzing...
          </span>
        ) : (
          'Analyze growth'
        )}
      </button>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
          >
            Error: {error}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.form>
  );
}

function ResultCard({ result, jarId, currentHeight, predictedPillClass, displayLabel, displayProbabilities }) {
  return (
    <div className="lg:col-span-3 space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-6 shadow-xl shadow-black/30"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Prediction</p>
            <h3 className="text-xl font-semibold">Model output</h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow shadow-emerald-400/40" />
            Live from FastAPI
          </div>
        </div>

        {!result && (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 rounded-2xl border border-slate-800/70 bg-slate-800/30 animate-pulse" />
            ))}
          </div>
        )}

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mt-6 space-y-6"
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${predictedPillClass}`}>
                  <span className="h-2 w-2 rounded-full bg-current opacity-80" />
                  {displayLabel || '-'}
                </div>
                {jarId && (
                  <div className="text-xs text-slate-400 px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">
                    Jar/Plant: {jarId}
                  </div>
                )}
                <div className="text-xs text-slate-400 px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">
                  Age: {result.age_days} days
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <StatCard title="Age (days)" value={result.age_days ?? '-'} hint="Days since planting" />
                <StatCard
                  title="Expected range (mm)"
                  value={result.expected_height_range ? `${result.expected_height_range[0]} - ${result.expected_height_range[1]}` : '-'}
                  hint="Range sourced from dataset lookup"
                />
                <StatCard title="Current height (mm)" value={Number(currentHeight) || result?.plant_height_mm || '-'} hint="Value you provided" />
              </div>

              {displayProbabilities && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                  <p className="text-sm text-slate-300 font-semibold">Probability breakdown</p>
                  <div className="grid gap-4">
                    {Object.entries(displayProbabilities).map(([label, prob]) => (
                      <ProbabilityBar key={label} label={label} value={prob} />
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 px-5 py-4 text-sm text-slate-300">
                The model compares the age-adjusted expected height range with your measurement to classify growth.
                Use the probability spread to judge confidence and watch for consistent shifts over time.
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function MockHistoryCard({ plantRecord }) {
  const knownIds = mockPlants.map((p) => p.id).join(', ');
  const heights = plantRecord?.heights || [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="rounded-3xl border border-slate-800/80 bg-slate-900/60 backdrop-blur p-5 shadow-xl shadow-black/30 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Mock DB lookup</p>
          <h4 className="text-lg font-semibold text-white">Plant profile & history</h4>
        </div>
        <span className="text-xs text-slate-400 px-3 py-1 rounded-full border border-slate-800 bg-slate-800/60">
          Demo data
        </span>
      </div>

      {plantRecord ? (
        <>
          <div className="space-y-2">
            {heights.map((row) => (
              <div
                key={`${plantRecord.id}-${row.date}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-200"
              >
                <span className="text-slate-400">{row.date}</span>
                <span className="font-semibold text-white">{row.height_mm} mm</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-300">
          Enter a mock Jar/Plant ID to auto-fill planting date and latest height. Available IDs: {knownIds}.
        </div>
      )}
    </motion.div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm text-slate-200 space-y-2">
      <span className="text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
      <p className="text-2xl font-semibold mt-2 text-white">{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function ProbabilityBar({ label, value }) {
  const pct = Math.max(0, Math.min(100, (value || 0) * 100));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="font-semibold">{label}</span>
        <span className="text-slate-400">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35 }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-500 shadow-[0_0_16px_rgba(16,185,129,0.35)]"
        />
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <motion.span
      className="inline-flex h-4 w-4 rounded-full border-2 border-slate-900 border-t-slate-900/20"
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
    />
  );
}

function StatusDot({ online }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.7)]' : 'bg-slate-600'}`} />
      {online ? 'API ready' : 'Offline'}
    </div>
  );
}

export default GrowthTracker;
