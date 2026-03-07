
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { onValue, ref } from "firebase/database";
import { db } from "../lib/firebase";
import { useTheme } from "../context/ThemeContext";

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const coerceTimestamp = (value) => {
  const num = toNumber(value);
  if (num === null) return null;
  return num < 10000000000 ? num * 1000 : num;
};

const normalizeHeightEntry = (entry) => {
  if (entry === undefined || entry === null) return null;
  if (typeof entry === "number") return { height_mm: entry };
  if (typeof entry === "string") {
    const num = toNumber(entry);
    return num === null ? null : { height_mm: num };
  }
  if (typeof entry !== "object") return null;

  const heightMm = toNumber(entry.height_mm ?? entry.height ?? entry.heightMm ?? entry.heightMM ?? entry.current_height);
  const heightCm = toNumber(entry.height_cm ?? entry.heightCm);
  const resolvedHeight = heightMm ?? (heightCm !== null ? heightCm * 10 : null);
  if (resolvedHeight === null) return null;

  const ts = coerceTimestamp(entry.timestamp ?? entry.ts ?? entry.time ?? entry.logged_at ?? entry.loggedAt);
  const date = entry.date || entry.recorded_at || entry.recordedAt || (ts ? new Date(ts).toISOString().split("T")[0] : null);

  return {
    ...entry,
    height_mm: resolvedHeight,
    timestamp: ts,
    date,
  };
};

const normalizeHeights = (raw) => {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  return list.map(normalizeHeightEntry).filter(Boolean);
};

const normalizePlantRecord = (plant) => {
  if (!plant) return null;
  const extra = plant.extra || {};
  const heights = normalizeHeights(
    plant.heights ??
      extra.heights ??
      extra.height_history ??
      extra.heightHistory ??
      extra.growth_logs ??
      extra.growthLogs
  );
  return {
    ...plant,
    id: plant.id ?? extra.id ?? "",
    heights,
    planting_date: plant.planting_date || plant.plantingDate || extra.planting_date || extra.plantingDate,
    location: plant.location ?? extra.location ?? (extra.rackNo ? `Rack ${extra.rackNo}` : undefined),
    cultivar: plant.cultivar ?? extra.cultivar ?? extra.orchidType,
    nutrition: plant.nutrition ?? extra.nutrition,
  };
};

const normalizePlantSnapshot = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map((item, idx) => normalizePlantRecord({ id: item?.id ?? String(idx), ...(item || {}) }))
      .filter(Boolean);
  }
  return Object.entries(data)
    .map(([key, value]) => normalizePlantRecord({ id: key, ...(value || {}) }))
    .filter(Boolean);
};

const normalizeJarIdInput = (value) => {
  const next = (value || "").trimStart();
  if (!next) return value || "";
  return next[0].toLowerCase() === "j" ? `J${next.slice(1)}` : value;
};

const resolveHeightTimestamp = (row) => {
  const direct = coerceTimestamp(row.timestamp ?? row.ts);
  if (direct !== null) return direct;
  if (row.date) {
    const parsed = Date.parse(row.date);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const chartTheme = (isLight) => ({
  axis: isLight ? "#0f172a" : "#e2e8f0",
  ticks: isLight ? "#475569" : "#94a3b8",
  grid: isLight ? "rgba(148,163,184,0.25)" : "rgba(51,65,85,0.45)",
});

const DAY_MS = 24 * 60 * 60 * 1000;

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatReportDate = () =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

const renderKeyValueTable = (rows) => {
  if (!rows || !rows.length) return "";
  const body = rows
    .map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`)
    .join("");
  return `<table class="kv"><tbody>${body}</tbody></table>`;
};

const renderDataTable = (headers, rows) => {
  if (!rows || !rows.length) return "<p class=\"muted\">No data available.</p>";
  const head = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`;
};

const openReportWindow = ({ title, subtitle, chartImage, sections }) => {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return;

  const sectionsHtml = (sections || [])
    .map((section) => {
      const heading = section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : "";
      return `<section>${heading}${section.content || ""}</section>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title || "Report")}</title>
    <style>
      body { font-family: "Manrope", Arial, sans-serif; color: #0f172a; padding: 32px; }
      h1 { margin: 0 0 6px; font-size: 24px; }
      h2 { margin: 20px 0 8px; font-size: 16px; }
      p { margin: 6px 0; }
      .muted { color: #64748b; font-size: 12px; }
      .chart { margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
      .chart img { width: 100%; height: auto; display: block; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      table.kv td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
      table.kv td:first-child { color: #64748b; width: 180px; }
      table.data th, table.data td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 12px; text-align: left; }
      table.data th { color: #475569; font-weight: 600; background: #f8fafc; }
      .footer { margin-top: 32px; }
      .signature { margin-top: 24px; }
      .signature-line { margin-top: 32px; border-bottom: 1px solid #94a3b8; width: 240px; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title || "Report")}</h1>
    ${subtitle ? `<p class="muted">${escapeHtml(subtitle)}</p>` : ""}
    ${chartImage ? `<div class="chart"><img src="${chartImage}" alt="Chart" /></div>` : ""}
    ${sectionsHtml}
    <div class="footer">
      <p class="muted">Generated: ${escapeHtml(formatReportDate())}</p>
      <div class="signature">
        <p class="muted">Signature</p>
        <div class="signature-line"></div>
      </div>
    </div>
  </body>
</html>`;

  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
};

const computeSeriesStats = (points) => {
  if (!points || points.length === 0) return null;
  let sum = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    const y = Number(point.y);
    if (!Number.isFinite(y)) return;
    sum += y;
    min = Math.min(min, y);
    max = Math.max(max, y);
  });

  const first = points[0];
  const last = points[points.length - 1];
  const delta = Number(last.y) - Number(first.y);
  const days = (Number(last.x) - Number(first.x)) / DAY_MS;
  const rate = days > 0 ? delta / days : null;

  return {
    avg: sum / points.length,
    min: Number.isFinite(min) ? min : null,
    max: Number.isFinite(max) ? max : null,
    first: Number(first.y),
    last: Number(last.y),
    delta,
    days: days > 0 ? days : null,
    rate,
    count: points.length,
  };
};

const computeRegressionLine = (points) => {
  if (!points || points.length < 2) return null;
  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  points.forEach((point) => {
    const x = Number(point.x);
    const y = Number(point.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  });

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
};

const buildTrendlinePoints = (points) => {
  const regression = computeRegressionLine(points);
  if (!regression || points.length < 2) return null;
  const start = points[0];
  const end = points[points.length - 1];
  const y1 = regression.slope * start.x + regression.intercept;
  const y2 = regression.slope * end.x + regression.intercept;
  return [
    { x: start.x, y: y1 },
    { x: end.x, y: y2 },
  ];
};

const buildCompareMetrics = (combinedRecords, compareIds, compareWindow) => {
  const cutoffMs = (() => {
    const now = Date.now();
    if (compareWindow === "30d") return now - 30 * DAY_MS;
    if (compareWindow === "90d") return now - 90 * DAY_MS;
    if (compareWindow === "365d") return now - 365 * DAY_MS;
    return null;
  })();

  const metrics = [];
  compareIds.forEach((id) => {
    const plant = combinedRecords.find((p) => p.id === id);
    if (!plant) return;
    const sorted = (plant.heights || [])
      .map((h) => {
        const ts = Date.parse(h.date);
        return { x: Number.isFinite(ts) ? ts : null, y: Number(h.height_mm) };
      })
      .filter((p) => p.x !== null && (cutoffMs === null || p.x >= cutoffMs))
      .sort((a, b) => a.x - b.x);
    if (!sorted.length) return;
    const stats = computeSeriesStats(sorted);
    if (!stats) return;
    metrics.push({
      id,
      rate: stats.rate,
      delta: stats.delta,
      avg: stats.avg,
      count: stats.count,
    });
  });

  return metrics;
};

const buildRackStats = (rackPlants) => {
  if (!rackPlants.length) return [];
  const stats = rackPlants.map((plant) => {
    const points = (plant.heights || [])
      .map((h) => {
        const ts = Date.parse(h.date);
        return { x: Number.isFinite(ts) ? ts : null, y: Number(h.height_mm) };
      })
      .filter((p) => p.x !== null)
      .sort((a, b) => a.x - b.x);
    const summary = computeSeriesStats(points);
    return {
      id: plant.id,
      avg: summary?.avg ?? null,
      count: summary?.count ?? 0,
    };
  });

  const valid = stats.filter((item) => item.avg !== null);
  if (!valid.length) return stats.map((item) => ({ ...item, rank: null }));
  const maxAvg = Math.max(...valid.map((item) => item.avg));
  const minAvg = Math.min(...valid.map((item) => item.avg));
  return stats.map((item) => {
    if (item.avg === null) return { ...item, rank: null };
    if (item.avg === maxAvg) return { ...item, rank: "Best" };
    if (item.avg === minAvg) return { ...item, rank: "Worst" };
    return { ...item, rank: null };
  });
};

const buildGrowthInsight = ({ stats, record, history }) => {
  if (!stats || !history.length) {
    return "No measurements yet. Add at least two entries to generate a growth conclusion.";
  }
  if (history.length < 2 || stats.days === null) {
    return "Not enough time-based data to estimate growth trend. Add measurements on different days.";
  }

  const rate = stats.rate ?? 0;
  const change = stats.delta ?? 0;
  const direction =
    Math.abs(rate) < 0.05
      ? "stable"
      : rate > 0
      ? "increasing"
      : "decreasing";
  const pace = stats.rate !== null ? `${stats.rate.toFixed(2)} mm/day` : "n/a";
  const changeText = Number.isFinite(change)
    ? `${change >= 0 ? "+" : ""}${change.toFixed(1)} mm`
    : "n/a";
  const avgText = Number.isFinite(stats.avg) ? `${stats.avg.toFixed(1)} mm` : "n/a";
  const spanText = stats.days !== null ? `${stats.days.toFixed(0)} days` : "n/a";

  return `Over ${spanText}, ${record?.id ? `jar ${record.id}` : "this jar"} shows a ${direction} trend. Average height is ${avgText} with a total change of ${changeText} and a growth rate of ${pace}.`;
};

const buildGrowthBrief = ({ stats, record, history }) => {
  if (!stats || !history.length) {
    return "Add measurements to generate a growth snapshot.";
  }
  if (history.length < 2 || stats.days === null) {
    return "Need more time-based points to describe the growth trend.";
  }
  const pace = stats.rate !== null ? `${stats.rate.toFixed(2)} mm/day` : "n/a";
  const changeText = Number.isFinite(stats.delta)
    ? `${stats.delta >= 0 ? "+" : ""}${stats.delta.toFixed(1)} mm`
    : "n/a";
  return `${record?.id ? `Jar ${record.id}` : "This jar"} is trending ${stats.rate >= 0 ? "upward" : "downward"} (${pace}), total change ${changeText}.`;
};

const buildCompareInsight = ({ metrics, compareWindow }) => {
  if (!metrics.length) return "Select two or three jars to generate a comparison summary.";
  const windowLabel = compareWindow === "all" ? "all time" : compareWindow;
  const valid = metrics.filter((m) => m.rate !== null);
  if (!valid.length) {
    return `Not enough recent data to calculate growth rates for the ${windowLabel} window.`;
  }
  const best = valid.reduce((a, b) => (a.rate > b.rate ? a : b));
  const worst = valid.reduce((a, b) => (a.rate < b.rate ? a : b));
  return `For the ${windowLabel} window, ${best.id} has the fastest growth at ${best.rate.toFixed(
    2
  )} mm/day, while ${worst.id} is the slowest at ${worst.rate.toFixed(2)} mm/day.`;
};

const buildCompareBrief = ({ metrics, compareWindow }) => {
  if (!metrics.length) return "Select jars to compare growth rates.";
  const windowLabel = compareWindow === "all" ? "all time" : compareWindow;
  const valid = metrics.filter((m) => m.rate !== null);
  if (!valid.length) return `Not enough data to compare growth rates (${windowLabel}).`;
  const best = valid.reduce((a, b) => (a.rate > b.rate ? a : b));
  return `Fastest growth: ${best.id} at ${best.rate.toFixed(2)} mm/day (${windowLabel}).`;
};

const buildRackInsight = ({ rackStats, rackQuery }) => {
  if (!rackQuery) return "Enter a rack label to generate a rack summary.";
  if (!rackStats.length) return "No jars found for this rack.";
  const valid = rackStats.filter((item) => item.avg !== null);
  if (!valid.length) return "Not enough measurements to calculate rack averages.";
  const best = valid.find((item) => item.rank === "Best") || valid[0];
  const worst = valid.find((item) => item.rank === "Worst") || valid[valid.length - 1];
  const avgAcross = valid.reduce((sum, item) => sum + item.avg, 0) / valid.length;
  return `Rack ${rackQuery} averages ${avgAcross.toFixed(1)} mm across ${valid.length} jars. Best average height is ${
    best.id
  } at ${best.avg.toFixed(1)} mm; lowest is ${worst.id} at ${worst.avg.toFixed(1)} mm.`;
};

const buildRackBrief = ({ rackStats, rackQuery }) => {
  if (!rackQuery) return "Enter a rack label to summarize.";
  if (!rackStats.length) return "No jars found on this rack.";
  const valid = rackStats.filter((item) => item.avg !== null);
  if (!valid.length) return "Not enough data to summarize rack averages.";
  const best = valid.find((item) => item.rank === "Best") || valid[0];
  return `Rack ${rackQuery}: best average height is ${best.id} at ${best.avg.toFixed(1)} mm.`;
};

const answerGrowthQuestion = ({ question, stats, history, record, insight }) => {
  if (!question?.trim()) return insight;
  if (!stats || !history.length) return "No measurement data is available yet.";

  const q = question.toLowerCase();
  if (q.includes("rate") || q.includes("growth")) {
    return stats.rate !== null ? `Growth rate is ${stats.rate.toFixed(2)} mm/day.` : "Growth rate is not available yet.";
  }
  if (q.includes("average") || q.includes("avg")) {
    return Number.isFinite(stats.avg) ? `Average height is ${stats.avg.toFixed(1)} mm.` : "Average height is not available yet.";
  }
  if (q.includes("change") || q.includes("delta")) {
    return Number.isFinite(stats.delta)
      ? `Total change is ${stats.delta >= 0 ? "+" : ""}${stats.delta.toFixed(1)} mm.`
      : "Total change is not available yet.";
  }
  if (q.includes("latest") || q.includes("last")) {
    const last = history[history.length - 1];
    return last ? `Latest height is ${Number(last.height_mm).toFixed(1)} mm on ${formatDate(last.ts)}.` : "No latest measurement.";
  }
  if (q.includes("min") || q.includes("max") || q.includes("range")) {
    if (stats.min === null || stats.max === null) return "Range is not available yet.";
    return `Height ranges from ${stats.min.toFixed(1)} mm to ${stats.max.toFixed(1)} mm.`;
  }
  return insight;
};

const answerCompareQuestion = ({ question, metrics, compareWindow, insight }) => {
  if (!question?.trim()) return insight;
  if (!metrics.length) return "No comparison data yet.";
  const q = question.toLowerCase();
  const windowLabel = compareWindow === "all" ? "all time" : compareWindow;
  const valid = metrics.filter((m) => m.rate !== null);

  if (q.includes("best") || q.includes("fastest")) {
    if (!valid.length) return "No growth rates available yet.";
    const best = valid.reduce((a, b) => (a.rate > b.rate ? a : b));
    return `${best.id} has the fastest growth at ${best.rate.toFixed(2)} mm/day (${windowLabel}).`;
  }
  if (q.includes("worst") || q.includes("slowest")) {
    if (!valid.length) return "No growth rates available yet.";
    const worst = valid.reduce((a, b) => (a.rate < b.rate ? a : b));
    return `${worst.id} is the slowest at ${worst.rate.toFixed(2)} mm/day (${windowLabel}).`;
  }
  if (q.includes("average") || q.includes("avg")) {
    const rows = metrics
      .map((m) => `${m.id}: ${Number.isFinite(m.avg) ? m.avg.toFixed(1) : "n/a"} mm`)
      .join(", ");
    return `Average heights (${windowLabel}): ${rows}.`;
  }
  if (q.includes("change") || q.includes("delta")) {
    const rows = metrics
      .map((m) => `${m.id}: ${Number.isFinite(m.delta) ? m.delta.toFixed(1) : "n/a"} mm`)
      .join(", ");
    return `Total change (${windowLabel}): ${rows}.`;
  }
  return insight;
};

const answerRackQuestion = ({ question, rackStats, rackQuery, insight }) => {
  if (!question?.trim()) return insight;
  if (!rackStats.length) return "No rack data yet.";
  const q = question.toLowerCase();
  const valid = rackStats.filter((item) => item.avg !== null);
  if (q.includes("best")) {
    const best = valid.find((item) => item.rank === "Best");
    return best ? `Best average height on ${rackQuery}: ${best.id} at ${best.avg.toFixed(1)} mm.` : insight;
  }
  if (q.includes("worst") || q.includes("lowest")) {
    const worst = valid.find((item) => item.rank === "Worst");
    return worst ? `Lowest average height on ${rackQuery}: ${worst.id} at ${worst.avg.toFixed(1)} mm.` : insight;
  }
  if (q.includes("average") || q.includes("avg")) {
    const rows = valid.map((item) => `${item.id}: ${item.avg.toFixed(1)} mm`).join(", ");
    return rows ? `Average height per jar: ${rows}.` : insight;
  }
  return insight;
};

export default function GrowthHistory() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [jarId, setJarId] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [rackQuery, setRackQuery] = useState("");
  const [rackStatus, setRackStatus] = useState("");
  const [compareIds, setCompareIds] = useState([]);
  const [compareWindow, setCompareWindow] = useState("all"); // all | 30d | 90d | 365d
  const [plants, setPlants] = useState([]);
  const [plantsError, setPlantsError] = useState("");
  const [cultureEntries, setCultureEntries] = useState([]);
  const [cultureError, setCultureError] = useState("");

  useEffect(() => {
    setPlantsError("");

    const plantsRef = ref(db, "plants");
    const unsubscribe = onValue(
      plantsRef,
      (snap) => {
        const normalized = normalizePlantSnapshot(snap.val());
        setPlants(normalized);
        setPlantsError("");
      },
      (err) => {
        const message = err?.message || "Failed to load plant records from Firebase";
        setPlantsError(message);
        setPlants([]);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const entriesRef = ref(db, "recultureEntries");
    const unsubscribe = onValue(
      entriesRef,
      (snap) => {
        const data = snap.val() || {};
        const next = Object.entries(data)
          .map(([key, value]) => {
            const entry = value && typeof value === "object" ? value : {};
            return {
              jarId: entry.jarId || key,
              cultureDate: entry.cultureDate,
              rackNo: entry.rackNo,
              orchidType: entry.orchidType,
              nutrition: entry.nutrition,
              recultures: Array.isArray(entry.recultures) ? entry.recultures : [],
              updatedAt: entry.updatedAt,
            };
          })
          .filter((entry) => entry.jarId);
        setCultureEntries(next);
        setCultureError("");
      },
      (err) => {
        setCultureError(err?.message || "Failed to load culture entries");
        setCultureEntries([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const cultureMap = useMemo(() => {
    const map = new Map();
    cultureEntries.forEach((entry) => {
      if (entry?.jarId) map.set(entry.jarId.toLowerCase(), entry);
    });
    return map;
  }, [cultureEntries]);

  const demoIds = useMemo(() => {
    const ids = new Set();
    cultureEntries.forEach((e) => e.jarId && ids.add(e.jarId));
    plants.forEach((p) => p.id && ids.add(p.id));
    return Array.from(ids);
  }, [cultureEntries, plants]);

  const demoIdHint = useMemo(() => demoIds.join(", "), [demoIds]);

  const rackHints = useMemo(() => {
    const set = new Set();
    cultureEntries.forEach((e) => e.rackNo && set.add(`Rack ${e.rackNo}`));
    plants.forEach((p) => p.location && set.add(p.location));
    return Array.from(set);
  }, [cultureEntries, plants]);
  const rackHintString = useMemo(() => rackHints.join(", "), [rackHints]);

  const combinedRecords = useMemo(() => {
    return plants.map((plant) => {
      const culture = cultureMap.get(plant.id.toLowerCase());
      const location = culture?.rackNo ? `Rack ${culture.rackNo}` : plant.location;
      const planting_date = culture?.cultureDate || plant.planting_date;
      const cultivar = culture?.orchidType || plant.cultivar;
      const nutrition = culture?.nutrition || plant.nutrition;
      const recultures = culture?.recultures || [];
      return { ...plant, location, planting_date, cultivar, nutrition, recultures };
    });
  }, [cultureMap, plants]);

  const rackPlants = useMemo(() => {
    const term = rackQuery.trim().toLowerCase();
    if (!term) return [];
    return combinedRecords.filter((p) => (p.location || "").toLowerCase().includes(term));
  }, [combinedRecords, rackQuery]);

  const record = useMemo(() => {
    if (!jarId) return null;
    const id = jarId.trim().toLowerCase();
    const heightsRecord = plants.find((p) => String(p.id).toLowerCase() === id) || null;
    const culture = cultureMap.get(id) || null;

    if (!heightsRecord && !culture) return null;

    const baseId = culture?.jarId || heightsRecord?.id || jarId.trim();
    const merged = {
      id: baseId,
      heights: heightsRecord?.heights || [],
      planting_date: culture?.cultureDate || heightsRecord?.planting_date,
      location: culture?.rackNo ? `Rack ${culture.rackNo}` : heightsRecord?.location,
      cultivar: culture?.orchidType || heightsRecord?.cultivar,
      nutrition: culture?.nutrition || heightsRecord?.nutrition,
      recultures: culture?.recultures || [],
    };
    return merged;
  }, [jarId, cultureMap, plants]);

  const history = useMemo(() => {
    if (!record) return [];
    return (record.heights || [])
      .map((h) => {
        const ts = resolveHeightTimestamp(h);
        return { ...h, ts: Number.isFinite(ts) ? ts : null };
      })
      .filter((h) => h.ts !== null)
      .sort((a, b) => a.ts - b.ts);
  }, [record]);

  const historyStats = useMemo(() => {
    if (!history.length) return null;
    const points = history.map((row) => ({ x: row.ts, y: Number(row.height_mm) }));
    return computeSeriesStats(points);
  }, [history]);
  const growthInsight = useMemo(
    () => buildGrowthInsight({ stats: historyStats, record, history }),
    [historyStats, record, history]
  );
  const growthBrief = useMemo(
    () => buildGrowthBrief({ stats: historyStats, record, history }),
    [historyStats, record, history]
  );
  const [includeInsightInReport, setIncludeInsightInReport] = useState(true);
  const [growthReportInsight, setGrowthReportInsight] = useState("");
  const compareMetrics = useMemo(
    () => buildCompareMetrics(combinedRecords, compareIds, compareWindow),
    [combinedRecords, compareIds, compareWindow]
  );
  const compareInsight = useMemo(
    () => buildCompareInsight({ metrics: compareMetrics, compareWindow }),
    [compareMetrics, compareWindow]
  );
  const compareBrief = useMemo(
    () => buildCompareBrief({ metrics: compareMetrics, compareWindow }),
    [compareMetrics, compareWindow]
  );
  const [includeCompareInsight, setIncludeCompareInsight] = useState(true);
  const [compareReportInsight, setCompareReportInsight] = useState("");
  const rackStats = useMemo(() => buildRackStats(rackPlants), [rackPlants]);
  const rackInsight = useMemo(
    () => buildRackInsight({ rackStats, rackQuery }),
    [rackStats, rackQuery]
  );
  const rackBrief = useMemo(
    () => buildRackBrief({ rackStats, rackQuery }),
    [rackStats, rackQuery]
  );
  const [includeRackInsight, setIncludeRackInsight] = useState(true);
  const [rackReportInsight, setRackReportInsight] = useState("");

  useEffect(() => {
    setGrowthReportInsight(growthBrief);
  }, [growthBrief]);

  useEffect(() => {
    setCompareReportInsight(compareBrief);
  }, [compareBrief]);

  useEffect(() => {
    setRackReportInsight(rackBrief);
  }, [rackBrief]);

  return (
    <div className="relative space-y-8">
      <Backdrop isLight={isLight} />
      <Hero />
      <LookupCard
        jarId={jarId}
        setJarId={setJarId}
        record={record}
        history={history}
        query={query}
        setQuery={setQuery}
        status={status}
        setStatus={setStatus}
        demoIdHint={demoIdHint}
        demoIds={demoIds}
        plantsError={plantsError}
        cultureError={cultureError}
      />

      <div className="relative space-y-6">
        <SummaryCard record={record} history={history} />
        <ChartCard
          isLight={isLight}
          record={record}
          history={history}
          reportInsightText={growthReportInsight || growthBrief}
          includeInsight={includeInsightInReport}
        />
        <InsightAssistant
          kicker="Chart assistant"
          title="Growth conclusion"
          insightText={growthBrief}
          summaryText={growthInsight}
          includeInsight={includeInsightInReport}
          setIncludeInsight={setIncludeInsightInReport}
          placeholder="Ask about rate, change, average, or latest..."
          onReportTextChange={setGrowthReportInsight}
          onAsk={(question) =>
            answerGrowthQuestion({
              question,
              stats: historyStats,
              history,
              record,
              insight: growthInsight,
            })
          }
        />
        <HistoryList history={history} />
        <RackSearch
          rackQuery={rackQuery}
          setRackQuery={setRackQuery}
          rackStatus={rackStatus}
          setRackStatus={setRackStatus}
          rackPlants={rackPlants}
          rackHintString={rackHintString}
        />
        <RackChart
          isLight={isLight}
          rackQuery={rackQuery}
          rackPlants={rackPlants}
          rackHintString={rackHintString}
          rackStats={rackStats}
          reportInsightText={rackReportInsight || rackBrief}
          includeInsight={includeRackInsight}
        />
        <InsightAssistant
          kicker="Rack assistant"
          title="Rack summary"
          insightText={rackBrief}
          summaryText={rackInsight}
          includeInsight={includeRackInsight}
          setIncludeInsight={setIncludeRackInsight}
          placeholder="Ask about best, worst, or averages..."
          onReportTextChange={setRackReportInsight}
          onAsk={(question) =>
            answerRackQuestion({
              question,
              rackStats,
              rackQuery,
              insight: rackInsight,
            })
          }
        />
        <ComparePanel
          combinedRecords={combinedRecords}
          compareIds={compareIds}
          setCompareIds={setCompareIds}
          compareWindow={compareWindow}
          setCompareWindow={setCompareWindow}
        />
        <CompareChart
          combinedRecords={combinedRecords}
          compareIds={compareIds}
          compareWindow={compareWindow}
          isLight={isLight}
          metrics={compareMetrics}
          reportInsightText={compareReportInsight || compareBrief}
          includeInsight={includeCompareInsight}
        />
        <InsightAssistant
          kicker="Compare assistant"
          title="Comparison summary"
          insightText={compareBrief}
          summaryText={compareInsight}
          includeInsight={includeCompareInsight}
          setIncludeInsight={setIncludeCompareInsight}
          placeholder="Ask about best, worst, change, or average..."
          onReportTextChange={setCompareReportInsight}
          onAsk={(question) =>
            answerCompareQuestion({
              question,
              metrics: compareMetrics,
              compareWindow,
              insight: compareInsight,
            })
          }
        />
      </div>
    </div>
  );
}
// Lookup card with search input and status messages.
function LookupCard({
  jarId,
  setJarId,
  record,
  history,
  query,
  setQuery,
  status,
  setStatus,
  demoIdHint,
  demoIds,
  plantsError,
  cultureError,
}) {
  const handleSearch = (e) => {
    e.preventDefault();
    const term = query.trim();

    if (!term) {
      setStatus("Enter a Jar ID to search.");
      return;
    }

    const match = demoIds.find((id) => id.toLowerCase() === term.toLowerCase());
    if (match) {
      setJarId(match);
      setStatus(`Loaded ${match} from Firebase.`);
    } else {
      setJarId("");
      setStatus(`No record for that Jar ID. Try ${demoIdHint || "a known ID"}.`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">Growth history</p>
          <h3 className="text-2xl font-semibold text-dark">Find a jar and see its Growth</h3>
          <p className="text-sm text-subtle mt-1">Type a Jar ID </p> 
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_rgba(13,148,136,0.4)] mt-1" aria-hidden />
      </div>

      {(plantsError || cultureError) && (
        <div className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">
          {plantsError && <p>Plant records: {plantsError}</p>}
          {cultureError && <p>Culture entries: {cultureError}</p>}
        </div>
      )}

      <div className="grid md:grid-cols-[2fr_1fr] gap-4 items-end font-medium">
        <form onSubmit={handleSearch} className="space-y-2">
          <span className="text-xs uppercase tracking-[0.22em] text-subtle">Jar / Plant ID</span>
          <div className="flex items-center gap-3 rounded-2xl border border-border/45 bg-paper/70 px-4 py-3 shadow-sm">
            <input
              value={query}
              onChange={(e) => {
                setQuery(normalizeJarIdInput(e.target.value));
                if (status) setStatus("");
              }}
              placeholder={`Search Jar ID (${demoIdHint || "known IDs"})`}
              className="w-full bg-transparent text-sm text-dark placeholder:text-subtle/80 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setStatus("");
                }}
                className="text-xs text-subtle hover:text-dark transition"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-primary to-secondary px-3 py-1.5 text-xs font-semibold text-white shadow-glow"
            >
              Search
            </button>
          </div>
          <p className="text-[11px] text-subtle">Known IDs: {demoIdHint}</p>
        </form>
        <div className="rounded-2xl border border-border/40 bg-paper/70 px-4 py-3 text-sm text-dark shadow-inner">
          {record ? (
            <p>
              Loaded <span className="font-semibold">{record.id}</span> - {history.length} measurements - Cultivar {record.cultivar}
            </p>
          ) : status ? (
            <p className="text-amber-700 dark:text-amber-300">{status}</p>
          ) : (
            <p>Pick a Jar ID to load its planting date and height history.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
// Chart card
function ChartCard({ record, history, isLight, reportInsightText, includeInsight }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const seriesStats = useMemo(() => {
    const points = history.map((row) => ({ x: row.ts, y: Number(row.height_mm) }));
    return computeSeriesStats(points);
  }, [history]);
  const reportDateRows = useMemo(
    () =>
      history.map((row) => [formatDate(row.ts), `${Number(row.height_mm).toFixed(1)} mm`]),
    [history]
  );
  const handleReport = () => {
    if (!history.length) return;
    const chartImage = chartRef.current?.toBase64Image?.();
    const statsRows = [
      ["Jar ID", record?.id || "-"],
      ["Planting date", record?.planting_date || "-"],
      ["Location", record?.location || "-"],
      ["Cultivar", record?.cultivar || "-"],
      ["Nutrition", record?.nutrition || "-"],
      ["Measurements", history.length ? `${history.length} entries` : "0"],
      ["Average height", seriesStats?.avg !== null ? `${seriesStats.avg.toFixed(1)} mm` : "-"],
      ["Change", seriesStats?.delta !== null ? `${seriesStats.delta >= 0 ? "+" : ""}${seriesStats.delta.toFixed(1)} mm` : "-"],
      ["Growth rate", seriesStats?.rate !== null ? `${seriesStats.rate.toFixed(2)} mm/day` : "-"],
    ];

    const sections = [
      { heading: "Summary", content: renderKeyValueTable(statsRows) },
      { heading: "Measurements", content: renderDataTable(["Date", "Height"], reportDateRows) },
    ];
    if (includeInsight && reportInsightText) {
      sections.unshift({
        heading: "Assistant conclusion",
        content: `<p>${escapeHtml(reportInsightText)}</p>`,
      });
    }

    openReportWindow({
      title: `Jar History Report - ${record?.id || "Unknown"}`,
      subtitle: "Height over time",
      chartImage,
      sections,
    });
  };

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    if (!history.length || !canvasRef.current) return;

    const theme = chartTheme(isLight);
    const dataPoints = history.map((row) => ({ x: row.ts, y: Number(row.height_mm) }));

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: {
        datasets: [
          {
            label: record?.id || "Height",
            data: dataPoints,
            borderColor: "#d946ef", // primary (teal-500)
            backgroundColor: "rgba(217, 70, 239, 0.15)",
            tension: 0.28,
            borderWidth: 2.4,
            pointRadius: 4,
            pointBackgroundColor: "#a21caf", // teal-700
            pointBorderColor: "#fdf4ff", // background color
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        scales: {
          x: {
            type: "time",
            time: { unit: "day", tooltipFormat: "MMM d, yyyy" },
            grid: { color: theme.grid },
            ticks: { color: theme.ticks },
            title: { display: true, text: "Measurement date", color: theme.axis },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.grid },
            ticks: { color: theme.ticks },
            title: { display: true, text: "Plant height (mm)", color: theme.axis },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            intersect: false,
            mode: "index",
            callbacks: {
              label: (ctx) => `Height: ${ctx.parsed.y} mm`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [history, record?.id, isLight]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="kicker">Trend line</p>
          <h3 className="text-xl font-semibold text-dark">Height over time</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-subtle">{history.length} points</span>
          <button type="button" onClick={handleReport} className="btn-soft text-xs px-3 py-1.5">
            Report
          </button>
        </div>
      </div>
      {seriesStats && (
        <div className="grid sm:grid-cols-4 gap-2">
          <div className="panel-muted px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Time span</p>
            <p className="text-sm font-semibold text-dark">
              {seriesStats.days !== null ? `${seriesStats.days.toFixed(0)} days` : "-"}
            </p>
          </div>
          <div className="panel-muted px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Avg height</p>
            <p className="text-sm font-semibold text-dark">
              {Number.isFinite(seriesStats.avg) ? `${seriesStats.avg.toFixed(1)} mm` : "-"}
            </p>
          </div>
          <div className="panel-muted px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Change</p>
            <p className="text-sm font-semibold text-dark">
              {Number.isFinite(seriesStats.delta) ? `${seriesStats.delta >= 0 ? "+" : ""}${seriesStats.delta.toFixed(1)} mm` : "-"}
            </p>
          </div>
          <div className="panel-muted px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">Growth rate</p>
            <p className="text-sm font-semibold text-dark">
              {seriesStats.rate !== null ? `${seriesStats.rate.toFixed(2)} mm/day` : "-"}
            </p>
          </div>
        </div>
      )}
      <div className="h-80">
        {history.length ? (
          <canvas ref={canvasRef} />
        ) : (
          <EmptyState message="No measurements yet. Choose a Jar ID to see the line chart." />
        )}
      </div>
    </motion.div>
  );
}

function InsightAssistant({
  kicker,
  title,
  insightText,
  summaryText,
  includeInsight,
  setIncludeInsight,
  placeholder,
  onAsk,
  onReportTextChange,
}) {
  const [messages, setMessages] = useState(() => [{ role: "assistant", text: insightText }]);
  const [input, setInput] = useState("");

  useEffect(() => {
    setMessages([{ role: "assistant", text: insightText }]);
  }, [insightText, title]);

  const handleAsk = (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    const lower = question.toLowerCase();
    const wantsSummary =
      lower.includes("summary") ||
      lower.includes("conclusion") ||
      lower.includes("overall") ||
      lower.includes("insight");
    const reply = wantsSummary ? summaryText || insightText : onAsk ? onAsk(question) : insightText;
    if (wantsSummary && onReportTextChange && summaryText) {
      onReportTextChange(summaryText);
    }
    setMessages((prev) => [...prev, { role: "user", text: question }, { role: "assistant", text: reply }]);
    setInput("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-primary/30 bg-primary/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-6 w-6 text-primary" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="5" y="8" width="14" height="10" rx="3" />
              <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
              <path d="M9 16h6" />
              <path d="M12 5v3" />
              <circle cx="12" cy="4" r="1" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div>
            <p className="kicker">{kicker}</p>
            <h3 className="text-lg font-semibold text-dark">{title}</h3>
            <p className="text-xs text-subtle">Mini scientist assistant</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-subtle shrink-0">
          <input
            type="checkbox"
            checked={includeInsight}
            onChange={(e) => setIncludeInsight(e.target.checked)}
            className="accent-primary"
          />
          Include in report
        </label>
      </div>

      <div className="space-y-2 max-h-48 overflow-auto pr-1">
        {messages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className={`rounded-xl border px-3 py-2 text-sm ${
              msg.role === "assistant"
                ? "border-primary/25 bg-primary/10 text-dark"
                : "border-border/45 bg-paper/80 text-dark"
            }`}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-subtle">
              {msg.role === "assistant" ? "Assistant" : "You"}
            </p>
            <p className="mt-1">{msg.text}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleAsk} className="flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          className="input-shell py-2 flex-1"
        />
        <button type="submit" className="btn-primary text-xs px-3 py-2">
          Ask
        </button>
      </form>
    </motion.div>
  );
}

function ComparePanel({ combinedRecords, compareIds, setCompareIds, compareWindow, setCompareWindow }) {
  const [search, setSearch] = useState("");

  const toggleId = (id) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; // limit selections
      return [...prev, id];
    });
    setSearch("");
  };

  const windows = [
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "365d", label: "1y" },
    { key: "all", label: "All" },
  ];

  const sortedIds = useMemo(() => combinedRecords.map((p) => p.id).sort(), [combinedRecords]);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedIds.filter((id) => !compareIds.includes(id) && (!term || id.toLowerCase().includes(term))).slice(0, 10);
  }, [sortedIds, compareIds, search]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!filtered.length) return;
    toggleId(filtered[0]);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="panel"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="kicker">Compare</p>
          <h3 className="text-lg font-semibold text-dark">Select jars to compare growth</h3>
          <p className="text-sm text-subtle">Search and add up to 3 jars, then choose a window (month, quarter, year, or all time).</p>
        </div>
        <div className="flex gap-2">
          {windows.map((w) => (
            <button
              key={w.key}
              onClick={() => setCompareWindow(w.key)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                compareWindow === w.key
                  ? "bg-primary text-white border-primary"
                  : "border-border/45 text-subtle hover:border-primary/50 hover:text-primary"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 mt-4">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <div className="flex-1 rounded-xl border border-border/45 bg-paper/70 px-3 py-2 flex items-center gap-2 shadow-sm">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Jar ID (type to filter)"
              className="w-full bg-transparent text-sm text-dark placeholder:text-subtle/80 focus:outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-xs text-subtle hover:text-dark">
                Clear
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-primary to-secondary shadow-glow disabled:opacity-60"
            disabled={!filtered.length}
          >
            Add
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {compareIds.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm border border-primary/35 bg-primary/10 text-primary"
            >
              {id}
              <button onClick={() => toggleId(id)} className="text-xs text-primary/80 hover:text-primary">
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="rounded-xl border border-border/40 bg-paper/60 px-3 py-2">
          <p className="text-[11px] text-subtle">Matches</p>
          {filtered.length ? (
            <div className="flex flex-wrap gap-2 mt-1">
              {filtered.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleId(id)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-border/45 bg-paper/80 text-subtle hover:border-primary/50 hover:text-primary transition"
                >
                  {id}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-subtle mt-1">No matches. Try another ID.</p>
          )}
        </div>
      </div>

      <p className="text-[11px] text-subtle mt-2">Select 2–3 jars for best comparison; currently {compareIds.length || 0} selected.</p>
    </motion.div>
  );
}

function RackSearch({ rackQuery, setRackQuery, rackStatus, setRackStatus, rackPlants, rackHintString }) {
  const handleRackSearch = (e) => {
    e.preventDefault();
    const term = rackQuery.trim();
    if (!term) {
      setRackStatus("Enter a rack label (e.g. A1, B3, C2).");
      return;
    }
    const count = rackPlants.length;
    if (count) {
      setRackStatus(`Showing ${count} jar${count > 1 ? "s" : ""} on racks matching "${term}".`);
    } else {
      setRackStatus("No jars found for that rack.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="panel space-y-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="kicker">Rack filter</p>
          <h3 className="text-lg font-semibold text-dark">Plot all jars on a rack</h3>
          <p className="text-sm text-subtle">Search by rack label to see every jar’s height line in one chart below.</p>
        </div>
        <span className="text-xs text-subtle">{rackPlants.length ? `${rackPlants.length} loaded` : rackQuery ? "0 matches" : "Idle"}</span>
      </div>

      <form onSubmit={handleRackSearch} className="space-y-2">
        <div className="flex items-center gap-3 rounded-2xl border border-border/45 bg-paper/70 px-4 py-3 shadow-sm">
          <input
            value={rackQuery}
            onChange={(e) => {
              setRackQuery(e.target.value);
              if (rackStatus) setRackStatus("");
            }}
            placeholder="e.g. A1, B3, C2, A4"
            className="w-full bg-transparent text-sm text-dark placeholder:text-subtle/80 focus:outline-none"
          />
          {rackQuery && (
            <button
              type="button"
              onClick={() => {
                setRackQuery("");
                setRackStatus("");
              }}
              className="text-xs text-subtle hover:text-dark transition"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-r from-primary to-secondary px-3 py-1.5 text-xs font-semibold text-white shadow-glow"
          >
            Search
          </button>
        </div>
        <p className="text-[11px] text-subtle">Known racks: {rackHintString || "n/a"}</p>
        {rackStatus && <p className="text-[12px] text-primary">{rackStatus}</p>}
      </form>
    </motion.div>
  );
}

function CompareChart({ combinedRecords, compareIds, compareWindow, isLight, metrics, reportInsightText, includeInsight }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const datasets = useMemo(() => {
    const palette = ["#e64cc3", "#4f46e5", "#22c55e", "#f59e0b", "#0ea5e9", "#ef4444"];
    const cutoffMs = (() => {
      const now = Date.now();
      if (compareWindow === "30d") return now - 30 * 24 * 3600 * 1000;
      if (compareWindow === "90d") return now - 90 * 24 * 3600 * 1000;
      if (compareWindow === "365d") return now - 365 * 24 * 3600 * 1000;
      return null;
    })();

    const nextDatasets = [];

    compareIds.forEach((id, idx) => {
      const plant = combinedRecords.find((p) => p.id === id);
      if (!plant) return;
      const sorted = (plant.heights || [])
        .map((h) => {
          const ts = Date.parse(h.date);
          return { x: Number.isFinite(ts) ? ts : null, y: Number(h.height_mm) };
        })
        .filter((p) => p.x !== null && (cutoffMs === null || p.x >= cutoffMs))
        .sort((a, b) => a.x - b.x);
      if (!sorted.length) return;

      const color = palette[idx % palette.length];
      nextDatasets.push({
        label: id,
        data: sorted,
        borderColor: color,
        backgroundColor: `${color}33`,
        tension: 0.25,
        borderWidth: 2.2,
        pointRadius: 4,
        pointBackgroundColor: color,
        fill: false,
      });

      const trendPoints = buildTrendlinePoints(sorted);
      if (trendPoints) {
        nextDatasets.push({
          label: `${id} trend`,
          data: trendPoints,
          borderColor: color,
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0,
          fill: false,
        });
      }
    });

    return nextDatasets;
  }, [compareIds, combinedRecords, compareWindow]);

  const handleReport = () => {
    const safeMetrics = metrics || [];
    if (!safeMetrics.length) return;
    const chartImage = chartRef.current?.toBase64Image?.();
    const windowLabel = compareWindow === "all" ? "All time" : compareWindow;
    const metricRows = safeMetrics.map((item) => [
      item.id,
      item.rate !== null ? `${item.rate.toFixed(2)} mm/day` : "n/a",
      Number.isFinite(item.delta) ? `${item.delta >= 0 ? "+" : ""}${item.delta.toFixed(1)} mm` : "n/a",
      Number.isFinite(item.avg) ? `${item.avg.toFixed(1)} mm` : "n/a",
      `${item.count} pts`,
    ]);

    const sections = [
      {
        heading: "Growth metrics",
        content: renderDataTable(
          ["Jar ID", "Growth rate", "Change", "Avg height", "Points"],
          metricRows
        ),
      },
    ];
    if (includeInsight && reportInsightText) {
      sections.unshift({
        heading: "Assistant conclusion",
        content: `<p>${escapeHtml(reportInsightText)}</p>`,
      });
    }

    openReportWindow({
      title: "Jar Comparison Report",
      subtitle: `Window: ${windowLabel}`,
      chartImage,
      sections,
    });
  };

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    if (!datasets.length || !canvasRef.current) return;

    const theme = chartTheme(isLight);
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { mode: "nearest", intersect: false },
        scales: {
          x: {
            type: "time",
            time: { unit: "day", tooltipFormat: "MMM d, yyyy" },
            grid: { color: theme.grid },
            ticks: { color: theme.ticks },
            title: { display: true, text: "Measurement date", color: theme.axis },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.grid },
            ticks: { color: theme.ticks },
            title: { display: true, text: "Height (mm)", color: theme.axis },
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "line",
              padding: 16,
              color: theme.axis,
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => {
                const ts = items[0]?.parsed?.x;
                return ts ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(ts) : "";
              },
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} mm`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [datasets, isLight]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="kicker">Jar comparison</p>
          <h3 className="text-xl font-semibold text-dark">Growth lines across selected jars</h3>
          <p className="text-sm text-subtle">Window: {compareWindow === "all" ? "All time" : compareWindow}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-subtle">
            {metrics?.length ? `${metrics.length} jar${metrics.length > 1 ? "s" : ""}` : "Waiting for selection"}
          </span>
          <button type="button" onClick={handleReport} className="btn-soft text-xs px-3 py-1.5">
            Report
          </button>
        </div>
      </div>
      {metrics?.length ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {metrics.map((item) => (
            <div key={item.id} className="panel-muted px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-dark">{item.id}</span>
                <span className="text-[11px] text-subtle">{item.count} pts</span>
              </div>
              <p className="text-xs text-subtle mt-1">
                Growth rate: {item.rate !== null ? `${item.rate.toFixed(2)} mm/day` : "n/a"}
              </p>
              <p className="text-xs text-subtle">
                Change: {Number.isFinite(item.delta) ? `${item.delta >= 0 ? "+" : ""}${item.delta.toFixed(1)} mm` : "n/a"}
              </p>
              <p className="text-xs text-subtle">
                Avg height: {Number.isFinite(item.avg) ? `${item.avg.toFixed(1)} mm` : "n/a"}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <div className="h-72">
        {datasets.length ? (
          <canvas ref={canvasRef} />
        ) : (
          <EmptyState message="Select at least one jar to see the comparison chart." />
        )}
      </div>
    </motion.div>
  );
}

function RackChart({ rackPlants, rackQuery, rackHintString, isLight, rackStats, reportInsightText, includeInsight }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const handleReport = () => {
    if (!rackStats?.length || !rackQuery) return;
    const chartImage = chartRef.current?.toBase64Image?.();
    const rows = (rackStats || []).map((item) => [
      item.id,
      item.avg !== null ? `${item.avg.toFixed(1)} mm` : "n/a",
      `${item.count} pts`,
      item.rank || "-",
    ]);

    const sections = [
      {
        heading: "Rack metrics",
        content: renderDataTable(["Jar ID", "Avg height", "Points", "Rank"], rows),
      },
    ];
    if (includeInsight && reportInsightText) {
      sections.unshift({
        heading: "Assistant conclusion",
        content: `<p>${escapeHtml(reportInsightText)}</p>`,
      });
    }

    openReportWindow({
      title: `Rack Summary Report - ${rackQuery}`,
      subtitle: "Average height per jar",
      chartImage,
      sections,
    });
  };

  const datasets = useMemo(() => {
    const palette = ["#d946ef", "#a855f7", "#6366f1", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9"];

    return rackPlants
      .map((plant, idx) => {
        const sorted = (plant.heights || [])
          .map((h) => {
            const ts = Date.parse(h.date);
            return { x: Number.isFinite(ts) ? ts : null, y: Number(h.height_mm) };
          })
          .filter((p) => p.x !== null)
          .sort((a, b) => a.x - b.x);

        if (!sorted.length) return null;
        const color = palette[idx % palette.length];
        return {
          label: plant.id,
          data: sorted,
          borderColor: color,
          backgroundColor: `${color}33`,
          tension: 0.24,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: color,
          fill: false,
        };
      })
      .filter(Boolean);
  }, [rackPlants]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    if (!datasets.length || !canvasRef.current) return;

    const theme = chartTheme(isLight);
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { mode: "nearest", intersect: false },
        scales: {
          x: {
            type: "time",
            time: { unit: "day", tooltipFormat: "MMM d, yyyy" },
            grid: { color: theme.grid },
            ticks: { color: theme.ticks },
            title: { display: true, text: "Measurement date", color: theme.axis },
          },
          y: {
            beginAtZero: true,
            grid: { color: theme.grid },
            ticks: { color: theme.ticks },
            title: { display: true, text: "Height (mm)", color: theme.axis },
          },
        },
        plugins: {
          legend: { display: true, position: "bottom", labels: { color: theme.axis } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} mm`,
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [datasets, isLight]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="kicker">Rack summary</p>
          <h3 className="text-xl font-semibold text-dark">Growth by rack</h3>
          <p className="text-sm text-subtle">Lines show each jar found on the rack label you searched.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-subtle">
            {datasets.length ? `${datasets.length} jar${datasets.length > 1 ? "s" : ""}` : rackQuery ? "No matches" : "Waiting"}
          </span>
          <button type="button" onClick={handleReport} className="btn-soft text-xs px-3 py-1.5">
            Report
          </button>
        </div>
      </div>
      {rackQuery && rackStats?.length ? (
        <div className="panel-muted px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-subtle">Average height per jar</p>
            <span className="text-[11px] text-subtle">Best/Worst marked</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 max-h-40 overflow-auto pr-1">
            {(rackStats || []).map((item) => (
              <div key={item.id} className="rounded-xl border border-border/45 bg-paper/80 px-3 py-2 text-xs text-dark">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{item.id}</span>
                  {item.rank && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${
                        item.rank === "Best"
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-rose-200/60 bg-rose-500/10 text-rose-700"
                      }`}
                    >
                      {item.rank}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-subtle mt-1">
                  Avg: {item.avg !== null ? `${item.avg.toFixed(1)} mm` : "n/a"} · {item.count} pts
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="h-72">
        {rackQuery ? (
          datasets.length ? (
            <canvas ref={canvasRef} />
          ) : (
            <EmptyState message={`No jars found for that rack label. Known racks: ${rackHintString || "n/a"}.`} />
          )
        ) : (
          <EmptyState message={`Enter a rack label above to plot all jar heights in that rack. Known racks: ${rackHintString || "n/a"}.`} />
        )}
      </div>
    </motion.div>
  );
}

function HistoryList({ history }) {
  const rows = [...history].reverse(); // newest first

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="kicker">History</p>
          <h3 className="text-lg font-semibold text-dark">Logged measurements</h3>
        </div>
        <span className="text-xs text-subtle">{rows.length ? "Latest first" : "Waiting for selection"}</span>
      </div>

      {rows.length ? (
        <div className="divide-y divide-border/30">
          {rows.map((row, idx) => {
            const prev = rows[idx + 1];
            const delta = prev ? Number(row.height_mm) - Number(prev.height_mm) : null;
            return (
              <div key={row.ts} className="grid grid-cols-3 gap-3 py-3 text-sm text-dark">
                <span className="font-medium">{formatDate(row.ts)}</span>
                <span>{Number(row.height_mm).toFixed(1)} mm</span>
                <span className="text-subtle">
                  {delta === null ? "-" : delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} mm vs prior`}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState message="Measurement list will appear once a Jar ID is loaded." />
      )}
    </motion.div>
  );
}
// Summary card showing key metadata and simple stats, with conditional formatting for positive/negative change and graceful handling of missing data
function SummaryCard({ record, history }) {
  const latest = history.length ? history[history.length - 1] : null;
  const first = history[0];
  const avg = history.length ? history.reduce((sum, row) => sum + Number(row.height_mm), 0) / history.length : null;
  const delta = latest && first ? latest.height_mm - first.height_mm : null;

  const stats = [
    { label: "Planting date", value: record?.planting_date || "-" },
    { label: "Location", value: record?.location || "-" },
    { label: "Measurements", value: history.length ? `${history.length} entries` : "0 entries" },
    { label: "Latest height", value: latest ? `${latest.height_mm.toFixed(1)} mm` : "-" },
    { label: "Avg height", value: avg !== null ? `${avg.toFixed(1)} mm` : "-" },
    { label: "Change", value: delta !== null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} mm` : "-" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel p-4 space-y-3"
    >
      <div className="space-y-1">
        <p className="kicker">Snapshot</p>
        <h3 className="text-base font-semibold text-dark">{record ? record.id : "Awaiting jar"}</h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {stats.map((item) => (
          <div key={item.label} className="panel-muted px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-subtle">{item.label}</p>
            <p className="text-sm font-semibold text-dark mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function Hero() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="panel relative overflow-hidden p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
      <div className="relative space-y-3">
        <p className="kicker">Historical view</p>
        <h1 className="title-lg">Jar height history</h1>
        <p className="text-subtle text-sm md:text-base max-w-2xl">
          Explore growth trends for any jar using time-stamped measurements from Firebase. The chart plots dates on the x-axis and height in millimeters on the y-axis, while the sections below support jar comparison, rack-level filtering, and detailed measurement review.
        </p>
      </div>
    </motion.div>
  );
}

// Backdrop with layered gradients and patterns for visual interest, using pointer-events-none to avoid interfering with interactions
function Backdrop({ isLight }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 -z-10 transition-opacity duration-300 ${
        isLight ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-50 via-white to-emerald-50" />
      <div className="absolute inset-0 opacity-60 bg-[linear-gradient(90deg,rgba(6,182,212,0.06)_1px,transparent_1px),linear-gradient(180deg,rgba(6,182,212,0.06)_1px,transparent_1px)] bg-[size:52px_52px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(13,148,136,0.15),transparent_30%),radial-gradient(circle_at_72%_16%,rgba(6,182,212,0.15),transparent_32%),radial-gradient(circle_at_48%_82%,rgba(249,115,22,0.1),transparent_36%)]" />
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-subtle bg-paper/60 rounded-2xl border border-border/35">
      {message}
    </div>
  );
}
 

function formatDate(ts) {
  if (!ts) return "-";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(ts));
  } catch {
    return "-";
  }
}
