import React from 'react'

export default function Loader() {
  return (
    <div className="flex flex-col items-center gap-5 py-10 animate-fade-in">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-green-400 border-r-green-400 animate-spin2" />
        <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-orchid-500 border-l-orchid-500 animate-spin2"
          style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
        <div className="absolute inset-[14px] rounded-full bg-green-400/10" />
      </div>

      <div className="text-center">
        <p className="font-display text-lg text-green-300 font-light">Analysing orchid…</p>
        <p className="text-xs text-green-700 mt-1">Running EfficientNetB0 · OOD detection</p>
      </div>

      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse2"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  )
}
