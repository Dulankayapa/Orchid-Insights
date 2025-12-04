import React, { useState } from 'react';
import axios from 'axios';

// Growth Tracker view: user inputs jar id, planting date and current height
export default function GrowthTracker() {
  const [jarId, setJarId] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [currentHeight, setCurrentHeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const backendBase = process.env.REACT_APP_API_URL || 'http://localhost:8000';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    if (!plantingDate || !currentHeight) {
      setError('Please provide planting date and current height.');
      return;
    }

    const payload = {
      planting_date: plantingDate,
      current_height_mm: Number(currentHeight),
    };

    setLoading(true);
    try {
      const resp = await axios.post(`${backendBase}/analyze-growth`, payload);
      setResult(resp.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data || err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="view growth-tracker">
      <h2>Orchid Growth Tracker</h2>
      <p>Enter plant details to analyze growth. (Uses backend model)</p>

      <form onSubmit={submit} className="tracker-form">
        <label>
          Jar / Plant ID
          <input value={jarId} onChange={(e) => setJarId(e.target.value)} placeholder="optional" />
        </label>

        <label>
          Planting date
          <input type="date" value={plantingDate} onChange={(e) => setPlantingDate(e.target.value)} />
        </label>

        <label>
          Current height (mm)
          <input type="number" step="0.1" value={currentHeight} onChange={(e) => setCurrentHeight(e.target.value)} />
        </label>

        <button type="submit" disabled={loading}>{loading ? 'Analyzing…' : 'Analyze'}</button>
      </form>

      {error && (
        <div className="error">Error: {typeof error === 'string' ? error : JSON.stringify(error)}</div>
      )}

      {result && (
        <div className="result">
          <h3>Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
          <p>Notes: The backend predicts whether the plant is below, within, or above expected height for its age and returns an expected range.</p>
        </div>
      )}
    </div>
  );
}
