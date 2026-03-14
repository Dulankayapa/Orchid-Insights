import React, { useMemo } from 'react';
import 'chartjs-adapter-date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
);

const METRIC_CONFIG = {
  temperature: {
    label: 'Temperature',
    short: 'TMP',
    unit: 'C',
    decimals: 1,
    color: '#f97316',
    fill: 'rgba(249, 115, 22, 0.14)',
    keys: ['temperature', 'temp', 't'],
  },
  humidity: {
    label: 'Humidity',
    short: 'HUM',
    unit: '%',
    decimals: 1,
    color: '#3b82f6',
    fill: 'rgba(59, 130, 246, 0.14)',
    keys: ['humidity', 'hum', 'h'],
  },
  light: {
    label: 'Light',
    short: 'LUX',
    unit: 'lx',
    decimals: 0,
    color: '#f59e0b',
    fill: 'rgba(245, 158, 11, 0.14)',
    keys: ['light', 'lux', 'lx'],
  },
  air: {
    label: 'Air Quality (MQ135/CO2)',
    short: 'AIR',
    unit: 'ppm',
    decimals: 0,
    color: '#10b981',
    fill: 'rgba(16, 185, 129, 0.14)',
    keys: ['co2', 'mq135', 'mq', 'gas'],
  },
};

const ZONE_METRIC_OPTIONS = [
  { value: 'temperature', label: 'Temperature', unit: 'C' },
  { value: 'humidity', label: 'Humidity', unit: '%' },
  { value: 'light', label: 'Light', unit: 'lx' },
  { value: 'co2', label: 'CO2/MQ135', unit: 'ppm' },
  { value: 'ph', label: 'pH', unit: '' },
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const pickValue = (row, keys) => {
  for (const key of keys) {
    const value = toNumber(row?.[key]);
    if (value !== null) return value;
  }
  return null;
};

const normalizeRows = (rows = []) => (
  rows
    .map((row) => ({
      ts: pickValue(row, ['timestamp', 'ts']),
      temperature: pickValue(row, METRIC_CONFIG.temperature.keys),
      humidity: pickValue(row, METRIC_CONFIG.humidity.keys),
      light: pickValue(row, METRIC_CONFIG.light.keys),
      air: pickValue(row, METRIC_CONFIG.air.keys),
    }))
    .filter((row) => row.ts !== null)
    .sort((a, b) => a.ts - b.ts)
);

const average = (rows, key) => {
  const values = rows.map((row) => toNumber(row?.[key])).filter((value) => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const formatValue = (value, decimals = 1) => {
  const num = toNumber(value);
  if (num === null) return '--';
  return decimals > 0 ? num.toFixed(decimals) : String(Math.round(num));
};

const buildTrendData = (points, key) => {
  const metric = METRIC_CONFIG[key];
  return {
    datasets: [
      {
        label: metric.label,
        data: points
          .filter((point) => point[key] !== null)
          .map((point) => ({ x: point.ts, y: point[key] })),
        borderColor: metric.color,
        backgroundColor: metric.fill,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 12,
        pointHoverRadius: 4,
        tension: 0.3,
        fill: true,
      },
    ],
  };
};

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'nearest', axis: 'x', intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      mode: 'index',
      intersect: false,
      borderWidth: 1,
      borderColor: '#e2e8f0',
      backgroundColor: 'rgba(255,255,255,0.92)',
      titleColor: '#0f172a',
      bodyColor: '#334155',
      displayColors: false,
      padding: 10,
    },
  },
  scales: {
    x: {
      type: 'time',
      grid: { display: false },
      ticks: { color: '#94a3b8', font: { size: 10 } },
    },
    y: {
      grid: { color: '#e2e8f0' },
      ticks: { color: '#94a3b8', font: { size: 10 } },
    },
  },
};

const MonitorCharts = ({
  history = [],
  previousWindow = [],
  zoneComparison = [],
  zoneMetric = 'temperature',
  onZoneMetricChange,
}) => {
  const points = useMemo(() => normalizeRows(history).slice(-240), [history]);
  const previousPoints = useMemo(() => normalizeRows(previousWindow).slice(-240), [previousWindow]);

  const latestPoint = points[points.length - 1] ?? null;

  const trendDatasets = useMemo(() => ({
    temperature: buildTrendData(points, 'temperature'),
    humidity: buildTrendData(points, 'humidity'),
    light: buildTrendData(points, 'light'),
    air: buildTrendData(points, 'air'),
  }), [points]);

  const metricSnapshots = useMemo(
    () => Object.entries(METRIC_CONFIG).map(([key, config]) => {
      const current = latestPoint?.[key] ?? null;
      const avgCurrent = average(points, key);
      const avgPrevious = average(previousPoints, key);
      const deltaPercent = (
        avgCurrent !== null
        && avgPrevious !== null
        && Math.abs(avgPrevious) > 1e-6
      )
        ? ((avgCurrent - avgPrevious) / Math.abs(avgPrevious)) * 100
        : null;
      return { key, config, current, avgCurrent, avgPrevious, deltaPercent };
    }),
    [latestPoint, points, previousPoints],
  );

  const changeBarData = useMemo(() => ({
    labels: metricSnapshots.map((item) => item.config.label),
    datasets: [
      {
        label: 'Change vs previous window (%)',
        data: metricSnapshots.map((item) => (
          item.deltaPercent === null ? 0 : Number(item.deltaPercent.toFixed(2))
        )),
        backgroundColor: metricSnapshots.map((item) => (
          item.deltaPercent === null ? 'rgba(148,163,184,0.45)' : (item.deltaPercent >= 0 ? 'rgba(16,185,129,0.65)' : 'rgba(239,68,68,0.65)')
        )),
        borderColor: metricSnapshots.map((item) => (
          item.deltaPercent === null ? '#94a3b8' : (item.deltaPercent >= 0 ? '#10b981' : '#ef4444')
        )),
        borderWidth: 1,
      },
    ],
  }), [metricSnapshots]);

  const changeBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y > 0 ? '+' : ''}${ctx.parsed.y}%`,
        },
      },
    },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
      y: {
        ticks: {
          color: '#64748b',
          font: { size: 10 },
          callback: (value) => `${value}%`,
        },
        grid: { color: '#e2e8f0' },
      },
    },
  }), []);

  const selectedZoneMetric = useMemo(
    () => ZONE_METRIC_OPTIONS.find((item) => item.value === zoneMetric) ?? ZONE_METRIC_OPTIONS[0],
    [zoneMetric],
  );

  const zoneBarData = useMemo(() => {
    const rows = Array.isArray(zoneComparison) ? zoneComparison : [];
    return {
      labels: rows.map((row) => row.zoneId || 'Zone'),
      datasets: [
        {
          label: `${selectedZoneMetric.label}${selectedZoneMetric.unit ? ` (${selectedZoneMetric.unit})` : ''}`,
          data: rows.map((row) => toNumber(row?.[selectedZoneMetric.value]) ?? 0),
          backgroundColor: 'rgba(79, 70, 229, 0.58)',
          borderColor: '#4f46e5',
          borderWidth: 1,
        },
      ],
    };
  }, [zoneComparison, selectedZoneMetric]);

  const zoneBarOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { display: false } },
      y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: '#e2e8f0' } },
    },
  }), []);

  if (!points.length) {
    return <div className="text-center py-10 text-slate-400">Waiting for live history data...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/60 bg-paper/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-dark">Live Telemetry Snapshot</h3>
          <span className="text-xs text-subtle">
            Last sample: {latestPoint ? new Date(latestPoint.ts).toLocaleTimeString() : '--'}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {metricSnapshots.map((item) => (
            <div key={item.key} className="rounded-xl border border-border/60 bg-white/70 px-3 py-2 dark:bg-slate-900/40">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">{item.config.label}</p>
              <p className="mt-1 text-sm font-bold text-dark">
                {formatValue(item.current, item.config.decimals)} {item.config.unit}
              </p>
              <p className="text-[11px] text-subtle">
                Window avg: {formatValue(item.avgCurrent, item.config.decimals)} {item.config.unit}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Temperature Trend" icon="TMP" hasData={trendDatasets.temperature.datasets[0].data.length > 0}>
          <Line data={trendDatasets.temperature} options={lineOptions} />
        </ChartCard>
        <ChartCard title="Humidity Trend" icon="HUM" hasData={trendDatasets.humidity.datasets[0].data.length > 0}>
          <Line data={trendDatasets.humidity} options={lineOptions} />
        </ChartCard>
        <ChartCard title="Light Intensity" icon="LUX" hasData={trendDatasets.light.datasets[0].data.length > 0}>
          <Line data={trendDatasets.light} options={lineOptions} />
        </ChartCard>
        <ChartCard title="Air Quality (MQ135/CO2)" icon="AIR" hasData={trendDatasets.air.datasets[0].data.length > 0}>
          <Line data={trendDatasets.air} options={lineOptions} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ChartCard title="Window Change (%)" icon="CMP" hasData={metricSnapshots.some((item) => item.deltaPercent !== null)}>
          <Bar data={changeBarData} options={changeBarOptions} />
        </ChartCard>

        <div className="dashboard-card dashboard-card-hover group flex h-[300px] flex-col p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-slate-700 dark:text-slate-200">
              <span className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-md border border-slate-200/80 bg-white/80 px-2 text-[10px] font-bold tracking-[0.08em] text-slate-600 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300">
                ZON
              </span>
              Zone Comparison
            </h3>
            <select
              className="input-shell w-auto rounded-lg px-2 py-1 text-xs"
              value={selectedZoneMetric.value}
              onChange={(event) => {
                if (typeof onZoneMetricChange === 'function') onZoneMetricChange(event.target.value);
              }}
            >
              {ZONE_METRIC_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="relative min-h-0 w-full flex-1">
            {!zoneBarData.labels.length ? (
              <EmptyState text="No zone data available yet." />
            ) : (
              <Bar data={zoneBarData} options={zoneBarOptions} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ text }) => (
  <div className="flex h-full items-center justify-center text-center text-sm text-subtle">{text}</div>
);

const ChartCard = ({ title, icon, children, hasData }) => (
  <div className="dashboard-card dashboard-card-hover group flex h-[300px] flex-col p-6">
    <h3 className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-slate-700 dark:text-slate-200">
      <span className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-md border border-slate-200/80 bg-white/80 px-2 text-[10px] font-bold tracking-[0.08em] text-slate-600 transition-transform duration-200 group-hover:scale-105 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300">
        {icon}
      </span>
      {title}
    </h3>
    <div className="relative min-h-0 w-full flex-1">
      {hasData ? children : <EmptyState text="Waiting for metric stream..." />}
    </div>
  </div>
);

export default MonitorCharts;

