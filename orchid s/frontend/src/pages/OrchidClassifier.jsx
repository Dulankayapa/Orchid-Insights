import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { fileApi } from '../lib/api';

const readableScore = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${Math.round(num * 100)}%`;
};

const DropZone = ({ onFile }) => {
  const [isDragging, setDragging] = useState(false);

  const handleFiles = (files) => {
    if (!files?.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    onFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      className={`panel-soft rounded-2xl border-2 border-dashed ${isDragging ? 'border-primary bg-primary/5' : 'border-border/60'} transition-colors`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={() => {}}
    >
      <label className="flex cursor-pointer flex-col items-center gap-3 px-6 py-8 text-center">
        <span className="text-3xl">📸</span>
        <p className="text-lg font-semibold text-dark">Drop an orchid photo</p>
        <p className="text-sm text-subtle">PNG or JPG · max 10MB</p>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </label>
    </div>
  );
};

const ConfidenceBar = ({ label, value }) => {
  const pct = Math.min(100, Math.max(0, Math.round((Number(value) || 0) * 100)));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm text-subtle">
        <span>{label}</span>
        <span className="font-semibold text-dark">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%`, boxShadow: '0 6px 18px -10px rgba(0,180,150,0.8)' }}
        />
      </div>
    </div>
  );
};

const OodMeter = ({ value }) => {
  const pct = Math.min(100, Math.max(0, Math.round((Number(value) || 0) * 100)));
  const status = pct < 30 ? 'In-distribution' : pct < 65 ? 'Borderline' : 'Possibly OOD';
  const tone = pct < 30 ? 'text-emerald-600' : pct < 65 ? 'text-amber-500' : 'text-rose-600';

  return (
    <div className="panel-soft rounded-2xl border border-border/60 px-4 py-3">
      <p className="text-sm font-semibold text-dark">OOD Score</p>
      <p className={`text-xl font-semibold ${tone}`}>{pct}%</p>
      <p className="text-xs text-subtle">{status}</p>
      <div className="mt-2 h-2 rounded-full bg-border/60">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-rose-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const ResultPanel = ({ result }) => {
  if (!result) {
    return (
      <div className="panel-soft rounded-2xl border border-border/60 px-4 py-5 text-subtle">
        Upload an image to see predictions.
      </div>
    );
  }

  const { label, confidence, topK, fertilizer, notes } = result;

  return (
    <div className="panel-soft space-y-3 rounded-2xl border border-border/60 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-subtle">Predicted</p>
          <p className="text-xl font-semibold text-dark">{label || 'Unknown'}</p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
          {readableScore(confidence)}
        </span>
      </div>

      {Array.isArray(topK) && topK.length ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-subtle">Top classes</p>
          <div className="space-y-1">
            {topK.map((item) => (
              <div key={`${item.label}-${item.score}`} className="flex items-center justify-between rounded-xl bg-paper/70 px-3 py-2">
                <span className="text-sm text-dark">{item.label}</span>
                <span className="text-sm font-semibold text-subtle">{readableScore(item.score)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {fertilizer ? (
        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          🌱 Fertilizer tip: {fertilizer}
        </div>
      ) : null}

      {notes ? (
        <div className="rounded-xl bg-primary/5 px-3 py-2 text-sm text-dark">
          💡 Care note: {notes}
        </div>
      ) : null}
    </div>
  );
};

const Loader = () => (
  <div className="flex items-center gap-2 text-primary">
    <div className="h-2.5 w-2.5 animate-ping rounded-full bg-primary" />
    <div className="h-2.5 w-2.5 animate-ping rounded-full bg-primary" style={{ animationDelay: '120ms' }} />
    <div className="h-2.5 w-2.5 animate-ping rounded-full bg-primary" style={{ animationDelay: '240ms' }} />
    <span className="text-sm font-medium">Running model…</span>
  </div>
);

const normalizeResult = (payload) => {
  if (!payload) return null;
  const topK =
    payload.top_k
    || payload.topK
    || payload.predictions
    || payload.results
    || [];
  const first = payload.primary || payload.top1 || payload.best || topK[0] || {};

  return {
    label: payload.label || payload.class || first.label || first.name,
    confidence: payload.confidence ?? payload.score ?? first.score ?? first.confidence,
    ood: payload.ood ?? payload.ood_score ?? payload.oodScore ?? payload.oodScorePct,
    topK: Array.isArray(topK)
      ? topK.map((item) => ({
        label: item.label || item.class || item.name,
        score: item.score ?? item.confidence ?? item.probability,
      }))
      : [],
    fertilizer: payload.fertilizer || payload.recommendation,
    notes: payload.notes || payload.insight || payload.message,
  };
};

const OrchidClassifier = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setLoading] = useState(false);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const hasResult = Boolean(result);

  const handleFile = (nextFile) => {
    if (!nextFile) return;
    setFile(nextFile);
    setError('');
    setResult(null);
    const url = URL.createObjectURL(nextFile);
    setPreview(url);
  };

  const classify = async () => {
    if (!file) {
      setError('Please add an orchid image first.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await fileApi().post('/orchid-classifier/predict', formData);
      setResult(normalizeResult(data));
    } catch (err) {
      const detail = err?.response?.data?.detail
        || err?.response?.data?.message
        || err?.message
        || 'Classification failed. Check the backend /orchid-classifier/predict endpoint.';
      setError(String(detail));
      // helpful for debugging
      console.error('Classifier error', err);
    } finally {
      setLoading(false);
    }
  };

  const confidence = useMemo(() => result?.confidence ?? 0, [result]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="kicker">Orchid Classifier</p>
          <h1 className="title-lg">Classify an orchid image</h1>
          <p className="text-subtle">
            Upload a photo to run the ONNX-based orchid classifier. You&apos;ll see confidence, out-of-distribution score, and care tips.
          </p>
        </div>
        <button
          type="button"
          onClick={classify}
          className="btn-primary h-fit px-4 py-2 text-sm font-semibold disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Classifying…' : 'Run classifier'}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <DropZone onFile={handleFile} />
          {preview ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="overflow-hidden rounded-2xl border border-border/60"
            >
              <img src={preview} alt="Preview" className="max-h-[380px] w-full object-cover" />
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-paper/70 px-4 py-12 text-center text-subtle">
              Add an image to preview it here.
            </div>
          )}
        </div>

        <div className="space-y-4 lg:col-span-2">
          {isLoading ? <Loader /> : null}
          {error ? (
            <div className="rounded-2xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <ResultPanel result={result} />

          <ConfidenceBar label="Model confidence" value={confidence} />
          <OodMeter value={result?.ood} />
        </div>
      </div>

      {hasResult ? (
        <div className="panel-soft rounded-2xl border border-border/60 px-4 py-3 text-xs text-subtle">
          Endpoint: POST /api/orchid-classifier/predict (multipart/form-data with `file`). Update the URL in
          <code className="ml-1 rounded bg-paper px-1 py-0.5 text-[11px] text-dark">src/lib/api.js</code>
          {' '}if your backend runs elsewhere.
        </div>
      ) : null}
    </div>
  );
};

export default OrchidClassifier;
