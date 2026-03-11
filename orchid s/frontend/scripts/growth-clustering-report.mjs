import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDatasetPath = path.resolve(__dirname, "data/plant-growth-records.json");
const datasetArg = process.argv[2];
const datasetPath = datasetArg ? path.resolve(process.cwd(), datasetArg) : defaultDatasetPath;

const K = 3;
const MAX_ITERS = 100;

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const normalizeDate = (value) => {
  if (value === undefined || value === null || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
};

const parseInputRecord = (row) => {
  const jar_id = String(row.jar_id ?? row.jarId ?? row.jar ?? "").trim();
  const plant_id = String(row.plant_id ?? row.plantId ?? row.id ?? "").trim();
  const height_cm = toNumber(row.height_cm ?? row.heightCm) ?? (toNumber(row.height_mm ?? row.heightMm ?? row.plant_height_mm) ?? 0) / 10;
  const days_since_planting = toNumber(row.days_since_planting ?? row.daysSincePlanting);
  const growth_rate = toNumber(row.growth_rate ?? row.growthRate);
  const record_date = normalizeDate(row.record_date ?? row.recordDate ?? row.date ?? row.recorded_at ?? row.recordedAt);

  if (!jar_id || !Number.isFinite(height_cm)) return null;
  return {
    plant_id: plant_id || jar_id,
    jar_id,
    height_cm,
    days_since_planting,
    growth_rate,
    record_date,
  };
};

const daysBetween = (startIso, endIso) => {
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / (24 * 60 * 60 * 1000)));
};

const aggregateJarRows = (rows) => {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.jar_id)) grouped.set(row.jar_id, []);
    grouped.get(row.jar_id).push(row);
  });

  const jars = [];
  grouped.forEach((jarRows, jar_id) => {
    const sorted = [...jarRows].sort((a, b) => {
      if (a.record_date && b.record_date) return a.record_date.localeCompare(b.record_date);
      if (a.record_date) return -1;
      if (b.record_date) return 1;
      return 0;
    });

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const explicitDays = sorted.map((r) => toNumber(r.days_since_planting)).filter((n) => Number.isFinite(n));
    const explicitRates = sorted.map((r) => toNumber(r.growth_rate)).filter((n) => Number.isFinite(n));

    const derivedDays = first.record_date && last.record_date ? daysBetween(first.record_date, last.record_date) : null;
    const days_since_planting = explicitDays.length ? Math.max(...explicitDays) : derivedDays ?? 0;

    const derivedGrowthRate =
      days_since_planting > 0 ? (last.height_cm - first.height_cm) / days_since_planting : 0;
    const growth_rate = explicitRates.length
      ? explicitRates.reduce((sum, value) => sum + value, 0) / explicitRates.length
      : derivedGrowthRate;

    jars.push({
      plant_id: jar_id,
      jar_id,
      height_cm: last.height_cm,
      days_since_planting,
      growth_rate,
    });
  });

  return jars.filter(
    (row) =>
      Number.isFinite(row.height_cm) &&
      Number.isFinite(row.days_since_planting) &&
      Number.isFinite(row.growth_rate)
  );
};

const computeNormStats = (rows, keys) =>
  keys.map((key) => {
    const values = rows.map((row) => row[key]);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
    const std = Math.sqrt(variance) || 1;
    return { key, mean, std };
  });

const normalizeRows = (rows, stats) =>
  rows.map((row) =>
    stats.map((s) => (row[s.key] - s.mean) / s.std)
  );

const euclideanSq = (a, b) => a.reduce((sum, value, i) => sum + (value - b[i]) ** 2, 0);

const meanVector = (vectors) => {
  const dims = vectors[0].length;
  const sums = new Array(dims).fill(0);
  vectors.forEach((vector) => {
    vector.forEach((value, i) => {
      sums[i] += value;
    });
  });
  return sums.map((sum) => sum / vectors.length);
};

const initCentroids = (vectors) => {
  const byGrowth = [...vectors].sort((a, b) => a[2] - b[2]);
  const low = byGrowth[0];
  const mid = byGrowth[Math.floor(byGrowth.length / 2)];
  const high = byGrowth[byGrowth.length - 1];
  return [low, mid, high].map((v) => [...v]);
};

const runKMeans = (vectors, k = K, maxIters = MAX_ITERS) => {
  if (vectors.length < k) {
    throw new Error(`Need at least ${k} records for K-Means. Found ${vectors.length}.`);
  }

  let centroids = initCentroids(vectors);
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
      const clusterVectors = clusters[cIdx];
      if (!clusterVectors.length) return oldCentroid;
      return meanVector(clusterVectors);
    });

    if (!changed) {
      return { centroids, assignments, iterations: iter + 1 };
    }
  }

  return { centroids, assignments, iterations: maxIters };
};

const labelClusters = (centroids) => {
  const ranked = centroids
    .map((centroid, idx) => ({ idx, growthSignal: centroid[2] }))
    .sort((a, b) => a.growthSignal - b.growthSignal);

  const labels = new Map();
  labels.set(ranked[0].idx, "slow growth");
  labels.set(ranked[1].idx, "normal growth");
  labels.set(ranked[2].idx, "fast growth");
  return labels;
};

const buildScatterHtml = (assignments) => {
  const colorByLabel = {
    "slow growth": "rgba(239, 68, 68, 0.85)",
    "normal growth": "rgba(59, 130, 246, 0.85)",
    "fast growth": "rgba(16, 185, 129, 0.85)",
  };

  const grouped = {
    "slow growth": [],
    "normal growth": [],
    "fast growth": [],
  };

  assignments.forEach((row) => {
    grouped[row.cluster_label].push({
      x: row.days_since_planting,
      y: row.height_cm,
      plant_id: row.plant_id,
      jar_id: row.jar_id,
      growth_rate: row.growth_rate,
    });
  });

  const datasets = Object.entries(grouped).map(([label, points]) => ({
    label,
    data: points,
    backgroundColor: colorByLabel[label],
    pointRadius: 5,
  }));

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Plant Growth Clusters</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
      h1 { margin: 0 0 8px; }
      p { margin: 0 0 14px; color: #475569; }
      .card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; max-width: 980px; }
      canvas { width: 100%; max-width: 940px; height: 520px; }
    </style>
  </head>
  <body>
    <h1>Plant Growth Clusters (K-Means, k=3)</h1>
    <p>X-axis: days since planting, Y-axis: latest height (cm), color: growth pattern cluster</p>
    <div class="card"><canvas id="clusterChart"></canvas></div>
    <script>
      const datasets = ${JSON.stringify(datasets)};
      const ctx = document.getElementById('clusterChart');
      new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label(context) {
                  const raw = context.raw || {};
                  const parts = [
                    raw.jar_id ? 'Jar: ' + raw.jar_id : null,
                    Number.isFinite(raw.x) ? 'Days: ' + raw.x : null,
                    Number.isFinite(raw.y) ? 'Height: ' + raw.y.toFixed(2) + ' cm' : null,
                    Number.isFinite(raw.growth_rate) ? 'Rate: ' + raw.growth_rate.toFixed(3) + ' cm/day' : null,
                  ].filter(Boolean);
                  return parts.join(' | ');
                }
              }
            }
          },
          scales: {
            x: { title: { display: true, text: 'Days Since Planting' } },
            y: { title: { display: true, text: 'Height (cm)' } }
          }
        }
      });
    </script>
  </body>
</html>`;
};

if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset file not found: ${datasetPath}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
const parsedRows = (Array.isArray(raw) ? raw : raw?.records || []).map(parseInputRecord).filter(Boolean);

if (!parsedRows.length) {
  console.error("No valid rows after parsing. Check input dataset schema.");
  process.exit(1);
}

const jarFeatureRows = aggregateJarRows(parsedRows);
if (jarFeatureRows.length < K) {
  console.error(`Need at least ${K} jar records after aggregation. Found ${jarFeatureRows.length}.`);
  process.exit(1);
}

const featureKeys = ["height_cm", "days_since_planting", "growth_rate"];
const normStats = computeNormStats(jarFeatureRows, featureKeys);
const normalizedVectors = normalizeRows(jarFeatureRows, normStats);
const kmeans = runKMeans(normalizedVectors, K, MAX_ITERS);
const clusterLabels = labelClusters(kmeans.centroids);

const assignments = jarFeatureRows.map((row, idx) => ({
  jar_id: row.jar_id,
  height_cm: Number(row.height_cm.toFixed(3)),
  days_since_planting: Number(row.days_since_planting.toFixed(3)),
  growth_rate: Number(row.growth_rate.toFixed(5)),
  cluster_id: kmeans.assignments[idx],
  cluster_label: clusterLabels.get(kmeans.assignments[idx]) || "normal growth",
}));

const summary = {
  total_input_rows: parsedRows.length,
  total_jars_clustered: assignments.length,
  k: K,
  iterations: kmeans.iterations,
  feature_normalization: normStats,
  cluster_counts: assignments.reduce((acc, row) => {
    acc[row.cluster_label] = (acc[row.cluster_label] || 0) + 1;
    return acc;
  }, {}),
};

const outputDir = path.resolve(__dirname, "output");
fs.mkdirSync(outputDir, { recursive: true });

const outputJsonPath = path.join(outputDir, "growth-cluster-results.json");
fs.writeFileSync(
  outputJsonPath,
  `${JSON.stringify({ summary, assignments }, null, 2)}\n`,
  "utf8"
);

const outputHtmlPath = path.join(outputDir, "growth-clusters-scatter.html");
fs.writeFileSync(outputHtmlPath, buildScatterHtml(assignments), "utf8");

console.log(`Loaded dataset: ${datasetPath}`);
console.log(`Parsed rows: ${parsedRows.length}`);
console.log(`Jars clustered: ${assignments.length}`);
console.log(`K-Means iterations: ${kmeans.iterations}`);
console.log("Cluster counts:", summary.cluster_counts);
console.log("");
console.log("Cluster assignment for each jar:");
console.table(assignments);
console.log(`JSON output: ${outputJsonPath}`);
console.log(`Scatter plot HTML: ${outputHtmlPath}`);
