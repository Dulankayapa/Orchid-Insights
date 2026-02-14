import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";

export default function PlantDatabase() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const term = query.toLowerCase();
    return rows.filter((r) => r.id.toLowerCase().includes(term));
  }, [query, rows]);

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await api.get("/env/plants");
        setRows(resp.data || []);
        setSelected(resp.data?.[0] || null);
      } catch (err) {
        setError(err.response?.data?.detail || err.message || "Failed to load plants");
      } finally {
        setLoading(false);
      }
    };
    fetchRows();
  }, []);

  useEffect(() => {
    if (!filtered.length) return;
    if (!selected || !filtered.find((r) => r.id === selected.id)) {
      setSelected(filtered[0]);
    }
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6 border border-blue-400/30">
        <p className="text-xs uppercase tracking-[0.25em] text-subtle">Plant DB</p>
        <h2 className="text-2xl font-semibold text-dark">Firebase-linked plant records</h2>
        <p className="text-slate-600 mt-2">Search and inspect plant entries pulled from the unified backend.</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 border border-white/40 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-subtle">Spreadsheet view</p>
            <h3 className="text-lg font-semibold text-dark">Plant database</h3>
          </div>
          <div className="flex gap-2 items-center text-xs text-slate-500">
            <span className="px-3 py-1 rounded-full border border-fuchsia-100 bg-white/50">Rows: {filtered.length}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Jar/Plant ID"
            className="flex-1 rounded-xl bg-white border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/60 text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {error && <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}

        <div className="overflow-auto rounded-2xl border border-fuchsia-100">
          <table className="min-w-full text-sm text-left text-slate-800">
            <thead className="text-xs uppercase tracking-[0.25em] text-subtle bg-fuchsia-50/50">
              <tr>
                <th className="px-4 py-3">Jar ID</th>
                <th className="px-4 py-3">Planting date</th>
                <th className="px-4 py-3">Height</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelected(row)}
                  className={`border-t border-fuchsia-100 cursor-pointer ${selected?.id === row.id ? "bg-primary/10 border-primary/40" : "hover:bg-fuchsia-50/30"}`}
                >
                  <td className="px-4 py-3 font-semibold text-primary-dark">{row.id}</td>
                  <td className="px-4 py-3 text-slate-600">{row.planting_date || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.height_mm ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.updated_at || "—"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-slate-400">
                    No records match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {selected && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-6 border border-blue-400/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-subtle">Profile</p>
              <h3 className="text-xl font-semibold text-dark">{selected.id}</h3>
            </div>
            <span className="text-xs px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700">Mock/Live mix</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 mt-4">
            <Stat title="Planting date" value={selected.planting_date || "—"} />
            <Stat title="Height (mm)" value={selected.height_mm ?? "—"} />
            <Stat title="Cultivar" value={selected.cultivar || "—"} />
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="rounded-2xl border border-fuchsia-100 bg-white/50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-subtle">{title}</p>
      <p className="text-lg font-semibold text-dark mt-1">{value}</p>
    </div>
  );
}
