import { NavLink } from "react-router-dom";
import { mobileTabs } from "../lib/navigation";

export default function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/50 bg-paper/88 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-18px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur-2xl lg:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-2">
        {mobileTabs.map((item) => (
          <NavLink key={item.to} to={item.to} className="group">
            {({ isActive }) => (
              <div
                className={`flex min-h-[4rem] flex-col items-center justify-center rounded-[20px] border px-2 py-2 text-center transition-all duration-200 ${
                  isActive
                    ? "border-primary/35 bg-primary/12 text-primary shadow-[0_12px_26px_-20px_rgba(139,92,246,0.6)]"
                    : "border-border/45 bg-white/72 text-subtle hover:border-primary/25 hover:text-dark"
                }`}
              >
                <span className="text-lg leading-none">{item.code}</span>
                <span className="mt-1 text-[11px] font-semibold tracking-[0.02em]">{item.label}</span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
