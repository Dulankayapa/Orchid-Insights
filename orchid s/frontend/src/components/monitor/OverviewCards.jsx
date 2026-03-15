import React from 'react';
import { motion } from 'framer-motion';

const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const formatFixed = (value, digits = 1) => {
    const num = toNumber(value);
    return num === null ? '--' : num.toFixed(digits);
};

const formatInt = (value) => {
    const num = toNumber(value);
    return num === null ? '--' : Math.round(num);
};

const getLevel = (value, range) => {
    const num = toNumber(value);
    if (num === null) return 'unknown';
    if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return 'unknown';
    if (num < range.min || num > range.max) return 'warning';
    return 'good';
};

const resolveRange = (thresholds, key, fallbackMin, fallbackMax) => {
    const min = toNumber(thresholds?.metrics?.[key]?.min);
    const max = toNumber(thresholds?.metrics?.[key]?.max);
    return {
        min: min ?? fallbackMin,
        max: max ?? fallbackMax,
    };
};

const OverviewCards = ({ data, lastUpdate, thresholds }) => {
    const source = data ?? {};
    const limits = {
        temperature: resolveRange(thresholds, 'temperature', 18, 28),
        humidity: resolveRange(thresholds, 'humidity', 45, 72),
        lux: resolveRange(thresholds, 'light', 1200, 26000),
        co2: resolveRange(thresholds, 'co2', 350, 1300),
    };

    const formatTime = (ts) => {
        if (!ts) return '';
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const cards = [
        {
            title: 'Temperature',
            value: formatFixed(source.temperature, 1),
            unit: 'C',
            icon: 'T',
            level: getLevel(source.temperature, limits.temperature),
            color: 'text-orange-500',
            bg: 'bg-orange-50'
        },
        {
            title: 'Humidity',
            value: formatFixed(source.humidity, 1),
            unit: '%',
            icon: 'H',
            level: getLevel(source.humidity, limits.humidity),
            color: 'text-blue-500',
            bg: 'bg-blue-50'
        },
        {
            title: 'Light Level',
            value: formatInt(source.lux),
            unit: 'lx',
            icon: 'L',
            level: getLevel(source.lux, limits.lux),
            color: 'text-amber-500',
            bg: 'bg-amber-50'
        },
        {
            title: 'Air Quality',
            value: formatInt(source.co2 ?? source.mq135),
            unit: 'ppm',
            icon: 'G',
            level: getLevel(source.co2 ?? source.mq135, limits.co2),
            color: 'text-emerald-500',
            bg: 'bg-emerald-50'
        }
    ];

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {cards.map((card, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="dashboard-card dashboard-card-hover group relative flex flex-col justify-between overflow-hidden p-5"
                    >
                        <div className={`absolute -right-2 -top-2 p-4 text-7xl opacity-5 ${card.color}`}>
                            {card.icon}
                        </div>

                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <span className={`rounded-xl border border-white/70 p-2 text-lg shadow-[0_8px_20px_-16px_rgba(15,23,42,0.5)] transition-transform duration-200 group-hover:scale-105 ${card.bg} ${card.color}`}>
                                    {card.icon}
                                </span>
                                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                                    {card.title}
                                </span>
                            </div>
                            <div className="relative z-10 flex items-baseline gap-1">
                                <motion.span
                                    key={card.value}
                                    initial={{ opacity: 0.5 }}
                                    animate={{ opacity: 1 }}
                                    className="text-3xl font-bold text-slate-900 dark:text-slate-100"
                                >
                                    {card.value}
                                </motion.span>
                                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{card.unit}</span>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`h-2 w-2 rounded-full ${
                                        card.level === 'good' ? 'bg-emerald-500' : card.level === 'warning' ? 'bg-amber-500' : 'bg-slate-400'
                                    }`}
                                />
                                <span
                                    className={`text-[10px] font-bold uppercase tracking-tight ${
                                        card.level === 'good'
                                            ? 'text-emerald-600'
                                            : card.level === 'warning'
                                            ? 'text-amber-600'
                                            : 'text-slate-500'
                                    }`}
                                >
                                    {card.level === 'good' ? 'Optimal' : card.level === 'warning' ? 'Attention' : 'No Data'}
                                </span>
                            </div>
                            {lastUpdate && (
                                <span className="text-[10px] font-medium text-slate-400">
                                    {formatTime(lastUpdate)}
                                </span>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default OverviewCards;
