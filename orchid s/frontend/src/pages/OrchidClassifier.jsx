import React, { useCallback, useRef, useState } from "react";
import DropZone from "../components/classifier/DropZone";
import Loader from "../components/classifier/Loader";
import ResultPanel from "../components/classifier/ResultPanel";
import { fileApi } from "../lib/api";

function normalizeResult(data) {
  const rawPredictions = Array.isArray(data?.top_predictions)
    ? data.top_predictions
    : Array.isArray(data?.predictions)
      ? data.predictions
      : Array.isArray(data?.top_k)
        ? data.top_k
        : [];

  const top_predictions = rawPredictions.map((prediction) => ({
    label: prediction.label,
    confidence: prediction.confidence ?? prediction.score ?? 0,
  }));

  const bestPrediction = top_predictions[0] ?? {
    label: data?.label ?? "unknown",
    confidence: data?.confidence ?? 0,
  };

  const is_ood = Boolean(data?.is_ood);
  const isLowConfidence = !is_ood && bestPrediction.confidence < 0.75;

  return {
    ...data,
    is_ood,
    status: is_ood ? "OOD" : isLowConfidence ? "LOW_CONFIDENCE" : "OK",
    top_predictions: top_predictions.length ? top_predictions : [bestPrediction],
    mahalanobis_distance: data?.mahalanobis_distance ?? data?.ood ?? 0,
    threshold: data?.threshold ?? 1,
    inference_ms: data?.inference_ms ?? 0,
  };
}

export default function OrchidClassifier() {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const resultPanelRef = useRef(null);

  const analyzeFile = useCallback(async (file) => {
    if (!file) return;

    setResult(null);
    setError(null);
    setLoading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await fileApi().post("/orchid-classifier/predict", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(normalizeResult(data));
    } catch (err) {
      const message = err.response?.data?.detail ?? err.message ?? "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const setPreviewFromFile = useCallback((file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => setPreview(event.target.result);
    reader.readAsDataURL(file);
  }, []);

  const handleFile = useCallback(
    (file) => {
      if (!file) return;

      setSelectedFile(file);
      setPreviewFromFile(file);
      analyzeFile(file);
    },
    [analyzeFile, setPreviewFromFile]
  );

  const openFilePicker = useCallback(() => {
    if (loading) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }, [loading]);

  const handleUploadCardClick = useCallback(() => {
    openFilePicker();
  }, [openFilePicker]);

  const handleAnalyseCardClick = useCallback(() => {
    if (loading) return;

    if (selectedFile) {
      analyzeFile(selectedFile);
      return;
    }

    openFilePicker();
  }, [analyzeFile, loading, openFilePicker, selectedFile]);

  const handleIdentifyCardClick = useCallback(() => {
    if (result && resultPanelRef.current) {
      resultPanelRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (selectedFile && !loading) {
      analyzeFile(selectedFile);
      return;
    }

    openFilePicker();
  }, [analyzeFile, loading, openFilePicker, result, selectedFile]);

  const reset = () => {
    setPreview(null);
    setResult(null);
    setError(null);
    setLoading(false);
    setSelectedFile(null);
  };

  return (
    <div className="classifier-scope flex min-h-screen flex-col">
      <header className="relative px-6 py-8 text-center">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-green-800/50 to-transparent" />
        <h1 className="font-display text-5xl font-light leading-tight shimmer-text md:text-6xl">
          Orchid Classifier
        </h1>
        <p className="mx-auto mt-2 max-w-xs font-body text-sm font-light text-green-600">
          EfficientNetB0 species classifier with out-of-distribution detection
        </p>
        <p className="mx-auto mt-2 max-w-md font-body text-xs text-green-700">
          This tool identifies supported orchid species only. Other flowers or plants are rejected.
        </p>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16">
        <div className="w-full max-w-5xl">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          <div className={`grid gap-6 ${preview ? "md:grid-cols-2" : "mx-auto max-w-xl md:grid-cols-1"}`}>
            <div className="space-y-4">
              {!preview ? (
                <DropZone onFile={handleFile} loading={loading} />
              ) : (
                <div
                  className="relative overflow-hidden rounded-2xl border border-green-800/30 glass"
                  style={{ aspectRatio: "4/3" }}
                >
                  <img src={preview} alt="Uploaded orchid candidate" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-leaf-dark/60 via-transparent to-transparent" />

                  <button
                    onClick={reset}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-green-800/50 text-green-400 transition-all duration-200 glass hover:border-green-600 hover:text-green-200"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>

                  {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-leaf-dark/70">
                      <Loader />
                    </div>
                  ) : null}
                </div>
              )}

              {preview && !loading ? (
                <button
                  onClick={reset}
                  className="w-full rounded-xl border border-green-800/40 py-2.5 text-sm text-green-600 transition-all duration-200 glass hover:border-green-700 hover:text-green-400 font-body"
                >
                  Try another image
                </button>
              ) : null}
            </div>

            {loading && !preview ? (
              <div className="rounded-2xl p-8 glass">
                <Loader />
              </div>
            ) : null}

            {error ? (
              <div className="animate-fade-up rounded-2xl border border-red-900/40 p-6 glass">
                <div className="flex items-start gap-3">
                  <span className="text-xl text-red-400">x</span>
                  <div>
                    <p className="font-body text-sm font-medium text-red-300">Prediction failed</p>
                    <p className="mt-1 font-body text-xs text-red-600">{error}</p>
                  </div>
                </div>
                <p className="mt-4 font-body text-xs text-green-800">
                  Use a clear orchid photo. Non-orchid plants and unsupported images are rejected.
                </p>
              </div>
            ) : null}

            {result && !loading ? (
              <div ref={resultPanelRef}>
                <ResultPanel result={result} />
              </div>
            ) : null}
          </div>

          <div className="mx-auto mt-10 grid max-w-xl grid-cols-3 gap-4">
            {[
              {
                icon: (
                  <svg className="mx-auto h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.6}
                      d="M12 16V4m0 0-4 4m4-4 4 4M4 16.5v1.25A2.25 2.25 0 0 0 6.25 20h11.5A2.25 2.25 0 0 0 20 17.75V16.5"
                    />
                  </svg>
                ),
                title: "Upload",
                body: "Drag and drop or click to browse your orchid photo",
                onClick: handleUploadCardClick,
              },
              {
                icon: (
                  <svg className="mx-auto h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.6}
                      d="M10.5 6.75a6.75 6.75 0 1 0 4.244 12l4.253 1.417-1.417-4.253A6.75 6.75 0 0 0 10.5 6.75Z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.6}
                      d="m15.75 15.75 3.5 3.5"
                    />
                  </svg>
                ),
                title: "Analyze",
                body: "EfficientNetB0 extracts deep features for orchid classification",
                onClick: handleAnalyseCardClick,
              },
              {
                icon: (
                  <svg className="mx-auto h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.6}
                      d="M12 3c4.75 0 8.861 3 10.5 7.25C20.861 14.5 16.75 17.5 12 17.5s-8.861-3-10.5-7.25C3.139 6 7.25 3 12 3Z"
                    />
                    <circle cx="12" cy="10.25" r="2.75" strokeWidth="1.6" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.6}
                      d="M9.5 20.25h5"
                    />
                  </svg>
                ),
                title: "Identify",
                body: "Get an orchid species result, or an error for non-orchid uploads",
                onClick: handleIdentifyCardClick,
              },
            ].map(({ icon, title, body, onClick }) => (
              <button
                key={title}
                type="button"
                onClick={onClick}
                disabled={loading}
                className="rounded-xl p-4 text-center transition-all duration-200 glass-dark hover:scale-[1.02] hover:border-green-700/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="mb-2 text-green-300">{icon}</div>
                <p className="font-display text-sm font-light text-green-300">{title}</p>
                <p className="mt-1 font-body text-xs leading-relaxed text-green-700">{body}</p>
              </button>
            ))}
          </div>
        </div>
      </main>

      <footer className="py-5 text-center">
        <div className="mb-5 h-px bg-gradient-to-r from-transparent via-green-900/50 to-transparent" />
      </footer>
    </div>
  );
}
