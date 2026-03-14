const hasValue = (value) => value !== undefined && value !== null && value !== "";

const firstValue = (...values) => {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
};

const toNumber = (value) => {
  if (!hasValue(value)) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const asText = (value) => {
  if (!hasValue(value)) return "";
  return String(value).trim();
};

const normalizeJarId = (value) => {
  const raw = asText(value);
  if (!raw) return "";
  const compact = raw.replace(/[\s_]+/g, "-");
  const match = compact.match(/jar-?0*(\d+)/i);
  if (!match) return compact;
  return `Jar-${String(Number(match[1])).padStart(2, "0")}`;
};

const normalizeRackId = (value) => {
  const raw = asText(value);
  if (!raw) return "";
  const cleaned = raw.replace(/^rack\s*/i, "").trim();
  if (!cleaned) return "";
  return `Rack ${cleaned.toUpperCase()}`;
};

const normalizeDate = (value) => {
  const raw = asText(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toISOString().slice(0, 10);
};

const sampleStdDev = (values, mean) => {
  if (values.length <= 1) return 0;
  const variance =
    values.reduce((sum, value) => {
      const diff = value - mean;
      return sum + diff * diff;
    }, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
};

const round3 = (value) => Number(value.toFixed(3));

const sortById = (a, b, key) =>
  String(a[key]).localeCompare(String(b[key]), undefined, { numeric: true, sensitivity: "base" });

export const normalizeGrowthRecord = (record) => {
  const plantId = asText(firstValue(record.plant_id, record.plantId, record.id, record.sample_id, record.sampleId));
  const jarId = normalizeJarId(firstValue(record.jar_id, record.jarId, record.jar, record.jar_key, record.jarKey, record.id));
  const rackId = normalizeRackId(
    firstValue(record.rack_id, record.rackId, record.rack_no, record.rackNo, record.rack, record.location)
  );

  const heightCmDirect = toNumber(firstValue(record.height_cm, record.heightCm));
  const heightMm = toNumber(firstValue(record.height_mm, record.heightMm, record.plant_height_mm, record.plantHeightMm));
  const heightCm = heightCmDirect ?? (heightMm !== null ? heightMm / 10 : null);

  const recordDate = normalizeDate(
    firstValue(
      record.record_date,
      record.recordDate,
      record.date,
      record.recorded_at,
      record.recordedAt,
      record.planting_date,
      record.plantingDate
    )
  );

  if (!plantId || !jarId || !rackId || heightCm === null || !recordDate) {
    return null;
  }

  return {
    plant_id: plantId,
    jar_id: jarId,
    rack_id: rackId,
    height_cm: heightCm,
    record_date: recordDate,
  };
};

const buildGroupStats = (records, idKey, outputIdKey) => {
  const grouped = new Map();
  records.forEach((record) => {
    const groupId = record[idKey];
    if (!grouped.has(groupId)) grouped.set(groupId, []);
    grouped.get(groupId).push(record);
  });

  const stats = [];
  grouped.forEach((groupRecords, groupId) => {
    const heights = groupRecords.map((row) => row.height_cm);
    const mean = heights.reduce((sum, value) => sum + value, 0) / heights.length;
    const min = Math.min(...heights);
    const max = Math.max(...heights);
    const stdDev = sampleStdDev(heights, mean);
    const uniquePlants = new Set(groupRecords.map((row) => row.plant_id)).size;

    stats.push({
      [outputIdKey]: groupId,
      mean_height_cm: round3(mean),
      min_height_cm: round3(min),
      max_height_cm: round3(max),
      std_dev_height_cm: round3(stdDev),
      plant_count: uniquePlants,
      observation_count: groupRecords.length,
    });
  });

  return stats.sort((a, b) => sortById(a, b, outputIdKey));
};

export const analyzePlantGrowthRecords = (records, stdThresholdCm = 1.5) => {
  const normalizedRecords = [];
  const droppedRecords = [];

  (records || []).forEach((row, index) => {
    const normalized = normalizeGrowthRecord(row);
    if (normalized) {
      normalizedRecords.push(normalized);
    } else {
      droppedRecords.push({ index, row });
    }
  });

  const jarStats = buildGroupStats(normalizedRecords, "jar_id", "jar_id");
  const rackStats = buildGroupStats(normalizedRecords, "rack_id", "rack_id");

  const highVarianceJars = jarStats.filter((item) => item.std_dev_height_cm > stdThresholdCm);

  const summaryTable = [
    ...jarStats.map((item) => ({
      level: "jar",
      id: item.jar_id,
      mean_height_cm: item.mean_height_cm,
      min_height_cm: item.min_height_cm,
      max_height_cm: item.max_height_cm,
      std_dev_height_cm: item.std_dev_height_cm,
      plant_count: item.plant_count,
      observation_count: item.observation_count,
    })),
    ...rackStats.map((item) => ({
      level: "rack",
      id: item.rack_id,
      mean_height_cm: item.mean_height_cm,
      min_height_cm: item.min_height_cm,
      max_height_cm: item.max_height_cm,
      std_dev_height_cm: item.std_dev_height_cm,
      plant_count: item.plant_count,
      observation_count: item.observation_count,
    })),
  ];

  const visualizationData = {
    generated_at: new Date().toISOString(),
    threshold_std_dev_cm: stdThresholdCm,
    totals: {
      raw_records: records?.length || 0,
      normalized_records: normalizedRecords.length,
      dropped_records: droppedRecords.length,
      jar_groups: jarStats.length,
      rack_groups: rackStats.length,
    },
    jar_stats: jarStats,
    rack_stats: rackStats,
    high_variance_jars: highVarianceJars,
  };

  return {
    summaryTable,
    jarStats,
    rackStats,
    highVarianceJars,
    visualizationData,
    normalizedRecords,
    droppedRecords,
  };
};
