import { NavLink } from "react-router-dom";

const quickLinks = [
  { to: "/", label: "Dashboard" },
  { to: "/monitor", label: "Env Monitor" },
  { to: "/reculture", label: "Culture Details" },
  { to: "/growth", label: "Growth Tracker" },
  { to: "/history", label: "Growth History" },
  { to: "/plants", label: "Plant Database" },
  { to: "/firebase", label: "Firebase Table" },
  { to: "/companion", label: "Orchid Care Companion" },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative mt-10 border-t border-border/60 bg-paper/90 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-10 -top-14 h-28 rounded-[32px] bg-gradient-to-r from-primary/20 via-secondary/20 to-accent/20 blur-3xl opacity-70" />
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-8 lg:px-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full gap-3 text-sm sm:grid-cols-2 sm:gap-4 lg:w-auto lg:flex lg:flex-wrap lg:items-center lg:justify-end lg:gap-3">
            {quickLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `inline-flex items-center gap-2 rounded-[12px] border px-3.5 py-2 transition-all duration-200 ${
                    isActive
                      ? "border-primary/45 bg-primary/10 text-primary"
                      : "border-border/60 bg-paper/80 text-subtle hover:border-primary/35 hover:text-dark"
                  }`
                }
              >
                <span className="h-2 w-2 rounded-full bg-gradient-to-br from-primary to-secondary shadow-soft" aria-hidden />
                {link.label}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-2 text-[13px] text-subtle sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/70 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </span>
            Real-time data companion for your orchid lab.
          </p>
          <p className="text-[12px] uppercase tracking-[0.18em] text-subtle/90">
            (c) {currentYear} Orchid Insights Lab
          </p>
        </div>
      </div>
    </footer>
  );
}
