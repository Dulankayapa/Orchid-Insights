import React from 'react'

function OodBadge({ isOod }) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold
        ${isOod ? 'bg-[#c59cc8] text-white' : 'bg-[#85b18f] text-[#eaf9ee]'}
      `}
    >
      {isOod ? (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v5m0 3h.01" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="m10.29 3.86-7.4 12.82A2 2 0 0 0 4.62 20h14.76a2 2 0 0 0 1.73-3.32l-7.4-12.82a2 2 0 0 0-3.42 0Z"
          />
        </svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 13 4 4L19 7" />
        </svg>
      )}
      <span>{isOod ? 'OOD' : 'In-distribution'}</span>
    </span>
  )
}

export default function OodMeter({ distance, threshold, isOod }) {
  const safeThreshold = Number.isFinite(threshold) && threshold > 0 ? threshold : 1
  const safeDistance = Number.isFinite(distance) ? distance : 0
  const maxVal = Math.max(safeThreshold * 1.5, safeDistance, 1)
  const fillPct = Math.max(0, Math.min(100, (safeDistance / maxVal) * 100))
  const thresholdPct = Math.max(0, Math.min(100, (safeThreshold / maxVal) * 100))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="font-['DM_Sans'] text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#80b191]">
          Mahalanobis Distance
        </span>
        <OodBadge isOod={isOod} />
      </div>

      <div className="relative h-2 rounded-full bg-[#365a47]">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${isOod ? 'bg-[#cf4fe0]' : 'bg-[#5ad67e]'}`}
          style={{ width: `${fillPct}%` }}
        />
        <div
          className="absolute top-1/2 h-5 w-px -translate-y-1/2 bg-[#d8bb63]"
          style={{ left: `${thresholdPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between font-['DM_Sans'] text-[0.76rem] tabular-nums">
        <span className="text-[#7ea389]">0</span>
        <span className="text-[#d7ba67]">threshold {safeThreshold.toFixed(1)}</span>
        <span className="text-[#6bb783]">{safeDistance.toFixed(1)}</span>
      </div>
    </div>
  )
}
