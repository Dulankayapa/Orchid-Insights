import React, { useState } from "react";
import ConfidenceBar from "./ConfidenceBar";
import OodMeter from "./OodMeter";
import FertilizerPage from "./FertilizerPage";

const KNOWN_LABELS = [
  "vanda",
  "oncidium",
  "phalaenopsis",
  "cattleya",
  "dendrobium",
];

export default function ResultPanel({ result }) {
  const {
    is_ood = false,
    status = "OK",
    top_predictions = [],
    mahalanobis_distance = 0,
    threshold = 1,
    inference_ms = 0,
  } = result;

  const topPred = top_predictions[0] ?? { label: "unknown", confidence: 0 };
  const isLowConf = status === "LOW_CONFIDENCE";
  const [showFertilizer, setShowFertilizer] = useState(false);

  const bannerStyle = is_ood
    ? "bg-orchid-950/40 border-orchid-700/30 orchid-glow"
    : isLowConf
      ? "bg-yellow-950/40 border-yellow-700/30"
      : "bg-green-950/50 border-green-700/30 forest-glow";

  const canShowFertilizer =
    !is_ood && KNOWN_LABELS.includes(topPred.label.toLowerCase().split("_")[0]);

  return (
    <div className="animate-fade-up space-y-4">
      <div className={`rounded-2xl border p-5 text-center ${bannerStyle}`}>
        {is_ood ? (
          <>
            <div className="mb-2 text-3xl">⚠️</div>
            <p className="font-display text-2xl font-light text-orchid-300">
              Out-of-Distribution
            </p>
            <p className="font-body mt-1 text-sm text-orchid-500">
              This image does not match the trained orchid species set
            </p>
            <p className="font-body mt-2 text-xs text-orchid-600">
              Supported species: cattleya, dendrobium, oncidium, phalaenopsis, and vanda.
            </p>
          </>
        ) : isLowConf ? (
          <>
            <div className="mb-2 text-3xl">🔍</div>
            <p className="font-display text-2xl font-light text-yellow-300">
              Low Confidence
            </p>
            <p className="font-display mt-1 text-xl font-light text-yellow-200/70">
              {topPred.label.replace(/_/g, " ")}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="h-1 w-20 overflow-hidden rounded-full bg-yellow-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400"
                  style={{ width: `${Math.round(topPred.confidence * 100)}%` }}
                />
              </div>
              <span className="font-body text-sm font-semibold text-yellow-400">
                {Math.round(topPred.confidence * 100)}% below 75% threshold
              </span>
            </div>
            <p className="font-body mt-2 text-xs text-yellow-700">
              Result may be unreliable. Try a clearer image.
            </p>
          </>
        ) : (
          <>
            <p className="font-body mb-1 text-xs uppercase tracking-widest text-green-600">
              Identified Species
            </p>
            <p className="font-display text-3xl font-light leading-tight text-green-200">
              {topPred.label.replace(/_/g, " ")}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <div className="h-1 w-20 overflow-hidden rounded-full bg-green-900">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-300"
                  style={{ width: `${Math.round(topPred.confidence * 100)}%` }}
                />
              </div>
              <span className="font-body text-sm font-semibold text-green-400">
                {Math.round(topPred.confidence * 100)}% confident
              </span>
            </div>
          </>
        )}
      </div>

      {canShowFertilizer ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowFertilizer((current) => !current)}
            className="group flex w-full items-center justify-between rounded-2xl px-5 py-4 transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
            style={{
              background:
                "linear-gradient(135deg, rgba(134,239,172,0.12) 0%, rgba(74,222,128,0.06) 100%)",
              border: "1px solid rgba(134,239,172,0.25)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl text-lg"
                style={{ background: "rgba(134,239,172,0.15)" }}
              >
                🌿
              </div>
              <div className="text-left">
                <p className="font-body text-sm font-semibold leading-tight text-green-300">
                  {showFertilizer ? "Hide Fertilizer Guide" : "Show Fertilizer Guide"}
                </p>
                <p className="font-body mt-0.5 text-xs text-green-700">
                  {is_ood ? "Based on top prediction: " : "Fertilizers for "}
                  <span className="capitalize text-green-500">
                    {topPred.label.replace(/_/g, " ")}
                  </span>
                </p>
              </div>
            </div>
            <span className="text-lg text-green-600 transition-transform duration-200 group-hover:translate-x-1">
              {showFertilizer ? "↑" : "→"}
            </span>
          </button>

          {showFertilizer ? (
            <div className="overflow-hidden rounded-2xl border border-green-800/30 bg-[#080c10] p-4">
              <FertilizerPage
                classificationLabel={topPred.label}
                confidence={topPred.confidence}
                embedded
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <OodMeter
        distance={mahalanobis_distance}
        threshold={threshold}
        isOod={is_ood}
      />

      {!is_ood ? (
        <div className="space-y-2">
          <p className="font-body px-1 text-xs uppercase tracking-widest text-green-700">
            Top Predictions
          </p>
          {top_predictions.map((pred, index) => (
            <ConfidenceBar
              key={pred.label}
              label={pred.label}
              confidence={pred.confidence}
              rank={index}
              isOod={is_ood}
            />
          ))}
        </div>
      ) : null}

      <div className="font-body flex items-center justify-between px-1 text-xs text-green-800">
        <span>EfficientNetB0 · ONNX Runtime</span>
        <span className="tabular-nums">⚡ {inference_ms} ms</span>
      </div>
    </div>
  );
}
