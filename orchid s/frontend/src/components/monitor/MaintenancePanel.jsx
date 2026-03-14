import React from 'react';

const statusClasses = {
  ok: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  due: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  overdue: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const MaintenancePanel = ({ tasks, onMarkDone }) => (
  <section className="panel space-y-3">
    <div className="flex items-center justify-between gap-2">
      <h2 className="module-title">Maintenance Reminders</h2>
      <span className="text-xs text-subtle">Calibration and device checks</span>
    </div>

    {tasks.length === 0 ? (
      <p className="text-sm text-subtle">No maintenance tasks configured.</p>
    ) : (
      <div className="space-y-2">
        {tasks.map((task) => (
          <div key={task.key} className="dashboard-card p-3">
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-dark">{task.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClasses[task.status] || statusClasses.ok}`}>
                {task.status}
              </span>
            </div>
            <p className="text-xs text-subtle">
              Interval: every {task.intervalDays} days
            </p>
            <p className="text-xs text-subtle">
              Last done: {task.lastDoneAt ? new Date(task.lastDoneAt).toLocaleDateString() : 'Never'}
            </p>
            <p className="text-xs text-subtle">
              Due in: {task.daysRemaining} day(s)
            </p>
            <button
              type="button"
              className="btn-soft mt-2 rounded-xl px-2 py-1 text-xs"
              onClick={() => onMarkDone?.(task.key)}
            >
              Mark completed
            </button>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default MaintenancePanel;
