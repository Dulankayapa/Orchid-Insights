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
    Filler
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
    Filler
);

const pickValue = (row, keys) => {
    for (const key of keys) {
        const value = Number(row?.[key]);
        if (Number.isFinite(value)) return value;
    }
    return null;
};

const MonitorCharts = ({ history }) => {
    if (!history || history.length === 0) {
        return <div className="text-center py-10 text-slate-400">Loading charts...</div>;
    }

    const points = history
        .map((row) => ({
            ts: pickValue(row, ['timestamp', 'ts']),
            temperature: pickValue(row, ['temperature', 'temp', 't']),
            humidity: pickValue(row, ['humidity', 'hum', 'h']),
            light: pickValue(row, ['lux', 'light', 'lx']),
            gas: pickValue(row, ['mq135', 'mq', 'gas'])
        }))
        .filter((row) => row.ts !== null)
        .slice(-60);

    if (points.length === 0) {
        return <div className="text-center py-10 text-slate-400">Waiting for chart data...</div>;
    }

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                mode: 'index',
                intersect: false,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10,
                displayColors: false
            }
        },
        scales: {
            x: {
                type: 'time',
                grid: { display: false },
                ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0, autoSkip: true }
            },
            y: {
                grid: { color: '#f1f5f9' },
                ticks: { color: '#94a3b8', font: { size: 10 } }
            }
        },
        elements: {
            point: { radius: 0, hitRadius: 10, hoverRadius: 4 },
            line: { tension: 0.4 }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };

    // Memoize datasets to prevent unnecessary re-renders
    const datasets = useMemo(() => ({
        temp: {
            datasets: [{
                label: 'Temperature',
                data: points.filter((p) => p.temperature !== null).map((p) => ({ x: p.ts, y: p.temperature })),
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        hum: {
            datasets: [{
                label: 'Humidity',
                data: points.filter((p) => p.humidity !== null).map((p) => ({ x: p.ts, y: p.humidity })),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        light: {
            datasets: [{
                label: 'Light',
                data: points.filter((p) => p.light !== null).map((p) => ({ x: p.ts, y: p.light })),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        air: {
            datasets: [{
                label: 'Air Quality',
                data: points.filter((p) => p.gas !== null).map((p) => ({ x: p.ts, y: p.gas })),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        }
    }), [points]);

    return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartCard title="Temperature Trend" icon="TMP">
                <Line data={datasets.temp} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Humidity Trend" icon="HUM">
                <Line data={datasets.hum} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Light Intensity" icon="LUX">
                <Line data={datasets.light} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Air Quality (MQ135)" icon="AIR">
                <Line data={datasets.air} options={commonOptions} />
            </ChartCard>
        </div>
    );
};

const ChartCard = ({ title, icon, children }) => (
    <div className="dashboard-card dashboard-card-hover group flex h-[300px] flex-col p-6">
        <h3 className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-slate-700 dark:text-slate-200">
            <span className="inline-flex h-6 min-w-[2.25rem] items-center justify-center rounded-md border border-slate-200/80 bg-white/80 px-2 text-[10px] font-bold tracking-[0.08em] text-slate-600 transition-transform duration-200 group-hover:scale-105 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-300">{icon}</span>{" "}{title}
        </h3>
        <div className="relative min-h-0 w-full flex-1">{children}</div>
    </div>
);

export default MonitorCharts;

