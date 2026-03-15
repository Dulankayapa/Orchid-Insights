import React from 'react';
import { GREENHOUSE_DEVICES } from '../../lib/monitorConfig';

const AutomationControlPanel = ({
  controlState,
  recommendation,
  canControl,
  onModeChange,
  onToggleDevice,
  onApplyAuto,
  onAutoRulesToggle,
}) => {
  const mode = controlState?.mode ?? 'auto';
  const devices = controlState?.devices ?? {};

  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="module-title">Automation Control Panel</h2>
        <span className="text-xs text-subtle">
          Recommendation confidence: {Math.round((recommendation?.confidence ?? 0) * 100)}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={mode}
          className="input-shell w-auto rounded-xl px-2 py-1.5 text-sm"
          disabled={!canControl}
          onChange={(event) => onModeChange?.(event.target.value)}
        >
          <option value="auto">Auto Mode</option>
          <option value="manual">Manual Mode</option>
        </select>

        <label className="flex items-center gap-2 rounded-xl border border-border/60 bg-paper/80 px-3 py-2 text-xs text-subtle">
          <input
            type="checkbox"
            checked={Boolean(controlState?.autoRulesEnabled)}
            disabled={!canControl}
            onChange={(event) => onAutoRulesToggle?.(event.target.checked)}
          />
          Enable automatic rules
        </label>

        <button type="button" className="btn-soft" disabled={!canControl} onClick={() => onApplyAuto?.()}>
          Apply auto rules now
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {GREENHOUSE_DEVICES.map((device) => {
          const isOn = Boolean(devices[device.key]);
          const recommended = Boolean(recommendation?.suggested?.[device.key]);

          return (
            <div key={device.key} className="dashboard-card p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-dark">{device.label}</p>
                  <p className="text-[11px] text-subtle">{device.description}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isOn ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}`}>
                  {isOn ? 'ON' : 'OFF'}
                </span>
              </div>

              <p className="mb-2 text-[11px] text-subtle">
                Auto recommendation: <span className="font-semibold text-dark">{recommended ? 'ON' : 'OFF'}</span>
              </p>

              <button
                type="button"
                className="btn-soft w-full rounded-xl px-2 py-1.5 text-xs"
                disabled={!canControl || mode !== 'manual'}
                onClick={() => onToggleDevice?.(device.key, !isOn)}
              >
                Toggle device
              </button>
            </div>
          );
        })}
      </div>

      {!canControl && (
        <p className="text-xs text-subtle">Control actions are restricted for your role.</p>
      )}
    </section>
  );
};

export default AutomationControlPanel;
