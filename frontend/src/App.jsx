import React, { useState, useCallback } from 'react'
import axios from 'axios'
import DropZone from './components/DropZone'
import Loader from './components/Loader'
import ResultPanel from './components/ResultPanel'
import FertilizerPage from './components/FertilizerPage'

const API_BASE = 'http://localhost:8000'

export default function App() {
  const [preview,  setPreview]  = useState(null)   // data URL
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState(null)
  const [error,    setError]    = useState(null)

  const handleFile = useCallback(async (file) => {
    // Show preview immediately
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target.result)
    reader.readAsDataURL(file)

    setResult(null)
    setError(null)
    setLoading(true)

    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await axios.post(`${API_BASE}/predict`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
    } catch (err) {
      const msg = err.response?.data?.detail ?? err.message ?? 'Unknown error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = () => {
    setPreview(null)
    setResult(null)
    setError(null)
    setLoading(false)
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="relative px-6 py-8 text-center">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-800/50 to-transparent" />
        <p className="text-xs text-green-700 uppercase tracking-[0.3em] font-body mb-2">
          AI · Botanical Intelligence
        </p>
        <h1 className="text-5xl font-light leading-tight shimmer-text font-display md:text-6xl">
          OrchidAI
        </h1>
        <p className="max-w-xs mx-auto mt-2 text-sm font-light text-green-600 font-body">
          EfficientNetB0 species classifier with out-of-distribution detection
        </p>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="flex items-start justify-center flex-1 px-4 pb-16">
        <div className="w-full max-w-5xl">
          <div className={`grid gap-6 ${preview ? 'md:grid-cols-2' : 'md:grid-cols-1 max-w-xl mx-auto'}`}>

            {/* Left — Upload + Preview */}
            <div className="space-y-4">
              {!preview ? (
                <DropZone onFile={handleFile} loading={loading} />
              ) : (
                <div className="relative overflow-hidden border rounded-2xl glass border-green-800/30"
                  style={{ aspectRatio: '4/3' }}>
                  <img
                    src={preview}
                    alt="Uploaded orchid"
                    className="object-cover w-full h-full"
                  />
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-leaf-dark/60 via-transparent to-transparent" />

                  {/* Reset button */}
                  <button
                    onClick={reset}
                    className="absolute flex items-center justify-center w-8 h-8 text-green-400 transition-all duration-200 border rounded-full top-3 right-3 glass border-green-800/50 hover:text-green-200 hover:border-green-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  {/* Loading overlay */}
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-leaf-dark/70">
                      <Loader />
                    </div>
                  )}
                </div>
              )}

              {/* Try another */}
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

            {/* Right — Results */}
            {(loading && !preview) && (
              <div className="p-8 glass rounded-2xl">
                <Loader />
              </div>
            )}

            {error && (
              <div className="p-6 border glass rounded-2xl border-red-900/40 animate-fade-up">
                <div className="flex items-start gap-3">
                  <span className="text-xl text-red-400">✗</span>
                  <div>
                    <p className="text-sm font-medium text-red-300 font-body">Prediction failed</p>
                    <p className="mt-1 text-xs text-red-600 font-body">{error}</p>
                  </div>
                </div>
                <p className="mt-4 text-xs text-green-800 font-body">
                  Make sure the backend is running at <code className="text-green-700">localhost:8000</code>
                  and the ONNX model files are in place.
                </p>
              </div>
            )}

            {result && !loading && (
              <ResultPanel result={result} />
            )}
          </div>

          {/* Instructions — shown when no image */}
          {!preview && (
            <div className="grid max-w-xl grid-cols-3 gap-4 mx-auto mt-10">
              {[
                { icon: '📤', title: 'Upload', body: 'Drag & drop or click to browse your orchid photo' },
                { icon: '🔬', title: 'Analyse', body: 'EfficientNetB0 extracts deep features for classification' },
                { icon: '🌸', title: 'Identify', body: 'Get species name, confidence, and OOD detection result' },
              ].map(({ icon, title, body }) => (
                <div key={title} className="p-4 text-center rounded-xl glass-dark">
                  <div className="mb-2 text-2xl">{icon}</div>
                  <p className="text-sm font-light text-green-300 font-display">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-green-700 font-body">{body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="py-5 text-center">
        <div className="h-px mb-5 bg-gradient-to-r from-transparent via-green-900/50 to-transparent" />
      </footer>
    </div>
  )
}
