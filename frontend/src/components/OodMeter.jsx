import React from 'react'

/**
 * Visual gauge showing Mahalanobis distance vs threshold.
 */
export default function OodMeter({ distance, threshold, isOod }) {
  // Clamp to [0, threshold * 1.5] for display
  const maxVal  = threshold * 1.5
  const clamped = Math.min(distance, maxVal)
  const pct     = (clamped / maxVal) * 100
  const thPct   = (threshold / maxVal) * 100

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-green-600 font-body uppercase tracking-widest">
          Mahalanobis Distance
        </span>
        <span
          className={`text-xs font-body font-medium px-2 py-0.5 rounded-full
            ${isOod
              ? 'bg-orchid-900/60 text-orchid-300 border border-orchid-700/40'
              : 'bg-green-900/60 text-green-400 border border-green-700/40'}`}
        >
          {isOod ? '⚠ OOD' : '✓ In-distribution'}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-2.5 rounded-full bg-green-950/80 overflow-visible">
        {/* Filled portion */}
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all duration-700
            ${isOod
              ? 'bg-gradient-to-r from-orchid-600 to-orchid-400'
              : 'bg-gradient-to-r from-green-700 to-green-400'}`}
          style={{ width: `${pct}%` }}
        />
        {/* Threshold marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 bg-yellow-400/70 rounded"
          style={{ left: `${thPct}%` }}
        />
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-green-700 font-body tabular-nums">
        <span>0</span>
        <span className="text-yellow-500/80">
          threshold {threshold.toFixed(1)}
        </span>
        <span>{distance.toFixed(1)}</span>
      </div>
    </div>
  )
}
