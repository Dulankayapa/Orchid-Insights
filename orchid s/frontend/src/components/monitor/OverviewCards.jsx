import React from 'react';
import { motion } from 'framer-motion';

const LIMITS = {
    temperature: { min: 18, max: 28 },
    humidity: { min: 40, max: 70 },
    lux: { min: 1000, max: 25000 },
    mq135: { min: 0, max: 150 }
};

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
    if (num < range.min || num > range.max) return 'warning';
    return 'good';
};

const OverviewCards = ({ data, lastUpdate }) => {
    const source = data ?? {};

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
            level: getLevel(source.temperature, LIMITS.temperature),
            color: 'text-orange-500',
            bg: 'bg-orange-50'
        },
        {
            title: 'Humidity',
            value: formatFixed(source.humidity, 1),
            unit: '%',
            icon: 'H',
            level: getLevel(source.humidity, LIMITS.humidity),
            color: 'text-blue-500',
            bg: 'bg-blue-50'
        },
        {
            title: 'Light Level',
            value: formatInt(source.lux),
            unit: 'lx',
            icon: 'L',
            level: getLevel(source.lux, LIMITS.lux),
            color: 'text-amber-500',
            bg: 'bg-amber-50'
        },
        {
            title: 'Air Quality',
            value: formatInt(source.mq135),
            unit: 'AQI',
            icon: 'G',
            level: getLevel(source.mq135, LIMITS.mq135),
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
                        className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
                    >
                        <div className={`absolute -right-2 -top-2 p-4 text-7xl opacity-5 ${card.color}`}>
                            {card.icon}
                        </div>

                        <div>
                            <div className="mb-2 flex items-center gap-2">
                                <span className={`rounded-lg p-2 text-lg ${card.bg} ${card.color}`}>{card.icon}</span>
                                <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    {card.title}
                                </span>
                            </div>
                            <div className="relative z-10 flex items-baseline gap-1">
                                <motion.span
                                    key={card.value}
                                    initial={{ opacity: 0.5 }}
                                    animate={{ opacity: 1 }}
                                    className="text-3xl font-bold text-slate-800 dark:text-white"
                                >
                                    {card.value}
                                </motion.span>
                                <span className="text-sm font-semibold text-slate-400">{card.unit}</span>
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
