import React from 'react';
import { motion } from "framer-motion";

const LightDetails = ({ data }) => {
    const lightSchedule = [
        { time: '6 AM', intensity: '200 LUX', source: 'Morning Sun' },
        { time: '10 AM', intensity: '800 LUX', source: 'Grow Light' },
        { time: '2 PM', intensity: '600 LUX', source: 'Filtered Sun' },
        { time: '6 PM', intensity: '50 LUX', source: 'Ambient' },
    ];

    return (
        <div className="space-y-6">
            {/* Header Metric */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center text-amber-500 text-3xl">
                        ☀️
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-amber-800 uppercase tracking-wide">Current Light Intensity</h3>
                        <div className="text-4xl font-bold text-slate-800">700 LUX</div>
                        <div className="text-xs text-amber-700 mt-1 font-medium">
                            PPFD: 120 μmol/m²/s | DLI: 5.2 mol/m²/day
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Light Schedule</h3>
                <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                            <tr>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">Intensity</th>
                                <th className="px-4 py-3">Source</th>
                                <th className="px-4 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {lightSchedule.map((item, index) => (
                                <tr key={index} className="hover:bg-slate-50/50">
                                    <td className="px-4 py-3 font-medium text-slate-700 flex items-center gap-2">
                                        <span>⏰</span> {item.time}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${parseInt(item.intensity) >= 700 ? 'bg-amber-100 text-amber-700' :
                                                parseInt(item.intensity) >= 300 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {item.intensity}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">{item.source}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold tracking-wide ${index === 1 ? 'bg-green-100 text-green-700 ring-1 ring-green-200' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {index === 1 ? 'Active' : 'Completed'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4">Daily Exposure</h4>
                    <div className="space-y-2">
                        <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-400 rounded-full" style={{ width: '75%' }}></div>
                        </div>
                        <div className="flex justify-between text-xs font-medium">
                            <span className="text-slate-500">6 hours / 8 hours recommended</span>
                            <span className="text-amber-600">75%</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <h4 className="font-semibold text-slate-800 mb-4">Light Type Analysis</h4>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-lg">🌞</div>
                            <div>
                                <div className="font-medium text-slate-700 text-sm">Natural Sun</div>
                                <div className="text-xs text-slate-400">3 hours daily</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-lg">💡</div>
                            <div>
                                <div className="font-medium text-slate-700 text-sm">Grow Light</div>
                                <div className="text-xs text-slate-400">LED #3 - 4 hours</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Optimization</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30">
                        <div className="text-2xl mb-2">⏰</div>
                        <h4 className="font-bold text-emerald-900 text-sm">Extend Morning Light</h4>
                        <p className="text-xs text-emerald-700 mt-1 mb-2">Add 30 minutes of morning light exposure</p>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-white/50 px-2 py-1 rounded inline-block">
                            📈 Growth increase: 15%
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/30">
                        <div className="text-2xl mb-2">🪞</div>
                        <h4 className="font-bold text-blue-900 text-sm">Add Reflectors</h4>
                        <p className="text-xs text-blue-700 mt-1 mb-2">Place reflective surface on east side</p>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-white/50 px-2 py-1 rounded inline-block">
                            💡 Light efficiency: +25%
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LightDetails;
