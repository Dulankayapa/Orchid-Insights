import { useMemo, useState } from "react";
import { usePwaInstallPrompt } from "../hooks/usePwaInstallPrompt";

export default function PwaInstallButton({ compact = false }) {
  const { canInstall, isStandalone, needsManualInstall, install } = usePwaInstallPrompt();
  const [showHelp, setShowHelp] = useState(false);

  const helperText = useMemo(() => {
    if (needsManualInstall) {
      return "Open this site in Safari, tap Share, then choose Add to Home Screen.";
    }

    return "Open this site in Chrome or Edge, then use the browser menu and choose Install app or Add to Home screen.";
  }, [needsManualInstall]);

  const baseButtonClass = `inline-flex items-center justify-center rounded-full border font-semibold transition ${
    compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
  }`;

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
        className={`${baseButtonClass} border-primary/25 bg-primary/12 text-primary hover:border-primary/40 hover:bg-primary/18`}
      >
        Install app
      </button>
    );
  }

  return (
    <div className={`flex ${compact ? "max-w-[14rem] flex-col items-end gap-2" : "flex-col items-start gap-2"}`}>
      <button
        type="button"
        onClick={() => setShowHelp((current) => !current)}
        className={`${baseButtonClass} border-border/70 bg-paper/85 text-subtle hover:border-primary/30 hover:text-dark`}
      >
        {needsManualInstall ? "Install on iPhone" : "Install help"}
      </button>
      {showHelp ? (
        <p className={`text-subtle ${compact ? "max-w-[14rem] text-right text-[11px]" : "text-xs"}`}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
