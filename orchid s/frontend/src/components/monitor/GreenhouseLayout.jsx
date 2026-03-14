import React from 'react';

const format = (value, unit, decimals = 1) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num.toFixed(decimals)} ${unit}`;
};

const GreenhouseLayout = ({ zones, nodeStatuses }) => {
  const zoneList = Object.values(zones || {});

  return (
    <section className="panel space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="module-title">Greenhouse Layout</h2>
        <span className="text-xs text-subtle">Node-level view</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {zoneList.map((zone) => {
          const zoneNodes = nodeStatuses.filter((node) => node.zoneId === zone.id);

          return (
            <div key={zone.id} className="dashboard-card p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-dark">{zone.id}</p>
                <span className="text-xs text-subtle">{zoneNodes.length} nodes</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border/60 bg-paper/80 p-2">
                  <p className="text-subtle">Temp</p>
                  <p className="font-semibold text-dark">{format(zone.latest?.temperature, 'C', 1)}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-paper/80 p-2">
                  <p className="text-subtle">Humidity</p>
                  <p className="font-semibold text-dark">{format(zone.latest?.humidity, '%', 1)}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-paper/80 p-2">
                  <p className="text-subtle">Light</p>
                  <p className="font-semibold text-dark">{format(zone.latest?.light, 'lx', 0)}</p>
                </div>
                <div className="rounded-xl border border-border/60 bg-paper/80 p-2">
                  <p className="text-subtle">CO2</p>
                  <p className="font-semibold text-dark">{format(zone.latest?.co2, 'ppm', 0)}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {zoneNodes.length === 0
                  ? <p className="text-xs text-subtle">No node heartbeat data</p>
                  : zoneNodes.map((node) => (
                    <span
                      key={node.id}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] ${node.status === 'online' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${node.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {node.id}
                    </span>
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default GreenhouseLayout;
