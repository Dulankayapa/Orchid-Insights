import { useEffect, useMemo, useState } from "react";
import { METRIC_DEFINITIONS } from "../../lib/monitorConfig";

const DEFAULT_PUBLIC_MONITOR_URL = "https://orchid-insights.web.app/";

const resolvePublicMonitorBaseUrl = () => {
  const configuredBaseUrl = String(import.meta.env.VITE_PUBLIC_MONITOR_URL ?? "").trim();
  if (configuredBaseUrl) return configuredBaseUrl;

  if (typeof window !== "undefined") {
    const { origin, hostname } = window.location;
    const isLocalhost = ["localhost", "127.0.0.1"].includes(hostname);
    if (origin && !isLocalhost) return `${origin}/`;
  }

  return DEFAULT_PUBLIC_MONITOR_URL;
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatMetric = (value, metricKey) => {
  const metric = METRIC_DEFINITIONS[metricKey];
  if (!metric) return "--";
  const num = toNumber(value);
  if (num === null) return "--";
  const val = metric.decimals > 0 ? num.toFixed(metric.decimals) : Math.round(num);
  return `${val} ${metric.unit}`;
};

const formatDateTime = (ts) => {
  if (!ts) return "--";
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildMonitorUrl = (baseUrl, nodeId, zoneId) => {
  if (!baseUrl) return "";

  try {
    const url = new URL(baseUrl);
    url.search = "";
    if (nodeId) url.searchParams.set("node", nodeId);
    if (zoneId) url.searchParams.set("zone", zoneId);
    return url.toString();
  } catch {
    return "";
  }
};

export default function PublicMonitorQrCard({ latest, lastUpdate, className = "panel" }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [qrStatus, setQrStatus] = useState("");

  const monitorLink = useMemo(() => {
    return buildMonitorUrl(
      resolvePublicMonitorBaseUrl(),
      latest?.nodeId,
      latest?.zoneId
    );
  }, [latest?.nodeId, latest?.zoneId]);

  const qrLabel = useMemo(() => {
    if (latest?.nodeId) return `Node: ${latest.nodeId}`;
    if (latest?.zoneId) return `Zone: ${latest.zoneId}`;
    return "Env Monitor";
  }, [latest?.nodeId, latest?.zoneId]);

  const qrPayload = useMemo(() => monitorLink, [monitorLink]);
  const qrPreview = monitorLink || "Waiting for public link";

  useEffect(() => {
    let cancelled = false;
    if (!qrPayload) return undefined;

    const fetchQrDataUrl = async (target) => {
      const qrUrl = `https://quickchart.io/qr?text=${encodeURIComponent(target)}&margin=1&size=320&dark=0f172a&light=ffffff`;
      const response = await fetch(qrUrl);
      if (!response.ok) throw new Error(`QR request failed (${response.status})`);
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("QR decode failed"));
        reader.readAsDataURL(blob);
      });
    };

    setQrError("");
    fetchQrDataUrl(qrPayload)
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setQrError(err?.message || "Failed to generate QR");
          setQrDataUrl("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const safeId = (latest?.nodeId || latest?.zoneId || "env-monitor")
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase() || "env-monitor";
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `${safeId}-qr.png`;
    anchor.click();
    setQrStatus("QR label downloaded");
    setTimeout(() => setQrStatus(""), 1500);
  };

  const handleCopyQrPayload = async () => {
    if (!qrPayload) return;
    try {
      await navigator.clipboard.writeText(qrPayload);
      setQrStatus("Link copied");
    } catch (err) {
      setQrError(err?.message || "Copy failed");
    }
    setTimeout(() => setQrStatus(""), 1500);
  };

  return (
    <section className={className}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="kicker">QR label</p>
          <p className="text-sm text-subtle">Scan to open the Orchid Insights web app.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={!qrDataUrl}
            className="rounded-xl border border-primary/30 bg-white/80 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download PNG
          </button>
          <button
            type="button"
            onClick={handleCopyQrPayload}
            disabled={!qrPayload}
            className="rounded-xl border border-border/70 bg-paper/80 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-paper disabled:cursor-not-allowed disabled:opacity-60"
          >
            Copy link
          </button>
        </div>
      </div>

      {qrError && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          QR error: {qrError}
        </p>
      )}
      {qrStatus && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {qrStatus}
        </p>
      )}

      <div className="flex items-center gap-4">
        <div className="h-28 w-28 rounded-xl border border-white bg-white p-2 shadow-sm shadow-primary/10">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR for ${qrLabel}`} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full items-center justify-center text-[11px] text-subtle">Generating...</div>
          )}
        </div>
        <div className="space-y-1 text-sm text-dark">
          <p className="font-semibold">{qrLabel}</p>
          <p className="text-xs text-subtle">Last update: {formatDateTime(lastUpdate)}</p>
          <p className="text-xs text-subtle">
            Temp {formatMetric(latest?.temperature, "temperature")} · Hum {formatMetric(latest?.humidity, "humidity")}
          </p>
          <div className="whitespace-pre-wrap break-words rounded border border-border/60 bg-white/80 px-2 py-1 text-[11px] text-slate-600">
            {qrPreview}
          </div>
        </div>
      </div>
    </section>
  );
}
