import React, { useEffect, useState } from "react";
import { getHealthScore } from "../../lib/companionApi";

const scoreTone = (score) => {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-rose-600";
};

export default function MLHealthForecast({ orchidId, sensorData }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchHealth = async () => {
      if (!orchidId || !sensorData) return;
      setLoading(true);
      try {
        const data = await getHealthScore(orchidId, sensorData.temp, sensorData.humidity, sensorData.light);
        setHealth(data);
      } catch (err) {
        console.error("health-score", err);
        setHealth(null);
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, [orchidId, sensorData]);

  if (loading) return <div className="skeleton h-32" />;
  if (!health) return null;

  return (
    <div className="companion-card">
      <h3 className="companion-title">Health Forecast</h3>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-bold ${scoreTone(health.score)}`}>{health.score}</span>
        <span className="text-gray-500">/ 100</span>
        {health.anomaly_detected && (
          <span className="ml-2 bg-rose-100 text-rose-800 text-xs px-2 py-1 rounded">Anomaly</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {Object.entries(health.breakdown || {}).map(([key, val]) => (
          <div key={key} className="flex justify-between">
            <span className="capitalize">{key}:</span>
            <span className="font-medium">{val}</span>
          </div>
        ))}
      </div>
      {Array.isArray(health.forecast) && (
        <div className="mt-3">
          <p className="text-sm text-subtle">3-day forecast</p>
          <div className="flex gap-2 mt-1">
            {health.forecast.map((score, idx) => (
              <div key={idx} className="flex-1 text-center p-2 bg-surface rounded border border-border/50">
                <div className="text-xs">Day {idx + 1}</div>
                <div className={`font-bold ${scoreTone(score)}`}>{score}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
