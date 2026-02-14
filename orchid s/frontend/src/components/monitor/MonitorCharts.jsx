import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    TimeScale
);

const MonitorCharts = ({ history }) => {
    if (!history || history.length === 0) return <div className="text-center py-10 text-slate-400">Loading charts...</div>;

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
                displayColors: false,
            }
        },
        scales: {
            x: {
                type: 'time',
                time: { unit: 'minute' },
                grid: { display: false },
                ticks: { color: '#94a3b8', font: { size: 10 } }
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

    const createDataset = (label, dataKey, color, bgColor) => ({
        labels: history.map(h => h.ts),
        datasets: [{
            label,
            data: history.map(h => ({ x: h.ts, y: h[dataKey] })),
            borderColor: color,
            backgroundColor: bgColor,
            borderWidth: 2,
            fill: true
        }]
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Temperature Trend" icon="🌡️">
                <Line data={createDataset('Temperature', 't', '#f97316', 'rgba(249, 115, 22, 0.1)')} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Humidity Trend" icon="💧">
                <Line data={createDataset('Humidity', 'h', '#3b82f6', 'rgba(59, 130, 246, 0.1)')} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Light Intensity" icon="☀️">
                <Line data={createDataset('Light', 'lx', '#f59e0b', 'rgba(245, 158, 11, 0.1)')} options={commonOptions} />
            </ChartCard>
            <ChartCard title="Air Quality (MQ135)" icon="💨">
                <Line data={createDataset('Air Quality', 'mq', '#10b981', 'rgba(16, 185, 129, 0.1)')} options={commonOptions} />
            </ChartCard>
        </div>
    );
};

const ChartCard = ({ title, icon, children }) => (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm h-[300px] flex flex-col">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
            <span>{icon}</span> {title}
        </h3>
        <div className="flex-1 w-full relative min-h-0">
            {children}
        </div>
    </div>
);

export default MonitorCharts;
