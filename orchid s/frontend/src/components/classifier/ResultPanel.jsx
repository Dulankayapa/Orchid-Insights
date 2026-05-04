import React, { useState } from "react";
import ConfidenceBar from "./ConfidenceBar";
import OodMeter from "./OodMeter";
import FertilizerPage from "./FertilizerPage";

const KNOWN_LABELS = ["vanda", "oncidium", "phalaenopsis", "cattleya", "dendrobium"];

function humanizeLabel(label) {
  return String(label || "unknown").replace(/_/g, " ");
}

function toPercent(value) {
  return Math.round((value || 0) * 100);
}

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
  const confidencePercent = toPercent(topPred.confidence);
  const speciesName = humanizeLabel(topPred.label);

  const bannerStyle = isLowConf
    ? "border-yellow-700/30 bg-[linear-gradient(180deg,rgba(57,43,8,0.92),rgba(30,21,3,0.96))]"
    : "border-green-700/30 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.14),transparent_42%),linear-gradient(180deg,rgba(8,28,16,0.94),rgba(5,18,10,0.98))] forest-glow";

  const canShowFertilizer =
    !is_ood && KNOWN_LABELS.includes(topPred.label.toLowerCase().split("_")[0]);

  return (
    <div className="animate-fade-up space-y-5">
      <div className={`overflow-hidden rounded-[28px] border p-6 sm:p-7 ${bannerStyle}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-green-500/90">
            <span className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_14px_rgba(74,222,128,0.75)]" />
            {isLowConf ? "Needs another look" : "Identified species"}
          </div>
          <div
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              isLowConf
                ? "border-yellow-500/30 bg-yellow-400/10 text-yellow-300"
                : "border-green-500/25 bg-green-400/10 text-green-300"
            }`}
          >
            {isLowConf ? `${confidencePercent}% below confidence target` : "Supported orchid class"}
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.8fr)] md:items-end">
          <div>
            <p className="font-display text-[2.3rem] font-light leading-[0.92] text-green-100 sm:text-5xl">
              {speciesName}
            </p>
            <p
              className={`mt-3 max-w-xl font-body text-sm leading-6 ${
                isLowConf ? "text-yellow-100/75" : "text-green-100/70"
              }`}
            >
              {isLowConf
                ? "The image is close to a known orchid class, but the confidence is still low. A sharper flower photo should improve the result."
                : "The uploaded flower matches one of the orchid groups supported by this model. Use the guide below for care ideas and compare the ranked alternatives when two genera look similar."}
            </p>
          </div>

          <div className="rounded-[24px] border border-white/8 bg-black/15 p-4 backdrop-blur-sm">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-body text-[11px] uppercase tracking-[0.24em] text-green-500/80">
                  Confidence
                </p>
                <p
                  className={`mt-2 font-display text-4xl font-light ${
                    isLowConf ? "text-yellow-200" : "text-green-200"
                  }`}
                >
                  {confidencePercent}%
                </p>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  isLowConf ? "bg-yellow-400/10 text-yellow-300" : "bg-green-400/10 text-green-300"
                }`}
              >
                {isLowConf ? "Review" : "Strong match"}
              </div>
            </div>
            <div
              className={`mt-4 h-2 overflow-hidden rounded-full ${
                isLowConf ? "bg-yellow-950/70" : "bg-green-950/70"
              }`}
            >
              <div
                className={`h-full rounded-full ${
                  isLowConf
                    ? "bg-gradient-to-r from-yellow-500 via-yellow-400 to-amber-200"
                    : "bg-gradient-to-r from-emerald-500 via-green-400 to-green-200 shadow-[0_0_24px_rgba(74,222,128,0.35)]"
                }`}
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between font-body text-xs text-green-200/60">
              <span>model certainty</span>
              <span className="tabular-nums">{confidencePercent}/100</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <p className="font-body text-[11px] uppercase tracking-[0.22em] text-green-500/80">Distribution</p>
            <p className={`mt-2 font-body text-sm font-semibold ${is_ood ? "text-pink-300" : "text-green-200"}`}>
              {is_ood ? "Outside trained range" : "Inside trained range"}
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <p className="font-body text-[11px] uppercase tracking-[0.22em] text-green-500/80">Inference</p>
            <p className="mt-2 font-body text-sm font-semibold text-green-200">
              <span className="tabular-nums">{inference_ms}</span> ms
            </p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
            <p className="font-body text-[11px] uppercase tracking-[0.22em] text-green-500/80">Model scope</p>
            <p className="mt-2 font-body text-sm font-semibold text-green-200">5 orchid genera</p>
          </div>
        </div>
      </div>

      {canShowFertilizer ? (
        <div className="space-y-3">
          <button
            onClick={() => setShowFertilizer((current) => !current)}
            className="group flex w-full items-center justify-between rounded-[24px] border border-green-400/15 px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-green-300/25 active:scale-[0.99]"
            style={{
              background:
                "linear-gradient(135deg, rgba(134,239,172,0.12) 0%, rgba(74,222,128,0.06) 45%, rgba(6,95,70,0.14) 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-green-400/10 bg-green-300/10 text-green-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.7"
                    d="M12 21V10m0 0C9.5 10 7.5 8.2 7.5 6c0-1.8 1.5-3 4.5-3 3 0 4.5 1.2 4.5 3 0 2.2-2 4-4.5 4Zm0 0c2.7 0 5 2.1 5 4.6 0 3.1-2.5 5.4-5 6.4-2.5-1-5-3.3-5-6.4C7 12.1 9.3 10 12 10Z"
                  />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-body text-sm font-semibold leading-tight text-green-200">
                  {showFertilizer ? "Hide Fertilizer Guide" : "Show Fertilizer Guide"}
                </p>
                <p className="mt-1 font-body text-xs text-green-100/60">
                  Personalized feeding ideas for <span className="capitalize text-green-300">{speciesName}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full border border-green-400/15 bg-green-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-green-300 sm:inline-flex">
                Care guide
              </span>
              <span
                className={`text-lg text-green-400 transition-transform duration-200 ${
                  showFertilizer ? "rotate-90" : "group-hover:translate-x-1"
                }`}
              >
                {">"}
              </span>
            </div>
          </button>

          {showFertilizer ? (
            <div className="overflow-hidden rounded-[24px] border border-green-800/30 bg-[#080c10] p-4">
              <FertilizerPage
                classificationLabel={topPred.label}
                confidence={topPred.confidence}
                embedded
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <OodMeter distance={mahalanobis_distance} threshold={threshold} isOod={is_ood} />

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="font-body text-xs uppercase tracking-[0.28em] text-green-700">Top Predictions</p>
            <p className="mt-1 font-body text-xs text-green-100/50">
              Ranked orchid classes from the current model
            </p>
          </div>
        </div>
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

      <div className="flex items-center justify-between px-1 font-body text-xs text-green-800">
        <span>EfficientNetB0 | ONNX Runtime</span>
        <span className="tabular-nums">inference {inference_ms} ms</span>
      </div>
    </div>
  );
}
