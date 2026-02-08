import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Wrapper page to embed the full HTML dashboard (orchid-dashboard.html) with all UI + Firebase logic.
 * Served from public/orchid-dashboard.html so we preserve original behaviors without rewriting the script.
 */

export default function EnvMonitor() {
  const iframeRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [theme, setTheme] = useState("night");

  const applyTheme = (t) => {
    const doc = iframeRef.current?.contentWindow?.document;
    if (!doc) return;
    doc.documentElement.setAttribute("data-theme", t);
  };

  useEffect(() => {
    applyTheme(theme);
  }, [theme, loaded]);

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-4 border border-white/10">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Full dashboard</p>
        <h2 className="text-2xl font-semibold text-white">Orchid Environmental Monitor</h2>
        <p className="text-slate-300 text-sm mt-1">Embedded legacy dashboard with all cards, charts, alerts, PDF/CSV export, AI tips, and Firebase live updates.</p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <p className="text-xs text-slate-400">If you don’t see data, confirm Firebase is configured and loaded in the iframe below.</p>
          <button
            onClick={() => setTheme((t) => (t === "night" ? "day" : "night"))}
            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-200 hover:border-emerald-400/60"
          >
            Theme: {theme === "night" ? "Dark" : "Light"}
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }} className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
        <iframe
          ref={iframeRef}
          title="Orchid Dashboard"
          src="/orchid-dashboard.html"
          className="w-full h-[1200px] border-0"
          onLoad={() => {
            setLoaded(true);
            applyTheme("night");
          }}
        />
        {!loaded && <div className="p-4 text-sm text-slate-300">Loading dashboard…</div>}
      </motion.div>
    </div>
  );
}
