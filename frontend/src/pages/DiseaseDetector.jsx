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
      <div className="glass rounded-3xl p-6 border border-amber-400/30 shadow-glow">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Leaf health</p>
        <h2 className="text-2xl font-semibold">Disease detector</h2>
        <p className="text-slate-300 mt-2">Upload a single leaf photo. The backend runs MobileNetV3 PlantVillage weights and returns status/disease/confidence.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <form onSubmit={submit} className="lg:col-span-2 glass rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Upload leaf image</h3>
            <span className="text-xs text-slate-400">JPG/PNG · 224x224+</span>
          </div>
          <label className="border-2 border-dashed border-white/10 rounded-2xl p-6 cursor-pointer hover:border-amber-400/50 transition flex flex-col items-center gap-2 text-center">
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            <div className="text-slate-200 font-semibold">Drop or select a file</div>
            <p className="text-sm text-slate-400">The backend converts to RGB and normalizes.</p>
            {file && <p className="text-sm text-amber-200">{file.name}</p>}
          </label>
          {preview && (
            <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900/50">
              <img src={preview} alt="Preview" className="w-full h-64 object-cover" />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 text-slate-900 font-semibold px-5 py-3 shadow-glow disabled:opacity-60"
          >
            {loading ? "Analyzing..." : "Analyze leaf"}
          </button>
          {error && <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
        </form>

        <div className="glass rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Prediction</h3>
            <span className="text-xs px-3 py-1 rounded-full border border-white/10 bg-white/5 text-slate-300">Live</span>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-sm text-slate-300">Health status</p>
            <div className="flex items-center gap-2">
              <span className={`h-3 w-3 rounded-full ${result?.status === "Healthy" ? "bg-emerald-400 shadow-[0_0_0_8px_rgba(16,185,129,0.18)]" : "bg-amber-400 shadow-[0_0_0_8px_rgba(251,191,36,0.18)]"}`} />
              <p className="text-xl font-semibold text-white">{result ? result.status : "Awaiting upload"}</p>
            </div>
            <p className="text-sm text-slate-400">Detected disease/class</p>
            <p className="text-base font-medium text-amber-200">{result ? result.disease : "—"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-300">
              <span>Confidence</span>
              <span className="font-semibold text-white">{confidencePct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-400 via-rose-400 to-white transition-all" style={{ width: `${confidencePct}%` }} />
            </div>
            <p className="text-xs text-slate-400">Class index: <span className="font-mono">{result?.class_index ?? "—"}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
