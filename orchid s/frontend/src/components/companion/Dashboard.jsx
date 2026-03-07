import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import DetailsModal from './DetailsModal.jsx';
import { useMonitorData } from '../../hooks/useMonitorData';

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const formatFixed = (value, digits = 1) => {
    if (value === null) return '--';
    return Number(value).toFixed(digits);
};

const formatInt = (value) => {
    if (value === null) return '--';
    return String(Math.round(Number(value)));
};

const resolveStatus = (value, min, max) => {
    if (value === null) return { label: 'Waiting', color: 'slate' };
    if (value < min) return { label: 'Low', color: 'rose' };
    if (value > max) return { label: 'High', color: 'amber' };
    return { label: 'Good', color: 'emerald' };
};

const formatLastUpdate = (lastUpdate) => {
    if (!lastUpdate) return 'Waiting for live data';
    return `Updated ${new Date(lastUpdate).toLocaleTimeString()}`;
};

const getConnectionMeta = (connectionStatus) => {
    if (connectionStatus === 'connected') return { label: 'Live', color: 'emerald' };
    if (connectionStatus === 'stale') return { label: 'Stale', color: 'amber' };
    if (connectionStatus === 'connecting') return { label: 'Connecting', color: 'blue' };
    return { label: 'Offline', color: 'rose' };
};

const Dashboard = () => {
    const [modalConfig, setModalConfig] = useState({ isOpen: false, type: null, data: null });
    const { latest, connectionStatus, lastUpdate } = useMonitorData();

    const cards = useMemo(() => {
        const temperature = toNumber(latest?.temperature);
        const light = toNumber(latest?.lux);
        const humidity = toNumber(latest?.humidity);
        const co2 = toNumber(latest?.mq135);

        return [
            {
                type: 'temperature',
                title: 'Temperature',
                value: formatFixed(temperature, 1),
                unit: 'C',
                icon: 'T',
                ...resolveStatus(temperature, 18, 35)
            },
            {
                type: 'light',
                title: 'Light',
                value: formatInt(light),
                unit: 'lux',
                icon: 'L',
                ...resolveStatus(light, 50, 800)
            },
            {
                type: 'humidity',
                title: 'Humidity',
                value: formatFixed(humidity, 1),
                unit: '%',
                icon: 'H',
                ...resolveStatus(humidity, 40, 80)
            },
            {
                type: 'co2',
                title: 'CO2',
                value: formatInt(co2),
                unit: 'ppm',
                icon: 'G',
                ...resolveStatus(co2, 0, 2500)
            }
        ];
    }, [latest]);

    const connectionMeta = getConnectionMeta(connectionStatus);

    const openModal = (type, data = {}) => {
        setModalConfig({ isOpen: true, type, data });
    };

    const closeModal = () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
    };

    return (
        <div className="space-y-8">
            <DetailsModal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                type={modalConfig.type}
                data={modalConfig.data}
            />

            {/* Environmental Monitor Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span>🌡️</span> Environmental Monitor
                    </h2>
                    <div className="flex items-center gap-3">
                        <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${connectionMeta.color === 'emerald'
                                ? 'bg-emerald-100 text-emerald-700'
                                : connectionMeta.color === 'amber'
                                    ? 'bg-amber-100 text-amber-700'
                                    : connectionMeta.color === 'blue'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-rose-100 text-rose-700'
                                }`}
                        >
                            {connectionMeta.label}
                        </span>
                        <Link to="/monitor" className="text-sm text-fuchsia-600 hover:text-fuchsia-700 font-medium">View Full Monitor &rarr;</Link>
                    </div>
                </div>

                <p className="text-xs text-slate-500 mb-3">{formatLastUpdate(lastUpdate)}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {cards.map((card) => (
                        <div key={card.type} onClick={() => openModal(card.type, { latest })} className="cursor-pointer">
                            <MetricCard
                                title={card.title}
                                value={card.value}
                                unit={card.unit}
                                status={card.label}
                                statusColor={card.color}
                                icon={card.icon}
                            />
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid md:grid-cols-2 gap-8">
                {/* Health Monitor Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span>🩺</span> Health Monitor
                        </h2>
                        <Link to="/disease" className="text-sm text-fuchsia-600 hover:text-fuchsia-700 font-medium">Disease AI &rarr;</Link>
                    </div>

                    <div className="space-y-4">
                        <div
                            className="bg-white rounded-2xl p-5 shadow-sm border border-fuchsia-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow group"
                            onClick={() => openModal('disease')}
                        >
                            <div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-1 group-hover:text-fuchsia-600 transition-colors">Disease Detection</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-lg font-bold text-slate-800">Healthy</span>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                🌿
                            </div>
                        </div>

                        <div
                            className="bg-white rounded-2xl p-5 shadow-sm border border-fuchsia-100 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow group"
                            onClick={() => openModal('leaf')}
                        >
                            <div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-1 group-hover:text-fuchsia-600 transition-colors">Leaf Condition</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-lg font-bold text-slate-800">Excellent</span>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                                ✨
                            </div>
                        </div>
                    </div>
                </section>

                {/* Growth Tracker Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span>📈</span> Growth Tracker
                        </h2>
                        <Link to="/growth" className="text-sm text-fuchsia-600 hover:text-fuchsia-700 font-medium">Growth Analysis &rarr;</Link>
                    </div>

                    <div
                        className="bg-white rounded-2xl p-6 shadow-sm border border-fuchsia-100 h-full max-h-[160px] flex flex-col justify-center relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
                        onClick={() => openModal('height')}
                    >
                        <div className="absolute top-0 right-0 p-6 opacity-10 text-9xl leading-none select-none pointer-events-none group-hover:scale-110 transition-transform">
                            📏
                        </div>
                        <h3 className="text-sm font-semibold text-slate-600 mb-2 group-hover:text-fuchsia-600 transition-colors">Current Plant Height</h3>
                        <div className="flex items-end gap-2">
                            <span className="text-4xl font-bold text-slate-800">30</span>
                            <span className="text-lg text-slate-500 mb-1">cm</span>
                        </div>
                        <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-fuchsia-500 h-full rounded-full" style={{ width: '45%' }}></div>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">+2.5cm since last week</p>
                    </div>
                </section>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, unit, status, statusColor, icon }) => {
    const colorMap = {
        emerald: 'bg-emerald-100 text-emerald-700',
        amber: 'bg-amber-100 text-amber-700',
        rose: 'bg-rose-100 text-rose-700',
        slate: 'bg-slate-100 text-slate-600'
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-fuchsia-100 flex flex-col justify-between h-full hover:shadow-md transition-shadow"
        >
            <div className="flex items-start justify-between mb-3">
                <span className="text-2xl font-bold text-slate-500">{icon}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${colorMap[statusColor] || colorMap.slate}`}>
                    {status}
                </span>
            </div>
            <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 transition-colors">{title}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-800">{value}</span>
                    <span className="text-sm text-slate-500">{unit}</span>
                </div>
            </div>
        </motion.div>
    );
};

export default Dashboard;
