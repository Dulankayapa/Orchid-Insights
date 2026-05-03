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
    <div className="bg-white rounded-2xl shadow-lg p-4 flex flex-col h-[700px] overflow-y-auto">
      <h2 className="text-xl font-bold mb-2 flex justify-between items-center">
        <span>Orchid Care Calendar</span>
        <span className="text-sm font-normal text-gray-500">
          Monthly planner saved in this browser
        </span>
      </h2>

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={goPrevMonth}
          className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          {"<"}
        </button>
        <span className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</span>
        <button
          onClick={goNextMonth}
          className="px-3 py-1 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          {">"}
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm font-medium text-gray-500 mb-2">
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
                p-2 rounded-lg text-center transition
                ${!isSameMonth(day, currentMonth) ? "text-gray-300" : ""}
                ${isSelected ? "bg-green-600 text-white" : "hover:bg-green-100"}
                ${hasTaskOnDay && !isSelected ? "bg-green-50 font-semibold" : ""}
              `}
            >
              {format(day, "d")}
              {hasTaskOnDay ? (
                <span className="block w-1 h-1 bg-green-500 rounded-full mx-auto mt-1" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-6 border-t pt-4">
        <h3 className="font-semibold text-lg mb-2">
          {format(selectedDate, "MMMM d, yyyy")}
        </h3>

        <form onSubmit={handleAddTask} className="bg-gray-50 p-3 rounded-lg mb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Task title (e.g., Water phalaenopsis)"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              className="border rounded px-2 py-1 w-full"
              required
            />
            <select
              value={taskType}
              onChange={(event) => setTaskType(event.target.value)}
              className="border rounded px-2 py-1"
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
              className="border rounded px-2 py-1"
            />
            <input
              type="text"
              placeholder="Notes (optional)"
              value={taskNotes}
              onChange={(event) => setTaskNotes(event.target.value)}
              className="border rounded px-2 py-1"
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
          <h4 className="font-medium text-gray-700 mb-2">Selected Day Tasks</h4>
          {tasksForSelectedDate.length === 0 ? (
            <p className="text-gray-400 text-sm">No tasks for this day.</p>
          ) : (
            <ul className="space-y-2">
              {tasksForSelectedDate.map((task) => (
                <li
                  key={task.id}
                  className="flex justify-between items-center bg-white border rounded-lg p-2"
                >
                  <div>
                    <span className="font-medium">{task.title}</span>
                    <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded-full">
                      {task.type}
                    </span>
                    {task.notes ? (
                      <p className="text-xs text-gray-500 mt-1">{task.notes}</p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
