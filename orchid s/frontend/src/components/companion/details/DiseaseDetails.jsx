import React, { useState } from 'react';

const DiseaseDetails = ({ data }) => {
    const [selectedLeaf, setSelectedLeaf] = useState(null);

    const diagnosticData = {
        rootHealth: { status: 'Excellent', score: 95 },
        stemIntegrity: { status: 'Good', score: 85 },
        leafAnalysis: { status: 'Early Spots', score: 70 },
        flowerBuds: { status: 'Healthy', score: 90 }
    };

    const leaves = [
        { id: 1, name: 'Leaf L1', health: 'Excellent', color: 'bg-emerald-500', notes: 'New growth' },
        { id: 2, name: 'Leaf L2', health: 'Good', color: 'bg-emerald-500', notes: 'Mature leaf' },
        { id: 3, name: 'Leaf L3', health: 'Watch', color: 'bg-amber-400', notes: 'Monitor closely' },
        { id: 4, name: 'Leaf L4', health: 'Good', color: 'bg-emerald-500', notes: 'Healthy' },
    ];

    return (
        <div className="space-y-6">
            {/* Alert Header */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shrink-0">
                    🛡️
                </div>
                <div>
                    <h3 className="text-lg font-bold text-emerald-900">Disease Detection Status</h3>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-200/50 text-emerald-800 text-xs font-bold mt-1 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Not Detected
                    </div>
                    <p className="text-sm text-emerald-700">Early warning system activated. Monitoring 24/7.</p>
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Full Health Scan Results</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(diagnosticData).map(([key, value]) => (
                        <div key={key} className={`bg-white rounded-xl p-4 border shadow-sm ${value.status.includes('Excellent') ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'}`}>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{key.replace(/([A-Z])/g, ' $1')}</h4>
                            <div className="flex items-end justify-between mb-2">
                                <span className="text-xl font-bold text-slate-800">{value.score}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${value.score >= 90 ? 'bg-emerald-100 text-emerald-700' :
                                        value.score >= 80 ? 'bg-blue-100 text-blue-700' :
                                            'bg-amber-100 text-amber-700'
                                    }`}>{value.status}</span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${value.score >= 90 ? 'bg-emerald-500' :
                                        value.score >= 80 ? 'bg-blue-500' :
                                            'bg-amber-400'
                                    }`} style={{ width: `${value.score}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-800">Leaf-by-Leaf Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {leaves.map(leaf => (
                        <div
                            key={leaf.id}
                            className={`p-3 rounded-xl border cursor-pointer transition-all ${selectedLeaf === leaf.id
                                    ? 'ring-2 ring-fuchsia-400 border-fuchsia-300 bg-fuchsia-50'
                                    : 'border-slate-100 bg-white hover:border-fuchsia-200 hover:shadow-sm'
                                }`}
                            onClick={() => setSelectedLeaf(leaf.id)}
                        >
                            <div className={`w-3 h-3 rounded-full mb-3 ${leaf.color}`}></div>
                            <h4 className="font-bold text-slate-700">{leaf.name}</h4>
                            <div className="text-xs text-slate-500 mb-1">{leaf.health}</div>
                            <p className="text-[10px] text-slate-400 leading-tight">{leaf.notes}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800">Treatment Plan</h3>
                    <div className="space-y-3">
                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-fuchsia-500"></div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">1</span>
                                <button className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700">Mark Done</button>
                            </div>
                            <h4 className="font-semibold text-slate-800">Apply Organic Fungicide</h4>
                            <p className="text-sm text-slate-500 mt-1">Mix 10ml neem oil with 1L water, spray every 3 days</p>
                            <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                                <span>⏰</span> Next application: Tomorrow
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 bottom-0 w-1 bg-slate-200"></div>
                            <div className="flex justify-between items-start mb-2">
                                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center">2</span>
                                <button className="text-xs font-semibold text-slate-400 hover:text-slate-600">Adjust</button>
                            </div>
                            <h4 className="font-semibold text-slate-800">Adjust Watering Schedule</h4>
                            <p className="text-sm text-slate-500 mt-1">Reduce watering frequency by 20% for next 2 weeks</p>
                            <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                                <span>⏰</span> Next watering: 3 days
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800">Diagnostic Timeline</h3>
                    <div className="bg-white p-5 rounded-xl border border-slate-100">
                        <div className="relative border-l-2 border-slate-100 space-y-6 pl-4 ml-2">
                            <div className="relative">
                                <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-slate-300 border-2 border-white"></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Jan 15</span>
                                <h4 className="text-sm font-semibold text-slate-700">Routine Check</h4>
                                <p className="text-xs text-slate-500">All systems normal</p>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-white shadow-sm"></div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Jan 22</span>
                                <h4 className="text-sm font-semibold text-slate-700">Early Alert</h4>
                                <p className="text-xs text-slate-500">Increased airflow recommended</p>
                            </div>
                            <div className="relative">
                                <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-fuchsia-500 ring-4 ring-fuchsia-100 border-2 border-white"></div>
                                <span className="text-[10px] font-bold text-fuchsia-600 uppercase tracking-wide">Today</span>
                                <h4 className="text-sm font-semibold text-slate-800">Monitoring Active</h4>
                                <p className="text-xs text-slate-500">Treatment suggested</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DiseaseDetails;
