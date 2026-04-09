import React, { useEffect, useState } from "react";
import { getNextWatering } from "../../lib/companionApi";

export default function DynamicWateringAdvisor({ orchidId, sensorData }) {
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAdvice = async () => {
      if (!orchidId || !sensorData) return;
      setLoading(true);
      try {
        const data = await getNextWatering(orchidId, sensorData.temp, sensorData.humidity, sensorData.lightLevel);
        setAdvice(data);
      } catch (err) {
        console.error("next-watering", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAdvice();
  }, [orchidId, sensorData]);

  if (loading) return <div className="skeleton h-24" />;

  return (
    <div className="companion-card">
      <h3 className="companion-title">Watering Advisor</h3>
      {advice ? (
        <>
          <p className="text-2xl font-bold text-primary">{advice.recommended_date}</p>
          <p className="text-sm text-subtle mt-1">Confidence: {(advice.confidence * 100).toFixed(0)}%</p>
          <p className="text-sm mt-2">{advice.reason}</p>
          <button
            type="button"
            onClick={() => alert("Watering logged! (wire to backend if needed)")}
            className="mt-3 btn-primary px-4 py-2 rounded-lg"
          >
            Mark as watered
          </button>
        </>
      ) : (
        <p className="text-sm text-subtle">No advice available.</p>
      )}
    </div>
  );
}
