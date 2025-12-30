import React, { useMemo, useState } from 'react';
// Axios for HTTP requests to backend API
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

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


  const backendBase = useMemo(() => {
    const base = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    return base.endsWith('/') ? base.slice(0, -1) : base;
  }, []);

  const predictedPillClass = useMemo(() => {
    if (!result?.predicted_label) return 'border-slate-700 bg-slate-800/60 text-slate-100';
    const label = String(result.predicted_label).toLowerCase();
    if (label.includes('below')) return 'border-amber-400/50 bg-amber-500/10 text-amber-100';
    if (label.includes('within') || label.includes('normal')) return 'border-emerald-400/60 bg-emerald-500/10 text-emerald-100';
    if (label.includes('above')) return 'border-sky-400/60 bg-sky-500/10 text-sky-100';
    return 'border-slate-600 bg-slate-800/70 text-slate-100';
  }, [result]);

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
        {/* <FormCard
          onSubmit={submit}
          jarId={jarId}
          setJarId={setJarId}
          plantingDate={plantingDate}
          setPlantingDate={setPlantingDate}
          currentHeight={currentHeight}
          setCurrentHeight={setCurrentHeight}
          loading={loading}
          error={error}
          
        /> */}
        <FormCard
           onSubmit={submit}
           jarId={jarId}
           setJarId={setJarId}
          plantingDate={plantingDate}
          setPlantingDate={setPlantingDate}
          today={today}
          currentHeight={currentHeight}
          setCurrentHeight={setCurrentHeight}
          manualAgeDays={manualAgeDays}          // ✅ add
          setManualAgeDays={setManualAgeDays}    // ✅ add
          loading={loading}
           error={error}
        />

        <ResultCard
          result={result}
          jarId={jarId}
          currentHeight={currentHeight}
          predictedPillClass={predictedPillClass}
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
  today,
  currentHeight,
  setCurrentHeight,
  manualAgeDays,          // ✅ add
  setManualAgeDays,       // ✅ add
  loading,
  error,
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
      min={new Date().toISOString().split('T')[0]}
      max={new Date().toISOString().split('T')[0]}
      className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
      required
    />
  </Field>

      <Field label="Current height (mm) *">
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
      </Field>
      <Field label="Age (days) - optional (testing)">
        <input
          type="number"
          value={manualAgeDays}
          onChange={(e) => setManualAgeDays(e.target.value)}
         placeholder="e.g. 45"
         className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition"
         min="0"
       />
      </Field>


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

function ResultCard({ result, jarId, currentHeight, predictedPillClass }) {
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
                  {result.predicted_label || '-'}
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

              {result.probabilities && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
                  <p className="text-sm text-slate-300 font-semibold">Probability breakdown</p>
                  <div className="grid gap-4">
                    {Object.entries(result.probabilities).map(([label, prob]) => (
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
