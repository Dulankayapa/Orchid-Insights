import React from 'react';
import { motion } from 'framer-motion';

const LIMITS = {
    temperature: { min: 18, max: 35 },
    humidity: { min: 40, max: 80 },
    lux: { min: 50, max: 800 },
    mq135: { min: 0, max: 2500 }
};

const formatFixed = (value, digits = 1) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '--';
    return Number(value).toFixed(digits);
};

const formatInt = (value) => {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '--';
    return String(Math.round(Number(value)));
};

const getLevel = (value, limits) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'unknown';
    if (limits?.min !== undefined && n < limits.min) return 'low';
    if (limits?.max !== undefined && n > limits.max) return 'high';
    return 'safe';
};

const LEVEL_STYLES = {
    safe: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'Safe' },
    low: { dot: 'bg-rose-500', text: 'text-rose-600', label: 'Low' },
    high: { dot: 'bg-blue-500', text: 'text-blue-600', label: 'High' },
    unknown: { dot: 'bg-slate-400', text: 'text-slate-500', label: 'Waiting' }
};

const OverviewCards = ({ data }) => {
    if (!data) return <div className="text-slate-500">Waiting for data...</div>;

    const cards = [
        {
            title: 'Temperature',
            value: formatFixed(data.temperature, 1),
            unit: 'C',
            icon: 'T',
            level: getLevel(data.temperature, LIMITS.temperature),
            color: 'text-orange-500',
            bg: 'bg-orange-50'
        },
        {
            title: 'Humidity',
            value: formatFixed(data.humidity, 1),
            unit: '%',
            icon: 'H',
            level: getLevel(data.humidity, LIMITS.humidity),
            color: 'text-blue-500',
            bg: 'bg-blue-50'
        },
        {
            title: 'Light Level',
            value: formatInt(data.lux),
            unit: 'lx',
            icon: 'L',
            level: getLevel(data.lux, LIMITS.lux),
            color: 'text-amber-500',
            bg: 'bg-amber-50'
        },
        {
            title: 'Air Quality',
            value: formatInt(data.mq135),
            unit: 'AQI',
            icon: 'G',
            level: getLevel(data.mq135, LIMITS.mq135),
            color: 'text-emerald-500',
            bg: 'bg-emerald-50'
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, idx) => (
                <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
                >
                    <div className={`absolute top-0 right-0 p-4 opacity-10 text-6xl ${card.color}`}>
                        {card.icon}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`p-2 rounded-lg ${card.bg} ${card.color} text-lg`}>{card.icon}</span>
                            <span className="text-slate-500 font-medium text-sm uppercase tracking-wider">{card.title}</span>
                        </div>
                        <div className="flex items-baseline gap-1 relative z-10">
                            <span className="text-3xl font-bold text-slate-800">{card.value}</span>
                            <span className="text-sm text-slate-400 font-semibold">{card.unit}</span>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${LEVEL_STYLES[card.level].dot}`}></span>
                        <span className={`text-xs font-bold ${LEVEL_STYLES[card.level].text}`}>
                            {LEVEL_STYLES[card.level].label}
                        </span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default OverviewCards;
