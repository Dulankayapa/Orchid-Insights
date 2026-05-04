import React from 'react'

export default function ConfidenceBar({ label, confidence, rank, isOod }) {
  const pct    = Math.round(confidence * 100)
  const isTop  = rank === 0

  const barColor = isOod
    ? 'bg-orchid-500'
    : isTop
      ? 'bg-gradient-to-r from-green-500 to-green-400'
      : 'bg-gradient-to-r from-green-800 to-green-700'

  return (
    <div
      className={`
        rounded-xl p-3 transition-all duration-200
        ${isTop ? 'glass border border-green-700/30' : 'bg-leaf-light/30'}
      `}
      style={{ animationDelay: `${rank * 0.12}s` }}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {isTop && (
            <span className="text-xs font-body font-medium px-1.5 py-0.5 rounded bg-green-900 text-green-400 border border-green-700/50">
              #1
            </span>
          )}
          <span className={`font-body text-sm ${isTop ? 'text-green-200 font-medium' : 'text-green-500'}`}>
            {label.replace(/_/g, ' ')}
          </span>
        </div>
        <span className={`font-body text-sm tabular-nums ${isTop ? 'text-green-300 font-semibold' : 'text-green-600'}`}>
          {pct}%
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-green-950/60 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} animate-bar-grow`}
          style={{ '--bar-width': `${pct}%`, width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
