export default function SidebarOrchidBloom() {
  return (
    <section className="sidebar-orchid-card" aria-label="Decorative orchid flower">
      <div className="orchid-glow" />
      <div className="orchid-caption">
        <p className="kicker">Orchid Bloom</p>
        <p className="text-[13px] text-subtle">Live orchid corner</p>
      </div>

      <svg
        viewBox="0 0 220 240"
        className="orchid-svg"
        role="img"
        aria-label="Stylized orchid flower in a pot"
      >
        <defs>
          <linearGradient id="petalFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff5fb" />
            <stop offset="58%" stopColor="#f4e8ff" />
            <stop offset="100%" stopColor="#ecebff" />
          </linearGradient>
          <linearGradient id="petalShade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f7d7ef" />
            <stop offset="100%" stopColor="#d6d6ff" />
          </linearGradient>
          <linearGradient id="leafFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6fd4a2" />
            <stop offset="100%" stopColor="#2f9f6d" />
          </linearGradient>
          <linearGradient id="potFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#d59657" />
            <stop offset="100%" stopColor="#b77033" />
          </linearGradient>
        </defs>

        <ellipse cx="110" cy="218" rx="50" ry="10" fill="rgba(15, 23, 42, 0.14)" />

        <path className="orchid-leaf" d="M74 166c-29-22-42-54-38-69 28 0 56 19 72 47 10 18 17 39 14 56-16-6-34-18-48-34z" fill="url(#leafFill)" />
        <path className="orchid-leaf" d="M145 166c29-22 42-54 38-69-28 0-56 19-72 47-10 18-17 39-14 56 16-6 34-18 48-34z" fill="url(#leafFill)" />

        <path className="orchid-stem" d="M111 194c-3-26-2-54 3-76 5-22 5-39-2-56" />

        <path className="orchid-petal" d="M110 40c-16 6-27 24-27 41 0 15 9 28 27 33 18-5 27-18 27-33 0-17-11-35-27-41z" fill="url(#petalFill)" />
        <path className="orchid-petal" d="M81 65c-22 2-40 20-42 40-2 20 13 35 34 36 18 1 31-10 35-26 5-22-5-48-27-50z" fill="url(#petalFill)" />
        <path className="orchid-petal" d="M139 65c22 2 40 20 42 40 2 20-13 35-34 36-18 1-31-10-35-26-5-22 5-48 27-50z" fill="url(#petalFill)" />
        <path className="orchid-petal" d="M92 132c-8 3-14 10-14 18 0 10 9 17 20 17 12 0 22-7 24-19 1-9-5-18-13-20-6-1-12 0-17 4z" fill="url(#petalShade)" />
        <path className="orchid-petal" d="M128 132c8 3 14 10 14 18 0 10-9 17-20 17-12 0-22-7-24-19-1-9 5-18 13-20 6-1 12 0 17 4z" fill="url(#petalShade)" />
        <ellipse cx="110" cy="124" rx="12" ry="14" fill="#f0b38a" stroke="#7b3253" strokeWidth="1.5" />
        <path d="M102 133c2 6 6 9 8 10 2-1 6-4 8-10-4-2-12-2-16 0z" fill="#ffc13a" stroke="#7b3253" strokeWidth="1.4" />

        <ellipse cx="110" cy="196" rx="36" ry="10" fill="#8c4f1f" />
        <path className="orchid-pot" d="M74 196h72l-9 34c-2 8-9 13-17 13H99c-8 0-15-5-17-13z" fill="url(#potFill)" />
        <rect className="orchid-pot" x="68" y="187" width="84" height="14" rx="7" fill="#c27b32" />
      </svg>
    </section>
  );
}
