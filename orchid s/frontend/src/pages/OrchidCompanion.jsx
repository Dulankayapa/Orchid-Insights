import CompanionChatTile from "../components/companion/CompanionChatTile.jsx";
import CalendarTile from "../components/companion/CalendarTile.jsx";

export default function OrchidCompanion() {
  return (
    <div
      className="min-h-screen bg-gray-100 p-6"
      style={{ fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif" }}
    >
      <h1 className="text-3xl font-bold mb-6 text-black">🌿 Orchid Care Companion</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CompanionChatTile />
        <CalendarTile />
      </div>
    </div>
  );
}
