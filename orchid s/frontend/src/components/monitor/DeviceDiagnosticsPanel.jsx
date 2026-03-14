import React from 'react';

const badge = (severity) => {
  if (severity === 'critical') return 'bg-rose-500/15 text-rose-700 dark:text-rose-300';
  if (severity === 'warning') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
};

const DeviceDiagnosticsPanel = ({ diagnostics, nodeStatuses }) => (
  <section className="panel space-y-4">
    <div className="flex items-center justify-between gap-2">
      <h2 className="module-title">Device Diagnostics</h2>
      <span className="text-xs text-subtle">Sensor health monitoring</span>
    </div>

    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {nodeStatuses.map((node) => (
        <div key={node.id} className="dashboard-card p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-dark">{node.id}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${node.status === 'online' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>
              {node.status}
            </span>
          </div>
          <p className="text-xs text-subtle">Zone: {node.zoneId}</p>
          <p className="text-xs text-subtle">Last seen: {node.lastSeen ? new Date(node.lastSeen).toLocaleTimeString() : '--'}</p>
        </div>
      ))}
    </div>

    <div className="space-y-2">
      {diagnostics.length === 0
        ? <p className="text-sm text-subtle">No diagnostics issues detected.</p>
        : diagnostics.map((issue) => (
          <div key={issue.id} className="dashboard-card p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-dark">{issue.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge(issue.severity)}`}>
                {issue.severity}
              </span>
            </div>
            <p className="text-xs text-subtle">{issue.detail}</p>
          </div>
        ))}
    </div>
  </section>
);

export default DeviceDiagnosticsPanel;
