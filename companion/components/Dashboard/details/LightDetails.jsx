// src\components\Dashboard\details\LightDetails.jsx
import React from 'react';
import { FiSun, FiClock, FiActivity } from 'react-icons/fi';

const LightDetails = ({ data }) => {
  const lightSchedule = [
    { time: '6 AM', intensity: '200 LUX', source: 'Morning Sun' },
    { time: '10 AM', intensity: '800 LUX', source: 'Grow Light' },
    { time: '2 PM', intensity: '600 LUX', source: 'Filtered Sun' },
    { time: '6 PM', intensity: '50 LUX', source: 'Ambient' },
  ];

  return (
    <div className="details-container">
      <div className="light-header">
        <div className="light-metric">
          <div className="metric-icon">
            <FiSun />
          </div>
          <div className="metric-content">
            <h3>Current Light Intensity</h3>
            <div className="metric-value-large">700 LUX</div>
            <div className="metric-subtitle">
              PPFD: 120 μmol/m²/s | DLI: 5.2 mol/m²/day
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Light Schedule</h3>
        <div className="schedule-table">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Intensity</th>
                <th>Source</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {lightSchedule.map((item, index) => (
                <tr key={index}>
                  <td>
                    <div className="time-cell">
                      <FiClock />
                      <span>{item.time}</span>
                    </div>
                  </td>
                  <td>
                    <div className={`intensity-cell ${getIntensityClass(item.intensity)}`}>
                      {item.intensity}
                    </div>
                  </td>
                  <td>{item.source}</td>
                  <td>
                    <span className={`status-badge ${index === 1 ? 'active' : 'completed'}`}>
                      {index === 1 ? 'Active' : 'Completed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h3>Light Distribution</h3>
        <div className="distribution-grid">
          <div className="distribution-card">
            <h4>Daily Exposure</h4>
            <div className="exposure-meter">
              <div className="exposure-bar">
                <div className="exposure-fill" style={{ width: '75%' }}></div>
              </div>
              <div className="exposure-info">
                <span>6 hours / 8 hours recommended</span>
                <span className="exposure-percent">75%</span>
              </div>
            </div>
          </div>

          <div className="distribution-card">
            <h4>Light Type Analysis</h4>
            <div className="light-types">
              <div className="light-type-item">
                <div className="light-type-icon">🌞</div>
                <div className="light-type-info">
                  <span>Natural Sun</span>
                  <small>3 hours daily</small>
                </div>
              </div>
              <div className="light-type-item">
                <div className="light-type-icon">💡</div>
                <div className="light-type-info">
                  <span>Grow Light</span>
                  <small>LED #3 - 4 hours</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="recommendations-section">
        <h3>Optimization Recommendations</h3>
        <div className="recommendations-grid">
          <div className="recommendation-card">
            <div className="rec-icon">⏰</div>
            <h4>Extend Morning Light</h4>
            <p>Add 30 minutes of morning light exposure</p>
            <div className="rec-benefit">
              <FiActivity />
              <span>Expected growth increase: 15%</span>
            </div>
          </div>

          <div className="recommendation-card">
            <div className="rec-icon">🪞</div>
            <h4>Add Reflectors</h4>
            <p>Place reflective surface on east side</p>
            <div className="rec-benefit">
              <FiActivity />
              <span>Light efficiency: +25%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const getIntensityClass = (intensity) => {
  const lux = parseInt(intensity);
  if (lux >= 700) return 'high';
  if (lux >= 300) return 'medium';
  return 'low';
};

export default LightDetails;