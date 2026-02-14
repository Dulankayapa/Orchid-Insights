import React from 'react';
import Dashboard from '../../components/companion/Dashboard.jsx';

const DashboardPage = () => {
    return (
        <div className="space-y-6 pb-10">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Companion Dashboard</h1>
                <p className="text-slate-600">Overview of your orchid's environment, health, and growth status.</p>
            </div>

            <Dashboard />
        </div>
    );
};

export default DashboardPage;
