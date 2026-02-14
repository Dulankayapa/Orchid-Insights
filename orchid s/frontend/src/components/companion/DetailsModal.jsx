import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TemperatureDetails from './details/TemperatureDetails.jsx';
import LightDetails from './details/LightDetails.jsx';
import DiseaseDetails from './details/DiseaseDetails.jsx';

const DetailsModal = ({ isOpen, onClose, type, data }) => {
    const [activeTab, setActiveTab] = useState('overview');

    if (!isOpen) return null;

    const renderContent = () => {
        switch (type) {
            case 'temperature':
                return <TemperatureDetails data={data} />;
            case 'light':
                return <LightDetails data={data} />;
            case 'disease':
                return <DiseaseDetails data={data} />;
            case 'humidity':
            case 'co2':
            case 'leaf':
            case 'height':
            case 'leafSize':
            default:
                return (
                    <div className="p-8 text-center">
                        <div className="text-4xl mb-4">🚧</div>
                        <h3 className="text-lg font-bold text-slate-800">Coming Soon</h3>
                        <p className="text-slate-500">This detailed view is currently under development.</p>
                    </div>
                );
        }
    };

    const getTitle = (type) => {
        const titles = {
            temperature: 'Temperature Details',
            light: 'Light Monitoring Details',
            humidity: 'Humidity Analysis',
            co2: 'Carbon Dioxide Levels',
            disease: 'Disease Detection Analysis',
            leaf: 'Leaf Condition Report',
            height: 'Growth Tracker - Plant Height',
            leafSize: 'Growth Tracker - Leaf Size'
        };
        return titles[type] || 'Details';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto border border-fuchsia-100"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <h2 className="text-xl font-bold text-slate-800">{getTitle(type)}</h2>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center transition-colors"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="px-6 border-b border-slate-100 flex gap-6 overflow-x-auto">
                                {['overview', 'trends', 'recommendations', 'history'].map((tab) => (
                                    <button
                                        key={tab}
                                        className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                                                ? 'border-fuchsia-500 text-fuchsia-600'
                                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                            }`}
                                        onClick={() => setActiveTab(tab)}
                                    >
                                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 custom-scrollbar">
                                {renderContent()}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default DetailsModal;
