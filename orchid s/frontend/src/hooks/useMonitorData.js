
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  limitToLast,
  onValue,
  orderByKey,
  push,
  query,
  ref,
  set,
  update,
} from 'firebase/database';
import { db, resolvedDatabaseURL } from '../lib/firebase';
import {
  AI_TIPS,
  DEFAULT_CONTROL_STATE,
  DEFAULT_MAINTENANCE_TASKS,
  DEFAULT_THRESHOLDS,
  GREENHOUSE_DEVICES,
  METRIC_DEFINITIONS,
} from '../lib/monitorConfig';

const LIVE_PATHS = ['orchidData/latest', 'Jar1', 'Jar2', 'Jar3'];
const HISTORY_PATH = 'orchidData/logs';

const PHYSICAL_LIMITS = {
  temperature: { min: -10, max: 60 },
  humidity: { min: 0, max: 100 },
  light: { min: 0, max: 120000 },
  co2: { min: 0, max: 7000 },
  ph: { min: 0, max: 14 },
  soilMoisture: { min: 0, max: 100 },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const toTimestampMs = (value) => {
  const ts = toNumber(value);
  if (ts === null) return null;
  return ts < 10000000000 ? ts * 1000 : ts;
};

const deepMerge = (...objects) => {
  const output = {};

  objects.forEach((item) => {
    if (!isObject(item)) return;

    Object.entries(item).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        output[key] = [...value];
      } else if (isObject(value)) {
        output[key] = deepMerge(output[key], value);
      } else {
        output[key] = value;
      }
    });
  });

  return output;
};

const pickMetricValue = (row, aliases = []) => {
  for (const alias of aliases) {
    const maybe = toNumber(row?.[alias]);
    if (maybe !== null) return maybe;
  }
  return null;
};

const normalizeSensor = (payload, fallback = {}) => {
  if (!isObject(payload)) return null;

  const timestamp = toTimestampMs(
    payload.timestamp
    ?? payload.ts
    ?? payload.lastSeen
    ?? payload.last_seen
    ?? payload.updatedAt
    ?? payload.updated_at
    ?? Date.now()
  ) ?? Date.now();

  const normalized = {
    ...payload,
    timestamp,
    ts: timestamp,
    nodeId: String(
      payload.nodeId
      ?? payload.node
      ?? payload.deviceId
      ?? payload.device_id
      ?? payload.jarId
      ?? payload.jar_id
      ?? fallback.nodeId
      ?? 'node-1'
    ),
    zoneId: String(
      payload.zoneId
      ?? payload.zone
      ?? payload.greenhouseZone
      ?? payload.zone_id
      ?? fallback.zoneId
      ?? 'Zone A'
    ),
  };

  Object.entries(METRIC_DEFINITIONS).forEach(([key, definition]) => {
    const value = pickMetricValue(payload, definition.aliases);
    normalized[key] = value;
  });

  // Backward compatibility for existing components.
  normalized.temperature = normalized.temperature ?? pickMetricValue(payload, ['temperature', 'temp', 't']);
  normalized.humidity = normalized.humidity ?? pickMetricValue(payload, ['humidity', 'hum', 'h']);
  normalized.lux = normalized.light;
  normalized.mq135 = normalized.co2;

  const heightMm = pickMetricValue(payload, ['height_mm', 'heightMm', 'heightMM', 'height', 'plantHeight', 'distance_mm']);
  const heightCm = pickMetricValue(payload, ['height_cm', 'heightCm', 'distance_cm']);
  normalized.height_mm = heightMm ?? (heightCm !== null ? heightCm * 10 : null);
  normalized.height_cm = normalized.height_mm !== null
    ? Number((normalized.height_mm / 10).toFixed(1))
    : heightCm;

  return normalized;
};

const normalizeHistoryRows = (payload) => {
  if (!payload) return [];

  const rows = (Array.isArray(payload) ? payload : Object.values(payload))
    .map((entry) => normalizeSensor(entry))
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts);

  return rows;
};

const computeLinearForecast = (history, key, horizonHours) => {
  const samples = history
    .map((row) => ({
      ts: toTimestampMs(row.ts ?? row.timestamp),
      value: toNumber(row[key]),
    }))
    .filter((row) => row.ts !== null && row.value !== null)
    .slice(-Math.min(120, history.length));

  if (samples.length < 8) return null;

  const origin = samples[0].ts;
  const n = samples.length;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;

  samples.forEach(({ ts, value }) => {
    const x = (ts - origin) / 3600000;
    sx += x;
    sy += value;
    sxy += x * value;
    sxx += x * x;
  });

  const denominator = (n * sxx) - (sx * sx);
  if (Math.abs(denominator) < 1e-8) return null;

  const slopePerHour = ((n * sxy) - (sx * sy)) / denominator;
  const intercept = (sy - (slopePerHour * sx)) / n;

  const latest = samples[samples.length - 1];
  const latestX = (latest.ts - origin) / 3600000;
  const predicted = intercept + (slopePerHour * (latestX + horizonHours));

  const mean = sy / n;
  let ssTot = 0;
  let ssRes = 0;
  samples.forEach(({ ts, value }) => {
    const x = (ts - origin) / 3600000;
    const fit = intercept + (slopePerHour * x);
    ssTot += (value - mean) ** 2;
    ssRes += (value - fit) ** 2;
  });

  const r2 = ssTot === 0 ? 1 : clamp(1 - (ssRes / ssTot), 0, 1);
  const confidence = clamp(0.25 + ((n / 120) * 0.35) + (r2 * 0.4), 0.2, 0.98);

  return {
    key,
    current: latest.value,
    predicted,
    slopePerHour,
    confidence,
    r2,
    samples: n,
  };
};

const computeMetricStress = (value, bounds) => {
  const numeric = toNumber(value);
  if (numeric === null) return null;

  const range = Math.max((bounds.max ?? 0) - (bounds.min ?? 0), 1);
  if (numeric < bounds.min) return clamp(((bounds.min - numeric) / range) * 100, 0, 100);
  if (numeric > bounds.max) return clamp(((numeric - bounds.max) / range) * 100, 0, 100);
  return 0;
};

const formatDateKey = (timestamp = Date.now()) => {
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${date.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const formatWeekLabel = (timestamp) => {
  const date = new Date(timestamp);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  const mm = `${start.getMonth() + 1}`.padStart(2, '0');
  const dd = `${start.getDate()}`.padStart(2, '0');
  return `Wk ${mm}/${dd}`;
};

const buildEstimatedEnergy = (devicesState, energyRows) => {
  if (Array.isArray(energyRows) && energyRows.length > 0) {
    const dailyMap = new Map();
    const weeklyMap = new Map();
    const perDevice = new Map();

    energyRows.forEach((entry) => {
      const ts = toTimestampMs(entry.timestamp ?? entry.ts);
      const kwh = toNumber(entry.kwh);
      const device = String(entry.device ?? entry.deviceKey ?? 'unknown');
      if (ts === null || kwh === null) return;

      const dayKey = formatDateKey(ts);
      dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + kwh);

      const weekKey = formatWeekLabel(ts);
      weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + kwh);

      perDevice.set(device, (perDevice.get(device) ?? 0) + kwh);
    });

    const daily = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([label, kwh]) => ({ label, kwh }));

    const weekly = Array.from(weeklyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([label, kwh]) => ({ label, kwh }));

    const perDeviceRows = GREENHOUSE_DEVICES.map((device) => ({
      ...device,
      kwh: perDevice.get(device.key) ?? 0,
      isOn: !!devicesState?.[device.key],
    }));

    return {
      daily,
      weekly,
      perDevice: perDeviceRows,
      todayTotal: daily[daily.length - 1]?.kwh ?? 0,
      weekTotal: daily.reduce((sum, row) => sum + row.kwh, 0),
    };
  }

  const now = Date.now();
  const daily = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now - (i * 24 * 60 * 60 * 1000));
    const dayFactor = 0.82 + (0.18 * Math.sin(i));
    const kwh = GREENHOUSE_DEVICES.reduce((sum, device) => {
      const isOn = !!devicesState?.[device.key];
      const duty = isOn ? 0.58 : 0.18;
      return sum + ((device.powerWatts / 1000) * 24 * duty * dayFactor);
    }, 0);
    daily.push({
      label: `${day.getMonth() + 1}/${day.getDate()}`,
      kwh,
    });
  }

  const weekly = [];
  for (let i = 5; i >= 0; i -= 1) {
    const weekRows = daily.slice(Math.max(0, daily.length - ((i + 1) * 1) - 1), Math.max(0, daily.length - i));
    const total = weekRows.reduce((sum, row) => sum + row.kwh, 0) * (6.4 + (i * 0.2));
    weekly.push({ label: `W-${6 - i}`, kwh: total });
  }

  const perDevice = GREENHOUSE_DEVICES.map((device) => {
    const isOn = !!devicesState?.[device.key];
    const duty = isOn ? 0.58 : 0.18;
    return {
      ...device,
      isOn,
      kwh: (device.powerWatts / 1000) * 24 * 7 * duty,
    };
  });

  return {
    daily,
    weekly,
    perDevice,
    todayTotal: daily[daily.length - 1]?.kwh ?? 0,
    weekTotal: daily.reduce((sum, row) => sum + row.kwh, 0),
  };
};

const getPreferredLatest = (payload) => {
  if (!payload) return null;

  if (isObject(payload) && pickMetricValue(payload, Object.values(METRIC_DEFINITIONS).flatMap((metric) => metric.aliases)) !== null) {
    return payload;
  }

  if (Array.isArray(payload)) {
    for (let i = payload.length - 1; i >= 0; i -= 1) {
      if (isObject(payload[i])) return payload[i];
    }
  }

  if (isObject(payload)) {
    const candidates = ['latest', 'value', 'data', 'reading'];
    for (const key of candidates) {
      if (isObject(payload[key])) return payload[key];
    }

    const nested = Object.values(payload).filter(isObject);
    for (let i = nested.length - 1; i >= 0; i -= 1) {
      if (nested[i]) return nested[i];
    }
  }

  return null;
};

const getAverage = (rows, key) => {
  const values = rows.map((row) => toNumber(row?.[key])).filter((value) => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const useMonitorData = (settingsOverride = {}) => {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [growthLogs, setGrowthLogs] = useState([]);
  const [zonesPayload, setZonesPayload] = useState({});
  const [nodesPayload, setNodesPayload] = useState({});
  const [settingsPayload, setSettingsPayload] = useState({});
  const [legacyThresholdPayload, setLegacyThresholdPayload] = useState({});
  const [controlPayload, setControlPayload] = useState({});
  const [notificationsPayload, setNotificationsPayload] = useState([]);
  const [maintenancePayload, setMaintenancePayload] = useState({});
  const [energyPayload, setEnergyPayload] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  const publishedAlertIdsRef = useRef(new Set());
  const persistedReportRef = useRef('');

  const thresholds = useMemo(() => (
    deepMerge(
      DEFAULT_THRESHOLDS,
      legacyThresholdPayload,
      settingsPayload?.thresholds,
      settingsPayload?.threshold,
      settingsOverride,
    )
  ), [legacyThresholdPayload, settingsPayload, settingsOverride]);

  const controlState = useMemo(() => {
    const source = isObject(controlPayload) ? controlPayload : {};
    const flatDevices = GREENHOUSE_DEVICES.reduce((acc, device) => {
      acc[device.key] = Boolean(source[device.key]);
      return acc;
    }, {});

    return deepMerge(
      DEFAULT_CONTROL_STATE,
      {
        mode: source.mode,
        autoRulesEnabled: source.autoRulesEnabled,
        devices: source.devices,
      },
      { devices: flatDevices },
    );
  }, [controlPayload]);

  const normalizedHistory = useMemo(
    () => normalizeHistoryRows(history),
    [history],
  );

  const latestSnapshot = useMemo(() => {
    if (latest) return normalizeSensor(latest) ?? latest;
    return normalizedHistory[normalizedHistory.length - 1] ?? null;
  }, [latest, normalizedHistory]);

  const zones = useMemo(() => {
    const source = isObject(zonesPayload) ? zonesPayload : {};
    const parsed = {};

    Object.entries(source).forEach(([zoneKey, zoneValue]) => {
      if (!isObject(zoneValue)) return;

      const latestZone = normalizeSensor(
        zoneValue.latest
        ?? zoneValue.current
        ?? zoneValue.snapshot
        ?? zoneValue,
        { zoneId: zoneKey },
      );

      const zoneHistory = normalizeHistoryRows(zoneValue.logs ?? zoneValue.history ?? zoneValue.samples ?? []);

      parsed[zoneKey] = {
        id: zoneKey,
        latest: latestZone,
        history: zoneHistory,
      };
    });

    if (Object.keys(parsed).length === 0) {
      const grouped = normalizedHistory.reduce((acc, row) => {
        const zoneId = row.zoneId || 'Zone A';
        if (!acc[zoneId]) acc[zoneId] = [];
        acc[zoneId].push(row);
        return acc;
      }, {});

      Object.entries(grouped).forEach(([zoneId, rows]) => {
        parsed[zoneId] = {
          id: zoneId,
          latest: rows[rows.length - 1] ?? latestSnapshot,
          history: rows,
        };
      });
    }

    if (Object.keys(parsed).length === 0) {
      parsed['Zone A'] = {
        id: 'Zone A',
        latest: latestSnapshot,
        history: normalizedHistory,
      };
    }

    return parsed;
  }, [zonesPayload, normalizedHistory, latestSnapshot]);

  const nodeStatuses = useMemo(() => {
    const now = Date.now();
    const output = [];
    const source = isObject(nodesPayload) ? nodesPayload : {};

    Object.entries(source).forEach(([nodeId, value]) => {
      const normalizedLatest = normalizeSensor(
        value.latest ?? value.reading ?? value,
        { nodeId },
      );
      const lastSeen = toTimestampMs(
        value.lastSeen
        ?? value.timestamp
        ?? value.ts
        ?? value.updatedAt
        ?? normalizedLatest?.ts,
      );
      const status = (lastSeen !== null && (now - lastSeen) <= ((thresholds.offlineSeconds ?? DEFAULT_THRESHOLDS.offlineSeconds) * 1000))
        ? 'online'
        : 'offline';

      output.push({
        id: nodeId,
        zoneId: String(value.zoneId ?? value.zone ?? normalizedLatest?.zoneId ?? 'Zone A'),
        lastSeen,
        status,
        latest: normalizedLatest,
      });
    });

    if (!output.length) {
      const grouped = normalizedHistory.reduce((acc, row) => {
        const nodeId = row.nodeId || 'node-1';
        if (!acc[nodeId] || row.ts > acc[nodeId].ts) {
          acc[nodeId] = row;
        }
        return acc;
      }, {});

      Object.entries(grouped).forEach(([nodeId, row]) => {
        const lastSeen = row.ts;
        const status = (now - lastSeen) <= ((thresholds.offlineSeconds ?? DEFAULT_THRESHOLDS.offlineSeconds) * 1000)
          ? 'online'
          : 'offline';

        output.push({
          id: nodeId,
          zoneId: row.zoneId || 'Zone A',
          lastSeen,
          status,
          latest: row,
        });
      });
    }

    return output.sort((a, b) => a.id.localeCompare(b.id));
  }, [nodesPayload, normalizedHistory, thresholds.offlineSeconds]);

  const forecastHorizon = toNumber(thresholds.predictiveHorizonHours) ?? DEFAULT_THRESHOLDS.predictiveHorizonHours;

  const predictions = useMemo(() => ({
    temperature: computeLinearForecast(normalizedHistory, 'temperature', forecastHorizon),
    humidity: computeLinearForecast(normalizedHistory, 'humidity', forecastHorizon),
    light: computeLinearForecast(normalizedHistory, 'light', forecastHorizon),
    co2: computeLinearForecast(normalizedHistory, 'co2', forecastHorizon),
    ph: computeLinearForecast(normalizedHistory, 'ph', forecastHorizon),
  }), [normalizedHistory, forecastHorizon]);

  const healthScore = useMemo(() => {
    if (!latestSnapshot) return null;

    let weightedStress = 0;
    let totalWeight = 0;

    Object.entries(METRIC_DEFINITIONS).forEach(([key, definition]) => {
      const bounds = thresholds.metrics?.[key];
      if (!bounds) return;

      const stress = computeMetricStress(latestSnapshot[key], bounds);
      if (stress === null) return;

      weightedStress += stress * (definition.weight ?? 0.15);
      totalWeight += definition.weight ?? 0.15;
    });

    if (!totalWeight) return null;
    const normalizedStress = weightedStress / totalWeight;
    return clamp(100 - normalizedStress, 0, 100);
  }, [latestSnapshot, thresholds]);

  const diagnostics = useMemo(() => {
    const findings = [];
    if (!latestSnapshot) {
      findings.push({
        id: 'diag-no-data',
        severity: 'warning',
        title: 'No recent sensor payload',
        detail: 'Waiting for live telemetry from Firebase.',
      });
      return findings;
    }

    const staleSec = (Date.now() - (latestSnapshot.ts ?? Date.now())) / 1000;
    if (staleSec > (thresholds.staleSeconds ?? DEFAULT_THRESHOLDS.staleSeconds)) {
      findings.push({
        id: 'diag-stale',
        severity: 'critical',
        title: 'Telemetry stale',
        detail: `Last packet is ${Math.round(staleSec)}s old.`,
      });
    }

    Object.entries(PHYSICAL_LIMITS).forEach(([key, limits]) => {
      const value = toNumber(latestSnapshot[key]);
      if (value === null) return;

      if (value < limits.min || value > limits.max) {
        findings.push({
          id: `diag-physical-${key}`,
          severity: 'critical',
          title: `${METRIC_DEFINITIONS[key]?.label ?? key} out of physical range`,
          detail: `${value} ${METRIC_DEFINITIONS[key]?.unit ?? ''} is outside expected sensor bounds.`,
        });
      }
    });

    Object.entries(METRIC_DEFINITIONS).forEach(([key, definition]) => {
      const recentValues = normalizedHistory
        .slice(-30)
        .map((row) => toNumber(row[key]))
        .filter((value) => value !== null);
      if (recentValues.length < 10) return;

      const current = toNumber(latestSnapshot[key]);
      if (current === null) return;

      const mean = recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length;
      const variance = recentValues.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / recentValues.length;
      const std = Math.sqrt(variance);
      if (std < 1e-4) return;

      const z = (current - mean) / std;
      if (Math.abs(z) > 2.8) {
        findings.push({
          id: `diag-anomaly-${key}`,
          severity: Math.abs(z) > 3.5 ? 'critical' : 'warning',
          title: `${definition.label} anomaly`,
          detail: `Current value deviates from baseline (z=${z.toFixed(2)}).`,
        });
      }
    });

    nodeStatuses.forEach((node) => {
      if (node.status === 'offline') {
        findings.push({
          id: `diag-node-${node.id}`,
          severity: 'warning',
          title: `${node.id} offline`,
          detail: `No heartbeat from ${node.id} in zone ${node.zoneId}.`,
        });
      }
    });

    return findings.slice(0, 20);
  }, [latestSnapshot, nodeStatuses, normalizedHistory, thresholds.staleSeconds]);

  const alerts = useMemo(() => {
    const output = [];
    const now = Date.now();

    if (!latestSnapshot) return output;

    Object.entries(METRIC_DEFINITIONS).forEach(([key, definition]) => {
      const bounds = thresholds.metrics?.[key];
      if (!bounds) return;

      const current = toNumber(latestSnapshot[key]);
      if (current === null) return;

      if (current < bounds.min || current > bounds.max) {
        const direction = current < bounds.min ? 'below' : 'above';
        const severity = Math.abs(current - (direction === 'below' ? bounds.min : bounds.max))
          > Math.max((bounds.max - bounds.min) * 0.25, 1)
          ? 'critical'
          : 'warning';

        output.push({
          id: `metric-${key}-${Math.floor(now / 600000)}`,
          metricKey: key,
          title: `${definition.label} threshold breach`,
          message: `${definition.label} is ${direction} range (${current.toFixed(definition.decimals)} ${definition.unit}; target ${bounds.min}-${bounds.max}).`,
          type: severity,
          source: 'live',
          at: now,
          confidence: 0.98,
        });
      }

      const forecast = predictions[key];
      if (!forecast) return;

      if (forecast.predicted < bounds.min || forecast.predicted > bounds.max) {
        const direction = forecast.predicted < bounds.min ? 'below' : 'above';
        output.push({
          id: `pred-${key}-${Math.floor(now / 900000)}`,
          metricKey: key,
          title: `Predictive ${definition.label} alert`,
          message: `${definition.label} is projected ${direction} range in ${forecastHorizon}h (${forecast.predicted.toFixed(definition.decimals)} ${definition.unit}).`,
          type: 'warning',
          source: 'prediction',
          at: now,
          confidence: forecast.confidence,
        });
      }
    });

    diagnostics.forEach((item) => {
      output.push({
        id: `diag-${item.id}`,
        metricKey: 'diagnostics',
        title: item.title,
        message: item.detail,
        type: item.severity === 'critical' ? 'critical' : 'warning',
        source: 'diagnostics',
        at: now,
        confidence: 0.88,
      });
    });

    return Array.from(new Map(output.map((alert) => [alert.id, alert])).values())
      .sort((a, b) => {
        const weight = { critical: 3, warning: 2, info: 1 };
        const severityDiff = (weight[b.type] ?? 0) - (weight[a.type] ?? 0);
        if (severityDiff !== 0) return severityDiff;
        return (b.confidence ?? 0) - (a.confidence ?? 0);
      })
      .slice(0, 25);
  }, [latestSnapshot, thresholds, predictions, diagnostics, forecastHorizon]);

  const aiInsights = useMemo(() => {
    const insights = [];

    if (healthScore !== null) {
      if (healthScore >= 85) insights.push(`Environment health is strong at ${healthScore.toFixed(1)}/100.`);
      if (healthScore < 85 && healthScore >= 65) insights.push(`Environment health is moderate at ${healthScore.toFixed(1)}/100. Fine-tune humidity and airflow.`);
      if (healthScore < 65) insights.push(`Environment health is low at ${healthScore.toFixed(1)}/100. Apply control actions immediately.`);
    }

    const tempForecast = predictions.temperature;
    if (tempForecast) {
      insights.push(`Short-term temperature forecast (${forecastHorizon}h): ${tempForecast.predicted.toFixed(1)} C.`);
    }

    const humidityForecast = predictions.humidity;
    if (humidityForecast) {
      insights.push(`Short-term humidity forecast (${forecastHorizon}h): ${humidityForecast.predicted.toFixed(1)}%.`);
    }

    const moisture = toNumber(latestSnapshot?.soilMoisture);
    if (moisture !== null) {
      if (moisture < (thresholds.metrics?.soilMoisture?.min ?? 35)) {
        insights.push('Smart irrigation recommendation: increase pump pulse frequency to avoid root-zone stress.');
      } else if (moisture > (thresholds.metrics?.soilMoisture?.max ?? 75)) {
        insights.push('Irrigation recommendation: reduce watering intervals to prevent oversaturation.');
      }
    }

    const temp = toNumber(latestSnapshot?.temperature);
    const humidity = toNumber(latestSnapshot?.humidity);
    if (temp !== null && humidity !== null) {
      const stressSignal = (temp > (thresholds.metrics?.temperature?.max ?? 28) && humidity < (thresholds.metrics?.humidity?.min ?? 45));
      if (stressSignal) {
        insights.push('Plant stress detection: high heat + low humidity pattern detected.');
      }
    }

    if (alerts.some((alert) => alert.type === 'critical')) {
      insights.push('Anomaly detection is active: resolve critical alerts before changing growth profile.');
    }

    const bloomProbability = (() => {
      if (healthScore === null) return null;
      const temp = toNumber(latestSnapshot?.temperature) ?? 24;
      const hum = toNumber(latestSnapshot?.humidity) ?? 58;
      const light = toNumber(latestSnapshot?.light) ?? 12000;
      const score = clamp(
        (healthScore * 0.55)
        + (clamp(1 - Math.abs(temp - 24) / 12, 0, 1) * 20)
        + (clamp(1 - Math.abs(hum - 60) / 30, 0, 1) * 15)
        + (clamp(1 - Math.abs(light - 14000) / 14000, 0, 1) * 10),
        0,
        100,
      );
      return score;
    })();

    if (bloomProbability !== null) {
      insights.push(`Estimated bloom/yield probability: ${bloomProbability.toFixed(0)}%.`);
    }

    if (insights.length < 4) {
      insights.push(AI_TIPS[(Date.now() / 60000 | 0) % AI_TIPS.length]);
    }

    return insights.slice(0, 8);
  }, [
    healthScore,
    predictions,
    forecastHorizon,
    latestSnapshot,
    thresholds,
    alerts,
  ]);

  const aiTip = useMemo(() => aiInsights[0] ?? AI_TIPS[(Date.now() / 60000 | 0) % AI_TIPS.length], [aiInsights]);

  const notifications = useMemo(() => {
    const remoteNotifications = Array.isArray(notificationsPayload)
      ? notificationsPayload
      : isObject(notificationsPayload)
        ? Object.entries(notificationsPayload).map(([id, value]) => ({ id, ...value }))
        : [];

    const normalizedRemote = remoteNotifications
      .map((item) => ({
        id: String(item.id ?? item.key ?? Math.random().toString(36).slice(2, 8)),
        title: String(item.title ?? 'Notification'),
        message: String(item.message ?? ''),
        severity: String(item.severity ?? item.type ?? 'info'),
        source: String(item.source ?? 'firebase'),
        at: toTimestampMs(item.at ?? item.timestamp ?? item.createdAt) ?? Date.now(),
        read: Boolean(item.read),
      }))
      .sort((a, b) => b.at - a.at);

    const merged = [
      ...alerts.map((alert) => ({
        id: `live-${alert.id}`,
        title: alert.title,
        message: alert.message,
        severity: alert.type,
        source: alert.source,
        at: alert.at,
        read: false,
      })),
      ...normalizedRemote,
    ];

    return Array.from(new Map(merged.map((entry) => [entry.id, entry])).values())
      .sort((a, b) => b.at - a.at)
      .slice(0, 60);
  }, [notificationsPayload, alerts]);

  const dailyReport = useMemo(() => {
    const todayKey = formatDateKey();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const todayRows = normalizedHistory.filter((row) => row.ts >= startOfDay.getTime());

    const zoneSummary = Object.values(zones).map((zone) => {
      const zoneRows = (zone.history ?? []).filter((row) => row.ts >= startOfDay.getTime());
      return {
        zoneId: zone.id,
        avgTemperature: getAverage(zoneRows, 'temperature'),
        avgHumidity: getAverage(zoneRows, 'humidity'),
        avgLight: getAverage(zoneRows, 'light'),
        samples: zoneRows.length,
      };
    });

    return {
      date: todayKey,
      generatedAt: Date.now(),
      sampleCount: todayRows.length,
      averages: {
        temperature: getAverage(todayRows, 'temperature'),
        humidity: getAverage(todayRows, 'humidity'),
        light: getAverage(todayRows, 'light'),
      },
      zoneSummary,
      healthScore,
    };
  }, [normalizedHistory, zones, healthScore]);

  const maintenanceTasks = useMemo(() => {
    const now = Date.now();

    const rawTasks = isObject(maintenancePayload?.tasks)
      ? maintenancePayload.tasks
      : maintenancePayload;

    return DEFAULT_MAINTENANCE_TASKS.map((task) => {
      const persisted = isObject(rawTasks?.[task.key]) ? rawTasks[task.key] : {};
      const intervalDays = toNumber(persisted.intervalDays) ?? task.intervalDays;
      const lastDoneAt = toTimestampMs(persisted.lastDoneAt ?? persisted.last_done_at ?? 0) ?? 0;
      const dueAt = lastDoneAt > 0
        ? lastDoneAt + (intervalDays * 24 * 60 * 60 * 1000)
        : now;
      const daysRemaining = Math.ceil((dueAt - now) / (24 * 60 * 60 * 1000));

      return {
        ...task,
        intervalDays,
        lastDoneAt,
        dueAt,
        daysRemaining,
        status: daysRemaining < 0 ? 'overdue' : daysRemaining <= 2 ? 'due' : 'ok',
      };
    });
  }, [maintenancePayload]);

  const zoneComparison = useMemo(() => (
    Object.values(zones).map((zone) => {
      const rows = zone.history ?? [];
      return {
        zoneId: zone.id,
        temperature: getAverage(rows, 'temperature'),
        humidity: getAverage(rows, 'humidity'),
        light: getAverage(rows, 'light'),
        co2: getAverage(rows, 'co2'),
        ph: getAverage(rows, 'ph'),
        samples: rows.length,
      };
    })
  ), [zones]);

  const energyUsage = useMemo(
    () => buildEstimatedEnergy(controlState.devices, Array.isArray(energyPayload) ? energyPayload : Object.values(energyPayload || {})),
    [controlState.devices, energyPayload],
  );

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unConnected = onValue(connectedRef, (snapshot) => {
      const connected = Boolean(snapshot.val());
      setConnectionStatus(connected ? 'connected' : 'offline');
    });

    const latestRef = ref(db, 'orchidData/latest');
    const unLatest = onValue(latestRef, (snapshot) => {
      const value = snapshot.val();
      const normalized = normalizeSensor(value);
      if (!normalized) return;
      setLatest(normalized);
      setLastUpdate(Date.now());
    });

    const historyRef = query(ref(db, HISTORY_PATH), orderByKey(), limitToLast(3000));
    const unHistory = onValue(historyRef, (snapshot) => {
      const rows = normalizeHistoryRows(snapshot.val())
        .filter((row) => (row.ts ?? 0) > 1704067200000);
      setHistory(rows);
    });

    const growthRef = query(ref(db, 'growthLogs'), orderByKey(), limitToLast(200));
    const unGrowth = onValue(growthRef, (snapshot) => {
      const rows = Array.isArray(snapshot.val()) ? snapshot.val() : Object.values(snapshot.val() || {});
      const ordered = rows
        .filter(Boolean)
        .sort((a, b) => (toTimestampMs(b?.timestamp ?? b?.ts) ?? 0) - (toTimestampMs(a?.timestamp ?? a?.ts) ?? 0));
      setGrowthLogs(ordered);
    });

    const zonesRef = ref(db, 'orchidData/zones');
    const unZones = onValue(zonesRef, (snapshot) => setZonesPayload(snapshot.val() || {}));

    const nodesRef = ref(db, 'orchidData/nodes');
    const unNodes = onValue(nodesRef, (snapshot) => setNodesPayload(snapshot.val() || {}));

    const settingsRef = ref(db, 'orchidData/settings');
    const unSettings = onValue(settingsRef, (snapshot) => setSettingsPayload(snapshot.val() || {}));

    const legacyThresholdRef = ref(db, 'orchidData/thresholds');
    const unLegacyThreshold = onValue(legacyThresholdRef, (snapshot) => setLegacyThresholdPayload(snapshot.val() || {}));

    const controlsRef = ref(db, 'orchidData/controlStates');
    const unControls = onValue(controlsRef, (snapshot) => setControlPayload(snapshot.val() || {}));

    const notificationsRef = query(ref(db, 'orchidData/notifications'), orderByKey(), limitToLast(120));
    const unNotifications = onValue(notificationsRef, (snapshot) => {
      const payload = snapshot.val() || {};
      const rows = Object.entries(payload).map(([id, value]) => ({ id, ...value }));
      setNotificationsPayload(rows);
    });

    const maintenanceRef = ref(db, 'orchidData/maintenance');
    const unMaintenance = onValue(maintenanceRef, (snapshot) => setMaintenancePayload(snapshot.val() || {}));

    const energyRef = query(ref(db, 'orchidData/energyLogs'), orderByKey(), limitToLast(500));
    const unEnergy = onValue(energyRef, (snapshot) => {
      const rows = Array.isArray(snapshot.val()) ? snapshot.val() : Object.values(snapshot.val() || {});
      setEnergyPayload(rows.filter(Boolean));
    });

    return () => {
      unConnected();
      unLatest();
      unHistory();
      unGrowth();
      unZones();
      unNodes();
      unSettings();
      unLegacyThreshold();
      unControls();
      unNotifications();
      unMaintenance();
      unEnergy();
    };
  }, []);

  useEffect(() => {
    let pollTimer;

    const poll = async () => {
      try {
        if (!resolvedDatabaseURL) return;
        const base = resolvedDatabaseURL.replace(/\/$/, '');

        for (const path of LIVE_PATHS) {
          const response = await fetch(`${base}/${path}.json`);
          if (!response.ok) continue;

          const json = await response.json();
          const candidate = getPreferredLatest(json);
          const normalized = normalizeSensor(candidate);
          if (!normalized) continue;

          setLatest((prev) => {
            const prevTs = toTimestampMs(prev?.ts ?? prev?.timestamp) ?? 0;
            return normalized.ts >= prevTs ? normalized : prev;
          });
          setLastUpdate(Date.now());
          break;
        }
      } catch {
        // fallback polling errors are ignored
      }
    };

    poll();
    pollTimer = setInterval(poll, 10000);

    return () => clearInterval(pollTimer);
  }, []);

  useEffect(() => {
    const staleSec = thresholds.staleSeconds ?? DEFAULT_THRESHOLDS.staleSeconds;

    const timer = setInterval(() => {
      if (!lastUpdate) return;
      const stale = (Date.now() - lastUpdate) > (staleSec * 1000);
      if (stale) setConnectionStatus('stale');
      if (!stale && connectionStatus === 'stale') setConnectionStatus('connected');
    }, 1000);

    return () => clearInterval(timer);
  }, [thresholds.staleSeconds, lastUpdate, connectionStatus]);

  useEffect(() => {
    if (!alerts.length) return;

    const publish = async () => {
      const emailEnabled = Boolean(thresholds.notifications?.emailEnabled);
      const recipients = String(thresholds.notifications?.emailRecipients ?? '').trim();

      for (const alert of alerts) {
        if (publishedAlertIdsRef.current.has(alert.id)) continue;
        publishedAlertIdsRef.current.add(alert.id);

        try {
          const notificationRef = push(ref(db, 'orchidData/notifications'));
          await set(notificationRef, {
            title: alert.title,
            message: alert.message,
            severity: alert.type,
            source: alert.source,
            at: alert.at,
            read: false,
          });

          if (emailEnabled && recipients && (alert.type === 'warning' || alert.type === 'critical')) {
            const emailRef = push(ref(db, 'orchidData/emailQueue'));
            await set(emailRef, {
              recipients,
              subject: `[Orchid Alert] ${alert.title}`,
              body: `${alert.message}\n\nSource: ${alert.source}\nTime: ${new Date(alert.at).toLocaleString()}`,
              createdAt: Date.now(),
              status: 'queued',
            });
          }
        } catch {
          // avoid breaking UI if publish fails
        }
      }
    };

    publish();
  }, [alerts, thresholds.notifications]);

  useEffect(() => {
    if (!dailyReport.date || dailyReport.sampleCount < 2) return;

    const signature = `${dailyReport.date}:${dailyReport.sampleCount}`;
    if (persistedReportRef.current === signature) return;

    const persist = async () => {
      try {
        await set(ref(db, `orchidData/reports/daily/${dailyReport.date}`), dailyReport);
        persistedReportRef.current = signature;
      } catch {
        // report persistence failure is non-fatal
      }
    };

    persist();
  }, [dailyReport]);

  const saveThresholdSettings = async (nextThresholds) => {
    const merged = deepMerge(thresholds, nextThresholds);
    await update(ref(db, 'orchidData/settings'), { thresholds: merged });
  };

  const saveNotificationSettings = async (payload) => {
    const merged = deepMerge(thresholds.notifications, payload);
    await update(ref(db, 'orchidData/settings'), {
      thresholds: {
        ...thresholds,
        notifications: merged,
      },
    });
  };

  const setControlMode = async (mode) => {
    await update(ref(db, 'orchidData/controlStates'), {
      mode,
      updatedAt: Date.now(),
    });
  };

  const setDeviceState = async (deviceKey, nextState, actor = 'dashboard') => {
    await update(ref(db, 'orchidData/controlStates'), {
      [`devices/${deviceKey}`]: Boolean(nextState),
      updatedAt: Date.now(),
      updatedBy: actor,
    });

    const eventRef = push(ref(db, 'orchidData/controlEvents'));
    await set(eventRef, {
      deviceKey,
      state: Boolean(nextState),
      actor,
      timestamp: Date.now(),
    });
  };

  const applyAutomaticRules = async (actor = 'auto-rule') => {
    if (!latestSnapshot) return;

    const nextDevices = { ...controlState.devices };

    const temperature = toNumber(latestSnapshot.temperature);
    const humidity = toNumber(latestSnapshot.humidity);
    const light = toNumber(latestSnapshot.light);

    if (temperature !== null) {
      nextDevices.fan = temperature > (thresholds.metrics?.temperature?.max ?? 28);
      nextDevices.ventilation = temperature > ((thresholds.metrics?.temperature?.max ?? 28) - 1.5);
    }

    if (humidity !== null) {
      nextDevices.pump = humidity < (thresholds.metrics?.humidity?.min ?? 45);
    }

    if (light !== null) {
      nextDevices.growLights = light < (thresholds.metrics?.light?.min ?? 1200);
    }

    await update(ref(db, 'orchidData/controlStates'), {
      mode: 'auto',
      autoRulesEnabled: true,
      devices: nextDevices,
      updatedAt: Date.now(),
      updatedBy: actor,
    });
  };

  const setAutoRulesEnabled = async (enabled) => {
    await update(ref(db, 'orchidData/controlStates'), {
      autoRulesEnabled: Boolean(enabled),
      updatedAt: Date.now(),
    });
  };

  const markNotificationRead = async (notificationId) => {
    if (!notificationId) return;
    await update(ref(db, `orchidData/notifications/${notificationId}`), {
      read: true,
      readAt: Date.now(),
    });
  };

  const clearNotifications = async () => {
    const updates = {};
    (Array.isArray(notificationsPayload) ? notificationsPayload : []).forEach((entry) => {
      if (!entry?.id) return;
      updates[`${entry.id}/read`] = true;
      updates[`${entry.id}/readAt`] = Date.now();
    });

    if (Object.keys(updates).length) {
      await update(ref(db, 'orchidData/notifications'), updates);
    }
  };

  const markMaintenanceDone = async (taskKey) => {
    if (!taskKey) return;

    await update(ref(db, `orchidData/maintenance/tasks/${taskKey}`), {
      lastDoneAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  const autoControlRecommendation = useMemo(() => {
    const temp = toNumber(latestSnapshot?.temperature);
    const humidity = toNumber(latestSnapshot?.humidity);
    const light = toNumber(latestSnapshot?.light);
    const co2 = toNumber(latestSnapshot?.co2);

    const suggested = {
      fan: false,
      pump: false,
      growLights: false,
      ventilation: false,
    };

    if (temp !== null && temp > (thresholds.metrics?.temperature?.max ?? 28)) {
      suggested.fan = true;
      suggested.ventilation = true;
    }
    if (humidity !== null && humidity < (thresholds.metrics?.humidity?.min ?? 45)) {
      suggested.pump = true;
    }
    if (light !== null && light < (thresholds.metrics?.light?.min ?? 1200)) {
      suggested.growLights = true;
    }
    if (co2 !== null && co2 > (thresholds.metrics?.co2?.max ?? 1300)) {
      suggested.ventilation = true;
    }

    const confidence = clamp(
      0.32
      + ((predictions.temperature?.confidence ?? 0.45) * 0.26)
      + ((predictions.humidity?.confidence ?? 0.45) * 0.26)
      + ((healthScore ?? 70) / 100 * 0.16),
      0.3,
      0.97,
    );

    return { suggested, confidence };
  }, [latestSnapshot, thresholds, predictions, healthScore]);

  return {
    latest: latestSnapshot,
    history: normalizedHistory,
    growthLogs,
    connectionStatus,
    lastUpdate,
    thresholds,
    alerts,
    notifications,
    diagnostics,
    controlState,
    zones,
    zoneComparison,
    nodeStatuses,
    predictions,
    forecastHorizon,
    healthScore,
    aiTip,
    aiInsights,
    energyUsage,
    maintenanceTasks,
    dailyReport,
    saveThresholdSettings,
    saveNotificationSettings,
    setControlMode,
    setAutoRulesEnabled,
    setDeviceState,
    applyAutomaticRules,
    markNotificationRead,
    clearNotifications,
    markMaintenanceDone,
    autoControlRecommendation,
  };
};
