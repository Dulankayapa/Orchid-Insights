import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzePlantGrowthRecords } from "../src/lib/plantGrowthStats.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDatasetPath = path.resolve(__dirname, "data/plant-growth-records.json");
const datasetArg = process.argv[2];
const thresholdArg = Number(process.argv[3]);

const datasetPath = datasetArg ? path.resolve(process.cwd(), datasetArg) : defaultDatasetPath;
const stdThresholdCm = Number.isFinite(thresholdArg) ? thresholdArg : 1.5;

if (!fs.existsSync(datasetPath)) {
  console.error(`Dataset file not found: ${datasetPath}`);
  process.exit(1);
}

const parsed = JSON.parse(fs.readFileSync(datasetPath, "utf8"));
const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.records) ? parsed.records : [];

if (!records.length) {
  console.error("No records found. Use a JSON array or an object with a `records` array.");
  process.exit(1);
}

const result = analyzePlantGrowthRecords(records, stdThresholdCm);

console.log(`Loaded ${records.length} raw records from ${datasetPath}`);
console.log(`Normalized records: ${result.normalizedRecords.length}`);
console.log(`Dropped records: ${result.droppedRecords.length}`);
console.log("");

console.log("1) Summary Statistics Table (Jar + Rack)");
console.table(result.summaryTable);

console.log("2) Jars exceeding standard deviation threshold");
if (!result.highVarianceJars.length) {
  console.log(`No jars exceeded std dev threshold (${stdThresholdCm} cm).`);
} else {
  console.table(result.highVarianceJars);
}

console.log("3) JSON formatted data for visualization");
const outputPath = path.resolve(__dirname, "output/growth-stats-visualization.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result.visualizationData, null, 2)}\n`, "utf8");
console.log(`Saved: ${outputPath}`);
console.log(JSON.stringify(result.visualizationData, null, 2));

if (result.droppedRecords.length) {
  console.log("");
  console.log("Dropped record samples (first 5):");
  console.table(result.droppedRecords.slice(0, 5).map((item) => ({ index: item.index, row: JSON.stringify(item.row) })));
}
