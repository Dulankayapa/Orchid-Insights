import React from 'react'

export default function ConfidenceBar({ label, confidence, rank, isOod }) {
  const pct = Math.round((confidence ?? 0) * 100)
  const isTop = rank === 0

  return (
    <div
      className={`
        rounded-[16px] border px-3 py-2.5 transition-all duration-200
        ${isTop
          ? 'border-[#d6e7d8] bg-white shadow-[0_14px_30px_-24px_rgba(92,140,106,0.35)]'
          : 'border-transparent bg-[#94a795] text-white'}
      `}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isTop ? (
            <span className="rounded-md bg-[#2f7d4f] px-1.5 py-0.5 text-[11px] font-semibold text-[#dff6e5]">
              #1
            </span>
          ) : null}
          <span className={`font-['DM_Sans'] text-sm capitalize ${isTop ? 'text-[#99c4a4]' : 'text-[#42d476]'}`}>
            {label.replace(/_/g, ' ')}
          </span>
        </div>
        <span className={`font-['DM_Sans'] text-sm font-semibold ${isTop ? 'text-[#89d7a2]' : 'text-[#d7f6de]'}`}>
          {pct}%
        </span>
      </div>

      <div className={`h-1.5 overflow-hidden rounded-full ${isTop ? 'bg-[#e7f1e8]' : 'bg-[#436b52]'}`}>
        <div
          className={`h-full rounded-full ${
            isOod ? 'bg-[#df9cc8]' : isTop ? 'bg-[#4ed879]' : 'bg-[#2f6744]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
