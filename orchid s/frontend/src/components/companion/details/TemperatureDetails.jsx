import React from 'react';
import { motion } from "framer-motion";

const TemperatureDetails = ({ data }) => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Current Temp Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-fuchsia-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500 text-2xl">
                        🌡️
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Current Temperature</h3>
                        <div className="text-3xl font-bold text-slate-800">15°C</div>
                        <div className="text-xs font-semibold text-rose-500 bg-rose-100 px-2 py-1 rounded-full inline-block mt-1">Slightly Low</div>
                    </div>
                </div>

                {/* Range Card */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-fuchsia-100">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-500 text-xl">
                            📅
                        </div>
                        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">24-Hour Range</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-600">12°C</span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-400 to-fuchsia-500" style={{ width: '60%', marginLeft: '10%' }}></div>
                        </div>
                        <span className="text-sm font-bold text-slate-600">18°C</span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Temperature Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-fuchsia-50/50 rounded-xl p-4 border border-fuchsia-100">
                        <h4 className="text-sm font-semibold text-fuchsia-800 mb-2">Ideal Range</h4>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-slate-600">18°C</span>
                            <div className="flex-1 h-2 bg-slate-200 rounded-full relative">
                                <div className="absolute left-1/4 right-1/4 h-full bg-emerald-400 rounded-full"></div>
                            </div>
                            <span className="text-xs font-bold text-slate-600">24°C</span>
                        </div>
                        <p className="text-[10px] text-fuchsia-600/80 text-center">Optimal for Orchid Growth</p>
                    </div>

                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
                        <h4 className="text-sm font-semibold text-amber-800 mb-2">Status</h4>
                        <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
                            <span>⚠️</span>
                            <span>3°C below optimal</span>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-slate-100">
                        <h4 className="text-sm font-semibold text-slate-600 mb-2">Daily Pattern</h4>
                        <div className="flex items-end justify-between h-16 gap-1">
                            {[12, 13, 15, 17, 16, 14, 13].map((temp, i) => (
                                <div key={i} className="flex flex-col items-center gap-1 w-full">
                                    <div className="w-full bg-purple-200 rounded-t-sm hover:bg-purple-300 transition-colors" style={{ height: `${(temp - 10) * 8}px` }}></div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>6A</span>
                            <span>12P</span>
                            <span>6P</span>
                            <span>12A</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Recommendations</h3>
                <div className="space-y-3">
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-500 flex items-center justify-center text-xl shrink-0">🔥</div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-slate-800">Increase Temperature</h4>
                            <p className="text-sm text-slate-500">Adjust thermostat to increase temperature by 3°C</p>
                            <div className="flex gap-3 mt-2 text-xs">
                                <span className="font-bold text-rose-500">High Priority</span>
                                <span className="text-slate-400">Adjust by 6 PM</span>
                            </div>
                        </div>
                        <button className="px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">Apply</button>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center text-xl shrink-0">🛡️</div>
                        <div className="flex-1">
                            <h4 className="font-semibold text-slate-800">Night Protection</h4>
                            <p className="text-sm text-slate-500">Temperature dropped below 12°C 3 times this week</p>
                            <div className="flex gap-3 mt-2 text-xs">
                                <span className="font-bold text-amber-500">Medium Priority</span>
                                <span className="text-slate-400">Tonight at 8 PM</span>
                            </div>
                        </div>
                        <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors">Schedule</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemperatureDetails;
