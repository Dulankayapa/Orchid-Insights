import { useMemo, useState } from "react";
import { fileApi } from "../lib/api";

export default function DiseaseDetector() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const confidencePct = useMemo(() => {
    if (!result) return 0;
    const val = result.confidence_percent ?? (result.confidence || 0) * 100;
    return Math.max(0, Math.min(100, Math.round(val * 100) / 100));
  }, [result]);

  const onFile = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setResult(null);
    setError("");
    const url = URL.createObjectURL(selected);
    setPreview(url);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Choose a leaf image first.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    const form = new FormData();
    form.append("file", file);
    try {
      const resp = await fileApi().post("/disease/predict", form);
      setResult(resp.data.prediction || resp.data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6 border border-rose-400/30 shadow-glow">
        <p className="text-xs uppercase tracking-[0.25em] text-subtle">Leaf health</p>
        <h2 className="text-2xl font-semibold text-dark">Disease detector</h2>
        <p className="text-slate-600 mt-2">Upload a single leaf photo. The backend runs MobileNetV3 PlantVillage weights and returns status/disease/confidence.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <form onSubmit={submit} className="lg:col-span-2 glass rounded-3xl p-6 border border-white/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-dark">Upload leaf image</h3>
            <span className="text-xs text-subtle">JPG/PNG · 224x224+</span>
          </div>
          <label className="border-2 border-dashed border-fuchsia-200 rounded-2xl p-6 cursor-pointer hover:border-rose-400/50 transition flex flex-col items-center gap-2 text-center bg-white/50">
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            <div className="text-slate-700 font-semibold">Drop or select a file</div>
            <p className="text-sm text-slate-500">The backend converts to RGB and normalizes.</p>
            {file && <p className="text-sm text-rose-600">{file.name}</p>}
          </label>
          {preview && (
            <div className="rounded-2xl overflow-hidden border border-fuchsia-100 bg-slate-100">
              <img src={preview} alt="Preview" className="w-full h-64 object-cover" />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-400 to-orange-500 text-white font-semibold px-5 py-3 shadow-glow disabled:opacity-60"
          >
            {loading ? "Analyzing..." : "Analyze leaf"}
          </button>
          {error && <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
        </form>

        <div className="glass rounded-3xl p-6 border border-white/40 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-dark">Prediction</h3>
            <span className="text-xs px-3 py-1 rounded-full border border-fuchsia-100 bg-white/50 text-subtle">Live</span>
          </div>
          <div className="rounded-2xl border border-fuchsia-100 bg-white/50 p-4 space-y-2">
            <p className="text-sm text-slate-600">Health status</p>
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${result?.status === "Healthy" ? "bg-emerald-500 shadow-[0_0_0_8px_rgba(16,185,129,0.18)]" : "bg-rose-500 shadow-[0_0_0_8px_rgba(244,63,94,0.18)]"}`} />
              <p className="text-xl font-semibold text-dark">{result ? result.status : "Awaiting upload"}</p>
            </div>
            <p className="text-sm text-slate-500">Detected disease/class</p>
            <p className="text-base font-medium text-rose-600">{result ? result.disease : "—"}</p>
          </div>
          <div className="rounded-2xl border border-fuchsia-100 bg-white/50 p-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Confidence</span>
              <span className="font-semibold text-dark">{confidencePct}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-rose-400 via-pink-400 to-white transition-all" style={{ width: `${confidencePct}%` }} />
            </div>
            <p className="text-xs text-slate-500">Class index: <span className="font-mono">{result?.class_index ?? "—"}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
