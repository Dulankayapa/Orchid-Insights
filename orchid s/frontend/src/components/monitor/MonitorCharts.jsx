import React, { useMemo } from 'react';
import 'chartjs-adapter-date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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
}) => {
  const points = useMemo(() => normalizeRows(history).slice(-240), [history]);

  const trendDatasets = useMemo(() => ({
    temperature: buildTrendData(points, 'temperature'),
    humidity: buildTrendData(points, 'humidity'),
    light: buildTrendData(points, 'light'),
    air: buildTrendData(points, 'air'),
  }), [points]);

  if (!points.length) {
    return <div className="text-center py-10 text-slate-400">Waiting for live history data...</div>;
  }

  return (
    <div className="space-y-5">
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

    </div>
  );
};

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

