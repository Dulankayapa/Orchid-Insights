import React from 'react'
import { useTheme } from '../../context/ThemeContext'

function OodBadge({ isOod, isDark }) {
  const tone = isOod
    ? {
        background: isDark ? '#5a284b' : '#d8a9c6',
        text: isDark ? '#ffe8f7' : '#582046',
      }
    : {
        background: isDark ? '#234030' : '#b9dcc4',
        text: isDark ? '#e8f7ec' : '#183323',
      }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold"
      style={{ background: tone.background, color: tone.text }}
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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const safeThreshold = Number.isFinite(threshold) && threshold > 0 ? threshold : 1
  const safeDistance = Number.isFinite(distance) ? distance : 0
  const maxVal = Math.max(safeThreshold * 1.5, safeDistance, 1)
  const fillPct = Math.max(0, Math.min(100, (safeDistance / maxVal) * 100))
  const thresholdPct = Math.max(0, Math.min(100, (safeThreshold / maxVal) * 100))

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span
          className="font-['DM_Sans'] text-[0.72rem] font-semibold uppercase tracking-[0.18em]"
          style={{ color: isDark ? '#9fc7ac' : '#567664' }}
        >
          Mahalanobis Distance
        </span>
        <OodBadge isOod={isOod} isDark={isDark} />
      </div>

      <div
        className="relative h-2 rounded-full"
        style={{ background: isDark ? '#203728' : '#cadfce' }}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${fillPct}%`,
            background: isOod ? '#d78fbb' : '#4ade80',
          }}
        />
        <div
          className="absolute top-1/2 h-5 w-px -translate-y-1/2"
          style={{ left: `${thresholdPct}%`, background: '#d8bb63' }}
        />
      </div>

      <div className="flex items-center justify-between font-['DM_Sans'] text-[0.76rem] tabular-nums">
        <span style={{ color: isDark ? '#8eb198' : '#5c7c6a' }}>0</span>
        <span style={{ color: '#c49d33' }}>threshold {safeThreshold.toFixed(1)}</span>
        <span style={{ color: isDark ? '#b0e4be' : '#2f7044' }}>{safeDistance.toFixed(1)}</span>
      </div>
    </div>
  )
}
