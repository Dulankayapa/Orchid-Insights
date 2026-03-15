import React from 'react';
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#94a3b8' },
    },
  },
  scales: {
    x: {
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(148,163,184,0.12)' },
    },
    y: {
      ticks: { color: '#94a3b8' },
      grid: { color: 'rgba(148,163,184,0.12)' },
    },
  },
};

const toFixed = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : '--';
};

const EnergyUsagePanel = ({ energyUsage }) => {
  const daily = energyUsage?.daily ?? [];
  const weekly = energyUsage?.weekly ?? [];
  const perDevice = energyUsage?.perDevice ?? [];

  const dailyData = {
    labels: daily.map((row) => row.label),
    datasets: [{
      label: 'Daily kWh',
      data: daily.map((row) => row.kwh),
      backgroundColor: 'rgba(20,184,166,0.7)',
      borderRadius: 8,
    }],
  };

  const weeklyData = {
    labels: weekly.map((row) => row.label),
    datasets: [{
      label: 'Weekly kWh',
      data: weekly.map((row) => row.kwh),
      backgroundColor: 'rgba(99,102,241,0.7)',
      borderRadius: 8,
    }],
  };

  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="module-title">Energy Usage Monitoring</h2>
        <span className="text-xs text-subtle">
          Today: {toFixed(energyUsage?.todayTotal)} kWh | Week: {toFixed(energyUsage?.weekTotal)} kWh
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="dashboard-card p-3">
          <p className="mb-2 text-sm font-semibold text-dark">Daily Usage</p>
          <div className="h-64">
            <Bar data={dailyData} options={chartOptions} />
          </div>
        </div>

        <div className="dashboard-card p-3">
          <p className="mb-2 text-sm font-semibold text-dark">Weekly Usage</p>
          <div className="h-64">
            <Bar data={weeklyData} options={chartOptions} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        {perDevice.map((device) => (
          <div key={device.key} className="dashboard-card p-3 text-xs">
            <p className="font-semibold text-dark">{device.label}</p>
            <p className="text-subtle">Estimated weekly: {toFixed(device.kwh)} kWh</p>
            <p className="text-subtle">Power: {device.powerWatts} W</p>
            <p className="text-subtle">State: {device.isOn ? 'ON' : 'OFF'}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default EnergyUsagePanel;
