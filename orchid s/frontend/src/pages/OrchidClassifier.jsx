import React, { useCallback, useRef, useState } from 'react'
import DropZone from '../components/classifier/DropZone'
import Loader from '../components/classifier/Loader'
import ResultPanel from '../components/classifier/ResultPanel'
import { fileApi } from '../lib/api'

function normalizeResult(data) {
  const rawPredictions = Array.isArray(data?.top_predictions)
    ? data.top_predictions
    : Array.isArray(data?.predictions)
      ? data.predictions
      : Array.isArray(data?.top_k)
        ? data.top_k
        : []

  const top_predictions = rawPredictions.map((pred) => ({
    label: pred.label,
    confidence: pred.confidence ?? pred.score ?? 0,
  }))

  const bestPrediction = top_predictions[0] ?? {
    label: data?.label ?? 'unknown',
    confidence: data?.confidence ?? 0,
  }

  const is_ood = Boolean(data?.is_ood)
  const isLowConfidence = !is_ood && bestPrediction.confidence < 0.75

  return {
    ...data,
    is_ood,
    status: is_ood ? 'OOD' : isLowConfidence ? 'LOW_CONFIDENCE' : 'OK',
    top_predictions: top_predictions.length ? top_predictions : [bestPrediction],
    mahalanobis_distance: data?.mahalanobis_distance ?? data?.ood ?? 0,
    threshold: data?.threshold ?? 1,
    inference_ms: data?.inference_ms ?? 0,
  }
}

function normalizeError(err) {
  const rawMessage = err.response?.data?.detail ?? err.message ?? 'Unknown error'
  const message = typeof rawMessage === 'string' ? rawMessage : JSON.stringify(rawMessage)
  const normalized = message.toLowerCase()
  const isOod =
    err.response?.status === 422 &&
    (
      normalized.includes('out of distribution') ||
      normalized.includes('trained orchid species') ||
      normalized.includes('please upload a clear photo of one of those orchids')
    )

  return {
    kind: isOod ? 'OOD' : 'ERROR',
    message,
  }
}

function UploadSymbol() {
  return (
    <svg className="h-8 w-8 text-[#7799e6]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 16V5m0 0-3.5 3.5M12 5l3.5 3.5M5 19h14" />
    </svg>
  )
}

function AnalyzeSymbol() {
  return (
    <svg className="h-8 w-8 text-[#9b8de1]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 0v2m0 8v2m4-6h2M5 11H3m10.5 4.5L15 17m-8-8L5.5 7m8 0L15 7m-8 10L5.5 15"
      />
    </svg>
  )
}

function IdentifySymbol() {
  return (
    <svg className="h-8 w-8 text-[#f084b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M12 6.5c.8-1.7 2.1-2.5 3.6-2.5 2.1 0 3.9 1.7 3.9 3.9 0 4.2-5 7.2-7.5 8.8-2.5-1.6-7.5-4.6-7.5-8.8C4.5 5.7 6.3 4 8.4 4c1.5 0 2.8.8 3.6 2.5Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v1.5M7 5.5l1 1M17 5.5l-1 1" />
    </svg>
  )
}

function ErrorBanner({ error }) {
  return (
    <div className="rounded-[22px] border border-[#efdedf] bg-[#fff6f6] p-6 shadow-[0_18px_40px_-32px_rgba(185,116,116,0.35)]">
      <div className="flex items-start gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f7dede] text-[#c67b7b]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
          </svg>
        </span>
        <div>
          <p className="font-['DM_Sans'] text-sm font-semibold text-[#b07171]">
            {error.kind === 'OOD' ? 'Out of distribution' : 'Prediction failed'}
          </p>
          <p className="mt-1 font-['DM_Sans'] text-sm leading-6 text-[#bf8787]">{error.message}</p>
        </div>
      </div>
      <p className="mt-4 font-['DM_Sans'] text-xs leading-6 text-[#95a997]">
        {error.kind === 'OOD'
          ? 'This image is outside the classifier training set. Upload a clear photo of cattleya, dendrobium, oncidium, phalaenopsis, or vanda.'
          : 'Use a clear photo of a supported orchid species. Non-orchid flowers and unsupported plants are rejected.'}
      </p>
    </div>
  )
}

function FeatureCard({ icon, title, body, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group rounded-[20px] px-4 py-3 text-center transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="mb-2 flex justify-center transition-transform duration-200 group-hover:-translate-y-0.5">{icon}</div>
      <p className="font-['Cormorant_Garamond'] text-[1.15rem] leading-none text-[#b6e2c0]">{title}</p>
      <p className="mt-2 font-['DM_Sans'] text-[0.94rem] leading-7 text-[#5f8d6f]">{body}</p>
    </button>
  )
}

export default function OrchidClassifier() {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)
  const resultPanelRef = useRef(null)

  const analyzeFile = useCallback(async (file) => {
    if (!file) return

    setResult(null)
    setError(null)
    setLoading(true)

    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await fileApi().post('/orchid-classifier/predict', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(normalizeResult(data))
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const setPreviewFromFile = useCallback((file) => {
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)
  }, [])

  const handleFile = useCallback((file) => {
    if (!file) return

    setSelectedFile(file)
    setPreviewFromFile(file)
    analyzeFile(file)
  }, [analyzeFile, setPreviewFromFile])

  const openFilePicker = useCallback(() => {
    if (loading) return

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }, [loading])

  const handleUploadCardClick = useCallback(() => {
    openFilePicker()
  }, [openFilePicker])

  const handleAnalyseCardClick = useCallback(() => {
    if (loading) return
    if (selectedFile) {
      analyzeFile(selectedFile)
      return
    }
    openFilePicker()
  }, [analyzeFile, loading, openFilePicker, selectedFile])

  const handleIdentifyCardClick = useCallback(() => {
    if (result && resultPanelRef.current) {
      resultPanelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (selectedFile && !loading) {
      analyzeFile(selectedFile)
      return
    }
    openFilePicker()
  }, [analyzeFile, loading, openFilePicker, result, selectedFile])

  const reset = () => {
    setPreview(null)
    setResult(null)
    setError(null)
    setLoading(false)
    setSelectedFile(null)
  }

  return (
    <div className="classifier-scope min-h-screen bg-[#fcfdf9] text-[#446b54]">
      <main className="mx-auto flex min-h-screen w-full max-w-[980px] flex-col px-4 pb-14 pt-8 md:px-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        <header className="mx-auto max-w-[440px] text-center">
          <p className="font-['DM_Sans'] text-[0.72rem] font-semibold uppercase tracking-[0.42em] text-[#7ca88e]">
            AI · BOTANICAL INTELLIGENCE
          </p>
          <h1 className="mt-2 font-['Cormorant_Garamond'] text-[3.4rem] leading-none text-[#1f231e] md:text-[4rem]">
            OrchidAI
          </h1>
          <p className="mx-auto mt-2 max-w-[320px] font-['DM_Sans'] text-[0.98rem] leading-6 text-[#7bb08d]">
            EfficientNetB0 species classifier with out-of-distribution detection
          </p>
        </header>

        <section className="mt-10">
          {!preview ? (
            <div className="mx-auto max-w-[640px]">
              <DropZone onFile={handleFile} loading={loading} />
              {loading ? (
                <div className="mt-6 rounded-[24px] border border-[#e4efe5] bg-white/80 px-6 py-4 shadow-[0_20px_46px_-36px_rgba(99,145,115,0.42)]">
                  <Loader />
                </div>
              ) : null}
              {error ? <div className="mt-6"><ErrorBanner error={error} /></div> : null}
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.02fr_1fr] lg:items-start">
              <div className="space-y-4">
                <div className="relative overflow-hidden rounded-[24px] border border-[#d8e8da] bg-white shadow-[0_26px_54px_-40px_rgba(99,145,115,0.45)]">
                  <img
                    src={preview}
                    alt="Uploaded orchid"
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={reset}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[#b8d7bd] bg-white/86 text-[#9fd89e] shadow-[0_12px_24px_-18px_rgba(99,145,115,0.4)] transition-all duration-200 hover:text-[#83c58a]"
                    aria-label="Remove uploaded image"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/84 backdrop-blur-[2px]">
                      <Loader />
                    </div>
                  ) : null}
                </div>

                {!loading ? (
                  <button
                    type="button"
                    onClick={reset}
                    className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-[#cfded1] bg-white px-4 py-3 font-['DM_Sans'] text-[0.98rem] text-[#7ea08a] shadow-[0_18px_38px_-34px_rgba(99,145,115,0.4)] transition-all duration-200 hover:border-[#b7d1bb] hover:text-[#6d937b]"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 12a8 8 0 1 0 2.34-5.66M4 4v5h5" />
                    </svg>
                    <span>Try another image</span>
                  </button>
                ) : null}

                {error ? <ErrorBanner error={error} /> : null}
              </div>

              <div ref={resultPanelRef}>
                {result && !loading ? <ResultPanel result={result} /> : null}
              </div>
            </div>
          )}
        </section>

        <section className="mx-auto mt-12 grid w-full max-w-[700px] gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<UploadSymbol />}
            title="Upload"
            body="Drag & drop or click to browse your orchid photo"
            onClick={handleUploadCardClick}
            disabled={loading}
          />
          <FeatureCard
            icon={<AnalyzeSymbol />}
            title="Analyse"
            body="EfficientNetB0 extracts deep features for classification"
            onClick={handleAnalyseCardClick}
            disabled={loading}
          />
          <FeatureCard
            icon={<IdentifySymbol />}
            title="Identify"
            body="Get species name, confidence, and OOD detection result"
            onClick={handleIdentifyCardClick}
            disabled={loading}
          />
        </section>
      </main>
    </div>
  )
}
