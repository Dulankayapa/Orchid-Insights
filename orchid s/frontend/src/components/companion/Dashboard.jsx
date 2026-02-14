import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from "framer-motion";

const Dashboard = () => {
    return (
        <div className="space-y-8">
            {/* Environmental Monitor Section */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <span>🌡️</span> Environmental Monitor
                    </h2>
                    <Link to="/monitor" className="text-sm text-fuchsia-600 hover:text-fuchsia-700 font-medium">View Full Monitor &rarr;</Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard title="Temperature" value="24" unit="°C" status="Good" statusColor="emerald" icon="🌡️" />
                    <MetricCard title="Light" value="700" unit="lux" status="Medium" statusColor="amber" icon="☀️" />
                    <MetricCard title="Humidity" value="50" unit="%" status="Low" statusColor="rose" icon="💧" />
                    <MetricCard title="CO2" value="400" unit="ppm" status="Good" statusColor="emerald" icon="🌬️" />
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
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-fuchsia-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-1">Disease Detection</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-lg font-bold text-slate-800">Healthy</span>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl">
                                🌿
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-fuchsia-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-600 mb-1">Leaf Condition</h3>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                    <span className="text-lg font-bold text-slate-800">Excellent</span>
                                </div>
                            </div>
                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-xl">
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

                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-fuchsia-100 h-full max-h-[160px] flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6 opacity-10 text-9xl leading-none select-none pointer-events-none">
                            📏
                        </div>
                        <h3 className="text-sm font-semibold text-slate-600 mb-2">Current Plant Height</h3>
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
    };

    return (
        <motion.div
            whileHover={{ y: -2 }}
            className="bg-white rounded-2xl p-5 shadow-sm border border-fuchsia-100 flex flex-col justify-between"
        >
            <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{icon}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${colorMap[statusColor]}`}>
                    {status}
                </span>
            </div>
            <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{title}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-800">{value}</span>
                    <span className="text-sm text-slate-500">{unit}</span>
                </div>
            </div>
        </motion.div>
    );
};

export default Dashboard;
