import CompanionChatTile from "../components/companion/CompanionChatTile.jsx";
import CalendarTile from "../components/companion/CalendarTile.jsx";
import QuizTile from "../components/companion/QuizTile.jsx";
import ReminderTile from "../components/companion/ReminderTile.jsx";

export default function OrchidCompanion() {
  return (
    <div
      className="min-h-screen p-6 text-dark"
      style={{ fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif" }}
    >
      <h1 className="mb-6 text-3xl font-bold text-dark">Orchid Care Companion</h1>
      <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 xl:auto-rows-fr xl:grid-cols-4">
        <CompanionChatTile />
        <CalendarTile />
        <QuizTile />
        <ReminderTile />
      </div>
    </div>
  );
}
