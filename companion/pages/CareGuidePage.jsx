// src\pages\CareGuidePage.jsx
import React from 'react';
import CareGuideBot from '../components/CareGuideBot/CareGuideBot';
import './CareGuidePage.css';

const CareGuidePage = () => {
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
    <div className="care-guide-page">
      <div className="care-guide-header">
        <h1 className="care-guide-title">Orchid Care Guide</h1>
        <p className="care-guide-subtitle">Essential tips for healthy, blooming orchids</p>
      </div>

      {/* AI Bot Section - Placed at the top for easy access */}
      <div className="ai-bot-section">
        <h2 className="section-title-bot">💬 Ask Our Orchid AI Assistant</h2>
        <p className="bot-intro">Get personalized advice for your specific orchid needs</p>
        <CareGuideBot />
      </div>

      <div className="care-sections-container">
        {careSections.map(section => (
          <div key={section.id} className="care-section-card">
            <div className="section-header">
              <div className="section-icon">{section.icon}</div>
              <h2>{section.title}</h2>
            </div>
            
            <div className="section-content">
              {section.tips && (
                <ul className="tips-list">
                  {section.tips.map((tip, index) => (
                    <li key={index} className="tip-item">
                      <span className="tip-bullet">✓</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              )}
              
              {section.problems && (
                <div className="problems-container">
                  <h4>Common Issues:</h4>
                  {section.problems.map((problem, index) => (
                    <div key={index} className="problem-item">
                      <div className="problem-symptom">
                        <strong>{problem.symptom}</strong>
                      </div>
                      <div className="problem-details">
                        <span className="cause">Cause: {problem.cause}</span>
                        <span className="fix">Fix: {problem.fix}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {section.warning && (
                <div className="warning-box">
                  <span className="warning-icon">⚠️</span>
                  <span className="warning-text">{section.warning}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="care-guide-footer">
        <div className="reminder-card">
          <h3>📅 Monthly Care Checklist</h3>
          <div className="checklist">
            <div className="checklist-item">
              <input type="checkbox" id="check1" />
              <label htmlFor="check1">Check for pests and diseases</label>
            </div>
            <div className="checklist-item">
              <input type="checkbox" id="check2" />
              <label htmlFor="check2">Wipe leaves with damp cloth</label>
            </div>
            <div className="checklist-item">
              <input type="checkbox" id="check3" />
              <label htmlFor="check3">Inspect roots through pot</label>
            </div>
            <div className="checklist-item">
              <input type="checkbox" id="check4" />
              <label htmlFor="check4">Rotate plant for even growth</label>
            </div>
          </div>
        </div>
        
        <div className="emergency-card">
          <h3>🚨 Emergency Help</h3>
          <p>If your orchid shows signs of distress:</p>
          <ul>
            <li>Check watering schedule first</li>
            <li>Assess light conditions</li>
            <li>Look for pests under leaves</li>
            <li>Check root health</li>
            <li>Adjust environmental conditions</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CareGuidePage;