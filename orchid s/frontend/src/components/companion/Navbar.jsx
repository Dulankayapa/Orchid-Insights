import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const CompanionNavbar = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const getActive = () => {
        if (location.pathname === '/companion-dashboard') return 'Dashboard';
        if (location.pathname === '/care') return 'Care Guide';
        return '';
    };

    const active = getActive();

    return (
        <div className="flex items-center justify-between bg-white rounded-2xl px-6 py-4 border border-fuchsia-100 shadow-sm mb-8">
            {/* Left: Branding */}
            <div className="flex items-center gap-3" onClick={() => navigate('/companion-dashboard')} style={{ cursor: 'pointer' }}>
                <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-xl shadow-md">
                    🌺
                </div>
                <div className="hidden sm:block">
                    <h1 className="text-lg font-bold text-slate-800 leading-tight">Orchid Companion</h1>
                    <p className="text-[10px] uppercase tracking-wider text-fuchsia-500 font-bold">Personal Assistant</p>
                </div>
            </div>

            {/* Center: Navigation Pills */}
            <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1">
                <button
                    onClick={() => navigate('/companion-dashboard')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${active === 'Dashboard'
                            ? 'bg-white text-fuchsia-600 shadow-sm'
                            : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
                        }`}
                >
                    Dashboard
                </button>
                <button
                    onClick={() => navigate('/care')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${active === 'Care Guide'
                            ? 'bg-white text-fuchsia-600 shadow-sm'
                            : 'text-slate-500 hover:bg-white/50 hover:text-slate-700'
                        }`}
                >
                    Care Guide
                </button>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
                <button className="w-10 h-10 rounded-full border border-slate-200 text-slate-400 hover:text-fuchsia-500 hover:border-fuchsia-300 hover:bg-fuchsia-50 flex items-center justify-center transition-all">
                    🔔
                </button>
                <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden">
                        {/* User Avatar Placeholder */}
                        <div className="w-full h-full bg-gradient-to-br from-slate-300 to-slate-400"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CompanionNavbar;
