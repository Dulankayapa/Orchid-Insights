import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

export default function FirebaseTable() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createPayload, setCreatePayload] = useState({ id: "", planting_date: "", height_mm: "", cultivar: "" });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const term = query.toLowerCase();
    return rows.filter((r) => r.id.toLowerCase().includes(term));
  }, [query, rows]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await api.get("/env/plants");
      setRows(resp.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to fetch Firebase data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onSave = async (e) => {
    e.preventDefault();
    if (!createPayload.id.trim()) {
      setError("Provide an ID for the new record.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.put(`/env/plants/${createPayload.id}`, {
        planting_date: createPayload.planting_date || null,
        height_mm: createPayload.height_mm ? Number(createPayload.height_mm) : null,
        cultivar: createPayload.cultivar || null,
      });
      setCreatePayload({ id: "", planting_date: "", height_mm: "", cultivar: "" });
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id) => {
    try {
      await api.delete(`/env/plants/${id}`);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6 border border-pink-400/30">
        <p className="text-xs uppercase tracking-[0.25em] text-subtle">Firebase RTDB</p>
        <h2 className="text-2xl font-semibold text-dark">Live plant table</h2>
        <p className="text-slate-600 mt-2">Proxy CRUD via the backend to the configured Realtime Database.</p>
      </div>

      <div className="glass rounded-3xl p-6 border border-white/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-slate-600">Rows: {filtered.length}</div>
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by Jar/Plant ID"
              className="rounded-xl bg-white border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/60 text-slate-900 placeholder:text-slate-400"
            />
            <button
              onClick={fetchData}
              className="rounded-xl border border-pink-200 px-3 py-2 text-sm text-pink-700 hover:border-pink-400/60 hover:bg-pink-50"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-rose-200 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}

        <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Create/Update record</p>
          <form onSubmit={onSave} className="grid md:grid-cols-4 sm:grid-cols-2 gap-3">
            <input
              value={createPayload.id}
              onChange={(e) => setCreatePayload((p) => ({ ...p, id: e.target.value }))}
              placeholder="Jar ID *"
              className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 text-slate-900 placeholder:text-slate-400"
            />
            <input
              type="date"
              value={createPayload.planting_date}
              onChange={(e) => setCreatePayload((p) => ({ ...p, planting_date: e.target.value }))}
              className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 text-slate-900 placeholder:text-slate-400"
            />
            <input
              type="number"
              step="0.1"
              value={createPayload.height_mm}
              onChange={(e) => setCreatePayload((p) => ({ ...p, height_mm: e.target.value }))}
              placeholder="Height mm"
              className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 text-slate-900 placeholder:text-slate-400"
            />
            <input
              value={createPayload.cultivar}
              onChange={(e) => setCreatePayload((p) => ({ ...p, cultivar: e.target.value }))}
              placeholder="Cultivar"
              className="rounded-xl bg-white border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/60 text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={saving}
              className="md:col-span-4 sm:col-span-2 inline-flex justify-center items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-400 to-purple-500 text-slate-900 font-semibold px-4 py-2.5 shadow-glow disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save to Firebase"}
            </button>
          </form>
        </div>

        <div className="overflow-auto rounded-2xl border border-pink-100">
          <table className="min-w-full text-sm text-left text-slate-800">
            <thead className="text-xs uppercase tracking-[0.25em] text-subtle bg-pink-50/50">
              <tr>
                <th className="px-4 py-3">Jar ID</th>
                <th className="px-4 py-3">Planting date</th>
                <th className="px-4 py-3">Height (mm)</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Cultivar</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-pink-100 hover:bg-pink-50/30 transition">
                  <td className="px-4 py-3 font-semibold text-primary-dark">{row.id}</td>
                  <td className="px-4 py-3 text-slate-600">{row.planting_date || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.height_mm ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.updated_at || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{row.cultivar || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onDelete(row.id)}
                      className="text-xs px-3 py-1 rounded-lg border border-rose-500/40 text-rose-200 hover:bg-rose-500/10 transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-5 text-center text-slate-400">
                    No rows match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
