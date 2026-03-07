import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const pickValue = (row, keys) => {
    for (const key of keys) {
        const n = toNumber(row?.[key]);
        if (n !== null) return n;
    }
    return null;
};

const toTimeLabel = (ts) => {
    const n = toNumber(ts);
    if (n === null) return '--:--:--';
    const d = new Date(n);
    if (Number.isNaN(d.getTime())) return '--:--:--';
    return d.toLocaleTimeString();
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
                grid: { display: false },
                offset: true,
                ticks: {
                    color: '#94a3b8',
                    font: { size: 10 },
                    maxTicksLimit: 6
                }
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

    const createDataset = (label, values, color, bgColor) => ({
        labels,
        datasets: [{
            label,
            data: values,
            borderColor: color,
            backgroundColor: bgColor,
            borderWidth: 2,
            fill: true,
            spanGaps: true
        }]
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Temperature Trend" icon="T">
                <Line
                    data={createDataset('Temperature', points.map((p) => p.temperature), '#f97316', 'rgba(249, 115, 22, 0.1)')}
                    options={commonOptions}
                />
            </ChartCard>
            <ChartCard title="Humidity Trend" icon="H">
                <Line
                    data={createDataset('Humidity', points.map((p) => p.humidity), '#3b82f6', 'rgba(59, 130, 246, 0.1)')}
                    options={commonOptions}
                />
            </ChartCard>
            <ChartCard title="Light Intensity" icon="L">
                <Line
                    data={createDataset('Light', points.map((p) => p.light), '#f59e0b', 'rgba(245, 158, 11, 0.1)')}
                    options={commonOptions}
                />
            </ChartCard>
            <ChartCard title="Gas (MQ135)" icon="G">
                <Line
                    data={createDataset('Air Quality', points.map((p) => p.gas), '#10b981', 'rgba(16, 185, 129, 0.1)')}
                    options={commonOptions}
                />
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
