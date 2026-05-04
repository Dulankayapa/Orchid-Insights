import { useEffect, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";

const STORAGE_KEY = "orchid-care-calendar-tasks";
const taskTypes = ["watering", "fertilizing", "repotting", "pruning", "misting"];

function readStoredTasks() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error reading saved calendar tasks:", error);
    return [];
  }
}

export default function CalendarTile() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [taskTitle, setTaskTitle] = useState("");
  const [taskType, setTaskType] = useState("watering");
  const [taskNotes, setTaskNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTasks(readStoredTasks());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const goPrevMonth = () => setCurrentMonth((month) => subMonths(month, 1));
  const goNextMonth = () => setCurrentMonth((month) => addMonths(month, 1));

  const handleAddTask = (event) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;

    setLoading(true);

    const newTask = {
      id: crypto.randomUUID(),
      title: taskTitle.trim(),
      type: taskType,
      date: selectedDate.toISOString(),
      notes: taskNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    setTasks((current) => [...current, newTask]);
    setTaskTitle("");
    setTaskNotes("");
    setTaskType("watering");
    setLoading(false);
  };

  const handleDeleteTask = (taskId) => {
    setTasks((current) => current.filter((task) => task.id !== taskId));
  };

  const tasksForSelectedDate = tasks.filter((task) =>
    isSameDay(new Date(task.date), selectedDate)
  );

  return (
    <section className="flex h-[700px] flex-col overflow-y-auto rounded-2xl border border-border/60 bg-paper/95 p-4 text-dark shadow-lg dark:shadow-[0_18px_40px_-24px_rgba(2,6,23,0.8)]">
      <header className="mb-4 min-h-[84px]">
        <h2 className="text-xl font-bold">Orchid Care Calendar</h2>
        <p className="text-sm text-subtle">Monthly planner saved in this browser</p>
      </header>

      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={goPrevMonth}
          className="rounded-lg border border-border/60 bg-paper/90 px-3 py-1 text-dark transition hover:border-primary/35 hover:bg-primary/10"
        >
          {"<"}
        </button>
        <span className="text-lg font-semibold text-dark">{format(currentMonth, "MMMM yyyy")}</span>
        <button
          onClick={goNextMonth}
          className="rounded-lg border border-border/60 bg-paper/90 px-3 py-1 text-dark transition hover:border-primary/35 hover:bg-primary/10"
        >
          {">"}
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-sm font-medium text-subtle">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((day) => {
          const hasTaskOnDay = tasks.some((task) => isSameDay(new Date(task.date), day));
          const isSelected = isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={`
                rounded-lg border p-2 text-center transition
                ${!isSameMonth(day, currentMonth) ? "border-transparent text-subtle/45" : "border-transparent text-dark"}
                ${isSelected ? "border-green-500 bg-green-600 text-white shadow-sm shadow-green-700/20" : "hover:border-primary/25 hover:bg-primary/10"}
                ${hasTaskOnDay && !isSelected ? "border-green-500/20 bg-green-500/10 font-semibold" : ""}
              `}
            >
              {format(day, "d")}
              {hasTaskOnDay ? (
                <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-green-500" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex-1 border-t border-border/60 pt-4">
        <h3 className="mb-2 text-lg font-semibold text-dark">
          {format(selectedDate, "MMMM d, yyyy")}
        </h3>

        <form
          onSubmit={handleAddTask}
          className="mb-4 rounded-lg border border-border/50 bg-paper/80 p-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Task title (e.g., Water phalaenopsis)"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              className="w-full rounded border border-border/70 bg-paper px-2 py-1 text-dark placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
            <select
              value={taskType}
              onChange={(event) => setTaskType(event.target.value)}
              className="rounded border border-border/70 bg-paper px-2 py-1 text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {taskTypes.map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={selectedDate.toISOString().split("T")[0]}
              onChange={(event) => setSelectedDate(new Date(event.target.value))}
              className="rounded border border-border/70 bg-paper px-2 py-1 text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={taskNotes}
              onChange={(event) => setTaskNotes(event.target.value)}
              className="rounded border border-border/70 bg-paper px-2 py-1 text-dark placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-3 bg-green-600 text-white px-4 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? "Adding..." : "+ Add Task"}
          </button>
        </form>

        <div>
          <h4 className="mb-2 font-medium text-dark">Selected Day Tasks</h4>
          {tasksForSelectedDate.length === 0 ? (
            <p className="text-sm text-subtle">No tasks for this day.</p>
          ) : (
            <ul className="space-y-2">
              {tasksForSelectedDate.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between rounded-lg border border-border/60 bg-paper/90 p-2"
                >
                  <div>
                    <span className="font-medium text-dark">{task.title}</span>
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {task.type}
                    </span>
                    {task.notes ? (
                      <p className="mt-1 text-xs text-subtle">{task.notes}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-sm text-red-500 transition hover:text-red-400"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
