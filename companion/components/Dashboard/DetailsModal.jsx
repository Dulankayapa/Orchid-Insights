// src\components\Dashboard\DetailsModal.jsx
import React, { useState } from 'react';
import './DetailsModal.css';

const DetailsModal = ({ isOpen, onClose, type, data }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  const renderContent = () => {
    switch (type) {
      case 'temperature':
        return <TemperatureDetails data={data} />;
      case 'light':
        return <LightDetails data={data} />;
      case 'humidity':
        return <HumidityDetails data={data} />;
      case 'co2':
        return <CO2Details data={data} />;
      case 'disease':
        return <DiseaseDetails data={data} />;
      case 'leaf':
        return <LeafDetails data={data} />;
      case 'height':
        return <HeightDetails data={data} />;
      case 'leafSize':
        return <LeafSizeDetails data={data} />;
      default:
        return <DefaultDetails data={data} />;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{getTitle(type)}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-tabs">
          {getTabs(type).map(tab => (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="modal-body">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// Helper functions
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

const getTabs = (type) => {
  const baseTabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'trends', label: '📈 Trends' },
    { id: 'recommendations', label: '💡 Recommendations' },
    { id: 'history', label: '📋 History' }
  ];
  
  if (type === 'disease' || type === 'leaf') {
    return [
      { id: 'analysis', label: '🔍 Analysis' },
      { id: 'treatment', label: '💊 Treatment' },
      { id: 'timeline', label: '📅 Timeline' },
      { id: 'prevention', label: '🛡️ Prevention' }
    ];
  }
  
  return baseTabs;
};

export default DetailsModal;