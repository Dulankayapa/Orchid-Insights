import { useEffect, useMemo, useState } from "react";

const isStandaloneDisplay = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );
};

export function usePwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(isStandaloneDisplay);

  useEffect(() => {
    const updateStandalone = () => setIsStandalone(isStandaloneDisplay());

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      updateStandalone();
    };

    updateStandalone();

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    const mediaQuery = window.matchMedia?.("(display-mode: standalone)");
    mediaQuery?.addEventListener?.("change", updateStandalone);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery?.removeEventListener?.("change", updateStandalone);
    };
  }, []);

  const needsManualInstall = useMemo(() => {
    if (typeof navigator === "undefined") {
      return false;
    }

    const userAgent = navigator.userAgent || "";
    const isIosDevice = /iphone|ipad|ipod/i.test(userAgent);
    return isIosDevice && !isStandalone;
  }, [isStandalone]);

  const install = async () => {
    if (!deferredPrompt) {
      return false;
    }

    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return result?.outcome === "accepted";
  };

  return {
    canInstall: Boolean(deferredPrompt) && !isStandalone,
    isStandalone,
    needsManualInstall,
    install,
  };
}
