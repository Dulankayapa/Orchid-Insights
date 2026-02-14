import React from 'react';
import { motion } from 'framer-motion';

const OverviewCards = ({ data }) => {
    if (!data) return <div className="text-slate-500">Waiting for data...</div>;

    const cards = [
        {
            title: 'Temperature',
            value: data.temperature?.toFixed(1) || '--',
            unit: '°C',
            icon: '🌡️',
            status: data.temperature > 28 || data.temperature < 18 ? 'warning' : 'good',
            color: 'text-orange-500',
            bg: 'bg-orange-50'
        },
        {
            title: 'Humidity',
            value: data.humidity?.toFixed(1) || '--',
            unit: '%',
            icon: '💧',
            status: data.humidity < 40 ? 'warning' : 'good',
            color: 'text-blue-500',
            bg: 'bg-blue-50'
        },
        {
            title: 'Light Level',
            value: Math.round(data.lux) || '--',
            unit: 'lx',
            icon: '☀️',
            status: 'good',
            color: 'text-amber-500',
            bg: 'bg-amber-50'
        },
        {
            title: 'Air Quality',
            value: data.mq135 || '--',
            unit: 'AQI',
            icon: '🌬️',
            status: data.mq135 > 150 ? 'danger' : 'good',
            color: 'text-emerald-500',
            bg: 'bg-emerald-50'
        },
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
                        <span className={`w-2 h-2 rounded-full ${card.status === 'good' ? 'bg-emerald-500' : card.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
                        <span className={`text-xs font-bold ${card.status === 'good' ? 'text-emerald-600' : card.status === 'warning' ? 'text-amber-600' : 'text-rose-600'}`}>
                            {card.status === 'good' ? 'Optimal Range' : 'Attention Needed'}
                        </span>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default OverviewCards;
