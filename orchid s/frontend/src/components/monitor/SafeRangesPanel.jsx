import React, { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'orchid-safe-ranges-v1';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toDraft = (thresholds) => ({
  tempMin: thresholds?.metrics?.temperature?.min ?? 18,
  tempMax: thresholds?.metrics?.temperature?.max ?? 28,
  humMin: thresholds?.metrics?.humidity?.min ?? 45,
  humMax: thresholds?.metrics?.humidity?.max ?? 72,
  luxMin: thresholds?.metrics?.light?.min ?? 1200,
  luxMax: thresholds?.metrics?.light?.max ?? 26000,
  mqWarn: thresholds?.metrics?.co2?.max ?? 1300,
  staleAfter: thresholds?.staleSeconds ?? 90,
});

const readLocalDraft = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeLocalDraft = (draft) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // local storage failure should not block UI flow
  }
};

const clearLocalDraft = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

const NumberField = ({ label, unit, value, disabled, onChange }) => (
  <label className="space-y-1">
    <span className="text-xs font-semibold text-subtle">{label}</span>
    <div className="input-shell flex items-center gap-2 rounded-2xl px-3 py-2">
      <input
        className="w-full bg-transparent text-3xl font-bold text-dark outline-none"
        value={value}
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-lg font-semibold text-subtle">{unit}</span>
    </div>
  </label>
);

const SafeRangesPanel = ({ thresholds, canEdit, onSave }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(thresholds));

  useEffect(() => {
    const base = toDraft(thresholds);
    const local = readLocalDraft();
    setDraft(local ? { ...base, ...local } : base);
  }, [thresholds]);

  const rowItems = useMemo(() => ([
    { key: 'tempMin', label: 'Temp min', unit: 'C' },
    { key: 'tempMax', label: 'Temp max', unit: 'C' },
    { key: 'humMin', label: 'Hum min', unit: '%' },
    { key: 'humMax', label: 'Hum max', unit: '%' },
    { key: 'luxMin', label: 'Lux min', unit: 'lx' },
    { key: 'luxMax', label: 'Lux max', unit: 'lx' },
    { key: 'mqWarn', label: 'MQ warn (>)', unit: 'ppm' },
    { key: 'staleAfter', label: 'Stale after', unit: 'sec' },
  ]), []);

  const handleChange = (key, nextValue) => {
    setDraft((prev) => ({ ...prev, [key]: nextValue }));
  };

  const handleSave = async () => {
    const payload = {
      staleSeconds: toNumber(draft.staleAfter) ?? thresholds?.staleSeconds ?? 90,
      metrics: {
        temperature: {
          min: toNumber(draft.tempMin) ?? thresholds?.metrics?.temperature?.min ?? 18,
          max: toNumber(draft.tempMax) ?? thresholds?.metrics?.temperature?.max ?? 28,
        },
        humidity: {
          min: toNumber(draft.humMin) ?? thresholds?.metrics?.humidity?.min ?? 45,
          max: toNumber(draft.humMax) ?? thresholds?.metrics?.humidity?.max ?? 72,
        },
        light: {
          min: toNumber(draft.luxMin) ?? thresholds?.metrics?.light?.min ?? 1200,
          max: toNumber(draft.luxMax) ?? thresholds?.metrics?.light?.max ?? 26000,
        },
        co2: {
          min: thresholds?.metrics?.co2?.min ?? 350,
          max: toNumber(draft.mqWarn) ?? thresholds?.metrics?.co2?.max ?? 1300,
        },
      },
    };

    await onSave?.(payload);
    writeLocalDraft(draft);
  };

  const handleReset = () => {
    const base = toDraft(thresholds);
    setDraft(base);
    clearLocalDraft();
  };

  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="module-title">Safe Ranges</h2>
        <button
          type="button"
          className="btn-soft rounded-full px-3 py-1 text-xs"
          onClick={() => setCollapsed((prev) => !prev)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {rowItems.map((item) => (
              <NumberField
                key={item.key}
                label={item.label}
                unit={item.unit}
                value={draft[item.key] ?? ''}
                disabled={!canEdit}
                onChange={(nextValue) => handleChange(item.key, nextValue)}
              />
            ))}
          </div>

          <div className="border-t border-border/60 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary" disabled={!canEdit} onClick={handleSave}>
                Save
              </button>
              <button type="button" className="btn-soft" disabled={!canEdit} onClick={handleReset}>
                Reset
              </button>
            </div>
            <p className="mt-2 text-xs text-subtle">
              Tip: these ranges drive badges, alerts, and the safe band in charts.
            </p>
          </div>
        </>
      )}
    </section>
  );
};

export default SafeRangesPanel;
