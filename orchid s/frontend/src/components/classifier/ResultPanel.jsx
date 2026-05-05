import React, { useState } from 'react'
import ConfidenceBar from './ConfidenceBar'
import OodMeter from './OodMeter'
import FertilizerPage from './FertilizerPage'

const KNOWN_LABELS = [
  'vanda',
  'oncidium',
  'phalaenopsis',
  'cattleya',
  'dendrobium',
]

function WarningIcon() {
  return (
    <svg className="h-8 w-8 text-[#efae47]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v5m0 3h.01" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="m10.29 3.86-7.4 12.82A2 2 0 0 0 4.62 20h14.76a2 2 0 0 0 1.73-3.32l-7.4-12.82a2 2 0 0 0-3.42 0Z"
      />
    </svg>
  )
}

function LeafIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M18 5c-5.5.3-9.7 2.7-12 7.6 3.4.8 6.1.2 8.3-1.7 2.2-2 3.4-4.7 3.7-5.9Zm-7 6c-.8 2.3-1.8 4.3-3.3 6"
      />
    </svg>
  )
}

function ArrowIcon({ open }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform duration-200 ${open ? '-rotate-90' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 12h14m-4-4 4 4-4 4" />
    </svg>
  )
}

export default function ResultPanel({ result }) {
  const {
    is_ood = false,
    status = 'OK',
    top_predictions = [],
    mahalanobis_distance = 0,
    threshold = 1,
    inference_ms = 0,
  } = result

  const topPred = top_predictions[0] ?? { label: 'unknown', confidence: 0 }
  const isLowConf = status === 'LOW_CONFIDENCE'
  const [showFertilizer, setShowFertilizer] = useState(false)

  const canShowFertilizer =
    !is_ood && KNOWN_LABELS.includes(topPred.label.toLowerCase().split('_')[0])

  const headline = is_ood ? 'Out-of-Distribution' : isLowConf ? 'Low confidence' : 'Identified species'
  const confidenceLabel = `${Math.round((topPred.confidence ?? 0) * 100)}% ${isLowConf ? 'below threshold' : 'confident'}`
  const speciesLabel = topPred.label.replace(/_/g, ' ')

  return (
    <div className="animate-fade-up space-y-4">
      <div
        className={`
          rounded-[22px] px-6 py-5 text-center
          ${is_ood
            ? 'bg-[#dec5d6] text-[#7f5470]'
            : isLowConf
              ? 'bg-[#e3dcb8] text-[#7b7146]'
              : 'bg-[#93a596] text-[#f1f8f2]'}
        `}
      >
        {is_ood ? (
          <>
            <div className="mb-2 flex justify-center">
              <WarningIcon />
            </div>
            <p className="font-['Cormorant_Garamond'] text-[2.1rem] leading-none text-[#d8a6de] md:text-[2.35rem]">
              {headline}
            </p>
            <p className="mx-auto mt-3 max-w-sm font-['DM_Sans'] text-sm leading-6 opacity-85">
              This image does not match any known orchid species
            </p>
          </>
        ) : (
          <>
            <p className="font-['DM_Sans'] text-[0.72rem] font-semibold uppercase tracking-[0.18em] opacity-80">
              {headline}
            </p>
            <p className="mt-3 font-['Cormorant_Garamond'] text-[2.1rem] capitalize leading-none md:text-[2.35rem]">
              {speciesLabel}
            </p>
          <div className="mx-auto mt-4 flex max-w-[240px] items-center justify-center gap-3">
            <div className="h-1 w-16 rounded-full bg-[#69d37f]" />
            <span className="font-['DM_Sans'] text-sm font-semibold text-[#69d37f]">{confidenceLabel}</span>
          </div>
          </>
        )}
      </div>

      {canShowFertilizer ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowFertilizer((current) => !current)}
            className="flex w-full items-center justify-between rounded-[18px] border border-[#e3efe4] bg-[#f8fdf8] px-5 py-4 text-left shadow-[0_16px_34px_-30px_rgba(106,151,118,0.38)] transition-all duration-200 hover:bg-white"
          >
            <div className="flex items-center gap-3 text-[#8be39d]">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eff7ef] text-[#a7e8b0]">
                <LeafIcon />
              </div>
              <div>
                <p className="font-['DM_Sans'] text-sm font-semibold text-[#8fe1a1]">View Fertilizer Guide</p>
                <p className="mt-0.5 font-['DM_Sans'] text-xs text-[#76a884]">
                  Fertilizers for <span className="capitalize">{speciesLabel}</span>
                </p>
              </div>
            </div>
            <span className="text-[#79c68a]">
              <ArrowIcon open={showFertilizer} />
            </span>
          </button>

          {showFertilizer ? (
            <div className="overflow-hidden rounded-[20px] border border-[#d9eadb] bg-white p-4 shadow-[0_18px_36px_-30px_rgba(106,151,118,0.36)]">
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

      <div className="space-y-2">
        <p className="font-['DM_Sans'] px-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#7da88c]">
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

      <div className="flex items-center justify-between px-1 font-['DM_Sans'] text-xs text-[#6c9c7d]">
        <span>EfficientNetB0 · ONNX Runtime</span>
        <span className="tabular-nums text-[#84b08f]">{inference_ms} ms</span>
      </div>
    </div>
  )
}
