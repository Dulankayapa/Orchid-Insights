import React, { useEffect, useState } from "react";
import { getReminders, updateReminderStatus } from "../../lib/companionApi";

export default function SmartReminderList({ orchidId }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReminders = async () => {
    if (!orchidId) return;
    setLoading(true);
    try {
      const data = await getReminders(orchidId);
      setReminders(data);
    } catch (err) {
      console.error("reminders", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [orchidId]);

  const handleStatusChange = async (id, status) => {
    await updateReminderStatus(id, status);
    loadReminders();
  };

  if (loading) return <div className="skeleton h-28" />;

  return (
    <div className="companion-card">
      <h3 className="companion-title">Smart Reminders</h3>
      {reminders.length === 0 ? (
        <p className="text-sm text-subtle">No pending reminders.</p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((rem) => (
            <li key={rem.reminder_id} className="flex justify-between items-center border-b pb-2 last:border-none">
              <div>
                <p className="font-semibold">{rem.task?.toUpperCase()}</p>
                <p className="text-xs text-subtle">{rem.reminder_date}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleStatusChange(rem.reminder_id, "done")} className="text-emerald-600 hover:text-emerald-800 text-xs">
                  Done
                </button>
                <button type="button" onClick={() => handleStatusChange(rem.reminder_id, "skipped")} className="text-rose-600 hover:text-rose-800 text-xs">
                  Skip
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
