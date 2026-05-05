import React from 'react'
import { useTheme } from '../../context/ThemeContext'

export default function ConfidenceBar({ label, confidence, rank, isOod }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const pct = Math.round((confidence ?? 0) * 100)
  const isTop = rank === 0
  const cardTone = isTop
    ? {
        container: isDark
          ? 'border-[#315540] bg-[#112117] shadow-[0_14px_30px_-24px_rgba(0,0,0,0.55)]'
          : 'border-[#d6e7d8] bg-white shadow-[0_14px_30px_-24px_rgba(92,140,106,0.35)]',
        label: isDark ? '#d7f8de' : '#244635',
        value: isDark ? '#8ae7a1' : '#1f6f39',
        badgeBg: isDark ? '#224430' : '#2f7d4f',
        badgeText: '#e8f7ec',
        track: isDark ? '#203728' : '#e7f1e8',
        fill: isOod ? '#d78fbb' : '#4ed879',
      }
    : {
        container: isDark
          ? 'border-[#274232] bg-[#1a2b20] shadow-[0_14px_30px_-24px_rgba(0,0,0,0.45)]'
          : 'border-[#cfe0d2] bg-[#dce8de] shadow-[0_14px_30px_-24px_rgba(92,140,106,0.22)]',
        label: isDark ? '#dcefe1' : '#214031',
        value: isDark ? '#bdf3cb' : '#29513c',
        badgeBg: '#2f7d4f',
        badgeText: '#e8f7ec',
        track: isDark ? '#284232' : '#aac7b2',
        fill: isOod ? '#d78fbb' : '#2f6744',
      }

  return (
    <div
      className={`
        rounded-[16px] border px-3 py-2.5 transition-all duration-200
        ${cardTone.container}
      `}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isTop ? (
            <span
              className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
              style={{ background: cardTone.badgeBg, color: cardTone.badgeText }}
            >
              #1
            </span>
          ) : null}
          <span className="font-['DM_Sans'] text-sm capitalize" style={{ color: cardTone.label }}>
            {label.replace(/_/g, ' ')}
          </span>
        </div>
        <span className="font-['DM_Sans'] text-sm font-semibold" style={{ color: cardTone.value }}>
          {pct}%
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full" style={{ background: cardTone.track }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: cardTone.fill }}
        />
      </div>
    </div>
  )
}
