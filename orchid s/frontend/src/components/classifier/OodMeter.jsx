import React from "react";

export default function OodMeter({ distance, threshold, isOod }) {
  const safeThreshold = Math.max(threshold || 1, 1);
  const maxVal = safeThreshold * 1.5;
  const clamped = Math.min(distance || 0, maxVal);
  const pct = (clamped / maxVal) * 100;
  const thPct = (safeThreshold / maxVal) * 100;

  return (
    <div className="glass space-y-4 rounded-[24px] border border-green-700/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs uppercase tracking-[0.28em] text-green-600">
            Mahalanobis Distance
          </p>
          <p className="mt-1 font-body text-xs text-green-100/55">
            Lower distance means the image sits closer to the model's learned orchid patterns.
          </p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            isOod
              ? "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-200"
              : "border-green-500/25 bg-green-500/10 text-green-200"
          }`}
        >
          {isOod ? "Out of distribution" : "In distribution"}
        </span>
      </div>

      <div className="rounded-[20px] border border-white/6 bg-black/20 p-4">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.2em] text-green-500/80">Current score</p>
            <p className="mt-1 font-display text-3xl font-light text-green-100 tabular-nums">
              {(distance || 0).toFixed(1)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-body text-[11px] uppercase tracking-[0.2em] text-yellow-500/70">Threshold</p>
            <p className="mt-1 font-body text-base font-semibold text-yellow-300 tabular-nums">
              {safeThreshold.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="relative h-3 overflow-visible rounded-full bg-green-950/80">
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700 ${
              isOod
                ? "bg-gradient-to-r from-fuchsia-500 via-pink-400 to-rose-300"
                : "bg-gradient-to-r from-green-700 via-emerald-500 to-green-300"
            }`}
            style={{ width: `${pct}%` }}
          />
          <div
            className="absolute top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-full bg-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.55)]"
            style={{ left: `${thPct}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between font-body text-xs text-green-100/55 tabular-nums">
          <span>0</span>
          <span>threshold {safeThreshold.toFixed(1)}</span>
          <span>scale max {maxVal.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
