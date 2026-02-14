import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const cards = [
  { title: "Growth Tracker", to: "/growth", tone: "from-fuchsia-400/60 to-pink-500/50", desc: "Model-backed growth classification and ranges." },
  { title: "Growth History", to: "/history", tone: "from-violet-400/60 to-purple-500/50", desc: "Trend lines and logs by Jar ID (demo data)." },
  { title: "Disease Detector", to: "/disease", tone: "from-rose-400/60 to-orange-500/50", desc: "Upload a leaf photo for health and disease detection." },
  { title: "Plant Database", to: "/plants", tone: "from-blue-400/60 to-cyan-500/50", desc: "Browse and filter plant records (Firebase-backed)." },
  { title: "Firebase Table", to: "/firebase", tone: "from-pink-400/60 to-rose-500/50", desc: "Live table with CRUD against Realtime DB." },
  { title: "Env Monitor", to: "/monitor", tone: "from-teal-400/60 to-emerald-500/50", desc: "Charts and KPIs for temperature, humidity, light, MQ." },
];

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/health")
      .then((res) => setHealth(res.data))
      .catch((err) => setError(err.response?.data?.detail || err.message));
  }, []);

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6 border border-primary/20 shadow-glow">
        <p className="text-xs uppercase tracking-[0.25em] text-subtle">Orchid Insights</p>
        <h2 className="text-3xl font-semibold mt-1 text-dark">Unified dashboard</h2>
        <p className="text-slate-600 mt-2">Growth analytics, disease detection, Firebase plant DB, and environmental monitoring in one place.</p>
        {health && (
          <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
            <StatusPill label="Growth model" ok={health.model_loaded} />
            <StatusPill label="Disease model" ok={health.disease_model_loaded} />
            <StatusPill label="Firebase" ok={health.firebase_connected} />
          </div>
        )}
        {error && <p className="mt-3 text-sm text-rose-200">Health check failed: {error}</p>}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="relative overflow-hidden glass rounded-2xl border border-white/40 p-4 hover:scale-[1.01] transition hover:shadow-soft">
            <div className={`absolute inset-0 bg-gradient-to-br ${c.tone} opacity-10`} />
            <div className="relative space-y-1">
              <p className="text-[11px] uppercase tracking-[0.25em] text-subtle">Module</p>
              <h3 className="text-lg font-semibold text-dark">{c.title}</h3>
              <p className="text-sm text-slate-600">{c.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ label, ok }) {
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${ok ? "border-emerald-400/40 bg-emerald-50 text-emerald-700" : "border-amber-400/40 bg-amber-50 text-amber-700"}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]"}`} />
      {label}: {ok ? "ready" : "unavailable"}
    </div>
  );
}
