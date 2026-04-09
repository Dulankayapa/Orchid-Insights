import React, { useEffect, useState } from "react";
import { getGrowthAdvice } from "../../lib/companionApi";

const STAGES = ["seedling", "vegetative", "flowering", "resting"];

export default function GrowthTimeline({ growthStage }) {
  const [advice, setAdvice] = useState(null);

  useEffect(() => {
    if (!growthStage) return;
    getGrowthAdvice(growthStage)
      .then((data) => setAdvice(data?.[0] || null))
      .catch((err) => console.error("growth-advice", err));
  }, [growthStage]);

  const currentIndex = STAGES.indexOf(growthStage);

  return (
    <div className="companion-card">
      <h3 className="companion-title">Growth Timeline</h3>
      <div className="flex justify-between mb-4">
        {STAGES.map((stage, idx) => (
          <div key={stage} className="text-center flex-1">
            <div className={`w-3 h-3 rounded-full mx-auto ${idx <= currentIndex ? "bg-primary" : "bg-border"}`} />
            <p className={`text-xs mt-1 ${idx === currentIndex ? "font-semibold" : ""}`}>{stage}</p>
          </div>
        ))}
      </div>
      {advice && (
        <div className="mt-3 p-3 bg-primary/10 rounded border border-primary/25 text-sm">
          {advice.care_instructions}
        </div>
      )}
    </div>
  );
}
