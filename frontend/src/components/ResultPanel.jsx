import React, { useState } from "react";
import ConfidenceBar from "./ConfidenceBar";
import OodMeter from "./OodMeter";
import FertilizerPage from "./FertilizerPage";

export default function ResultPanel({ result }) {
  const {
    is_ood,
    status,
    top_predictions,
    mahalanobis_distance,
    threshold,
    inference_ms,
  } = result;
  const topPred = top_predictions[0];
  const isLowConf = status === "LOW_CONFIDENCE";

  const [showFertilizer, setShowFertilizer] = useState(false);

  // ── If user tapped "View Fertilizer Guide", show that page ──────────────
  if (showFertilizer) {
    return (
      <FertilizerPage
        classificationLabel={topPred.label}
        confidence={topPred.confidence}
        onBack={() => setShowFertilizer(false)}
      />
    );
  }

  // ── Normal result view ───────────────────────────────────────────────────
  const bannerStyle = is_ood
    ? "bg-orchid-950/40 border-orchid-700/30 orchid-glow"
    : isLowConf
      ? "bg-yellow-950/40 border-yellow-700/30"
      : "bg-green-950/50 border-green-700/30 forest-glow";

  // Only show the fertilizer button for confirmed (non-OOD) results
  const canShowFertilizer =
    !is_ood && KNOWN_LABELS.includes(topPred.label.toLowerCase().split("_")[0]);

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Status banner */}
      <div className={`rounded-2xl p-5 border text-center ${bannerStyle}`}>
        {is_ood ? (
          <>
            <div className="mb-2 text-3xl">⚠️</div>
            <p className="text-2xl font-light font-display text-orchid-300">
              Out-of-Distribution
            </p>
            <p className="mt-1 text-sm text-orchid-500 font-body">
              This image does not match any known orchid species
            </p>
          </>
        ) : isLowConf ? (
          <>
            <div className="mb-2 text-3xl">🔍</div>
            <p className="text-2xl font-light text-yellow-300 font-display">
              Low Confidence
            </p>
            <p className="mt-1 text-xl font-light font-display text-yellow-200/70">
              {topPred.label.replace(/_/g, " ")}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-20 h-1 overflow-hidden bg-yellow-900 rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                  style={{ width: `${Math.round(topPred.confidence * 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-yellow-400 font-body">
                {Math.round(topPred.confidence * 100)}% — below 75% threshold
              </span>
            </div>
            <p className="mt-2 text-xs text-yellow-700 font-body">
              Result may be unreliable — consider a clearer image
            </p>
          </>
        ) : (
          <>
            <p className="mb-1 text-xs tracking-widest text-green-600 uppercase font-body">
              Identified Species
            </p>
            <p className="text-3xl font-light leading-tight text-green-200 font-display">
              {topPred.label.replace(/_/g, " ")}
            </p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <div className="w-20 h-1 overflow-hidden bg-green-900 rounded-full">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-300"
                  style={{ width: `${Math.round(topPred.confidence * 100)}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-green-400 font-body">
                {Math.round(topPred.confidence * 100)}% confident
              </span>
            </div>
          </>
        )}
      </div>

      {/* ── Fertilizer Guide button — only for known, confident species ── */}
      {canShowFertilizer && (
        <button
          onClick={() => setShowFertilizer(true)}
          className="w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-200 hover:opacity-90 active:scale-[0.98] group"
          style={{
            background:
              "linear-gradient(135deg, rgba(134,239,172,0.12) 0%, rgba(74,222,128,0.06) 100%)",
            border: "1px solid rgba(134,239,172,0.25)",
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center text-lg w-9 h-9 rounded-xl"
              style={{ background: "rgba(134,239,172,0.15)" }}
            >
              🌿
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold leading-tight text-green-300 font-body">
                View Fertilizer Guide
              </p>
              <p className="text-xs text-green-700 font-body mt-0.5">
                Fertilizers for{" "}
                <span className="text-green-500 capitalize">
                  {topPred.label.replace(/_/g, " ")}
                </span>
              </p>
            </div>
          </div>
          <span className="text-lg text-green-600 transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        </button>
      )}

      {/* Mahalanobis gauge */}
      <OodMeter
        distance={mahalanobis_distance}
        threshold={threshold}
        isOod={is_ood}
      />

      {/* Top predictions */}
      <div className="space-y-2">
        <p className="px-1 text-xs tracking-widest text-green-700 uppercase font-body">
          Top Predictions
        </p>
        {top_predictions.map((pred, i) => (
          <ConfidenceBar
            key={pred.label}
            label={pred.label}
            confidence={pred.confidence}
            rank={i}
            isOod={is_ood}
          />
        ))}
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between px-1 text-xs text-green-800 font-body">
        <span>EfficientNetB0 · ONNX Runtime</span>
        <span className="tabular-nums">⚡ {inference_ms} ms</span>
      </div>
    </div>
  );
}

// Labels that have fertilizer data — must match keys in FERTILIZER_DATA
const KNOWN_LABELS = [
  "vanda",
  "oncidium",
  "phalaenopsis",
  "cattleya",
  "dendrobium",
];
