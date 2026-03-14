
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";
import { limitToLast, onValue, query as fbQuery, ref } from "firebase/database";
import { db } from "../lib/firebase";
import { encodeFirebaseKeySegment } from "../lib/firebaseKeys";
import { useTheme } from "../context/ThemeContext";

const MAX_VALID_HEIGHT_MM = 190;

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const sanitizeHeightMm = (value) => {
  const num = toNumber(value);
  if (num === null) return null;
  return num <= MAX_VALID_HEIGHT_MM ? num : null;
};

const normalizeId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compact = raw.replace(/[\s_-]+/g, "").toLowerCase();
  const jarMatch = compact.match(/^jar0*(\d+)$/);
  if (jarMatch) return `jar${Number(jarMatch[1])}`;
  const jMatch = compact.match(/^j0*(\d+)$/);
  if (jMatch) return `jar${Number(jMatch[1])}`;
  const numericMatch = compact.match(/^0*(\d+)$/);
  if (numericMatch) return `jar${Number(numericMatch[1])}`;
  return compact;
};

const canonicalPlantId = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw;
};

const coerceTimestamp = (value) => {
  const num = toNumber(value);
  if (num === null) return null;
  return num < 10000000000 ? num * 1000 : num;
};

const normalizeHeightEntry = (entry) => {
  if (entry === undefined || entry === null) return null;
  if (typeof entry === "number") {
    const num = sanitizeHeightMm(entry);
    return num === null ? null : { height_mm: num };
  }
  if (typeof entry === "string") {
    const num = sanitizeHeightMm(entry);
    return num === null ? null : { height_mm: num };
  }
  if (typeof entry !== "object") return null;
  const sourceTag = String(entry.source || entry.origin || "").toLowerCase();
  if (sourceTag.includes("dataset-biweekly") || sourceTag.includes("mock")) return null;

  const heightMm = toNumber(entry.height_mm ?? entry.height ?? entry.heightMm ?? entry.heightMM ?? entry.current_height);
  const heightCm = toNumber(entry.height_cm ?? entry.heightCm);
  const resolvedHeight = heightMm ?? (heightCm !== null ? heightCm * 10 : null);
  const sanitizedHeight = sanitizeHeightMm(resolvedHeight);
  if (sanitizedHeight === null) return null;

  const ts = coerceTimestamp(entry.timestamp ?? entry.ts ?? entry.time ?? entry.logged_at ?? entry.loggedAt);
  const date = entry.date || entry.recorded_at || entry.recordedAt || (ts ? new Date(ts).toISOString().split("T")[0] : null);

  return {
    ...entry,
    height_mm: sanitizedHeight,
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

const asText = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const firstText = (...values) => {
  for (const value of values) {
    const next = asText(value);
    if (next) return next;
  }
  return "";
};

const buildNutritionSnapshot = ({
  baseNutrition,
  hormoneEnabled,
  hormoneDetail,
  specialEnabled,
  specialDetail,
}) => {
  const parts = [];
  const base = firstText(baseNutrition);
  if (base) parts.push(base);

  if (hormoneEnabled || firstText(hormoneDetail)) {
    const detail = firstText(hormoneDetail);
    parts.push(detail ? `Hormone: ${detail}` : "Hormone added");
  }

  if (specialEnabled || firstText(specialDetail)) {
    const detail = firstText(specialDetail);
    parts.push(detail ? `Special nutrition: ${detail}` : "Special nutrition added");
  }

  return parts.join(" | ");
};

const normalizeCultureRecord = (key, value) => {
  const entry = value && typeof value === "object" ? value : {};
  const jarId = firstText(entry.jarId, key);
  if (!jarId) return null;

  const hormoneEnabled =
    entry.addHormone === true ||
    entry.hasHormone === true ||
    entry.useHormone === true ||
    entry.hormone_enabled === true;
  const specialEnabled =
    entry.addSpecialNutrition === true ||
    entry.hasSpecialNutrition === true ||
    entry.useSpecialNutrition === true ||
    entry.special_nutrition_enabled === true;

  const hormoneDetail = firstText(entry.hormoneDetail, entry.hormone, entry.hormoneNote, entry.hormone_note);
  const specialDetail = firstText(
    entry.specialNutritionDetail,
    entry.specialNutrition,
    entry.specialNutritionNote,
    entry.special_nutrition_detail,
    entry.special_nutrition_note
  );
  const baseNutrition = firstText(
    entry.nutrition,
    entry.nutritionStatus,
    entry.nutrition_status,
    entry.feedStatus,
    entry.feed_status
  );
  const nutritionSnapshot = buildNutritionSnapshot({
    baseNutrition,
    hormoneEnabled,
    hormoneDetail,
    specialEnabled,
    specialDetail,
  });

  return {
    jarId,
    parentJarId: firstText(
      entry.directParentJarId,
      entry.direct_parent_jar_id,
      entry.sourceJarId,
      entry.source_jar_id,
      entry.parentJarId,
      entry.parentJarID,
      entry.parentJar,
      entry.parent_id,
      entry.parent_jar_id
    ),
    cultureDate: firstText(entry.cultureDate, entry.culture_date, entry.planting_date, entry.plantingDate),
    rackNo: firstText(entry.rackNo, entry.rack_no, entry.rack),
    orchidType: firstText(entry.orchidType, entry.cultivar, entry.type),
    nutrition: baseNutrition,
    nutritionStatus: firstText(nutritionSnapshot, baseNutrition),
    addHormone: hormoneEnabled,
    hormoneDetail,
    addSpecialNutrition: specialEnabled,
    specialNutritionDetail: specialDetail,
    recultures: Array.isArray(entry.recultures) ? entry.recultures : [],
    updatedAt: entry.updatedAt || entry.updated_at || null,
  };
};

const normalizeJarIdInput = (value) => {
  const next = (value || "").trimStart();
  if (!next) return value || "";
  return next[0].toLowerCase() === "j" ? `J${next.slice(1)}` : value;
};

const buildLineageIndex = (cultureEntries) => {
  const parentById = new Map();
  const childrenById = new Map();

  (cultureEntries || []).forEach((entry) => {
    const childId = normalizeId(entry?.jarId);
    const parentId = normalizeId(entry?.parentJarId);
    if (!childId || !parentId || childId === parentId) return;
    parentById.set(childId, parentId);
    const existingChildren = childrenById.get(parentId) || [];
    childrenById.set(parentId, [...existingChildren, childId]);
  });

  return { parentById, childrenById };
};

const collectLineageIds = (seedId, lineageIndex) => {
  const seed = normalizeId(seedId);
  if (!seed) return [];

  const { parentById, childrenById } = lineageIndex || {};
  const visited = new Set([seed]);

  let cursor = seed;
  while (parentById?.has(cursor)) {
    const parent = parentById.get(cursor);
    if (!parent || visited.has(parent)) break;
    visited.add(parent);
    cursor = parent;
  }

  const queue = Array.from(visited);
  while (queue.length) {
    const current = queue.shift();
    const children = childrenById?.get(current) || [];
    children.forEach((child) => {
      if (!child || visited.has(child)) return;
      visited.add(child);
      queue.push(child);
    });
  }

  return Array.from(visited);
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

const toValidPoint = (x, y) => {
  const xn = Number(x);
  const yn = Number(y);
  if (!Number.isFinite(xn) || !Number.isFinite(yn)) return null;
  if (yn > MAX_VALID_HEIGHT_MM) return null;
  return { x: xn, y: yn };
};

const rackEndLabelsPlugin = {
  id: "rackEndLabels",
  afterDatasetsDraw(chart, _args, pluginOptions) {
    if (!pluginOptions?.enabled) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;

    const labels = [];
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      if (!dataset || dataset.hidden || dataset.yAxisID === "yDelta") return;
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden || !meta.data?.length) return;

      const lastElement = meta.data[meta.data.length - 1];
      const lastPoint = dataset.data?.[dataset.data.length - 1];
      const yValue = Number(lastPoint?.y ?? lastPoint);
      if (!lastElement || !Number.isFinite(lastElement.x) || !Number.isFinite(lastElement.y) || !Number.isFinite(yValue)) return;

      labels.push({
        x: lastElement.x + 10,
        y: lastElement.y,
        text: `${dataset.label} ${yValue.toFixed(1)} mm`,
        color: typeof dataset.borderColor === "string" ? dataset.borderColor : "#0f172a",
      });
    });
    if (!labels.length) return;

    labels.sort((a, b) => a.y - b.y);
    const minGap = Number(pluginOptions?.minGap) || 16;
    const top = chartArea.top + 10;
    const bottom = chartArea.bottom - 10;

    labels[0].y = Math.max(top, labels[0].y);
    for (let i = 1; i < labels.length; i += 1) {
      labels[i].y = Math.max(labels[i].y, labels[i - 1].y + minGap);
    }
    for (let i = labels.length - 1; i >= 0; i -= 1) {
      if (labels[i].y > bottom) {
        labels[i].y = bottom;
        if (i > 0) labels[i - 1].y = Math.min(labels[i - 1].y, labels[i].y - minGap);
      }
    }

    ctx.save();
    ctx.font = pluginOptions?.font || "600 11px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeStyle = pluginOptions?.haloColor || "rgba(255, 255, 255, 0.92)";

    labels.forEach((item) => {
      const textWidth = ctx.measureText(item.text).width;
      const safeX = Math.min(item.x, chartArea.right - textWidth - 2);
      ctx.strokeText(item.text, safeX, item.y);
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, safeX, item.y);
    });

    ctx.restore();
  },
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
      .map((h) => toValidPoint(Date.parse(h.date), h.height_mm))
      .filter((p) => p !== null && (cutoffMs === null || p.x >= cutoffMs))
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
      .map((h) => toValidPoint(Date.parse(h.date), h.height_mm))
      .filter((p) => p !== null)
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

const deriveCategoryLabel = (value) => {
  const text = firstText(value);
  if (!text) return "Uncategorized";
  const cleaned = text
    .replace(/\(.*?\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "Uncategorized";
  const genus = cleaned.match(/^[A-Za-z][A-Za-z-]*/);
  return genus ? genus[0] : cleaned;
};

const resolvePlantCategory = (plant) =>
  deriveCategoryLabel(firstText(plant?.category, plant?.cultivar, plant?.orchidType));

const toPlantSeriesPoints = (plant, cutoffMs = null) =>
  (plant?.heights || [])
    .map((h) => toValidPoint(Date.parse(h.date), h.height_mm))
    .filter((point) => point !== null && (cutoffMs === null || point.x >= cutoffMs))
    .sort((a, b) => a.x - b.x);

const classifyCategoryGrowth = ({ avgRate, avgDelta, measuredPlants }) => {
  if (!measuredPlants || avgRate === null) {
    return {
      growthLabel: "insufficient data",
      suggestion: "Log at least two measurements per jar before deciding interventions for this category.",
    };
  }
  if (avgRate < 0.2 || avgDelta < 8) {
    return {
      growthLabel: "slow",
      suggestion: "Try improving nutrition, refresh medium/pH, adjust light/temperature, and check contamination this week.",
    };
  }
  if (avgRate < 0.55) {
    return {
      growthLabel: "moderate",
      suggestion: "Consider a small nutrition boost, tune humidity/light, and review growth again after the next 7-14 days.",
    };
  }
  return {
    growthLabel: "fast",
    suggestion: "Keep current nutrition and conditions, but monitor spacing/ventilation to avoid stress from rapid growth.",
  };
};

const buildRackCategoryStats = (rackPlants) => {
  if (!rackPlants?.length) return [];
  const grouped = new Map();

  rackPlants.forEach((plant) => {
    const category = resolvePlantCategory(plant);
    if (!grouped.has(category)) {
      grouped.set(category, {
        category,
        ids: [],
        measuredPlants: 0,
        rates: [],
        deltas: [],
        avgHeights: [],
        latestHeights: [],
        totalPoints: 0,
      });
    }

    const bucket = grouped.get(category);
    bucket.ids.push(plant.id);

    const stats = computeSeriesStats(toPlantSeriesPoints(plant));
    if (!stats) return;

    bucket.measuredPlants += 1;
    bucket.totalPoints += stats.count || 0;
    if (Number.isFinite(stats.rate)) bucket.rates.push(stats.rate);
    if (Number.isFinite(stats.delta)) bucket.deltas.push(stats.delta);
    if (Number.isFinite(stats.avg)) bucket.avgHeights.push(stats.avg);
    if (Number.isFinite(stats.last)) bucket.latestHeights.push(stats.last);
  });

  const avgOrNull = (values) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  return Array.from(grouped.values())
    .map((item) => {
      const avgRate = avgOrNull(item.rates);
      const avgDelta = avgOrNull(item.deltas);
      const avgHeight = avgOrNull(item.avgHeights);
      const latestAvg = avgOrNull(item.latestHeights);
      const { growthLabel, suggestion } = classifyCategoryGrowth({
        avgRate,
        avgDelta,
        measuredPlants: item.measuredPlants,
      });

      return {
        category: item.category,
        plantCount: item.ids.length,
        measuredPlants: item.measuredPlants,
        avgRate,
        avgDelta,
        avgHeight,
        latestAvg,
        totalPoints: item.totalPoints,
        growthLabel,
        suggestion,
      };
    })
    .sort((a, b) => {
      const left = Number.isFinite(a.avgRate) ? a.avgRate : Number.NEGATIVE_INFINITY;
      const right = Number.isFinite(b.avgRate) ? b.avgRate : Number.NEGATIVE_INFINITY;
      return right - left;
    });
};

// START CLUSTER_UI_STEP: jar-id-based K-Means helpers (safe to remove as one block)
const CLUSTER_FEATURE_KEYS = ["height_cm", "days_since_planting", "growth_rate"];
const NO_GROWTH_RATE_CM_PER_DAY = 0.001;
const SLOW_GROWTH_RATE_CM_PER_DAY = 0.03;
const ATTENTION_MIN_DAYS_SINCE_PLANTING = 90;
const CLUSTER_LABEL_COLORS = {
  "slow growth": "#dc2626",
  "normal growth": "#2563eb",
  "fast growth": "#16a34a",
};

const buildJarClusterFeatures = (combinedRecords, { mockIdSet, includeIdSet } = {}) => {
  const allowMockOnly = mockIdSet && mockIdSet.size;
  const allowSubsetOnly = includeIdSet && includeIdSet.size;
  return (combinedRecords || [])
    .filter((record) => {
      if (!record?.id) return false;
      const idKey = normalizeId(record.id);
      if (!idKey) return false;
      if (allowMockOnly && !mockIdSet.has(idKey)) return false;
      if (allowSubsetOnly && !includeIdSet.has(idKey)) return false;
      return true;
    })
    .map((record) => {
      const points = (record.heights || [])
        .map((h) => toValidPoint(Date.parse(h.date), h.height_mm))
        .filter(Boolean)
        .sort((a, b) => a.x - b.x);
      if (points.length < 2) return null;

      const first = points[0];
      const last = points[points.length - 1];
      const elapsedDays = (last.x - first.x) / DAY_MS;

      const plantingTs = record.planting_date ? Date.parse(`${record.planting_date}T12:00:00Z`) : null;
      const daysSincePlanting = Number.isFinite(plantingTs)
        ? Math.max(0, (last.x - plantingTs) / DAY_MS)
        : Math.max(0, elapsedDays);

      const growthRate = elapsedDays > 0 ? ((last.y - first.y) / 10) / elapsedDays : 0;
      const heightCm = last.y / 10;

      if (!Number.isFinite(heightCm) || !Number.isFinite(daysSincePlanting) || !Number.isFinite(growthRate)) return null;

      return {
        jar_id: record.id,
        height_cm: heightCm,
        days_since_planting: daysSincePlanting,
        growth_rate: growthRate,
      };
    })
    .filter(Boolean);
};

const buildZScoreStats = (rows, keys) =>
  keys.map((key) => {
    const values = rows.map((row) => row[key]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1;
    return { key, mean, std };
  });

const normalizeFeatureVectors = (rows, stats) =>
  rows.map((row) => stats.map((s) => (row[s.key] - s.mean) / s.std));

const euclideanSq = (a, b) => a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0);

const meanVector = (vectors) => {
  const dims = vectors[0].length;
  const sums = new Array(dims).fill(0);
  vectors.forEach((vector) => {
    vector.forEach((value, idx) => {
      sums[idx] += value;
    });
  });
  return sums.map((sum) => sum / vectors.length);
};

const initGrowthCentroids = (vectors) => {
  const byGrowth = [...vectors].sort((a, b) => a[2] - b[2]);
  const low = byGrowth[0];
  const mid = byGrowth[Math.floor(byGrowth.length / 2)];
  const high = byGrowth[byGrowth.length - 1];
  return [low, mid, high].map((v) => [...v]);
};

const runKMeans = (vectors, k = 3, maxIters = 100) => {
  if (vectors.length < k) return null;

  let centroids = initGrowthCentroids(vectors);
  let assignments = new Array(vectors.length).fill(-1);

  for (let iter = 0; iter < maxIters; iter += 1) {
    let changed = false;
    vectors.forEach((vector, idx) => {
      let bestCluster = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, cIdx) => {
        const dist = euclideanSq(vector, centroid);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = cIdx;
        }
      });
      if (assignments[idx] !== bestCluster) {
        assignments[idx] = bestCluster;
        changed = true;
      }
    });

    const clusters = Array.from({ length: k }, () => []);
    assignments.forEach((clusterIdx, idx) => {
      clusters[clusterIdx].push(vectors[idx]);
    });

    centroids = centroids.map((oldCentroid, cIdx) => {
      const vectorsInCluster = clusters[cIdx];
      if (!vectorsInCluster.length) return oldCentroid;
      return meanVector(vectorsInCluster);
    });

    if (!changed) return { centroids, assignments, iterations: iter + 1 };
  }

  return { centroids, assignments, iterations: maxIters };
};

const labelClustersByGrowth = (centroids) => {
  const ranked = centroids
    .map((centroid, idx) => ({ idx, growthSignal: centroid[2] }))
    .sort((a, b) => a.growthSignal - b.growthSignal);
  const map = new Map();
  map.set(ranked[0].idx, "slow growth");
  map.set(ranked[1].idx, "normal growth");
  map.set(ranked[2].idx, "fast growth");
  return map;
};

const classifyGrowthByRule = ({ growth_rate, height_cm }) => {
  const rate = Number(growth_rate);
  const height = Number(height_cm);
  if ((Number.isFinite(rate) && rate < SLOW_GROWTH_RATE_CM_PER_DAY) || (Number.isFinite(height) && height < 12))
    return "slow growth";
  if ((Number.isFinite(rate) && rate > 0.1) || (Number.isFinite(height) && height >= 16)) return "fast growth";
  return "normal growth";
};

const buildGrowthAttentionWarnings = (
  features,
  { minDaysSincePlanting = ATTENTION_MIN_DAYS_SINCE_PLANTING } = {}
) => {
  const map = new Map();
  (features || []).forEach((item) => {
    const days = Number(item?.days_since_planting);
    if (!Number.isFinite(days) || days < minDaysSincePlanting) return;

    const rate = Number(item?.growth_rate);
    const noGrowth = Number.isFinite(rate) && rate <= NO_GROWTH_RATE_CM_PER_DAY;
    const slowGrowth =
      !noGrowth &&
      ((Number.isFinite(rate) && rate <= SLOW_GROWTH_RATE_CM_PER_DAY) || classifyGrowthByRule(item) === "slow growth");
    if (!noGrowth && !slowGrowth) return;

    const jarId = item?.jar_id;
    if (!jarId) return;
    const severity = noGrowth ? "no growth" : "slow growth";
    const existing = map.get(jarId);
    if (!existing || severity === "no growth") {
      map.set(jarId, { jar_id: jarId, severity, days_since_planting: days });
    }
  });

  return Array.from(map.values()).sort((a, b) =>
    String(a.jar_id).localeCompare(String(b.jar_id), undefined, { numeric: true, sensitivity: "base" })
  );
};

const buildGrowthClusterResult = (combinedRecords, { mockIdSet, includeIdSet } = {}) => {
  const features = buildJarClusterFeatures(combinedRecords, { mockIdSet, includeIdSet });
  const sourceLabel = includeIdSet && includeIdSet.size ? "selected jar/rack scope" : "all mock jars";

  if (!features.length) {
    return {
      ready: false,
      reason: "No eligible jars found for current selection. Choose a jar or rack with growth records.",
      assignments: [],
      counts: {},
      sourceLabel,
    };
  }

  if (features.length < 3) {
    const assignments = features
      .map((item) => {
        const clusterLabel = classifyGrowthByRule(item);
        return {
          ...item,
          cluster_id: -1,
          cluster_label: clusterLabel,
          color: CLUSTER_LABEL_COLORS[clusterLabel] || "#2563eb",
        };
      })
      .sort((a, b) => String(a.jar_id).localeCompare(String(b.jar_id), undefined, { numeric: true, sensitivity: "base" }));

    const counts = assignments.reduce((acc, item) => {
      acc[item.cluster_label] = (acc[item.cluster_label] || 0) + 1;
      return acc;
    }, {});

    return {
      ready: true,
      reason: "",
      mode: "rule-based",
      note: `Only ${assignments.length} jar(s) available in this selection. Rule-based grouping shown; K-Means starts from 3 jars.`,
      assignments,
      counts,
      iterations: 0,
      totalJars: assignments.length,
      sourceLabel,
    };
  }

  const normStats = buildZScoreStats(features, CLUSTER_FEATURE_KEYS);
  const vectors = normalizeFeatureVectors(features, normStats);
  const kmeans = runKMeans(vectors, 3, 100);
  if (!kmeans) {
    return {
      ready: false,
      reason: "K-Means could not run with current records.",
      assignments: [],
      counts: {},
    };
  }

  const labels = labelClustersByGrowth(kmeans.centroids);
  const assignments = features
    .map((item, idx) => {
      const clusterId = kmeans.assignments[idx];
      const clusterLabel = labels.get(clusterId) || "normal growth";
      return {
        ...item,
        cluster_id: clusterId,
        cluster_label: clusterLabel,
        color: CLUSTER_LABEL_COLORS[clusterLabel] || "#2563eb",
      };
    })
    .sort((a, b) => String(a.jar_id).localeCompare(String(b.jar_id), undefined, { numeric: true, sensitivity: "base" }));

  const counts = assignments.reduce((acc, item) => {
    acc[item.cluster_label] = (acc[item.cluster_label] || 0) + 1;
    return acc;
  }, {});

  return {
    ready: true,
    reason: "",
    mode: "kmeans",
    note: "",
    assignments,
    counts,
    iterations: kmeans.iterations,
    totalJars: assignments.length,
    sourceLabel,
  };
};
// END CLUSTER_UI_STEP

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

const buildRackInsight = ({ rackStats, rackQuery, categoryStats = [] }) => {
  if (!rackQuery) return "Enter a rack label to generate a rack summary.";
  if (!rackStats.length) return "No jars found for this rack.";
  const valid = rackStats.filter((item) => item.avg !== null);
  if (!valid.length) return "Not enough measurements to calculate rack averages.";
  const best = valid.find((item) => item.rank === "Best") || valid[0];
  const worst = valid.find((item) => item.rank === "Worst") || valid[valid.length - 1];
  const avgAcross = valid.reduce((sum, item) => sum + item.avg, 0) / valid.length;
  const validCategories = categoryStats.filter((item) => Number.isFinite(item.avgRate));
  if (!validCategories.length) {
    return `Rack ${rackQuery} averages ${avgAcross.toFixed(1)} mm across ${valid.length} jars. Best average height is ${
      best.id
    } at ${best.avg.toFixed(1)} mm; lowest is ${worst.id} at ${worst.avg.toFixed(1)} mm.`;
  }

  const topCategory = validCategories[0];
  const lowCategory = validCategories[validCategories.length - 1];
  return `Rack ${rackQuery} averages ${avgAcross.toFixed(1)} mm across ${valid.length} jars. Category growth-change comparison shows ${
    topCategory.category
  } is strongest (${topCategory.avgRate.toFixed(2)} mm/day, ${topCategory.avgDelta.toFixed(
    1
  )} mm avg change), while ${lowCategory.category} is slowest (${lowCategory.avgRate.toFixed(
    2
  )} mm/day). Suggested action for ${lowCategory.category}: ${lowCategory.suggestion}`;
};

const buildRackBrief = ({ rackStats, rackQuery, categoryStats = [] }) => {
  if (!rackQuery) return "Enter a rack label to summarize.";
  if (!rackStats.length) return "No jars found on this rack.";
  const valid = rackStats.filter((item) => item.avg !== null);
  if (!valid.length) return "Not enough data to summarize rack averages.";
  const validCategories = categoryStats.filter((item) => Number.isFinite(item.avgRate));
  if (!validCategories.length) {
    const best = valid.find((item) => item.rank === "Best") || valid[0];
    return `Rack ${rackQuery}: best average height is ${best.id} at ${best.avg.toFixed(1)} mm.`;
  }
  const topCategory = validCategories[0];
  const lowCategory = validCategories[validCategories.length - 1];
  return `Rack ${rackQuery} category focus: ${topCategory.category} grows fastest (${topCategory.avgRate.toFixed(
    2
  )} mm/day). Improve ${lowCategory.category} by checking nutrition and conditions: ${lowCategory.suggestion}`;
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

const answerRackQuestion = ({ question, rackStats, rackQuery, categoryStats = [], insight }) => {
  if (!question?.trim()) return insight;
  if (!rackStats.length) return "No rack data yet.";
  const q = question.toLowerCase();
  const valid = rackStats.filter((item) => item.avg !== null);
  const validCategories = (categoryStats || []).filter((item) => Number.isFinite(item.avgRate));
  if ((q.includes("category") || q.includes("type") || q.includes("cultivar")) && validCategories.length) {
    const rows = validCategories
      .map(
        (item) =>
          `${item.category}: ${item.avgRate.toFixed(2)} mm/day, change ${item.avgDelta?.toFixed(1) || "n/a"} mm (${item.growthLabel})`
      )
      .join(", ");
    return `Category growth change on ${rackQuery}: ${rows}.`;
  }
  if (q.includes("suggest") || q.includes("recommend") || q.includes("improve")) {
    if (!validCategories.length) return "Need category-level growth data before suggesting interventions.";
    const focus = validCategories[validCategories.length - 1];
    return `Recommended focus for ${focus.category}: ${focus.suggestion}`;
  }
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

const ENABLE_HISTORY_TEST_MOCK = true;

const mergeUniqueByNormalizedId = (primary, secondary, pickId) => {
  const map = new Map();
  (secondary || []).forEach((item) => {
    const key = normalizeId(pickId(item));
    if (!key) return;
    map.set(key, item);
  });
  (primary || []).forEach((item) => {
    const key = normalizeId(pickId(item));
    if (!key) return;
    map.set(key, item);
  });
  return Array.from(map.values());
};

const HISTORY_TEST_MOCK_PLANTS = [
  normalizePlantRecord({
    id: "Jar-91",
    planting_date: "2025-12-28",
    location: "Rack T1",
    cultivar: "Phalaenopsis (test A)",
    nutrition: "MS + 3% sucrose",
    heights: [
      { date: "2026-01-28", height_mm: 18 },
      { date: "2026-02-11", height_mm: 27 },
      { date: "2026-02-25", height_mm: 38 },
      { date: "2026-03-11", height_mm: 51 },
      { date: "2026-03-25", height_mm: 66 },
      { date: "2026-04-08", height_mm: 83 },
      { date: "2026-04-22", height_mm: 102 },
      { date: "2026-05-06", height_mm: 123 },
      { date: "2026-05-20", height_mm: 146 },
      { date: "2026-06-03", height_mm: 170 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-92",
    planting_date: "2025-12-30",
    location: "Rack T1",
    cultivar: "Phalaenopsis (test B)",
    nutrition: "VW medium",
    heights: [
      { date: "2026-01-30", height_mm: 20 },
      { date: "2026-02-13", height_mm: 22 },
      { date: "2026-02-27", height_mm: 24 },
      { date: "2026-03-13", height_mm: 27 },
      { date: "2026-03-27", height_mm: 30 },
      { date: "2026-04-10", height_mm: 33 },
      { date: "2026-04-24", height_mm: 36 },
      { date: "2026-05-08", height_mm: 40 },
      { date: "2026-05-22", height_mm: 44 },
      { date: "2026-06-05", height_mm: 49 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-93",
    planting_date: "2025-12-26",
    location: "Rack T1",
    cultivar: "Dendrobium (test C)",
    nutrition: "MS + banana extract",
    heights: [
      { date: "2026-01-26", height_mm: 16 },
      { date: "2026-02-09", height_mm: 23 },
      { date: "2026-02-23", height_mm: 31 },
      { date: "2026-03-09", height_mm: 40 },
      { date: "2026-03-23", height_mm: 50 },
      { date: "2026-04-06", height_mm: 62 },
      { date: "2026-04-20", height_mm: 75 },
      { date: "2026-05-04", height_mm: 89 },
      { date: "2026-05-18", height_mm: 106 },
      { date: "2026-06-01", height_mm: 128 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-94",
    planting_date: "2025-12-29",
    location: "Rack T1",
    cultivar: "Vanda (test D)",
    nutrition: "VW + peptone",
    heights: [
      { date: "2026-01-29", height_mm: 22 },
      { date: "2026-02-12", height_mm: 32 },
      { date: "2026-02-26", height_mm: 44 },
      { date: "2026-03-12", height_mm: 58 },
      { date: "2026-03-26", height_mm: 74 },
      { date: "2026-04-09", height_mm: 92 },
      { date: "2026-04-23", height_mm: 112 },
      { date: "2026-05-07", height_mm: 134 },
      { date: "2026-05-21", height_mm: 158 },
      { date: "2026-06-04", height_mm: 184 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-95",
    planting_date: "2026-01-02",
    location: "Rack T2",
    cultivar: "Cattleya (test E)",
    nutrition: "Half-strength MS",
    heights: [
      { date: "2026-02-02", height_mm: 15 },
      { date: "2026-02-16", height_mm: 21 },
      { date: "2026-03-02", height_mm: 28 },
      { date: "2026-03-16", height_mm: 36 },
      { date: "2026-03-30", height_mm: 45 },
      { date: "2026-04-13", height_mm: 56 },
      { date: "2026-04-27", height_mm: 69 },
      { date: "2026-05-11", height_mm: 84 },
      { date: "2026-05-25", height_mm: 100 },
      { date: "2026-06-08", height_mm: 118 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-96",
    planting_date: "2026-01-04",
    location: "Rack T2",
    cultivar: "Oncidium (test F)",
    nutrition: "MS + activated charcoal",
    heights: [
      { date: "2026-02-04", height_mm: 18 },
      { date: "2026-02-18", height_mm: 29 },
      { date: "2026-03-04", height_mm: 41 },
      { date: "2026-03-18", height_mm: 55 },
      { date: "2026-04-01", height_mm: 70 },
      { date: "2026-04-15", height_mm: 87 },
      { date: "2026-04-29", height_mm: 106 },
      { date: "2026-05-13", height_mm: 127 },
      { date: "2026-05-27", height_mm: 151 },
      { date: "2026-06-10", height_mm: 178 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-97",
    planting_date: "2026-01-01",
    location: "Rack T2",
    cultivar: "Dendrobium (test G)",
    nutrition: "VW + coconut water",
    heights: [
      { date: "2026-02-01", height_mm: 17 },
      { date: "2026-02-15", height_mm: 23 },
      { date: "2026-03-01", height_mm: 30 },
      { date: "2026-03-15", height_mm: 38 },
      { date: "2026-03-29", height_mm: 47 },
      { date: "2026-04-12", height_mm: 58 },
      { date: "2026-04-26", height_mm: 71 },
      { date: "2026-05-10", height_mm: 86 },
      { date: "2026-05-24", height_mm: 103 },
      { date: "2026-06-07", height_mm: 121 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-98",
    planting_date: "2026-01-06",
    location: "Rack T3",
    cultivar: "Oncidium (test H)",
    nutrition: "MS + casein hydrolysate",
    heights: [
      { date: "2026-02-06", height_mm: 14 },
      { date: "2026-02-20", height_mm: 19 },
      { date: "2026-03-06", height_mm: 25 },
      { date: "2026-03-20", height_mm: 32 },
      { date: "2026-04-03", height_mm: 40 },
      { date: "2026-04-17", height_mm: 49 },
      { date: "2026-05-01", height_mm: 59 },
      { date: "2026-05-15", height_mm: 69 },
      { date: "2026-05-29", height_mm: 78 },
      { date: "2026-06-12", height_mm: 86 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-99",
    planting_date: "2026-01-08",
    location: "Rack T3",
    cultivar: "Cattleya (test I)",
    nutrition: "Half-strength VW",
    heights: [
      { date: "2026-02-08", height_mm: 13 },
      { date: "2026-02-22", height_mm: 15 },
      { date: "2026-03-08", height_mm: 17 },
      { date: "2026-03-22", height_mm: 20 },
      { date: "2026-04-05", height_mm: 23 },
      { date: "2026-04-19", height_mm: 27 },
      { date: "2026-05-03", height_mm: 31 },
      { date: "2026-05-17", height_mm: 36 },
      { date: "2026-05-31", height_mm: 41 },
      { date: "2026-06-14", height_mm: 46 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-100",
    planting_date: "2026-01-10",
    location: "Rack T3",
    cultivar: "Paphiopedilum (test J)",
    nutrition: "MS + low nitrate",
    heights: [
      { date: "2026-02-10", height_mm: 30 },
      { date: "2026-02-24", height_mm: 30 },
      { date: "2026-03-10", height_mm: 30 },
      { date: "2026-03-24", height_mm: 30 },
      { date: "2026-04-07", height_mm: 30 },
      { date: "2026-04-21", height_mm: 30 },
      { date: "2026-05-05", height_mm: 31 },
      { date: "2026-05-19", height_mm: 31 },
      { date: "2026-06-02", height_mm: 31 },
      { date: "2026-06-16", height_mm: 31 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-101",
    planting_date: "2026-01-12",
    location: "Rack T4",
    cultivar: "Vanda (test K)",
    nutrition: "VW + amino acids",
    heights: [
      { date: "2026-02-12", height_mm: 19 },
      { date: "2026-02-26", height_mm: 30 },
      { date: "2026-03-12", height_mm: 43 },
      { date: "2026-03-26", height_mm: 58 },
      { date: "2026-04-09", height_mm: 74 },
      { date: "2026-04-23", height_mm: 92 },
      { date: "2026-05-07", height_mm: 113 },
      { date: "2026-05-21", height_mm: 136 },
      { date: "2026-06-04", height_mm: 158 },
      { date: "2026-06-18", height_mm: 175 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-102",
    planting_date: "2026-01-14",
    location: "Rack T4",
    cultivar: "Paphiopedilum (test L)",
    nutrition: "MS + coconut water",
    heights: [
      { date: "2026-02-14", height_mm: 21 },
      { date: "2026-02-28", height_mm: 27 },
      { date: "2026-03-14", height_mm: 34 },
      { date: "2026-03-28", height_mm: 42 },
      { date: "2026-04-11", height_mm: 51 },
      { date: "2026-04-25", height_mm: 62 },
      { date: "2026-05-09", height_mm: 75 },
      { date: "2026-05-23", height_mm: 90 },
      { date: "2026-06-06", height_mm: 109 },
      { date: "2026-06-20", height_mm: 132 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-103",
    planting_date: "2026-01-16",
    location: "Rack T1",
    cultivar: "Dendrobium (test M)",
    nutrition: "MS + myo-inositol",
    heights: [
      { date: "2026-02-16", height_mm: 24 },
      { date: "2026-03-02", height_mm: 31 },
      { date: "2026-03-16", height_mm: 39 },
      { date: "2026-03-30", height_mm: 48 },
      { date: "2026-04-13", height_mm: 59 },
      { date: "2026-04-27", height_mm: 71 },
      { date: "2026-05-11", height_mm: 85 },
      { date: "2026-05-25", height_mm: 101 },
      { date: "2026-06-08", height_mm: 119 },
      { date: "2026-06-22", height_mm: 140 },
    ],
  }),
  normalizePlantRecord({
    id: "Jar-104",
    planting_date: "2026-01-18",
    location: "Rack T4",
    cultivar: "Cattleya (test N)",
    nutrition: "MS baseline",
    heights: [
      { date: "2026-02-18", height_mm: 28 },
      { date: "2026-03-04", height_mm: 28 },
      { date: "2026-03-18", height_mm: 28 },
      { date: "2026-04-01", height_mm: 28 },
      { date: "2026-04-15", height_mm: 28 },
      { date: "2026-04-29", height_mm: 28 },
      { date: "2026-05-13", height_mm: 28 },
      { date: "2026-05-27", height_mm: 28 },
      { date: "2026-06-10", height_mm: 28 },
      { date: "2026-06-24", height_mm: 28 },
    ],
  }),
].filter(Boolean);
const HISTORY_TEST_MOCK_ID_SET = new Set(
  HISTORY_TEST_MOCK_PLANTS.map((item) => normalizeId(item?.id)).filter(Boolean)
);

const HISTORY_TEST_MOCK_CULTURE = [
  normalizeCultureRecord("Jar-91", {
    jarId: "Jar-91",
    cultureDate: "2025-12-28",
    rackNo: "T1",
    orchidType: "Phalaenopsis (test A)",
    nutrition: "MS + 3% sucrose",
    addHormone: true,
    hormoneDetail: "BA 1.0 mg/L + NAA 0.1 mg/L",
    addSpecialNutrition: true,
    specialNutritionDetail: "Coconut water 10%",
    recultures: [
      { date: "2026-01-24", note: "Hormone: BA 1.0 mg/L + NAA 0.1 mg/L" },
      { date: "2026-02-21", note: "Special nutrition: coconut water 10%" },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-92", {
    jarId: "Jar-92",
    cultureDate: "2025-12-30",
    rackNo: "T1",
    orchidType: "Phalaenopsis (test B)",
    nutrition: "VW medium",
    addHormone: true,
    hormoneDetail: "BA 0.5 mg/L",
    addSpecialNutrition: false,
    recultures: [
      { date: "2026-02-09", note: "Hormone reduced to BA 0.5 mg/L" },
      { date: "2026-03-23", note: "Observed slow growth; pH corrected to 5.6 and medium refreshed." },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-93", {
    jarId: "Jar-93",
    cultureDate: "2025-12-26",
    rackNo: "T1",
    orchidType: "Dendrobium (test C)",
    nutrition: "MS + banana extract",
    addHormone: true,
    hormoneDetail: "Kinetin 0.8 mg/L",
    addSpecialNutrition: true,
    specialNutritionDetail: "Banana extract 5%",
    recultures: [
      { date: "2026-01-31", note: "Special nutrition refreshed: banana extract 5%" },
      { date: "2026-02-28", note: "Hormone maintained at Kinetin 0.8 mg/L" },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-94", {
    jarId: "Jar-94",
    cultureDate: "2025-12-29",
    rackNo: "T1",
    orchidType: "Vanda (test D)",
    nutrition: "VW + peptone",
    addHormone: true,
    hormoneDetail: "BA 1.2 mg/L",
    addSpecialNutrition: true,
    specialNutritionDetail: "Peptone 0.2%",
    recultures: [
      { date: "2026-02-01", note: "Increased BA to 1.2 mg/L" },
      { date: "2026-03-01", note: "Peptone refreshed at 0.2%" },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-95", {
    jarId: "Jar-95",
    cultureDate: "2026-01-02",
    rackNo: "T2",
    orchidType: "Cattleya (test E)",
    nutrition: "Half-strength MS",
    addHormone: false,
    hormoneDetail: "",
    addSpecialNutrition: false,
    recultures: [
      { date: "2026-02-10", note: "No hormone protocol, baseline nutrition kept stable" },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-96", {
    jarId: "Jar-96",
    cultureDate: "2026-01-04",
    rackNo: "T2",
    orchidType: "Oncidium (test F)",
    nutrition: "MS + activated charcoal",
    addHormone: true,
    hormoneDetail: "NAA 0.2 mg/L",
    addSpecialNutrition: false,
    recultures: [
      { date: "2026-02-24", note: "NAA kept at 0.2 mg/L for rooting support" },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-97", {
    jarId: "Jar-97",
    cultureDate: "2026-01-01",
    rackNo: "T2",
    orchidType: "Dendrobium (test G)",
    nutrition: "VW + coconut water",
    addHormone: false,
    hormoneDetail: "",
    addSpecialNutrition: true,
    specialNutritionDetail: "Coconut water 8%",
    recultures: [
      { date: "2026-02-16", note: "Special nutrition: coconut water 8%" },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-98", {
    jarId: "Jar-98",
    cultureDate: "2026-01-06",
    rackNo: "T3",
    orchidType: "Oncidium (test H)",
    nutrition: "MS + casein hydrolysate",
    addHormone: true,
    hormoneDetail: "Kinetin 0.4 mg/L",
    addSpecialNutrition: false,
    recultures: [
      { date: "2026-02-28", note: "Kinetin kept stable at 0.4 mg/L" },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-99", {
    jarId: "Jar-99",
    cultureDate: "2026-01-08",
    rackNo: "T3",
    orchidType: "Cattleya (test I)",
    nutrition: "Half-strength VW",
    addHormone: false,
    hormoneDetail: "",
    addSpecialNutrition: true,
    specialNutritionDetail: "Seaweed extract 0.15%",
    recultures: [
      { date: "2026-03-06", note: "Slow growth observed; seaweed extract added." },
      { date: "2026-04-17", note: "No contamination; maintain slow-growth protocol and monitor." },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-100", {
    jarId: "Jar-100",
    cultureDate: "2026-01-10",
    rackNo: "T3",
    orchidType: "Paphiopedilum (test J)",
    nutrition: "MS + low nitrate",
    addHormone: false,
    hormoneDetail: "",
    addSpecialNutrition: false,
    recultures: [
      { date: "2026-03-10", note: "No visible growth after 60 days; sent for contamination test." },
      { date: "2026-04-21", note: "Still stagnant; planned reculture if unchanged in 14 days." },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-101", {
    jarId: "Jar-101",
    cultureDate: "2026-01-12",
    rackNo: "T4",
    orchidType: "Vanda (test K)",
    nutrition: "VW + amino acids",
    addHormone: true,
    hormoneDetail: "BA 1.1 mg/L",
    addSpecialNutrition: true,
    specialNutritionDetail: "Amino acid mix 0.2%",
    recultures: [
      { date: "2026-03-12", note: "Rapid growth confirmed; continue protocol and monitor spacing." },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-102", {
    jarId: "Jar-102",
    cultureDate: "2026-01-14",
    rackNo: "T4",
    orchidType: "Paphiopedilum (test L)",
    nutrition: "MS + coconut water",
    addHormone: true,
    hormoneDetail: "NAA 0.15 mg/L",
    addSpecialNutrition: true,
    specialNutritionDetail: "Coconut water 6%",
    recultures: [
      { date: "2026-03-14", note: "Growth steady; no intervention required." },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-103", {
    jarId: "Jar-103",
    cultureDate: "2026-01-16",
    rackNo: "T1",
    orchidType: "Dendrobium (test M)",
    nutrition: "MS + myo-inositol",
    addHormone: false,
    hormoneDetail: "",
    addSpecialNutrition: true,
    specialNutritionDetail: "Rice water filtrate 3%",
    recultures: [
      { date: "2026-03-30", note: "Stable normal growth; continue current medium." },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
  normalizeCultureRecord("Jar-104", {
    jarId: "Jar-104",
    cultureDate: "2026-01-18",
    rackNo: "T4",
    orchidType: "Cattleya (test N)",
    nutrition: "MS baseline",
    addHormone: false,
    hormoneDetail: "",
    addSpecialNutrition: false,
    specialNutritionDetail: "",
    recultures: [
      { date: "2026-04-29", note: "No growth trend after 100 days; contamination and pH review started." },
      { date: "2026-05-27", note: "Still stagnant; flagged for urgent reculture decision." },
    ],
    updatedAt: "2026-03-10T00:00:00.000Z",
  }),
].filter(Boolean);

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
  const [liveHistoryRows, setLiveHistoryRows] = useState([]);

  useEffect(() => {
    setPlantsError("");

    const plantsRef = ref(db, "plants");
    const unsubscribe = onValue(
      plantsRef,
      (snap) => {
        const normalized = normalizePlantSnapshot(snap.val());
        const next = ENABLE_HISTORY_TEST_MOCK
          ? mergeUniqueByNormalizedId(normalized, HISTORY_TEST_MOCK_PLANTS, (item) => item?.id)
          : normalized;
        setPlants(next);
        setPlantsError("");
      },
      (err) => {
        const message = err?.message || "Failed to load plant records from Firebase";
        setPlantsError(message);
        setPlants(ENABLE_HISTORY_TEST_MOCK ? HISTORY_TEST_MOCK_PLANTS : []);
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
        const liveEntries = Object.entries(data).map(([key, value]) => normalizeCultureRecord(key, value)).filter(Boolean);
        const next = ENABLE_HISTORY_TEST_MOCK
          ? mergeUniqueByNormalizedId(liveEntries, HISTORY_TEST_MOCK_CULTURE, (item) => item?.jarId)
          : liveEntries;
        setCultureEntries(next);
        setCultureError("");
      },
      (err) => {
        setCultureError(err?.message || "Failed to load culture entries");
        setCultureEntries(ENABLE_HISTORY_TEST_MOCK ? HISTORY_TEST_MOCK_CULTURE : []);
      }
    );

    return () => unsubscribe();
  }, []);

  const cultureMap = useMemo(() => {
    const map = new Map();
    cultureEntries.forEach((entry) => {
      const key = normalizeId(entry?.jarId);
      if (key) map.set(key, entry);
    });
    return map;
  }, [cultureEntries]);
  const plantMap = useMemo(() => {
    const map = new Map();
    plants.forEach((plant) => {
      const key = normalizeId(plant?.id);
      if (key) map.set(key, plant);
    });
    return map;
  }, [plants]);
  const lineageIndex = useMemo(() => buildLineageIndex(cultureEntries), [cultureEntries]);

  const activeCanonicalId = useMemo(() => canonicalPlantId(jarId), [jarId]);
  const activeNormalizedId = useMemo(() => normalizeId(jarId || activeCanonicalId), [jarId, activeCanonicalId]);
  const activeLineageIds = useMemo(
    () => collectLineageIds(activeNormalizedId, lineageIndex),
    [activeNormalizedId, lineageIndex]
  );
  const activeLineageCanonicalIds = useMemo(
    () =>
      Array.from(
        new Set(
          activeLineageIds
            .map((lineageId) => cultureMap.get(lineageId)?.jarId || plantMap.get(lineageId)?.id || lineageId)
            .map((rawId) => canonicalPlantId(rawId))
            .filter(Boolean)
        )
      ),
    [activeLineageIds, cultureMap, plantMap]
  );

  useEffect(() => {
    if (!activeLineageCanonicalIds.length && !activeLineageIds.length) {
      setLiveHistoryRows([]);
      return undefined;
    }

    const activeLineageSet = new Set(activeLineageIds);
    const normalizeRows = (rawObj, fallbackSourceId = "") =>
      Object.values(rawObj || {})
        .map((row) => normalizeHeightEntry(row))
        .filter(Boolean)
        .map((row) => {
          const ts = resolveHeightTimestamp(row);
          if (!Number.isFinite(ts)) return null;
          const sourceAliases = [
            row.jarId,
            row.jar_id,
            row.id,
            row.jar,
            row.jarKey,
            row.plantId,
            row.plant_id,
          ]
            .map((value) => normalizeId(value))
            .filter(Boolean);
          const sourceJarId =
            sourceAliases.find((alias) => activeLineageSet.has(alias)) ||
            sourceAliases[0] ||
            normalizeId(fallbackSourceId) ||
            "";
          return { ...row, ts, sourceJarId };
        })
        .filter(Boolean);

    const byJarRowsBySource = new Map();
    let globalRows = [];

    const mergeAndSet = () => {
      const deduped = new Map();
      const byJarRows = Array.from(byJarRowsBySource.values()).flat();
      [...byJarRows, ...globalRows].forEach((row) => {
        if (!row || !Number.isFinite(row.ts)) return;
        const sourceKey = normalizeId(row.sourceJarId || row.jarId || row.jar_id || row.id || row.plant_id);
        const heightKey = Number(row.height_mm);
        const entryKey = `${sourceKey || "na"}:${row.ts}:${Number.isFinite(heightKey) ? heightKey.toFixed(3) : "na"}`;
        if (!deduped.has(entryKey)) deduped.set(entryKey, row);
      });
      setLiveHistoryRows(Array.from(deduped.values()).sort((a, b) => a.ts - b.ts));
    };

    const unsubs = [];

    activeLineageCanonicalIds.forEach((canonicalId) => {
      const historyRef = fbQuery(ref(db, `growthLogsByJar/${encodeFirebaseKeySegment(canonicalId)}`), limitToLast(300));
      const offByJar = onValue(
        historyRef,
        (snap) => {
          byJarRowsBySource.set(canonicalId, normalizeRows(snap.val(), canonicalId));
          mergeAndSet();
        },
        () => {
          byJarRowsBySource.set(canonicalId, []);
          mergeAndSet();
        }
      );
      unsubs.push(offByJar);
    });

    if (activeLineageSet.size) {
      const globalRef = fbQuery(ref(db, "growthLogs"), limitToLast(1200));
      const offGlobal = onValue(
        globalRef,
        (snap) => {
          const matched = Object.values(snap.val() || {}).filter((row) => {
            if (!row || typeof row !== "object") return false;
            const aliases = [
              row.jarId,
              row.jar_id,
              row.id,
              row.jar,
              row.jarKey,
              row.plantId,
              row.plant_id,
            ]
              .map((value) => normalizeId(value))
              .filter(Boolean);
            return aliases.some((alias) => activeLineageSet.has(alias));
          });

          globalRows = normalizeRows(matched);
          mergeAndSet();
        },
        () => {
          globalRows = [];
          mergeAndSet();
        }
      );
      unsubs.push(offGlobal);
    }

    return () => {
      unsubs.forEach((off) => off && off());
    };
  }, [activeLineageCanonicalIds, activeLineageIds]);

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
      const culture = cultureMap.get(normalizeId(plant.id));
      const location = culture?.rackNo ? `Rack ${culture.rackNo}` : plant.location;
      const planting_date = culture?.cultureDate || plant.planting_date;
      const cultivar = culture?.orchidType || plant.cultivar;
      const nutrition = firstText(culture?.nutrition, plant.nutrition, plant.nutritionStatus);
      const nutritionStatus = firstText(culture?.nutritionStatus, nutrition);
      const recultures = culture?.recultures || [];
      const category = resolvePlantCategory({ category: plant.category, cultivar });
      return { ...plant, location, planting_date, cultivar, nutrition, nutritionStatus, recultures, category };
    });
  }, [cultureMap, plants]);

  const rackPlants = useMemo(() => {
    const term = rackQuery.trim().toLowerCase();
    if (!term) return [];
    return combinedRecords.filter((p) => (p.location || "").toLowerCase().includes(term));
  }, [combinedRecords, rackQuery]);

  const record = useMemo(() => {
    if (!jarId) return null;
    const id = normalizeId(jarId);
    const lineageIds = activeLineageIds.length ? activeLineageIds : (id ? [id] : []);
    const lineageSet = new Set(lineageIds);

    const lineagePlants = plants.filter((plant) => lineageSet.has(normalizeId(plant?.id)));
    const lineageCultures = lineageIds.map((lineageId) => cultureMap.get(lineageId)).filter(Boolean);

    if (!lineagePlants.length && !lineageCultures.length && !liveHistoryRows.length) return null;

    const directPlant = id ? plantMap.get(id) || null : null;
    const directCulture = id ? cultureMap.get(id) || null : null;
    const primaryPlant = directPlant || lineagePlants[0] || null;
    const primaryCulture = directCulture || lineageCultures[0] || null;
    const baseId = primaryCulture?.jarId || primaryPlant?.id || jarId.trim();

    const plantingCandidates = [
      directCulture?.cultureDate,
      directPlant?.planting_date,
      ...lineageCultures.map((entry) => entry?.cultureDate),
      ...lineagePlants.map((plant) => plant?.planting_date),
    ].filter(Boolean);
    const plantingDate = plantingCandidates.length ? [...plantingCandidates].sort()[0] : "";

    const rackLabels = Array.from(
      new Set(
        lineageCultures
          .map((entry) => firstText(entry?.rackNo))
          .filter(Boolean)
          .map((rack) => `Rack ${rack}`)
      )
    );
    const cultivarLabels = Array.from(
      new Set(
        lineageCultures
          .map((entry) => firstText(entry?.orchidType))
          .concat(lineagePlants.map((plant) => firstText(plant?.cultivar)))
          .filter(Boolean)
      )
    );
    const nutritionLabels = Array.from(
      new Set(
        lineageCultures
          .map((entry) => firstText(entry?.nutritionStatus, entry?.nutrition))
          .concat(lineagePlants.map((plant) => firstText(plant?.nutritionStatus, plant?.nutrition)))
          .filter(Boolean)
      )
    );

    const lineageDisplayIds = lineageIds.map(
      (lineageId) => cultureMap.get(lineageId)?.jarId || plantMap.get(lineageId)?.id || lineageId
    );

    const mergedRecultures = lineageCultures
      .flatMap((entry) =>
        (Array.isArray(entry?.recultures) ? entry.recultures : []).map((row) => ({
          ...row,
          note: firstText(row?.note),
          sourceJarId: entry?.jarId,
        }))
      )
      .filter((row) => row?.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map((row) => ({
        ...row,
        note: row.note ? `${row.sourceJarId}: ${row.note}` : `${row.sourceJarId}: Re-culture logged`,
      }));

    return {
      id: baseId,
      heights: lineagePlants.flatMap((plant) =>
        (plant?.heights || []).map((row) => ({ ...row, sourceJarId: plant?.id || "" }))
      ),
      planting_date: plantingDate || firstText(primaryCulture?.cultureDate, primaryPlant?.planting_date),
      location: rackLabels.length ? rackLabels.join(", ") : primaryPlant?.location,
      cultivar:
        cultivarLabels.length > 1 ? `${cultivarLabels[0]} + ${cultivarLabels.length - 1} linked` : cultivarLabels[0],
      nutrition: firstText(primaryCulture?.nutrition, primaryPlant?.nutrition, primaryPlant?.nutritionStatus),
      nutritionStatus: nutritionLabels.length ? nutritionLabels.join(" | ") : "",
      recultures: mergedRecultures,
      lineageIds: lineageDisplayIds,
      lineageCount: lineageDisplayIds.length,
    };
  }, [jarId, activeLineageIds, cultureMap, plantMap, plants, liveHistoryRows]);

  const history = useMemo(() => {
    if (!record) return [];
    const baseRows = (record.heights || [])
      .map((h) => {
        const ts = resolveHeightTimestamp(h);
        return { ...h, ts: Number.isFinite(ts) ? ts : null, sourceJarId: h?.sourceJarId || record.id };
      })
      .filter((h) => h.ts !== null);

    const byTs = new Map();
    baseRows.forEach((row) => {
      const sourceKey = normalizeId(row.sourceJarId || row.jarId || row.jar_id || row.id);
      const heightKey = Number(row.height_mm);
      const key = `${sourceKey || "na"}:${row.ts}:${Number.isFinite(heightKey) ? heightKey.toFixed(3) : "na"}`;
      byTs.set(key, row);
    });
    liveHistoryRows.forEach((row) => {
      if (row?.ts === null || row?.ts === undefined) return;
      const sourceKey = normalizeId(row.sourceJarId || row.jarId || row.jar_id || row.id);
      const heightKey = Number(row.height_mm);
      const key = `${sourceKey || "na"}:${row.ts}:${Number.isFinite(heightKey) ? heightKey.toFixed(3) : "na"}`;
      byTs.set(key, row);
    });

    return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
  }, [record, liveHistoryRows]);

  const historyStats = useMemo(() => {
    if (!history.length) return null;
    const points = history.map((row) => toValidPoint(row.ts, row.height_mm)).filter(Boolean);
    if (!points.length) return null;
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
  const rackCategoryStats = useMemo(() => buildRackCategoryStats(rackPlants), [rackPlants]);
  const rackInsight = useMemo(
    () => buildRackInsight({ rackStats, rackQuery, categoryStats: rackCategoryStats }),
    [rackStats, rackQuery, rackCategoryStats]
  );
  const rackBrief = useMemo(
    () => buildRackBrief({ rackStats, rackQuery, categoryStats: rackCategoryStats }),
    [rackStats, rackQuery, rackCategoryStats]
  );
  const [includeRackInsight, setIncludeRackInsight] = useState(true);
  const [rackReportInsight, setRackReportInsight] = useState("");
  const clusterSelectionIds = useMemo(() => {
    const set = new Set();
    (compareIds || []).forEach((id) => {
      const key = normalizeId(id);
      if (key) set.add(key);
    });
    if (record?.id) {
      const key = normalizeId(record.id);
      if (key) set.add(key);
    }
    if ((rackQuery || "").trim()) {
      (rackPlants || []).forEach((plant) => {
        const key = normalizeId(plant?.id);
        if (key) set.add(key);
      });
    }
    return set;
  }, [compareIds, record, rackQuery, rackPlants]);
  const hasClusterScope = clusterSelectionIds.size > 0;
  const clusterResult = useMemo(
    () => {
      if (!hasClusterScope) {
        return {
          ready: false,
          reason: "Select a rack or jar to view growth clustering.",
          assignments: [],
          counts: {},
          mode: "kmeans",
          note: "",
          iterations: 0,
          totalJars: 0,
          sourceLabel: "no active selection",
        };
      }
      return buildGrowthClusterResult(combinedRecords, {
        mockIdSet: HISTORY_TEST_MOCK_ID_SET,
        includeIdSet: clusterSelectionIds,
      });
    },
    [combinedRecords, clusterSelectionIds, hasClusterScope]
  );
  const globalGrowthFeatures = useMemo(() => buildJarClusterFeatures(combinedRecords), [combinedRecords]);
  const heroWarnings = useMemo(() => {
    return buildGrowthAttentionWarnings(globalGrowthFeatures);
  }, [globalGrowthFeatures]);

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
      <Hero warnings={heroWarnings} />
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
          rackCategoryStats={rackCategoryStats}
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
          placeholder="Ask about category growth, best/worst, or suggestions..."
          onReportTextChange={setRackReportInsight}
          onAsk={(question) =>
            answerRackQuestion({
              question,
              rackStats,
              rackQuery,
              categoryStats: rackCategoryStats,
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
        {hasClusterScope ? <GrowthClusterPanel clusterResult={clusterResult} /> : null}
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

    const normalizedTerm = normalizeId(term);
    const match = demoIds.find((id) => normalizeId(id) === normalizedTerm);
    if (match) {
      setJarId(match);
      setStatus(`Loaded ${match} from Firebase.`);
    } else {
      // Allow direct lookup even when the ID is not in preloaded demo lists.
      setJarId(term);
      setStatus(`Searching ${term} in live history...`);
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
              Loaded <span className="font-semibold">{record.id}</span> - {history.length} measurements - Cultivar {record.cultivar || "-"}
              {record.lineageCount > 1 ? ` - Lineage jars: ${record.lineageCount}` : ""}
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
  const pieCanvasRef = useRef(null);
  const pieChartRef = useRef(null);
  const cleanedPoints = useMemo(() => {
    const rawPoints = history
      .map((row) => toValidPoint(row.ts, row.height_mm))
      .filter(Boolean)
      .sort((a, b) => a.x - b.x);
    if (!rawPoints.length) return [];

    // Keep only the latest reading per day to reduce visual noise.
    const byDay = new Map();
    rawPoints.forEach((point) => {
      const dayKey = new Date(point.x).toISOString().slice(0, 10);
      const prev = byDay.get(dayKey);
      if (!prev || point.x >= prev.x) {
        byDay.set(dayKey, point);
      }
    });
    let points = Array.from(byDay.values()).sort((a, b) => a.x - b.x);

    // Drop placeholder zeros when enough real measurements exist.
    const nonZero = points.filter((point) => point.y > 0.5);
    if (nonZero.length >= Math.max(3, Math.floor(points.length * 0.25))) {
      points = nonZero;
    }

    // Remove isolated sensor spikes/dips that immediately revert.
    if (points.length >= 6) {
      points = points.filter((point, idx, arr) => {
        if (idx === 0 || idx === arr.length - 1) return true;
        const prev = arr[idx - 1];
        const next = arr[idx + 1];
        const prevGapDays = Math.max((point.x - prev.x) / DAY_MS, 1 / 24);
        const nextGapDays = Math.max((next.x - point.x) / DAY_MS, 1 / 24);
        const slopeToPrev = Math.abs(point.y - prev.y) / prevGapDays;
        const slopeToNext = Math.abs(next.y - point.y) / nextGapDays;
        const midpoint = (prev.y + next.y) / 2;
        const deviation = Math.abs(point.y - midpoint);
        const neighborSpread = Math.abs(next.y - prev.y);
        const isSpike = deviation > 18 && neighborSpread < 12 && slopeToPrev > 40 && slopeToNext > 40;
        return !isSpike;
      });
    }

    // Downsample very dense series for readability.
    const maxPoints = 120;
    if (points.length > maxPoints) {
      const stride = Math.ceil(points.length / maxPoints);
      points = points.filter((_, idx) => idx % stride === 0 || idx === points.length - 1);
    }

    return points;
  }, [history]);
  const chartPoints = useMemo(() => {
    if (cleanedPoints.length < 5) return cleanedPoints;
    const windowRadius = cleanedPoints.length > 30 ? 2 : 1;
    return cleanedPoints.map((point, idx, arr) => {
      const start = Math.max(0, idx - windowRadius);
      const end = Math.min(arr.length - 1, idx + windowRadius);
      const ys = arr
        .slice(start, end + 1)
        .map((p) => p.y)
        .sort((a, b) => a - b);
      const median = ys[Math.floor(ys.length / 2)];
      return { x: point.x, y: Number(median.toFixed(2)) };
    });
  }, [cleanedPoints]);
  const nutritionEvents = useMemo(() => {
    if (!record) return [];

    const baseNutrition = firstText(record?.nutritionStatus, record?.nutrition);
    const events = [];
    const pushEvent = ({ ts, label, nutritionText }) => {
      if (!Number.isFinite(ts)) return;
      events.push({ ts, label, nutritionText: firstText(nutritionText, baseNutrition) });
    };

    const cultureTs = Date.parse(record?.planting_date || "");
    if (Number.isFinite(cultureTs)) {
      pushEvent({
        ts: cultureTs,
        label: "Culture start",
        nutritionText: baseNutrition,
      });
    }

    (record?.recultures || []).forEach((row, idx) => {
      const ts = Date.parse(row?.date || "");
      if (!Number.isFinite(ts)) return;
      pushEvent({
        ts,
        label: `Re-culture ${idx + 1}`,
        nutritionText: firstText(row?.note, baseNutrition),
      });
    });

    const byDay = new Map();
    events
      .sort((a, b) => a.ts - b.ts)
      .forEach((event) => {
        const dayKey = new Date(event.ts).toISOString().slice(0, 10);
        if (!byDay.has(dayKey)) byDay.set(dayKey, event);
      });

    return Array.from(byDay.values());
  }, [record]);
  const nutritionMarkers = useMemo(() => {
    if (!nutritionEvents.length || !cleanedPoints.length) return [];
    return nutritionEvents.map((event) => {
      let nearest = cleanedPoints[0];
      let minDiff = Math.abs(cleanedPoints[0].x - event.ts);
      for (let i = 1; i < cleanedPoints.length; i += 1) {
        const diff = Math.abs(cleanedPoints[i].x - event.ts);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = cleanedPoints[i];
        }
      }
      return {
        x: event.ts,
        y: nearest.y,
        label: event.label,
        nutritionText: event.nutritionText,
      };
    });
  }, [nutritionEvents, cleanedPoints]);
  const nutritionImpactRows = useMemo(() => {
    if (!nutritionMarkers.length || cleanedPoints.length < 3) return [];

    const windowMs = 14 * DAY_MS;
    const computeRate = (points) => {
      if (!points || points.length < 2) return null;
      const first = points[0];
      const last = points[points.length - 1];
      const days = (last.x - first.x) / DAY_MS;
      if (!Number.isFinite(days) || days <= 0) return null;
      return (last.y - first.y) / days;
    };

    return nutritionMarkers.map((event) => {
      const before = cleanedPoints.filter((point) => point.x >= event.x - windowMs && point.x <= event.x);
      const after = cleanedPoints.filter((point) => point.x >= event.x && point.x <= event.x + windowMs);
      const beforeRate = computeRate(before);
      const afterRate = computeRate(after);
      const beforeDays =
        before.length >= 2 ? Math.max(0, (before[before.length - 1].x - before[0].x) / DAY_MS) : 0;
      const afterDays =
        after.length >= 2 ? Math.max(0, (after[after.length - 1].x - after[0].x) / DAY_MS) : 0;
      const afterDelta =
        after.length >= 2 ? Number(after[after.length - 1].y) - Number(after[0].y) : null;
      const rateDelta =
        beforeRate !== null && afterRate !== null ? Number((afterRate - beforeRate).toFixed(4)) : null;
      const outcome =
        rateDelta === null
          ? "insufficient"
          : Math.abs(rateDelta) < 0.05
            ? "no_clear_change"
            : rateDelta > 0
              ? "improved"
              : "slowed";
      const confidence =
        before.length >= 4 && after.length >= 4 && beforeDays >= 7 && afterDays >= 7
          ? "High"
          : before.length >= 3 && after.length >= 3 && beforeDays >= 4 && afterDays >= 4
            ? "Medium"
            : "Low";
      const effectText = (() => {
        if (beforeRate === null && afterRate === null) return "Not enough data around this change.";
        if (beforeRate === null && afterRate !== null) return `After change: ${afterRate.toFixed(2)} mm/day`;
        if (beforeRate !== null && afterRate === null) return `Before change: ${beforeRate.toFixed(2)} mm/day`;
        const diff = rateDelta;
        if (Math.abs(diff) < 0.05) return "Growth rate stayed almost the same.";
        return diff > 0
          ? `Growth got faster by ${diff.toFixed(2)} mm/day`
          : `Growth slowed by ${Math.abs(diff).toFixed(2)} mm/day`;
      })();

      return {
        ...event,
        beforeRate,
        afterRate,
        afterDelta,
        rateDelta,
        outcome,
        confidence,
        beforeCount: before.length,
        afterCount: after.length,
        effectText,
      };
    });
  }, [nutritionMarkers, cleanedPoints]);
  const segmentSeries = useMemo(() => {
    if (chartPoints.length < 2) return [];
    const startX = chartPoints[0].x;
    const endX = chartPoints[chartPoints.length - 1].x;
    const cuts = nutritionEvents
      .map((event) => Number(event.ts))
      .filter((ts) => Number.isFinite(ts) && ts > startX && ts < endX)
      .sort((a, b) => a - b);
    const boundaries = [startX, ...cuts, endX];
    const nextSegments = [];

    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const segStart = boundaries[i];
      const segEnd = boundaries[i + 1];
      let segmentPoints = chartPoints.filter((point) =>
        i === boundaries.length - 2 ? point.x >= segStart && point.x <= segEnd : point.x >= segStart && point.x < segEnd
      );
      if (!segmentPoints.length) continue;

      if (i > 0) {
        const prevLast = nextSegments[nextSegments.length - 1]?.points?.slice(-1)[0];
        if (prevLast && segmentPoints[0]?.x !== prevLast.x) {
          segmentPoints = [prevLast, ...segmentPoints];
        }
      }

      const stats = computeSeriesStats(segmentPoints);
      const rate = stats?.rate ?? null;
      const prevRate = nextSegments.length ? nextSegments[nextSegments.length - 1].rate : null;
      const deltaVsPrev = prevRate !== null && rate !== null ? rate - prevRate : null;
      const outcome =
        deltaVsPrev === null
          ? "baseline"
          : Math.abs(deltaVsPrev) < 0.08
            ? "no_clear_change"
            : deltaVsPrev > 0
              ? "improved"
              : "slowed";
      const eventLabel = i === 0 ? "Baseline" : firstText(nutritionEvents[i - 1]?.label, `Change ${i}`);
      nextSegments.push({
        idx: i,
        points: segmentPoints,
        rate,
        prevRate,
        deltaVsPrev,
        outcome,
        label: eventLabel,
      });
    }
    return nextSegments;
  }, [chartPoints, nutritionEvents]);
  const impactPieData = useMemo(() => {
    if (!nutritionImpactRows.length) return null;
    const counts = {
      improved: 0,
      slowed: 0,
      no_clear_change: 0,
      insufficient: 0,
    };
    nutritionImpactRows.forEach((row) => {
      if (Object.prototype.hasOwnProperty.call(counts, row.outcome)) counts[row.outcome] += 1;
      else counts.insufficient += 1;
    });
    const total = counts.improved + counts.slowed + counts.no_clear_change + counts.insufficient;
    if (!total) return null;
    return {
      labels: ["Improved", "Slowed", "No clear change", "Insufficient data"],
      values: [counts.improved, counts.slowed, counts.no_clear_change, counts.insufficient],
      colors: ["#16a34a", "#dc2626", "#64748b", "#f59e0b"],
      total,
    };
  }, [nutritionImpactRows]);
  const seriesStats = useMemo(() => {
    if (!cleanedPoints.length) return null;
    return computeSeriesStats(cleanedPoints);
  }, [cleanedPoints]);
  const qualityWarnings = useMemo(() => {
    const warnings = [];
    if (!cleanedPoints.length) {
      warnings.push("No valid measurements available for analysis.");
      return warnings;
    }
    if (cleanedPoints.length < 3) {
      warnings.push(`Only ${cleanedPoints.length} valid point(s) available; trend and intervention impact are not reliable yet.`);
    }
    if (seriesStats?.days !== null && seriesStats?.days < 7) {
      warnings.push("Observed time span is under 7 days; medium-term effects may not be visible.");
    }
    if (nutritionEvents.length && !nutritionImpactRows.length) {
      warnings.push("Culture/nutrition change events exist but there is not enough before/after data for impact scoring.");
    } else if (nutritionImpactRows.some((row) => row.confidence === "Low")) {
      warnings.push("Some intervention effects are low confidence due to sparse nearby measurements.");
    }
    return warnings;
  }, [cleanedPoints, seriesStats, nutritionEvents, nutritionImpactRows]);

  const timeSpanText = useMemo(() => {
    if (!seriesStats || seriesStats.days === null) return "-";
    if (seriesStats.days < 1) return `${(seriesStats.days * 24).toFixed(1)} hrs`;
    return seriesStats.days < 10 ? `${seriesStats.days.toFixed(1)} days` : `${seriesStats.days.toFixed(0)} days`;
  }, [seriesStats]);

  const growthRateText = useMemo(() => {
    if (!seriesStats || seriesStats.rate === null || !Number.isFinite(seriesStats.rate)) return "-";
    if (seriesStats.days !== null && seriesStats.days < 0.25) return "-";
    return `${seriesStats.rate.toFixed(2)} mm/day`;
  }, [seriesStats]);

  const reportDateRows = useMemo(
    () => cleanedPoints.map((point) => [formatDate(point.x), `${Number(point.y).toFixed(1)} mm`]),
    [cleanedPoints]
  );
  const reportNutritionRows = useMemo(
    () =>
      nutritionImpactRows.map((event) => [
        event.label,
        formatDate(event.x),
        event.nutritionText || "-",
        event.beforeRate !== null ? `${event.beforeRate.toFixed(2)} mm/day` : "n/a",
        event.afterRate !== null ? `${event.afterRate.toFixed(2)} mm/day` : "n/a",
        event.afterDelta !== null ? `${event.afterDelta >= 0 ? "+" : ""}${event.afterDelta.toFixed(1)} mm` : "n/a",
        event.confidence,
        event.outcome === "improved"
          ? "Improved"
          : event.outcome === "slowed"
            ? "Slowed"
            : event.outcome === "no_clear_change"
              ? "No clear change"
              : "Insufficient data",
      ]),
    [nutritionImpactRows]
  );

  const handleReport = () => {
    if (!cleanedPoints.length) return;
    const chartImage = chartRef.current?.toBase64Image?.();
    const statsRows = [
      ["Jar ID", record?.id || "-"],
      ["Lineage jars", record?.lineageCount ? String(record.lineageCount) : "1"],
      ["Planting date", record?.planting_date || "-"],
      ["Location", record?.location || "-"],
      ["Cultivar", record?.cultivar || "-"],
      ["Nutrition status", record?.nutritionStatus || record?.nutrition || "-"],
      ["Measurements", cleanedPoints.length ? `${cleanedPoints.length} entries` : "0"],
      ["Average height", seriesStats?.avg !== null ? `${seriesStats.avg.toFixed(1)} mm` : "-"],
      ["Change", seriesStats?.delta !== null ? `${seriesStats.delta >= 0 ? "+" : ""}${seriesStats.delta.toFixed(1)} mm` : "-"],
      ["Growth rate", growthRateText],
    ];

    const sections = [
      { heading: "Summary", content: renderKeyValueTable(statsRows) },
      { heading: "Measurements", content: renderDataTable(["Date", "Height"], reportDateRows) },
    ];
    if (reportNutritionRows.length) {
      sections.splice(1, 0, {
        heading: "Nutrition / culture changes",
        content: renderDataTable(
          ["Event", "Date", "Nutrition", "Before rate", "After rate", "After 14d change", "Confidence", "Outcome"],
          reportNutritionRows
        ),
      });
    }
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
    if (!chartPoints.length || !canvasRef.current) return;

    const theme = chartTheme(isLight);
    const dataMax = Math.max(...chartPoints.map((point) => point.y));
    const yMax = (() => {
      const maxVal = Math.max(50, Number.isFinite(dataMax) ? dataMax : 0);
      return Math.ceil((maxVal + 10) / 25) * 25;
    })();
    const pointRadius = chartPoints.length > 60 ? 0 : chartPoints.length > 24 ? 1.6 : 2.4;
    const segmentColor = (outcome) => {
      if (outcome === "improved") return "#16a34a";
      if (outcome === "slowed") return "#dc2626";
      if (outcome === "no_clear_change") return "#64748b";
      return "#f97316";
    };
    const segmentedDatasets = segmentSeries.map((segment, idx) => {
      const color = segmentColor(segment.outcome);
      const suffix =
        segment.outcome === "improved"
          ? "improved"
          : segment.outcome === "slowed"
            ? "slowed"
            : segment.outcome === "no_clear_change"
              ? "stable"
              : "baseline";
      return {
        label: `${segment.label} (${suffix})`,
        data: segment.points,
        borderColor: color,
        backgroundColor: `${color}1a`,
        tension: 0.22,
        cubicInterpolationMode: "monotone",
        borderWidth: idx === 0 ? 2.6 : 2.4,
        pointRadius,
        pointHoverRadius: pointRadius ? 4 : 3,
        pointBackgroundColor: color,
        pointBorderColor: "#fff7ed",
        pointBorderWidth: 1,
        fill: false,
        spanGaps: true,
      };
    });
    const datasets = segmentedDatasets.length
      ? segmentedDatasets
      : [
          {
            label: record?.id || "Height",
            data: chartPoints,
            borderColor: "#f97316",
            backgroundColor: "rgba(249, 115, 22, 0.08)",
            tension: 0.22,
            cubicInterpolationMode: "monotone",
            borderWidth: 2.4,
            pointRadius,
            pointHoverRadius: pointRadius ? 4 : 3,
            pointBackgroundColor: "#ea580c",
            pointBorderColor: "#fff7ed",
            pointBorderWidth: 1,
            fill: false,
            spanGaps: true,
          },
        ];
    if (nutritionMarkers.length) {
      datasets.push({
        type: "scatter",
        label: "Nutrition/culture changes",
        data: nutritionMarkers,
        pointRadius: 5.5,
        pointHoverRadius: 7,
        pointStyle: "triangle",
        pointBackgroundColor: "#0284c7",
        pointBorderColor: "#f8fafc",
        pointBorderWidth: 1.4,
        showLine: false,
      });
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { intersect: false, mode: "nearest" },
        scales: {
          x: {
            type: "timeseries",
            time: {
              unit: "day",
              tooltipFormat: "MMM d, yyyy HH:mm",
              displayFormats: {
                hour: "MMM d, HH:mm",
                day: "MMM d",
                week: "MMM d",
                month: "MMM yyyy",
              },
            },
            grid: { color: theme.grid },
            ticks: { color: theme.ticks, maxTicksLimit: 9, maxRotation: 0 },
            title: { display: true, text: "Time", color: theme.axis },
          },
          y: {
            beginAtZero: true,
            max: yMax,
            grid: { color: theme.grid },
            ticks: { color: theme.ticks, maxTicksLimit: 7 },
            title: { display: true, text: "Plant height (mm)", color: theme.axis },
          },
        },
        plugins: {
          legend: {
            display: segmentedDatasets.length > 1,
            position: "bottom",
            labels: {
              color: theme.axis,
              usePointStyle: true,
              pointStyle: "line",
              boxWidth: 26,
            },
          },
          tooltip: {
            intersect: false,
            mode: "nearest",
            callbacks: {
              label: (ctx) => {
                if (ctx.dataset?.label === "Nutrition/culture changes") {
                  const label = firstText(ctx.raw?.label, "Change");
                  return `${label}: ${Number(ctx.parsed.y).toFixed(1)} mm`;
                }
                return `${ctx.dataset.label}: ${ctx.parsed.y} mm`;
              },
              afterLabel: (ctx) => {
                if (ctx.dataset?.label === "Nutrition/culture changes") {
                  const nutritionText = firstText(ctx.raw?.nutritionText);
                  return nutritionText ? `Nutrition: ${nutritionText}` : "";
                }
                return "";
              },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [chartPoints, segmentSeries, nutritionMarkers, record?.id, isLight]);
  useEffect(() => {
    if (pieChartRef.current) {
      pieChartRef.current.destroy();
      pieChartRef.current = null;
    }
    if (!impactPieData || !pieCanvasRef.current) return;

    const theme = chartTheme(isLight);
    pieChartRef.current = new Chart(pieCanvasRef.current, {
      type: "pie",
      data: {
        labels: impactPieData.labels,
        datasets: [
          {
            data: impactPieData.values,
            backgroundColor: impactPieData.colors,
            borderColor: isLight ? "#ffffff" : "#0f172a",
            borderWidth: 1.2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: theme.axis,
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: "circle",
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = Number(ctx.parsed);
                const pct = impactPieData.total ? (val / impactPieData.total) * 100 : 0;
                return `${ctx.label}: ${val} (${pct.toFixed(0)}%)`;
              },
            },
          },
        },
      },
    });

    return () => {
      pieChartRef.current?.destroy();
    };
  }, [impactPieData, isLight]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="kicker">Growth curves</p>
          <h3 className="text-xl font-semibold text-dark">Height over time</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-subtle">{cleanedPoints.length} points</span>
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
              {timeSpanText}
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
              {growthRateText}
            </p>
          </div>
        </div>
      )}
      {qualityWarnings.length ? (
        <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-800 dark:text-amber-200 space-y-1">
          <p className="font-semibold">Data quality notes</p>
          {qualityWarnings.map((warning, idx) => (
            <p key={`${warning}-${idx}`}>- {warning}</p>
          ))}
        </div>
      ) : null}
      {nutritionImpactRows.length ? (
        <div className="panel-muted px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.18em] text-subtle">Nutrition change impact</p>
            <span className="text-[11px] text-subtle">{nutritionImpactRows.length} event(s)</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 max-h-52 overflow-auto pr-1">
            {nutritionImpactRows.map((event) => (
              <div key={`${event.label}-${event.x}`} className="rounded-xl border border-border/40 bg-paper/80 px-3 py-2">
                <p className="text-xs font-semibold text-dark">
                  {event.label} - {formatDate(event.x)}
                </p>
                <p className="text-[11px] text-subtle">
                  Nutrition: {event.nutritionText || "-"}
                </p>
                <p className="text-[11px] text-subtle">
                  {event.effectText}
                  {event.afterDelta !== null ? ` | 14-day height change: ${event.afterDelta >= 0 ? "+" : ""}${event.afterDelta.toFixed(1)} mm` : ""}
                </p>
                <p className="text-[11px] text-subtle">
                  Confidence:{" "}
                  <span
                    className={`font-semibold ${
                      event.confidence === "High"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : event.confidence === "Medium"
                          ? "text-sky-700 dark:text-sky-300"
                          : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {event.confidence}
                  </span>
                  {` (before ${event.beforeCount} pts, after ${event.afterCount} pts)`}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className={`grid gap-4 ${impactPieData ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <div className="h-80">
          {cleanedPoints.length ? (
            <canvas ref={canvasRef} />
          ) : (
            <EmptyState message="No measurements yet. Choose a Jar ID to see the line chart." />
          )}
        </div>
        {impactPieData ? (
          <div className="panel-muted px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-subtle">Intervention outcomes</p>
              <span className="text-[11px] text-subtle">{impactPieData.total} events</span>
            </div>
            <div className="h-56">
              <canvas ref={pieCanvasRef} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-border/35 bg-paper/80 px-2 py-1.5 text-subtle">
                Improved: <span className="font-semibold text-emerald-700 dark:text-emerald-300">{impactPieData.values[0]}</span>
              </div>
              <div className="rounded-lg border border-border/35 bg-paper/80 px-2 py-1.5 text-subtle">
                Slowed: <span className="font-semibold text-rose-700 dark:text-rose-300">{impactPieData.values[1]}</span>
              </div>
              <div className="rounded-lg border border-border/35 bg-paper/80 px-2 py-1.5 text-subtle">
                No clear change: <span className="font-semibold text-slate-700 dark:text-slate-300">{impactPieData.values[2]}</span>
              </div>
              <div className="rounded-lg border border-border/35 bg-paper/80 px-2 py-1.5 text-subtle">
                Insufficient: <span className="font-semibold text-amber-700 dark:text-amber-300">{impactPieData.values[3]}</span>
              </div>
            </div>
          </div>
        ) : null}
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
        .map((h) => toValidPoint(Date.parse(h.date), h.height_mm))
        .filter((p) => p !== null && (cutoffMs === null || p.x >= cutoffMs))
        .sort((a, b) => a.x - b.x);
      if (!sorted.length) return;

      const color = palette[idx % palette.length];
      nextDatasets.push({
        label: id,
        data: sorted,
        borderColor: color,
        backgroundColor: `${color}33`,
        tension: 0.38,
        cubicInterpolationMode: "monotone",
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
    const hasDelta = datasets.some((dataset) => dataset.yAxisID === "yDelta");
    chartRef.current = new Chart(canvasRef.current, {
      type: "line",
      data: { datasets },
      plugins: [rackEndLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: { mode: "index", intersect: false },
        layout: {
          padding: { right: 140 },
        },
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

function RackChart({
  rackPlants,
  rackQuery,
  rackHintString,
  isLight,
  rackStats,
  rackCategoryStats,
  reportInsightText,
  includeInsight,
}) {
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
    if (rackCategoryStats?.length) {
      const categoryRows = rackCategoryStats.map((item) => [
        item.category,
        `${item.plantCount}`,
        item.avgDelta !== null ? `${item.avgDelta.toFixed(1)} mm` : "n/a",
        item.avgRate !== null ? `${item.avgRate.toFixed(2)} mm/day` : "n/a",
        item.suggestion,
      ]);
      sections.push({
        heading: "Category growth-change comparison",
        content: renderDataTable(["Category", "Jars", "Avg change", "Avg rate", "Suggestion"], categoryRows),
      });
    }
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
    const palette = ["#0f172a", "#dc2626", "#2563eb", "#16a34a", "#d97706", "#9333ea", "#0ea5e9", "#e11d48"];
    const dashPatterns = [[], [10, 6], [3, 5], [14, 4, 3, 4], [2, 4], [8, 4]];
    const pointStyles = ["circle", "rectRot", "triangle", "rectRounded", "crossRot", "star"];

    const mainSeries = rackPlants
      .map((plant, idx) => {
        const sorted = (plant.heights || [])
          .map((h) => toValidPoint(Date.parse(h.date), h.height_mm))
          .filter((p) => p !== null)
          .sort((a, b) => a.x - b.x);

        if (!sorted.length) return null;
        const color = palette[idx % palette.length];
        return {
          label: plant.id,
          data: sorted,
          borderColor: color,
          backgroundColor: `${color}26`,
          borderDash: dashPatterns[idx % dashPatterns.length],
          tension: 0.36,
          cubicInterpolationMode: "monotone",
          borderWidth: idx === 0 ? 3.2 : 2.6,
          pointRadius: idx === 0 ? 4.8 : 4,
          pointHoverRadius: 7,
          pointStyle: pointStyles[idx % pointStyles.length],
          pointBackgroundColor: color,
          pointBorderColor: "#ffffff",
          pointBorderWidth: 1.3,
          fill: false,
          yAxisID: "y",
          order: 2,
        };
      })
      .filter(Boolean);

    if (mainSeries.length <= 1) return mainSeries;

    const baseline = mainSeries[0];
    const baselineMap = new Map(
      (baseline.data || [])
        .map((point) => [Number(point.x), Number(point.y)])
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))
    );

    const deltaSeries = mainSeries
      .slice(1)
      .map((series) => {
        const deltaData = (series.data || [])
          .map((point) => {
            const x = Number(point.x);
            const y = Number(point.y);
            const baseY = baselineMap.get(x);
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(baseY)) return null;
            return { x, y: Number((y - baseY).toFixed(2)) };
          })
          .filter(Boolean);

        if (deltaData.length < 2) return null;
        return {
          label: `Δ ${series.label} vs ${baseline.label}`,
          data: deltaData,
          borderColor: series.borderColor,
          borderDash: [3, 6],
          borderWidth: 1.8,
          pointRadius: 0,
          tension: 0.28,
          cubicInterpolationMode: "monotone",
          fill: false,
          yAxisID: "yDelta",
          order: 1,
        };
      })
      .filter(Boolean);

    return [...mainSeries, ...deltaSeries];
  }, [rackPlants]);

  const deltaMaxAbs = useMemo(() => {
    const absValues = datasets
      .filter((dataset) => dataset.yAxisID === "yDelta")
      .flatMap((dataset) => (dataset.data || []).map((point) => Math.abs(Number(point.y))))
      .filter((value) => Number.isFinite(value));
    if (!absValues.length) return 5;
    const maxVal = Math.max(...absValues, 1);
    return Math.ceil((maxVal + 0.5) / 1) * 1;
  }, [datasets]);
  const jarLineCount = useMemo(
    () => datasets.filter((dataset) => dataset.yAxisID !== "yDelta").length,
    [datasets]
  );
  const deltaLineCount = useMemo(
    () => datasets.filter((dataset) => dataset.yAxisID === "yDelta").length,
    [datasets]
  );
  const hasDelta = useMemo(() => deltaLineCount > 0, [deltaLineCount]);

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
          ...(hasDelta
            ? {
                yDelta: {
                  position: "right",
                  min: -deltaMaxAbs,
                  max: deltaMaxAbs,
                  grid: { drawOnChartArea: false, color: "rgba(148,163,184,0.15)" },
                  ticks: {
                    color: theme.ticks,
                    callback: (value) => `${Number(value).toFixed(1)}`,
                  },
                  title: { display: true, text: "Delta vs baseline (mm)", color: theme.axis },
                },
              }
            : {}),
        },
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: {
              color: theme.axis,
              usePointStyle: true,
              pointStyle: "line",
              boxWidth: 30,
            },
          },
          rackEndLabels: {
            enabled: true,
            minGap: 16,
            haloColor: isLight ? "rgba(255,255,255,0.95)" : "rgba(15,23,42,0.85)",
          },
          tooltip: {
            mode: "index",
            callbacks: {
              title: (items) => {
                const ts = items[0]?.parsed?.x;
                return ts ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(ts) : "";
              },
              label: (ctx) => {
                const value = Number(ctx.parsed.y);
                if (ctx.dataset.yAxisID === "yDelta") {
                  return `${ctx.dataset.label}: ${value >= 0 ? "+" : ""}${value.toFixed(2)} mm`;
                }
                return `${ctx.dataset.label}: ${value.toFixed(1)} mm`;
              },
            },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
    };
  }, [datasets, isLight, deltaMaxAbs]);

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
          <p className="text-sm text-subtle">
            Solid lines show jar heights. Dashed lines show differences vs the first jar. Category cards summarize growth change and actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-subtle">
            {jarLineCount
              ? `${jarLineCount} jar${jarLineCount > 1 ? "s" : ""}${deltaLineCount ? ` + ${deltaLineCount} delta line${deltaLineCount > 1 ? "s" : ""}` : ""}`
              : rackQuery
                ? "No matches"
                : "Waiting"}
          </span>
          <button type="button" onClick={handleReport} className="btn-soft text-xs px-3 py-1.5">
            Report
          </button>
        </div>
      </div>
      {rackQuery && rackCategoryStats?.length ? (
        <div className="panel-muted px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-subtle">Growth change by plant category</p>
            <span className="text-[11px] text-subtle">{rackCategoryStats.length} categories</span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
            {(rackCategoryStats || []).map((item) => (
              <div key={item.category} className="rounded-xl border border-border/45 bg-paper/80 px-3 py-2 text-xs text-dark">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{item.category}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${
                      item.growthLabel === "fast"
                        ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-700"
                        : item.growthLabel === "slow"
                          ? "border-rose-300/70 bg-rose-500/10 text-rose-700"
                          : item.growthLabel === "moderate"
                            ? "border-amber-300/70 bg-amber-500/10 text-amber-700"
                            : "border-slate-300/70 bg-slate-500/10 text-slate-700"
                    }`}
                  >
                    {item.growthLabel}
                  </span>
                </div>
                <p className="text-[11px] text-subtle mt-1">
                  {item.plantCount} jar(s) - Change: {item.avgDelta !== null ? `${item.avgDelta.toFixed(1)} mm` : "n/a"} - Rate:{" "}
                  {item.avgRate !== null ? `${item.avgRate.toFixed(2)} mm/day` : "n/a"}
                </p>
                <p className="text-[11px] text-subtle mt-1">{item.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
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

// START CLUSTER_UI_STEP: UI block for mock-data cluster visualization
function GrowthClusterPanel({ clusterResult }) {
  const actionByCluster = useMemo(
    () => ({
      "slow growth":
        "Decision: check medium, pH, nutrients, and contamination risk now. If no improvement in next 14 days, plan reculture.",
      "normal growth":
        "Decision: keep current protocol and continue biweekly measurements. No major change needed now.",
      "fast growth":
        "Decision: maintain current setup, but monitor spacing/light to avoid stress from very rapid growth.",
    }),
    []
  );
  const scatter = useMemo(() => {
    if (!clusterResult?.ready || !clusterResult.assignments?.length) return null;

    const width = 920;
    const height = 320;
    const padding = { left: 56, right: 24, top: 18, bottom: 46 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;
    const xs = clusterResult.assignments.map((row) => row.days_since_planting);
    const ys = clusterResult.assignments.map((row) => row.height_cm);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const safeMaxX = maxX === minX ? maxX + 1 : maxX;
    const safeMaxY = maxY === minY ? maxY + 1 : maxY;
    const safeMinY = minY === safeMaxY ? minY - 1 : Math.max(0, minY - 0.1 * (safeMaxY - minY));

    const scaleX = (value) => padding.left + ((value - minX) / (safeMaxX - minX)) * innerW;
    const scaleY = (value) => padding.top + ((safeMaxY - value) / (safeMaxY - safeMinY)) * innerH;

    const xTicks = Array.from({ length: 5 }, (_, idx) => minX + ((safeMaxX - minX) * idx) / 4);
    const yTicks = Array.from({ length: 5 }, (_, idx) => safeMinY + ((safeMaxY - safeMinY) * idx) / 4);

    const points = clusterResult.assignments.map((row) => ({
      ...row,
      cx: scaleX(row.days_since_planting),
      cy: scaleY(row.height_cm),
    }));

    return { width, height, padding, xTicks, yTicks, points, scaleX, scaleY };
  }, [clusterResult]);
  const clusterHelp = useMemo(() => {
    if (!clusterResult?.ready || !clusterResult.assignments?.length) return null;
    const days = clusterResult.assignments.map((item) => item.days_since_planting);
    const minDays = Math.min(...days);
    const maxDays = Math.max(...days);
    const daySpread = maxDays - minDays;
    return {
      daySpread,
      nearlySameDays: daySpread < 2,
    };
  }, [clusterResult]);
  const priorityNote = useMemo(() => {
    if (!clusterResult?.ready) return "";
    const slow = clusterResult.counts?.["slow growth"] || 0;
    const normal = clusterResult.counts?.["normal growth"] || 0;
    const fast = clusterResult.counts?.["fast growth"] || 0;
    if (slow >= 2) return `Priority now: review ${slow} slow-growth jar(s) first, then keep tracking ${normal} normal and ${fast} fast jar(s).`;
    if (slow === 1) return `Priority now: troubleshoot 1 slow-growth jar first. Other jars can remain on current plan.`;
    return `Priority now: no slow-growth jars detected. Keep current care plan and monitor normal/fast jars.`;
  }, [clusterResult]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="panel space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="kicker">Mock clustering</p>
          <h3 className="text-xl font-semibold text-dark">
            {clusterResult?.mode === "kmeans" ? "Jar growth clusters (K-Means, k=3)" : "Jar growth groups (selection mode)"}
          </h3>
          <p className="text-sm text-subtle">This panel auto-groups mock jars by similar growth behavior.</p>
        </div>
        <span className="text-xs text-subtle">
          {clusterResult?.ready
            ? `${clusterResult.totalJars} jars - ${
                clusterResult.mode === "kmeans" ? `${clusterResult.iterations} rounds` : "rule-based mode"
              }`
            : "Waiting for data"}
        </span>
      </div>

      {clusterResult?.ready ? (
        <>
          <div className="panel-muted px-3 py-3 text-xs text-subtle space-y-1">
            <p>
              <span className="font-semibold text-dark">What this chart shows:</span> each dot is one jar. Red means slow growth, blue means normal growth, green means fast growth.
            </p>
            <p>
              It compares jars using days since planting, latest height, and daily growth speed, then groups similar jars automatically.
            </p>
            <p>
              <span className="font-semibold text-dark">What decision to take:</span> {priorityNote}
            </p>
            <p>
              <span className="font-semibold text-dark">Current scope:</span> {clusterResult.sourceLabel}.
            </p>
            {clusterResult.note ? <p>{clusterResult.note}</p> : null}
            {clusterHelp?.nearlySameDays ? (
              <p>
                Most jars have similar days since planting, so points can stack vertically. In this case, decisions depend more on height and growth speed.
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {["slow growth", "normal growth", "fast growth"].map((label) => {
              const count = clusterResult.counts?.[label] || 0;
              const color = CLUSTER_LABEL_COLORS[label];
              return (
                <div key={label} className="panel-muted px-3 py-2 text-xs text-dark flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-semibold">{label}</span>
                  <span className="text-subtle">{count}</span>
                </div>
              );
            })}
          </div>

          <div className="panel-muted p-3 overflow-x-auto">
            {scatter ? (
              <svg viewBox={`0 0 ${scatter.width} ${scatter.height}`} className="w-full min-w-[760px] h-72">
                <line
                  x1={scatter.padding.left}
                  y1={scatter.height - scatter.padding.bottom}
                  x2={scatter.width - scatter.padding.right}
                  y2={scatter.height - scatter.padding.bottom}
                  stroke="rgba(148,163,184,0.7)"
                  strokeWidth="1.2"
                />
                <line
                  x1={scatter.padding.left}
                  y1={scatter.padding.top}
                  x2={scatter.padding.left}
                  y2={scatter.height - scatter.padding.bottom}
                  stroke="rgba(148,163,184,0.7)"
                  strokeWidth="1.2"
                />

                {scatter.xTicks.map((tick, idx) => {
                  const x = scatter.scaleX(tick);
                  return (
                    <g key={`x-${idx}`}>
                      <line
                        x1={x}
                        y1={scatter.padding.top}
                        x2={x}
                        y2={scatter.height - scatter.padding.bottom}
                        stroke="rgba(148,163,184,0.18)"
                        strokeDasharray="4 4"
                      />
                      <text x={x} y={scatter.height - scatter.padding.bottom + 18} textAnchor="middle" fontSize="11" fill="#64748b">
                        {tick.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {scatter.yTicks.map((tick, idx) => {
                  const y = scatter.scaleY(tick);
                  return (
                    <g key={`y-${idx}`}>
                      <line
                        x1={scatter.padding.left}
                        y1={y}
                        x2={scatter.width - scatter.padding.right}
                        y2={y}
                        stroke="rgba(148,163,184,0.18)"
                        strokeDasharray="4 4"
                      />
                      <text x={scatter.padding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">
                        {tick.toFixed(2)}
                      </text>
                    </g>
                  );
                })}

                {scatter.points.map((point) => (
                  <g key={point.jar_id}>
                    <circle cx={point.cx} cy={point.cy} r="5.5" fill={point.color} opacity="0.92" />
                    <title>
                      {`${point.jar_id} | ${point.cluster_label} | days ${point.days_since_planting.toFixed(1)} | height ${point.height_cm.toFixed(
                        2
                      )} cm | rate ${point.growth_rate.toFixed(4)} cm/day`}
                    </title>
                  </g>
                ))}

                <text
                  x={(scatter.padding.left + (scatter.width - scatter.padding.right)) / 2}
                  y={scatter.height - 8}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#475569"
                >
                  Days Since Planting
                </text>
                <text
                  x="14"
                  y={(scatter.padding.top + (scatter.height - scatter.padding.bottom)) / 2}
                  transform={`rotate(-90 14 ${(scatter.padding.top + (scatter.height - scatter.padding.bottom)) / 2})`}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#475569"
                >
                  Latest Height (cm)
                </text>
              </svg>
            ) : (
              <EmptyState message="Not enough cluster points to render scatter plot." />
            )}
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {clusterResult.assignments.map((item) => (
              <div key={item.jar_id} className="panel-muted px-3 py-2 text-xs text-dark">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{item.jar_id}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-subtle">{item.cluster_label}</span>
                  </span>
                </div>
                <p className="text-subtle mt-1">Height: {item.height_cm.toFixed(2)} cm</p>
                <p className="text-subtle">Days: {item.days_since_planting.toFixed(1)}</p>
                <p className="text-subtle">Daily growth speed: {item.growth_rate.toFixed(4)} cm/day</p>
                <p className="text-subtle mt-1">{actionByCluster[item.cluster_label] || actionByCluster["normal growth"]}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState message={clusterResult?.reason || "Cluster panel will appear once enough mock records are available."} />
      )}
    </motion.div>
  );
}
// END CLUSTER_UI_STEP

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
              <div
                key={`${normalizeId(row.sourceJarId || row.jarId || row.jar_id || row.id || "na")}:${row.ts}`}
                className="grid grid-cols-4 gap-3 py-3 text-sm text-dark"
              >
                <span className="font-medium">{formatDate(row.ts)}</span>
                <span>{Number(row.height_mm).toFixed(1)} mm</span>
                <span className="text-subtle">{row.sourceJarId || row.jarId || row.jar_id || row.id || "-"}</span>
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
    { label: "Lineage jars", value: record?.lineageCount ? String(record.lineageCount) : "1" },
    { label: "Planting date", value: record?.planting_date || "-" },
    { label: "Location", value: record?.location || "-" },
    { label: "Nutrition status", value: record?.nutritionStatus || record?.nutrition || "-" },
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

function Hero({ warnings = [] }) {
  const hasWarnings = warnings.length > 0;
  const attentionCount = warnings.length;
  const warningSummary = warnings.map((item) => `${item.jar_id} (${item.severity})`).join(", ");
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="panel relative overflow-hidden p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-secondary/10" />
      <div className="relative space-y-3">
        <div className="flex items-center gap-2">
          <p className="kicker">Growth Analysis</p>
          {hasWarnings ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/55 bg-rose-500/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-700">
              <span aria-hidden="true">{"\u26A0"}</span>
              Alert {attentionCount}
            </span>
          ) : null}
        </div>
        <h1 className="title-lg">Growth History Comparison</h1>
        <p className="text-subtle text-sm md:text-base max-w-2xl">
           Explore historical growth records and compare development trends of culture jars over time.
        </p>
        {hasWarnings ? (
          <div className="rounded-xl border border-rose-300/55 bg-rose-500/10 px-3 py-2 text-xs text-rose-800">
            <span className="font-semibold">Need attention:</span> {attentionCount} jar(s).
            <br />
            <span className="font-semibold">Warning jars:</span> {warningSummary}
          </div>
        ) : null}
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
