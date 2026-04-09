import React from "react";
import { postFeedback } from "../../lib/companionApi";

export default function FeedbackWidget({ orchidId, recommendationType, onFeedbackSent }) {
  const handleFeedback = async (rating) => {
    try {
      await postFeedback({
        orchid_id: orchidId,
        recommendation_type: recommendationType,
        rating,
        timestamp: new Date().toISOString(),
      });
      onFeedbackSent?.();
    } catch (err) {
      console.error("feedback", err);
    }
  };

  if (!orchidId) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-subtle mt-2">
      <span>Was this helpful?</span>
      <button type="button" onClick={() => handleFeedback(1)} className="hover:text-emerald-600 text-sm font-semibold">
        Yes
      </button>
      <button type="button" onClick={() => handleFeedback(0)} className="hover:text-rose-600 text-sm font-semibold">
        No
      </button>
    </div>
  );
}
