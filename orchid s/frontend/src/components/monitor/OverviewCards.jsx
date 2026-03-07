import React from 'react';
import { motion } from 'framer-motion';

const OverviewCards = ({ data, lastUpdate }) => {
    if (!data) return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white/80 animate-pulse rounded-2xl h-32 border border-slate-100 shadow-sm" />
            ))}
        </div>
    );

    const formatTime = (ts) => {
        if (!ts) return '';
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

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
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, idx) => (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
                    >
                        <div className={`absolute -top-2 -right-2 p-4 opacity-5 text-7xl ${card.color}`}>
                            {card.icon}
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`p-2 rounded-lg ${card.bg} ${card.color} text-lg`}>{card.icon}</span>
                                <span className="text-slate-500 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">{card.title}</span>
                            </div>
                            <div className="flex items-baseline gap-1 relative z-10">
                                <motion.span
                                    key={card.value}
                                    initial={{ opacity: 0.5 }}
                                    animate={{ opacity: 1 }}
                                    className="text-3xl font-bold text-slate-800 dark:text-white"
                                >
                                    {card.value}
                                </motion.span>
                                <span className="text-sm text-slate-400 font-semibold">{card.unit}</span>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${card.status === 'good' ? 'bg-emerald-500' : card.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                                <span className={`text-[10px] font-bold uppercase tracking-tight ${card.status === 'good' ? 'text-emerald-600' : card.status === 'warning' ? 'text-amber-600' : 'text-rose-600'}`}>
                                    {card.status === 'good' ? 'Optimal' : 'Checking'}
                                </span>
                            </div>
                            {lastUpdate && (
                                <span className="text-[10px] text-slate-400 font-medium">
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
