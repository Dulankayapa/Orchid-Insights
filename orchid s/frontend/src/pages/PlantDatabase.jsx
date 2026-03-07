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
    return rows.filter((row) => row.id.toLowerCase().includes(term));
  }, [query, rows]);

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true);
      setError("");
      try {
        const resp = await api.get("/env/plants");
        const data = resp.data || [];
        setRows(data);
        setSelected(data[0] || null);
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
    if (!selected || !filtered.find((row) => row.id === selected.id)) {
      setSelected(filtered[0]);
    }
  }, [filtered, selected]);

  return (
    <div className="space-y-6">
      <section className="panel">
        <p className="kicker">Plant DB</p>
        <h2 className="title-lg mt-1">Firebase-linked plant records</h2>
        <p className="mt-2 text-sm text-subtle md:text-base">
          Search and inspect plant entries pulled from the unified backend.
        </p>
      </section>

      <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="kicker">Spreadsheet View</p>
            <h3 className="text-lg font-semibold text-dark">Plant database</h3>
          </div>
          <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            Rows: {filtered.length}
          </span>
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by Jar/Plant ID"
          className="input-shell"
        />

        {loading && !error && <p className="text-sm text-subtle">Loading rows...</p>}
        {error && (
          <p className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
            {error}
          </p>
        )}

        <div className="overflow-auto rounded-2xl border border-primary/15">
          <table className="min-w-full text-left text-sm text-slate-800">
            <thead className="bg-primary/8 text-xs uppercase tracking-[0.2em] text-subtle">
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
                  className={`cursor-pointer border-t border-primary/10 ${
                    selected?.id === row.id ? "bg-primary/10" : "hover:bg-primary/5"
                  }`}
                >
                  <td className="px-4 py-3 font-semibold text-primary">{row.id}</td>
                  <td className="px-4 py-3 text-slate-600">{row.planting_date || "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.height_mm ?? "--"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.updated_at || "--"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={4} className="px-4 py-5 text-center text-subtle">
                    No records match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.section>

      {selected && (
        <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel">
          <div className="flex items-center justify-between">
            <div>
              <p className="kicker">Profile</p>
              <h3 className="text-xl font-semibold text-dark">{selected.id}</h3>
            </div>
            <span className="rounded-full border border-secondary/25 bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
              Firebase
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Stat title="Planting date" value={selected.planting_date || "--"} />
            <Stat title="Height (mm)" value={selected.height_mm ?? "--"} />
            <Stat title="Cultivar" value={selected.cultivar || "--"} />
          </div>
        </motion.section>
      )}
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="panel-muted p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-subtle">{title}</p>
      <p className="mt-1 text-lg font-semibold text-dark">{value}</p>
    </div>
  );
}
