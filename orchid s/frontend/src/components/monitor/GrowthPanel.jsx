import React, { useState } from 'react';
import { push, ref } from 'firebase/database';
import { db } from '../../lib/firebase';

const GrowthPanel = ({ logs }) => {
    const [height, setHeight] = useState('');
    const [note, setNote] = useState('');
    const [status, setStatus] = useState('idle'); // idle, saving, success, error

    const handleLog = async () => {
        if (!height) return;
        setStatus('saving');
        try {
            await push(ref(db, 'growthLogs'), {
                heightCm: parseFloat(height),
                note,
                timestamp: Date.now()
            });
            setHeight('');
            setNote('');
            setStatus('success');
            setTimeout(() => setStatus('idle'), 2000);
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    return (
        <div className="grid md:grid-cols-12 gap-6 h-full">
            {/* Input Section */}
            <div className="md:col-span-4 bg-fuchsia-50 rounded-2xl p-6 border border-fuchsia-100 h-full">
                <h3 className="text-lg font-bold text-fuchsia-800 mb-4 flex items-center gap-2">
                    <span>📏</span> Log New Growth
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-fuchsia-700 mb-1 uppercase tracking-wide">Plant Height (cm)</label>
                        <input
                            type="number"
                            value={height}
                            onChange={(e) => setHeight(e.target.value)}
                            className="w-full rounded-xl border-fuchsia-200 focus:border-fuchsia-500 focus:ring-fuchsia-200 py-3 px-4 text-slate-700 font-bold text-lg"
                            placeholder="e.g. 30.5"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-fuchsia-700 mb-1 uppercase tracking-wide">Notes (Optional)</label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="w-full rounded-xl border-fuchsia-200 focus:border-fuchsia-500 focus:ring-fuchsia-200 py-3 px-4 text-slate-700"
                            placeholder="New leaf appeared..."
                            rows="3"
                        />
                    </div>
                    <button
                        onClick={handleLog}
                        disabled={status === 'saving' || !height}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 ${status === 'success' ? 'bg-emerald-500' : 'bg-fuchsia-600 hover:bg-fuchsia-700 shadow-lg shadow-fuchsia-200'
                            }`}
                    >
                        {status === 'saving' ? 'Saving...' : status === 'success' ? 'Saved! ✅' : 'Log Entry'}
                    </button>
                </div>
            </div>

            {/* List Section */}
            <div className="md:col-span-8 bg-white rounded-2xl border border-slate-100 overflow-hidden flex flex-col h-[400px]">
                <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700">Growth History</h3>
                    <span className="text-xs text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-200">{logs.length} entries</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {logs.map((log, idx) => (
                        <div key={idx} className="flex gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 border-dashed">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg flex-shrink-0">
                                {log.heightCm}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-slate-700 text-sm">Height Logged</span>
                                    <span className="text-xs text-slate-400 font-medium">{new Date(log.timestamp).toLocaleDateString()}</span>
                                </div>
                                <div className="text-sm text-slate-600 mt-1">
                                    Measured at <strong>{log.heightCm} cm</strong>
                                </div>
                                {log.note && <div className="text-xs text-slate-500 mt-1 italic">"{log.note}"</div>}
                            </div>
                        </div>
                    ))}
                    {logs.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            No growth logs yet. Start tracking today!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default GrowthPanel;
