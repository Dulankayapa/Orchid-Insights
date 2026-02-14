// src\components\Dashboard\details\DiseaseDetails.jsx
import React, { useState } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiClock } from 'react-icons/fi';

const DiseaseDetails = ({ data }) => {
  const [selectedLeaf, setSelectedLeaf] = useState(null);

  const diagnosticData = {
    rootHealth: { status: 'Excellent', score: 95 },
    stemIntegrity: { status: 'Good', score: 85 },
    leafAnalysis: { status: 'Early Spots', score: 70 },
    flowerBuds: { status: 'Healthy', score: 90 }
  };

  const leaves = [
    { id: 1, name: 'Leaf L1', health: 'Excellent', color: 'green', notes: 'New growth' },
    { id: 2, name: 'Leaf L2', health: 'Good', color: 'green', notes: 'Mature leaf' },
    { id: 3, name: 'Leaf L3', health: 'Watch', color: 'yellow', notes: 'Monitor closely' },
    { id: 4, name: 'Leaf L4', health: 'Good', color: 'green', notes: 'Healthy' },
  ];

  return (
    <div className="details-container">
      <div className="diagnostic-header">
        <div className="diagnostic-alert">
          <div className="alert-icon">
            <FiAlertTriangle />
          </div>
          <div className="alert-content">
            <h3>Disease Detection Status</h3>
            <div className="alert-status good">Not Detected</div>
            <p className="alert-subtitle">Early warning system activated</p>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Full Health Scan Results</h3>
        <div className="health-grid">
          {Object.entries(diagnosticData).map(([key, value]) => (
            <div key={key} className={`health-card ${value.status.toLowerCase().includes('excellent') ? 'excellent' : ''}`}>
              <h4>{key.replace(/([A-Z])/g, ' $1')}</h4>
              <div className="health-status">
                <span className={`status-badge ${getStatusClass(value.status)}`}>
                  {value.status}
                </span>
              </div>
              <div className="health-score">
                <div className="score-bar">
                  <div className="score-fill" style={{ width: `${value.score}%` }}></div>
                </div>
                <span className="score-value">{value.score}/100</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section">
        <h3>Leaf-by-Leaf Analysis</h3>
        <div className="leaf-analysis">
          <div className="leaf-grid">
            {leaves.map(leaf => (
              <div 
                key={leaf.id} 
                className={`leaf-card ${selectedLeaf === leaf.id ? 'selected' : ''}`}
                onClick={() => setSelectedLeaf(leaf.id)}
              >
                <div className={`leaf-indicator ${leaf.color}`}></div>
                <div className="leaf-info">
                  <h4>{leaf.name}</h4>
                  <span className={`leaf-health ${leaf.health.toLowerCase()}`}>
                    {leaf.health}
                  </span>
                </div>
                <p className="leaf-notes">{leaf.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Treatment Plan</h3>
        <div className="treatment-plan">
          <div className="treatment-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Apply Organic Fungicide</h4>
              <p>Mix 10ml neem oil with 1L water, spray every 3 days</p>
              <div className="step-meta">
                <FiClock />
                <span>Next application: Tomorrow</span>
              </div>
            </div>
            <button className="step-action">Mark Done</button>
          </div>

          <div className="treatment-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Adjust Watering Schedule</h4>
              <p>Reduce watering frequency by 20% for next 2 weeks</p>
              <div className="step-meta">
                <FiClock />
                <span>Next watering: 3 days</span>
              </div>
            </div>
            <button className="step-action">Adjust</button>
          </div>
        </div>
      </div>

      <div className="timeline-section">
        <h3>Diagnostic Timeline</h3>
        <div className="timeline">
          <div className="timeline-item">
            <div className="timeline-date">Jan 15</div>
            <div className="timeline-dot"></div>
            <div className="timeline-content">
              <h4>Routine Check</h4>
              <p>All systems normal, no issues detected</p>
            </div>
          </div>
          <div className="timeline-item">
            <div className="timeline-date">Jan 22</div>
            <div className="timeline-dot alert"></div>
            <div className="timeline-content">
              <h4>Early Alert</h4>
              <p>Increased airflow recommended</p>
            </div>
          </div>
          <div className="timeline-item current">
            <div className="timeline-date">Today</div>
            <div className="timeline-dot current"></div>
            <div className="timeline-content">
              <h4>Monitoring</h4>
              <p>Treatment suggested, close monitoring active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getStatusClass = (status) => {
  if (status.includes('Excellent') || status.includes('Healthy')) return 'good';
  if (status.includes('Good')) return 'good';
  if (status.includes('Early')) return 'warning';
  return 'neutral';
};

export default DiseaseDetails;