import React, { useState } from 'react'
import ConfidenceBar from './ConfidenceBar'
import OodMeter from './OodMeter'
import FertilizerPage from './FertilizerPage'
import { useTheme } from '../../context/ThemeContext'

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
  const { theme } = useTheme()
  const isDark = theme === 'dark'
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
  const resultTone = is_ood
    ? {
        background: isDark ? '#412537' : '#f4dee9',
        text: isDark ? '#f8ddec' : '#5f314b',
        subtext: isDark ? '#f1c6dc' : '#7a4a64',
        accent: '#d78fbb',
        bar: '#e6a6cb',
      }
    : isLowConf
      ? {
          background: isDark ? '#473a15' : '#f3e8c8',
          text: isDark ? '#f8edbc' : '#5e4a18',
          subtext: isDark ? '#f3df8b' : '#7a6526',
          accent: '#d7af41',
          bar: '#f3c95d',
        }
      : {
          background: isDark ? '#1f3827' : '#dbe9dd',
          text: isDark ? '#f1fbf3' : '#173423',
          subtext: isDark ? '#bfdfc7' : '#42614d',
          accent: '#2ecc71',
          bar: '#4ade80',
        }
  const fertilizerTone = {
    buttonBackground: isDark ? '#132217' : '#f8fdf8',
    buttonBorder: isDark ? 'rgba(126, 196, 146, 0.26)' : '#d8eadc',
    buttonShadow: isDark
      ? '0 18px 34px -30px rgba(0, 0, 0, 0.55)'
      : '0 16px 34px -30px rgba(106,151,118,0.38)',
    iconBackground: isDark ? '#1a3322' : '#eff7ef',
    iconColor: isDark ? '#8ae7a1' : '#3f9958',
    title: isDark ? '#d7f8de' : '#1f6f39',
    subtitle: isDark ? '#9bc9a7' : '#557767',
    arrow: isDark ? '#7de396' : '#49b866',
    panelBackground: isDark ? '#0f1b13' : '#ffffff',
    panelBorder: isDark ? 'rgba(126, 196, 146, 0.22)' : '#d9eadb',
    panelShadow: isDark
      ? '0 18px 36px -30px rgba(0, 0, 0, 0.65)'
      : '0 18px 36px -30px rgba(106,151,118,0.36)',
  }

  return (
    <div className="animate-fade-up space-y-4">
      <div
        className="rounded-[22px] px-6 py-5 text-center"
        style={{ background: resultTone.background, color: resultTone.text }}
      >
        {is_ood ? (
          <>
            <div className="mb-2 flex justify-center">
              <WarningIcon />
            </div>
            <p
              className="font-['Cormorant_Garamond'] text-[2.1rem] leading-none md:text-[2.35rem]"
              style={{ color: resultTone.accent }}
            >
              {headline}
            </p>
            <p
              className="mx-auto mt-3 max-w-sm font-['DM_Sans'] text-sm leading-6"
              style={{ color: resultTone.subtext }}
            >
              This image does not match any known orchid species
            </p>
          </>
        ) : (
          <>
            <p
              className="font-['DM_Sans'] text-[0.72rem] font-semibold uppercase tracking-[0.18em]"
              style={{ color: resultTone.subtext }}
            >
              {headline}
            </p>
            <p className="mt-3 font-['Cormorant_Garamond'] text-[2.1rem] capitalize leading-none md:text-[2.35rem]">
              {speciesLabel}
            </p>
            <div className="mx-auto mt-4 flex max-w-[240px] items-center justify-center gap-3">
              <div className="h-1 w-16 rounded-full" style={{ background: resultTone.bar }} />
              <span className="font-['DM_Sans'] text-sm font-semibold" style={{ color: resultTone.accent }}>
                {confidenceLabel}
              </span>
            </div>
          </>
        )}
      </div>

      {canShowFertilizer ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowFertilizer((current) => !current)}
            className="flex w-full items-center justify-between rounded-[18px] px-5 py-4 text-left transition-all duration-200"
            style={{
              background: fertilizerTone.buttonBackground,
              border: `1px solid ${fertilizerTone.buttonBorder}`,
              boxShadow: fertilizerTone.buttonShadow,
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: fertilizerTone.iconBackground, color: fertilizerTone.iconColor }}
              >
                <LeafIcon />
              </div>
              <div>
                <p className="font-['DM_Sans'] text-sm font-semibold" style={{ color: fertilizerTone.title }}>
                  View Fertilizer Guide
                </p>
                <p className="mt-0.5 font-['DM_Sans'] text-xs" style={{ color: fertilizerTone.subtitle }}>
                  Fertilizers for <span className="capitalize">{speciesLabel}</span>
                </p>
              </div>
            </div>
            <span style={{ color: fertilizerTone.arrow }}>
              <ArrowIcon open={showFertilizer} />
            </span>
          </button>

          {showFertilizer ? (
            <div
              className="overflow-hidden rounded-[20px] p-4"
              style={{
                background: fertilizerTone.panelBackground,
                border: `1px solid ${fertilizerTone.panelBorder}`,
                boxShadow: fertilizerTone.panelShadow,
              }}
            >
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
        <p
          className="font-['DM_Sans'] px-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em]"
          style={{ color: isDark ? '#99c6a7' : '#567664' }}
        >
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

      <div
        className="flex items-center justify-between px-1 font-['DM_Sans'] text-xs"
        style={{ color: isDark ? '#8db39a' : '#628372' }}
      >
        <span>EfficientNetB0 - ONNX Runtime</span>
        <span className="tabular-nums" style={{ color: isDark ? '#b1d7bc' : '#517261' }}>
          {inference_ms} ms
        </span>
      </div>
    </div>
  )
}
