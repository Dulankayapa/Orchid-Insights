import React from "react";

function humanizeLabel(label) {
  return String(label || "unknown").replace(/_/g, " ");
}

export default function ConfidenceBar({ label, confidence, rank, isOod }) {
  const pct = Math.round((confidence || 0) * 100);
  const isTop = rank === 0;

  const barColor = isOod
    ? "bg-gradient-to-r from-fuchsia-500 to-pink-400"
    : isTop
      ? "bg-gradient-to-r from-emerald-500 via-green-400 to-green-200"
      : "bg-gradient-to-r from-emerald-900 via-green-700 to-green-500";

  return (
    <div
      className={`rounded-[22px] border p-4 transition-all duration-200 ${
        isTop
          ? "glass border-green-500/20 shadow-[0_18px_42px_-30px_rgba(22,163,74,0.82)]"
          : "border-green-900/40 bg-[linear-gradient(180deg,rgba(5,18,10,0.88),rgba(8,24,13,0.78))]"
      }`}
      style={{ animationDelay: `${rank * 0.12}s` }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex min-w-[2.2rem] items-center justify-center rounded-xl border px-2 py-1 text-xs font-semibold ${
              isTop
                ? "border-green-500/20 bg-green-400/10 text-green-200"
                : "border-green-900/60 bg-black/10 text-green-500"
            }`}
          >
            #{rank + 1}
          </span>
          <div>
            <p className={`font-body text-base capitalize ${isTop ? "font-semibold text-green-100" : "text-green-300"}`}>
              {humanizeLabel(label)}
            </p>
            <p className="mt-0.5 font-body text-xs text-green-100/45">
              {isTop ? "Best current match" : "Alternative class"}
            </p>
          </div>
        </div>
        <div className={`text-right font-body ${isTop ? "text-green-100" : "text-green-400"}`}>
          <p className="text-xl font-semibold tabular-nums">{pct}%</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-green-100/40">confidence</p>
        </div>
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/30">
        <div
          className={`h-full rounded-full ${barColor} animate-bar-grow`}
          style={{ "--bar-width": `${pct}%`, width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
