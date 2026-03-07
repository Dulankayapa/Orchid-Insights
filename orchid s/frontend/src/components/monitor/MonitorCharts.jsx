import React, { useMemo } from 'react';
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
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
);

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

    const labels = points.map((p) => toTimeLabel(p.ts));

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
                data: history.map(h => ({ x: h.ts, y: h.t })),
                borderColor: '#f97316',
                backgroundColor: 'rgba(249, 115, 22, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        hum: {
            datasets: [{
                label: 'Humidity',
                data: history.map(h => ({ x: h.ts, y: h.h })),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        light: {
            datasets: [{
                label: 'Light',
                data: history.map(h => ({ x: h.ts, y: h.lx })),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        },
        air: {
            datasets: [{
                label: 'Air Quality',
                data: history.map(h => ({ x: h.ts, y: h.mq })),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderWidth: 2,
                fill: true
            }]
        }
    }), [history]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Temperature Trend" icon="🌡️">
                <Line data={datasets.temp} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Humidity Trend" icon="💧">
                <Line data={datasets.hum} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Light Intensity" icon="☀️">
                <Line data={datasets.light} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Air Quality (MQ135)" icon="💨">
                <Line data={datasets.air} options={commonOptions} />
            </ChartCard>
        </div>
    );
};

const ChartCard = ({ title, icon, children }) => (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm h-[300px] flex flex-col">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span>{icon}</span> {title}
        </h3>
        <div className="flex-1 w-full relative min-h-0">{children}</div>
    </div>
);

export default MonitorCharts;
