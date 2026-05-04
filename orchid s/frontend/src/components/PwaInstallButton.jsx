import { useState } from "react";
import { usePwaInstallPrompt } from "../hooks/usePwaInstallPrompt";

export default function PwaInstallButton({ compact = false }) {
  const { canInstall, isStandalone, needsManualInstall, install } = usePwaInstallPrompt();
  const [dismissedHint, setDismissedHint] = useState(false);

  if (isStandalone) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
        App mode active
      </span>
    );
  }

  if (canInstall) {
    return (
      <button
        type="button"
        onClick={install}
        className={`inline-flex items-center justify-center rounded-full border border-primary/25 bg-primary/12 font-semibold text-primary transition hover:border-primary/40 hover:bg-primary/18 ${
          compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
        }`}
      >
        Install app
      </button>
    );
  }

  if (needsManualInstall && !dismissedHint) {
    return (
      <button
        type="button"
        onClick={() => setDismissedHint(true)}
        className={`inline-flex items-center justify-center rounded-full border border-border/70 bg-paper/85 text-subtle transition hover:border-primary/30 hover:text-dark ${
          compact ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-sm"
        }`}
      >
        Add to Home Screen in Safari
      </button>
    );
  }

  return null;
}
