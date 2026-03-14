import React from 'react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const HealthGauge = ({ score }) => {
  const safeScore = score === null || score === undefined ? null : clamp(Number(score), 0, 100);
  const radius = 78;
  const circumference = Math.PI * radius;
  const progress = safeScore === null ? 0 : (safeScore / 100);
  const offset = circumference * (1 - progress);

  const tone = safeScore === null
    ? 'text-slate-500'
    : safeScore >= 80
      ? 'text-emerald-600 dark:text-emerald-300'
      : safeScore >= 60
        ? 'text-amber-600 dark:text-amber-300'
        : 'text-rose-600 dark:text-rose-300';

  const label = safeScore === null
    ? 'No data'
    : safeScore >= 80
      ? 'Healthy'
      : safeScore >= 60
        ? 'Moderate'
        : 'Stress';

  return (
    <div className="dashboard-card p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dark">Environment Health Score</h3>
        <span className="text-xs text-subtle">0 - 100</span>
      </div>

      <div className="flex flex-col items-center justify-center">
        <svg viewBox="0 0 200 120" className="h-40 w-full max-w-[240px]">
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(148,163,184,0.25)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            stroke="url(#healthGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
          <defs>
            <linearGradient id="healthGradient" x1="20" y1="100" x2="180" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <text x="100" y="82" textAnchor="middle" className={`${tone} fill-current text-3xl font-bold`}>
            {safeScore === null ? '--' : Math.round(safeScore)}
          </text>
          <text x="100" y="100" textAnchor="middle" className="fill-slate-500 text-xs">
            {label}
          </text>
        </svg>
      </div>
    </div>
  );
};

export default HealthGauge;
