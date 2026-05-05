import React, { useState, useCallback, useRef } from 'react'
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
      const msg = err.response?.data?.detail ?? err.message ?? 'Unknown error'
      setError(msg)
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
    <div className="classifier-scope flex flex-col min-h-screen">
      <header className="relative px-6 py-8 text-center">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-800/50 to-transparent" />
        <h1 className="text-5xl font-light leading-tight shimmer-text font-display md:text-6xl">
          Orchid Classifier
        </h1>
        <p className="max-w-xs mx-auto mt-2 text-sm font-light text-green-600 font-body">
          EfficientNetB0 species classifier with out-of-distribution detection
        </p>
        <p className="max-w-md mx-auto mt-2 text-xs text-green-700 font-body">
          Supported species only: cattleya, dendrobium, oncidium, phalaenopsis, and vanda.
        </p>
      </header>

      <main className="flex items-start justify-center flex-1 px-4 pb-16">
        <div className="w-full max-w-5xl">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          <div className={`grid gap-6 ${preview ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-xl mx-auto'}`}>
            <div className="space-y-4">
              {!preview ? (
                <DropZone onFile={handleFile} loading={loading} />
              ) : (
                <div
                  className="relative overflow-hidden border rounded-2xl glass border-green-800/30"
                  style={{ aspectRatio: '4/3' }}
                >
                  <img
                    src={preview}
                    alt="Uploaded orchid"
                    className="object-cover w-full h-full"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-leaf-dark/60 via-transparent to-transparent" />

                  <button
                    onClick={reset}
                    className="absolute flex items-center justify-center w-8 h-8 text-green-400 transition-all duration-200 border rounded-full top-3 right-3 glass border-green-800/50 hover:text-green-200 hover:border-green-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-leaf-dark/70">
                      <Loader />
                    </div>
                  )}
                </div>
              )}

              {preview && !loading && (
                <button
                  onClick={reset}
                  className="w-full py-2.5 rounded-xl border border-green-800/40 text-green-600
                    hover:text-green-400 hover:border-green-700 text-sm font-body
                    transition-all duration-200 glass"
                >
                  ↺ Try another image
                </button>
              )}
            </div>

            {loading && !preview && (
              <div className="p-8 glass rounded-2xl">
                <Loader />
              </div>
            )}

            {error && (
              <div className="p-6 border glass rounded-2xl border-red-900/40 animate-fade-up">
                <div className="flex items-start gap-3">
                  <span className="text-xl text-red-400">✕</span>
                  <div>
                    <p className="text-sm font-medium text-red-300 font-body">Prediction failed</p>
                    <p className="mt-1 text-xs text-red-600 font-body">{error}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-green-800 font-body">
                  Use a clear photo of a supported orchid species. Non-orchid flowers and unsupported plants are rejected.
                </p>
              </div>
            )}

            {result && !loading && (
              <div ref={resultPanelRef}>
                <ResultPanel result={result} />
              </div>
            )}
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-4 mx-auto mt-10">
            {[
              {
                icon: '📤',
                title: 'Upload',
                body: 'Drag & drop or click to browse your orchid photo',
                onClick: handleUploadCardClick,
              },
              {
                icon: '🔬',
                title: 'Analyse',
                body: 'EfficientNetB0 extracts deep features for classification',
                onClick: handleAnalyseCardClick,
              },
              {
                icon: '🌸',
                title: 'Identify',
                body: 'Get species name, confidence, and OOD detection result',
                onClick: handleIdentifyCardClick,
              },
            ].map(({ icon, title, body, onClick }) => (
              <button
                key={title}
                type="button"
                onClick={onClick}
                disabled={loading}
                className="p-4 text-center rounded-xl glass-dark transition-all duration-200 hover:scale-[1.02] hover:border-green-700/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-2 text-2xl">{icon}</div>
                <p className="text-sm font-light text-green-300 font-display">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-green-700 font-body">{body}</p>
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-5 text-center">
        <div className="h-px mb-5 bg-gradient-to-r from-transparent via-green-900/50 to-transparent" />
      </footer>
    </div>
  )
}
