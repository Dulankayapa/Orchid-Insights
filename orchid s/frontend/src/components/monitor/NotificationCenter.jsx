import React from 'react';

const severityClass = (severity) => {
  if (severity === 'critical') return 'border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300';
  if (severity === 'warning') return 'border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300';
};

const formatDateTime = (ts) => {
  if (!ts) return '--';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const NotificationCenter = ({ notifications, onRead, onClear }) => (
  <section className="panel space-y-4">
    <div className="flex items-center justify-between gap-2">
      <h2 className="module-title">Notification Center</h2>
      <button type="button" className="btn-soft rounded-xl px-2 py-1 text-xs" onClick={onClear}>
        Mark all read
      </button>
    </div>

    {notifications.length === 0 ? (
      <p className="text-sm text-subtle">No notifications yet.</p>
    ) : (
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`dashboard-card border p-3 ${severityClass(notification.severity)}`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wide">{notification.source}</p>
              <p className="text-[11px] opacity-70">{formatDateTime(notification.at)}</p>
            </div>
            <p className="text-sm font-semibold">{notification.title}</p>
            <p className="mt-1 text-xs opacity-90">{notification.message}</p>
            {!notification.read && (
              <button
                type="button"
                className="btn-soft mt-2 rounded-xl px-2 py-1 text-xs"
                onClick={() => onRead?.(notification.id)}
              >
                Mark as read
              </button>
            )}
          </div>
        ))}
      </div>
    )}
  </section>
);

export default NotificationCenter;
