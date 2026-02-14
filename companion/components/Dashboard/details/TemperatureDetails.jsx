// src\components\Dashboard\details\TemperatureDetails.jsx
import React from 'react';
import { FiThermometer, FiCalendar, FiAlertCircle } from 'react-icons/fi';
import { MdDeviceThermostat } from 'react-icons/md';

const TemperatureDetails = ({ data }) => {
  return (
    <div className="details-container">
      <div className="metrics-grid">
        <div className="metric-card-large">
          <div className="metric-icon">
            <FiThermometer />
          </div>
          <div className="metric-content">
            <h3>Current Temperature</h3>
            <div className="metric-value-large">15°C</div>
            <div className="metric-status">Slightly Low</div>
          </div>
        </div>

        <div className="metric-card-large">
          <div className="metric-icon">
            <FiCalendar />
          </div>
          <div className="metric-content">
            <h3>24-Hour Range</h3>
            <div className="range-display">
              <span className="range-min">12°C</span>
              <div className="range-bar">
                <div className="range-fill" style={{ width: '60%' }}></div>
              </div>
              <span className="range-max">18°C</span>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <h3>Temperature Analysis</h3>
        <div className="analysis-grid">
          <div className="analysis-card">
            <h4>Ideal Range</h4>
            <div className="ideal-range">
              <span className="ideal-min">18°C</span>
              <div className="ideal-bar">
                <div className="ideal-zone"></div>
              </div>
              <span className="ideal-max">24°C</span>
            </div>
            <p className="ideal-note">Optimal for Orchid Growth</p>
          </div>

          <div className="analysis-card">
            <h4>Status</h4>
            <div className="status-indicator warning">
              <FiAlertCircle />
              <span>3°C below optimal</span>
            </div>
          </div>

          <div className="analysis-card">
            <h4>Daily Pattern</h4>
            <div className="pattern-chart">
              {[12, 13, 15, 17, 16, 14, 13].map((temp, i) => (
                <div key={i} className="pattern-bar" style={{ height: `${(temp-10)*10}px` }}>
                  <span className="pattern-value">{temp}°</span>
                </div>
              ))}
            </div>
            <div className="pattern-labels">
              <span>6AM</span>
              <span>12PM</span>
              <span>6PM</span>
              <span>12AM</span>
            </div>
          </div>
        </div>
      </div>

      <div className="recommendations-section">
        <h3>Recommendations</h3>
        <div className="recommendations-list">
          <div className="recommendation-item">
            <div className="rec-icon">🔥</div>
            <div className="rec-content">
              <h4>Increase Temperature</h4>
              <p>Adjust thermostat to increase temperature by 3°C</p>
              <div className="rec-meta">
                <span className="rec-priority high">High Priority</span>
                <span className="rec-time">Adjust by 6 PM</span>
              </div>
            </div>
            <button className="rec-action">Apply</button>
          </div>

          <div className="recommendation-item">
            <div className="rec-icon">🛡️</div>
            <div className="rec-content">
              <h4>Night Protection</h4>
              <p>Temperature dropped below 12°C 3 times this week</p>
              <div className="rec-meta">
                <span className="rec-priority medium">Medium Priority</span>
                <span className="rec-time">Tonight at 8 PM</span>
              </div>
            </div>
            <button className="rec-action">Schedule</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TemperatureDetails;