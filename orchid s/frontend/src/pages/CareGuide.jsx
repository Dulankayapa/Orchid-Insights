import React from 'react';
import CareGuideBot from '../components/companion/CareGuideBot.jsx';
import CompanionNavbar from '../components/companion/Navbar.jsx';
import { motion } from "framer-motion";

const CareGuide = () => {
    const careSections = [
        {
            id: 1,
            title: 'Watering Guide',
            icon: '💧',
            tips: [
                'Water once every 7-10 days',
                'Use room temperature water',
                'Water in the morning',
                'Allow water to drain completely',
                'Reduce watering in winter'
            ],
            warning: 'Overwatering is the #1 cause of orchid death'
        },
        {
            id: 2,
            title: 'Light Requirements',
            icon: '☀️',
            tips: [
                'Bright, indirect light is best',
                'East or west-facing windows are ideal',
                '6-8 hours of light daily',
                'Avoid direct afternoon sun',
                'Use sheer curtains to filter light'
            ],
            warning: 'Too much direct sun causes leaf burn'
        },
        {
            id: 3,
            title: 'Temperature Control',
            icon: '🌡️',
            tips: [
                'Daytime: 18-25°C (65-77°F)',
                'Nighttime: 15-20°C (60-68°F)',
                '10°C drop at night encourages blooming',
                'Avoid drafts and sudden temperature changes',
                'Keep away from heating/cooling vents'
            ],
            warning: 'Temperature extremes can prevent flowering'
        },
        {
            id: 4,
            title: 'Humidity Levels',
            icon: '💨',
            tips: [
                'Ideal humidity: 50-70%',
                'Use humidity trays with pebbles',
                'Group plants together',
                'Mist leaves in dry conditions',
                'Use a room humidifier'
            ],
            warning: 'Low humidity causes bud drop'
        },
        {
            id: 5,
            title: 'Fertilizing Schedule',
            icon: '🌱',
            tips: [
                'Fertilize every 2 weeks during growth',
                'Use balanced orchid fertilizer (20-20-20)',
                'Dilute to 1/4 recommended strength',
                'Fertilize after watering',
                'Reduce fertilizing in winter'
            ],
            warning: 'Over-fertilization burns roots'
        },
        {
            id: 6,
            title: 'Common Problems',
            icon: '⚠️',
            problems: [
                { symptom: 'Yellow leaves', cause: 'Overwatering or too much sun', fix: 'Adjust watering, move to shade' },
                { symptom: 'No flowers', cause: 'Insufficient light or no temperature drop', fix: 'Increase light, ensure night temp drop' },
                { symptom: 'Root rot', cause: 'Overwatering or poor drainage', fix: 'Repot, improve drainage' },
                { symptom: 'Bud blast', cause: 'Sudden environmental changes', fix: 'Maintain consistent conditions' },
                { symptom: 'Leaf spots', cause: 'Fungal infection', fix: 'Improve air circulation, use fungicide' }
            ]
        }
    ];

    return (
        <div className="relative space-y-8 pb-10">
            <CompanionNavbar />
            <div className="text-center space-y-3 py-4">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Orchid Care Guide</h1>
                <p className="text-slate-600 max-w-2xl mx-auto">Essential tips for healthy, blooming orchids. Master the basics of watering, light, and temperature.</p>
            </div>

            {/* AI Bot Section - Placed at the top for easy access */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-3xl p-6 md:p-8 border border-fuchsia-200/50 shadow-glow"
            >
                <div className="text-center mb-6 space-y-2">
                    <h2 className="text-xl font-semibold text-fuchsia-600 flex items-center justify-center gap-2">
                        <span>💬</span> Ask Our Orchid AI Assistant
                    </h2>
                    <p className="text-slate-500 text-sm">Get personalized advice for your specific orchid needs</p>
                </div>
                <CareGuideBot />
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {careSections.map((section, idx) => (
                    <motion.div
                        key={section.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-fuchsia-100 shadow-sm hover:shadow-lg hover:shadow-fuchsia-500/10 hover:-translate-y-1 transition-all duration-300"
                    >
                        <div className="flex items-center gap-4 mb-5 pb-4 border-b border-fuchsia-50">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center text-2xl text-white shadow-md">
                                {section.icon}
                            </div>
                            <h2 className="text-lg font-bold text-slate-800">{section.title}</h2>
                        </div>

                        <div className="space-y-4">
                            {section.tips && (
                                <ul className="space-y-3">
                                    {section.tips.map((tip, index) => (
                                        <li key={index} className="flex items-start gap-3 text-sm text-slate-600 group">
                                            <span className="text-fuchsia-500 font-bold mt-0.5 group-hover:scale-125 transition-transform">✓</span>
                                            <span className="leading-relaxed">{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {section.problems && (
                                <div className="bg-amber-50 rounded-xl p-4 border-l-4 border-amber-400 space-y-3">
                                    <h4 className="font-semibold text-amber-700 text-sm uppercase tracking-wide">Common Issues:</h4>
                                    <div className="space-y-3">
                                        {section.problems.map((problem, index) => (
                                            <div key={index} className="text-sm border-b border-amber-200/50 pb-2 last:border-0 last:pb-0">
                                                <div className="font-semibold text-slate-800 mb-1">{problem.symptom}</div>
                                                <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
                                                    <span className="text-slate-500">Cause:</span>
                                                    <span className="text-slate-700">{problem.cause}</span>
                                                    <span className="text-emerald-600 font-medium">Fix:</span>
                                                    <span className="text-emerald-800">{problem.fix}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {section.warning && (
                                <div className="bg-rose-50 rounded-xl p-4 border-l-4 border-rose-500 flex items-start gap-3">
                                    <span className="text-xl">⚠️</span>
                                    <span className="text-rose-700 text-sm font-medium leading-relaxed">{section.warning}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-fuchsia-100">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span>📅</span> Monthly Care Checklist
                    </h3>
                    <div className="space-y-3">
                        {[
                            "Check for pests and diseases",
                            "Wipe leaves with damp cloth",
                            "Inspect roots through pot",
                            "Rotate plant for even growth"
                        ].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors">
                                <input
                                    type="checkbox"
                                    id={`check${i}`}
                                    className="w-5 h-5 rounded border-2 border-fuchsia-500 text-fuchsia-600 focus:ring-fuchsia-500 cursor-pointer"
                                />
                                <label htmlFor={`check${i}`} className="text-slate-600 cursor-pointer select-none flex-1">{item}</label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-rose-50 to-red-50 rounded-2xl p-6 shadow-sm border border-rose-100">
                    <h3 className="text-xl font-bold text-rose-600 mb-4 flex items-center gap-2">
                        <span>🚨</span> Emergency Help
                    </h3>
                    <p className="text-slate-600 mb-4 text-sm">If your orchid shows signs of distress:</p>
                    <ul className="space-y-2">
                        {[
                            "Check watering schedule first",
                            "Assess light conditions",
                            "Look for pests under leaves",
                            "Check root health",
                            "Adjust environmental conditions"
                        ].map((item, i) => (
                            <li key={i} className="flex items-center gap-2 text-slate-700 text-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                {item}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default CareGuide;
