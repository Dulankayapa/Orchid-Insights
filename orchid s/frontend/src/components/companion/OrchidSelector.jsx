import React from "react";

export default function OrchidSelector({ orchids, selectedId, onSelect }) {
  if (!orchids?.length) {
    return (
      <div className="rounded-2xl bg-white/90 p-4 shadow-sm border border-border/60 dark:bg-slate-900/80">
        <p className="text-sm text-subtle">No orchids found yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white/90 p-4 shadow-sm border border-border/60 dark:bg-slate-900/80">
      <h3 className="text-lg font-semibold mb-3">My Orchids</h3>
      <div className="flex flex-wrap gap-3">
        {orchids.map((orchid) => (
          <button
            key={orchid.orchid_id}
            onClick={() => onSelect(orchid.orchid_id)}
            className={`px-4 py-2 rounded-full transition text-sm font-medium ${
              selectedId === orchid.orchid_id
                ? "bg-primary text-white shadow-md"
                : "bg-surface text-dark/80 dark:bg-slate-800 hover:bg-primary/10"
            }`}
          >
            {orchid.name} <span className="text-subtle">({orchid.species})</span>
          </button>
        ))}
      </div>
    </div>
  );
}
