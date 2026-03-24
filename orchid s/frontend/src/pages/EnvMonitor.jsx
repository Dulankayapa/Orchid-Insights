import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';

import { useMonitorData } from '../hooks/useMonitorData';
import { useAuthRole } from '../hooks/useAuthRole';
import { useWeather } from '../hooks/useWeather';

import OverviewCards from '../components/monitor/OverviewCards.jsx';
import MonitorCharts from '../components/monitor/MonitorCharts.jsx';
import ThresholdSettingsPanel from '../components/monitor/ThresholdSettingsPanel.jsx';
import SafeRangesPanel from '../components/monitor/SafeRangesPanel.jsx';
import AutomationControlPanel from '../components/monitor/AutomationControlPanel.jsx';
import NotificationCenter from '../components/monitor/NotificationCenter.jsx';
import GreenhouseLayout from '../components/monitor/GreenhouseLayout.jsx';
import WeatherPanel from '../components/monitor/WeatherPanel.jsx';

import {
  COMPARISON_METRIC_KEYS,
  HISTORY_FILTERS,
  METRIC_DEFINITIONS,
} from '../lib/monitorConfig';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value, decimals = 1) => {
  const num = toNumber(value);
  if (num === null) return '--';
  return num.toFixed(decimals);
};

const formatMetric = (value, metricKey) => {
  const metric = METRIC_DEFINITIONS[metricKey];
  if (!metric) return '--';
  const num = toNumber(value);
  if (num === null) return '--';
  const val = metric.decimals > 0 ? num.toFixed(metric.decimals) : Math.round(num);
  return `${val} ${metric.unit}`;
};

const formatDateTime = (ts) => {
  if (!ts) return '--';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const average = (rows, key) => {
  const values = rows.map((row) => toNumber(row?.[key])).filter((value) => value !== null);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const EnvMonitor = () => {
  const [historyWindow, setHistoryWindow] = useState('24h');
  const [zoneMetric, setZoneMetric] = useState('temperature');
  const [actionMessage, setActionMessage] = useState('');

  const {
    latest,
    history,
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
    autoControlRecommendation,
  } = useMonitorData();

  const {
    user,
    role,
    capabilities: _capabilities,
  } = useAuthRole();
  const canEditSettings = true;
  const canControlPanel = true;

  const { weather, weatherError } = useWeather({});

  const selectedFilter = useMemo(
    () => HISTORY_FILTERS.find((item) => item.value === historyWindow) ?? HISTORY_FILTERS[0],
    [historyWindow]
  );

  const filteredHistory = useMemo(() => {
    if (!selectedFilter.ms) return history;
    const cutoff = Date.now() - selectedFilter.ms;
    const rows = history.filter((row) => row.ts >= cutoff);
    if (rows.length >= 6) return rows;
    return history.slice(-Math.min(120, history.length));
  }, [history, selectedFilter]);

  const previousWindow = useMemo(() => {
    if (!selectedFilter.ms) return [];
    const now = Date.now();
    const start = now - selectedFilter.ms;
    const previousStart = start - selectedFilter.ms;
    return history.filter((row) => row.ts >= previousStart && row.ts < start);
  }, [history, selectedFilter]);

  const comparisonSummary = useMemo(
    () => COMPARISON_METRIC_KEYS.map((key) => {
      const current = average(filteredHistory, key);
      const previous = average(previousWindow, key);
      const delta = (current !== null && previous !== null) ? current - previous : null;
      return { key, current, previous, delta };
    }),
    [filteredHistory, previousWindow]
  );

  const liveFactors = useMemo(() => {
    const keys = ['temperature', 'humidity', 'light', 'co2'];
    return keys.map((key) => {
      const metric = METRIC_DEFINITIONS[key];
      const value = latest?.[key];
      const bounds = thresholds?.metrics?.[key];
      const min = bounds?.min;
      const max = bounds?.max;
      let state = 'No data';
      if (value !== null && value !== undefined) {
        if (min !== undefined && value < min) state = 'Low';
        else if (max !== undefined && value > max) state = 'High';
        else state = 'OK';
      }
      return {
        key,
        label: metric?.label || key,
        value,
        min,
        max,
        state,
      };
    });
  }, [latest, thresholds]);

  const handleGenerateReport = () => {
    const doc = new jsPDF();
    const now = new Date().toLocaleString();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const bottomY = pageHeight - 14;
    const lineHeight = 5;
    const contentWidth = 182;
    let y = 18;

    const ensureSpace = (lineCount = 1) => {
      const needed = (Math.max(1, lineCount) * lineHeight) + 2;
      if ((y + needed) > bottomY) {
        doc.addPage();
        y = 18;
      }
    };

    const writeHeader = (text) => {
      ensureSpace(2);
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(text, marginX, y);
      y += 7;
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
    };

    const writeLine = (text) => {
      const value = String(text ?? '--');
      const wrapped = doc.splitTextToSize(value, contentWidth);
      ensureSpace(wrapped.length);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * lineHeight;
    };

    const writeKV = (label, value) => {
      writeLine(`${label}: ${value ?? '--'}`);
    };

    const writeSpacer = (size = 2) => {
      y += size;
      if (y > bottomY) {
        doc.addPage();
        y = 18;
      }
    };

    const formatPrediction = (prediction) => {
      if (!prediction) return '--';
      const def = METRIC_DEFINITIONS[prediction.key];
      const unit = def?.unit ?? '';
      const decimals = def?.decimals ?? 1;
      const current = prediction.current?.toFixed?.(decimals) ?? '--';
      const projected = prediction.predicted?.toFixed?.(decimals) ?? '--';
      const slope = prediction.slopePerHour?.toFixed?.(decimals) ?? '--';
      const confidence = prediction.confidence !== undefined && prediction.confidence !== null
        ? `${Math.round(prediction.confidence * 100)}%`
        : '--';
      return `Current ${current} ${unit} | Predicted ${forecastHorizon}h ${projected} ${unit} | Slope ${slope} ${unit}/h | Confidence ${confidence}`;
    };

    doc.setFontSize(18);
    doc.setTextColor(15, 23, 42);
    doc.text('Orchid Environment Full Report', marginX, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(31, 41, 55);

    writeHeader('Report Metadata');
    writeKV('Generated', now);
    writeKV('Generated By', user?.email || user?.uid || 'Unknown');
    writeKV('Role', role || 'viewer');
    writeKV('Connection Status', String(connectionStatus || 'unknown').toUpperCase());
    writeKV('Last Update', formatDateTime(lastUpdate));
    writeKV('History Window', selectedFilter.label);
    writeKV('Samples in Window', filteredHistory.length);
    writeKV('Total History Samples', history.length);
    writeKV('Health Score', healthScore === null ? '--' : healthScore.toFixed(1));
    writeKV('Forecast Horizon', `${forecastHorizon}h`);
    writeSpacer();

    writeHeader('Live Sensor Snapshot');
    writeKV('Timestamp', formatDateTime(latest?.ts ?? latest?.timestamp));
    writeKV('Zone', latest?.zoneId || '--');
    writeKV('Node', latest?.nodeId || '--');
    Object.keys(METRIC_DEFINITIONS).forEach((key) => {
      const metric = METRIC_DEFINITIONS[key];
      writeKV(metric.label, formatMetric(latest?.[key], key));
    });
    if (latest?.height_mm !== undefined && latest?.height_mm !== null) {
      writeKV('Plant Height', `${latest.height_mm} mm`);
    }
    writeSpacer();

    writeHeader('Threshold Configuration');
    writeKV('Telemetry Stale Threshold', `${thresholds?.staleSeconds ?? '--'}s`);
    writeKV('Node Offline Threshold', `${thresholds?.offlineSeconds ?? '--'}s`);
    writeKV('Predictive Horizon', `${thresholds?.predictiveHorizonHours ?? '--'}h`);
    writeKV('Email Alerts Enabled', thresholds?.notifications?.emailEnabled ? 'Yes' : 'No');
    writeKV('Email Recipients', thresholds?.notifications?.emailRecipients || '--');
    Object.entries(METRIC_DEFINITIONS).forEach(([key, metric]) => {
      const bounds = thresholds?.metrics?.[key];
      const min = bounds?.min ?? '--';
      const max = bounds?.max ?? '--';
      writeKV(`${metric.label} Range`, `${min} to ${max} ${metric.unit}`);
    });
    writeSpacer();

    writeHeader('Automation and Device Control');
    writeKV('Control Mode', controlState?.mode || '--');
    writeKV('Auto Rules Enabled', controlState?.autoRulesEnabled ? 'Yes' : 'No');
    writeKV(
      'Recommendation Confidence',
      autoControlRecommendation?.confidence !== undefined && autoControlRecommendation?.confidence !== null
        ? `${Math.round(autoControlRecommendation.confidence * 100)}%`
        : '--'
    );
    Object.entries(controlState?.devices || {}).forEach(([deviceKey, isOn]) => {
      writeKV(`Device ${deviceKey}`, isOn ? 'ON' : 'OFF');
    });
    Object.entries(autoControlRecommendation?.suggested || {}).forEach(([deviceKey, shouldOn]) => {
      writeKV(`Recommended ${deviceKey}`, shouldOn ? 'ON' : 'OFF');
    });
    writeSpacer();

    writeHeader('Forecasts');
    writeKV('Temperature Forecast', formatPrediction(predictions?.temperature));
    writeKV('Humidity Forecast', formatPrediction(predictions?.humidity));
    writeKV('Light Forecast', formatPrediction(predictions?.light));
    writeKV('CO2 Forecast', formatPrediction(predictions?.co2));
    writeKV('pH Forecast', formatPrediction(predictions?.ph));
    writeSpacer();

    writeHeader('Daily Summary');
    writeKV('Summary Date', dailyReport?.date || '--');
    writeKV('Summary Generated At', formatDateTime(dailyReport?.generatedAt));
    writeKV('Samples Today', dailyReport?.sampleCount ?? 0);
    writeKV('Average Temperature', formatMetric(dailyReport?.averages?.temperature, 'temperature'));
    writeKV('Average Humidity', formatMetric(dailyReport?.averages?.humidity, 'humidity'));
    writeKV('Average Light', formatMetric(dailyReport?.averages?.light, 'light'));
    writeKV(
      'Daily Health Score',
      dailyReport?.healthScore === null || dailyReport?.healthScore === undefined
        ? '--'
        : Number(dailyReport.healthScore).toFixed(1)
    );
    (dailyReport?.zoneSummary || []).forEach((zone) => {
      writeKV(
        `Zone ${zone.zoneId}`,
        `Temp ${formatMetric(zone.avgTemperature, 'temperature')} | Humidity ${formatMetric(zone.avgHumidity, 'humidity')} | Light ${formatMetric(zone.avgLight, 'light')} | Samples ${zone.samples}`
      );
    });
    writeSpacer();

    writeHeader('Window Comparison Summary');
    comparisonSummary.forEach((item) => {
      const metric = METRIC_DEFINITIONS[item.key];
      const delta = item.delta === null
        ? '--'
        : `${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(metric.decimals)} ${metric.unit}`;
      writeKV(
        metric.label,
        `Current ${formatMetric(item.current, item.key)} | Previous ${formatMetric(item.previous, item.key)} | Delta ${delta}`
      );
    });
    writeSpacer();

    writeHeader('Zone Comparison');
    if (!zoneComparison.length) {
      writeLine('No zone comparison records available.');
    } else {
      zoneComparison.forEach((zone) => {
        writeKV(
          zone.zoneId,
          `Temp ${formatMetric(zone.temperature, 'temperature')} | Humidity ${formatMetric(zone.humidity, 'humidity')} | Light ${formatMetric(zone.light, 'light')} | CO2 ${formatMetric(zone.co2, 'co2')} | pH ${formatMetric(zone.ph, 'ph')} | Samples ${zone.samples}`
        );
      });
    }
    writeSpacer();

    writeHeader('Node Status');
    if (!nodeStatuses.length) {
      writeLine('No node status data available.');
    } else {
      nodeStatuses.forEach((node) => {
        writeKV(
          node.id,
          `Status ${String(node.status || 'unknown').toUpperCase()} | Zone ${node.zoneId || '--'} | Last Seen ${formatDateTime(node.lastSeen)}`
        );
      });
    }
    writeSpacer();

    writeHeader('Alerts');
    if (!alerts.length) {
      writeLine('No active alerts.');
    } else {
      alerts.forEach((alert) => {
        writeKV(
          alert.title,
          `[${String(alert.type || 'info').toUpperCase()}] ${alert.message} | Source: ${alert.source || '--'} | At: ${formatDateTime(alert.at)}`
        );
      });
    }
    writeSpacer();

    writeHeader('Notifications');
    if (!notifications.length) {
      writeLine('No notifications.');
    } else {
      notifications.forEach((entry) => {
        writeKV(
          entry.title,
          `[${entry.read ? 'READ' : 'UNREAD'}] ${entry.message} | Severity: ${entry.severity || '--'} | Source: ${entry.source || '--'} | At: ${formatDateTime(entry.at)}`
        );
      });
    }
    writeSpacer();

    writeHeader('AI Insights');
    writeKV('Top Insight', aiTip || '--');
    if (!aiInsights.length) {
      writeLine('No AI insights available.');
    } else {
      aiInsights.forEach((insight, idx) => {
        writeKV(`Insight ${idx + 1}`, insight);
      });
    }
    writeSpacer();

    writeHeader('Energy Usage');
    writeKV('Today Total', `${formatNumber(energyUsage?.todayTotal, 2)} kWh`);
    writeKV('7-day Total', `${formatNumber(energyUsage?.weekTotal, 2)} kWh`);
    (energyUsage?.daily || []).forEach((row) => {
      writeKV(`Daily ${row.label}`, `${formatNumber(row.kwh, 2)} kWh`);
    });
    (energyUsage?.weekly || []).forEach((row) => {
      writeKV(`Weekly ${row.label}`, `${formatNumber(row.kwh, 2)} kWh`);
    });
    (energyUsage?.perDevice || []).forEach((row) => {
      writeKV(
        `Device ${row.label || row.key}`,
        `${formatNumber(row.kwh, 2)} kWh | State: ${row.isOn ? 'ON' : 'OFF'}`
      );
    });
    writeSpacer();

    writeHeader('Maintenance');
    if (!maintenanceTasks.length) {
      writeLine('No maintenance tasks available.');
    } else {
      maintenanceTasks.forEach((task) => {
        writeKV(
          task.label,
          `Status ${String(task.status || 'ok').toUpperCase()} | Interval ${task.intervalDays}d | Last Done ${formatDateTime(task.lastDoneAt)} | Due ${formatDateTime(task.dueAt)} | Days Remaining ${task.daysRemaining}`
        );
      });
    }
    writeSpacer();

    writeHeader('Diagnostics');
    if (!diagnostics.length) {
      writeLine('No diagnostics issues detected.');
    } else {
      diagnostics.forEach((item) => {
        writeKV(
          item.title,
          `[${String(item.severity || 'info').toUpperCase()}] ${item.detail}`
        );
      });
    }

    doc.save(`orchid-report-${Date.now()}.pdf`);
    setActionMessage('Report exported successfully.');
  };

  const saveThresholds = async (payload) => {
    try {
      if (!canEditSettings) {
        setActionMessage('You do not have permission to update thresholds.');
        return;
      }
      await saveThresholdSettings(payload);
      setActionMessage('Thresholds saved to Firebase.');
    } catch (error) {
      setActionMessage(error?.message || 'Failed to save thresholds.');
    }
  };

  const saveEmailSettings = async (payload) => {
    try {
      if (!canEditSettings) {
        setActionMessage('You do not have permission to update notification settings.');
        return;
      }
      await saveNotificationSettings(payload);
      setActionMessage('Email notification settings updated.');
    } catch (error) {
      setActionMessage(error?.message || 'Failed to save email settings.');
    }
  };

  const updateControlMode = async (mode) => {
    try {
      if (!canControlPanel) {
        setActionMessage('You do not have permission to change control mode.');
        return;
      }
      await setControlMode(mode);
      setActionMessage(`Control mode set to ${mode}.`);
    } catch (error) {
      setActionMessage(error?.message || 'Failed to update control mode.');
    }
  };

  const toggleDevice = async (deviceKey, nextState) => {
    try {
      if (!canControlPanel) {
        setActionMessage('You do not have permission to toggle devices.');
        return;
      }
      await setDeviceState(deviceKey, nextState, role);
      setActionMessage(`${deviceKey} turned ${nextState ? 'ON' : 'OFF'}.`);
    } catch (error) {
      setActionMessage(error?.message || 'Failed to update device state.');
    }
  };

  const applyAutoRulesNow = async () => {
    try {
      if (!canControlPanel) {
        setActionMessage('You do not have permission to apply automatic rules.');
        return;
      }
      await applyAutomaticRules(role);
      setActionMessage('Automatic control rules applied.');
    } catch (error) {
      setActionMessage(error?.message || 'Failed to apply auto rules.');
    }
  };

  const toggleAutoRules = async (enabled) => {
    try {
      if (!canControlPanel) {
        setActionMessage('You do not have permission to update automatic rules.');
        return;
      }
      await setAutoRulesEnabled(enabled);
      setActionMessage(`Automatic rules ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      setActionMessage(error?.message || 'Failed to update automation rule state.');
    }
  };

  const handleMarkNotification = async (id) => {
    try {
      if (String(id).startsWith('live-')) return;
      await markNotificationRead(id);
    } catch {
      // ignore mark read failures
    }
  };

  const onlineNodes = nodeStatuses.filter((node) => node.status === 'online').length;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="title-lg">Environmental Monitoring Dashboard</h1>
          <p className="page-description">
            Real-time orchid analytics with threshold alerts, automation controls, zone comparisons, and predictive insights.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${connectionStatus === 'connected'
            ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
            : connectionStatus === 'stale'
              ? 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
            }`}>
            {connectionStatus.toUpperCase()}
          </span>
          <span className="rounded-full border border-border/60 bg-paper/80 px-3 py-1 text-xs font-semibold text-subtle">
            Last update: {formatDateTime(lastUpdate)}
          </span>
          <button type="button" className="btn-soft rounded-xl px-3 py-2 text-sm" onClick={handleGenerateReport}>
            Export Report
          </button>
        </div>
      </div>

      {actionMessage && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border/70 bg-paper/80 px-4 py-2 text-sm text-subtle"
        >
          {actionMessage}
        </motion.div>
      )}

      {aiTip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative overflow-hidden rounded-[18px] p-6 text-white shadow-[0_16px_36px_-16px_rgba(79,70,229,0.55)]"
          style={{ backgroundImage: 'linear-gradient(135deg, #00b496, #4f46e5)' }}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">AI Insight</p>
          <p className="mt-1 text-lg font-medium">{aiTip}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="module-title">Real-Time Sensor Cards</h2>
              <span className="text-xs text-subtle">Online nodes: {onlineNodes}/{nodeStatuses.length}</span>
            </div>
            <OverviewCards data={latest} lastUpdate={lastUpdate} thresholds={thresholds} />
          </section>

          <section className="panel">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="module-title">Live 4-Factor Comparison</h2>
              <span className="text-xs text-subtle">Updates instantly with incoming telemetry</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-subtle">
                    <th className="pb-2 pr-4 font-semibold">Factor</th>
                    <th className="pb-2 pr-4 font-semibold">Current</th>
                    <th className="pb-2 pr-4 font-semibold">Min</th>
                    <th className="pb-2 pr-4 font-semibold">Max</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {liveFactors.map((item) => {
                    const metric = METRIC_DEFINITIONS[item.key];
                    const formatted = formatMetric(item.value, item.key);
                    const statusTone = item.state === 'OK'
                      ? 'text-emerald-600 dark:text-emerald-300'
                      : item.state === 'No data'
                        ? 'text-subtle'
                        : 'text-rose-600 dark:text-rose-300';
                    return (
                      <tr key={item.key} className="align-top">
                        <td className="py-2 pr-4 font-semibold text-dark">{item.label}</td>
                        <td className="py-2 pr-4 text-dark">{formatted}</td>
                        <td className="py-2 pr-4 text-subtle">{metric ? formatNumber(item.min ?? null, metric.decimals ?? 1) : '--'}</td>
                        <td className="py-2 pr-4 text-subtle">{metric ? formatNumber(item.max ?? null, metric.decimals ?? 1) : '--'}</td>
                        <td className={`py-2 font-semibold ${statusTone}`}>{item.state}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="dashboard-card p-5">
              <h3 className="mb-2 text-sm font-semibold text-dark">Automated Daily Report</h3>
              <p className="text-xs text-subtle">{dailyReport?.date || '--'}</p>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-dark">Avg Temp: {formatMetric(dailyReport?.averages?.temperature, 'temperature')}</p>
                <p className="text-dark">Avg Humidity: {formatMetric(dailyReport?.averages?.humidity, 'humidity')}</p>
                <p className="text-dark">Avg Light: {formatMetric(dailyReport?.averages?.light, 'light')}</p>
                <p className="text-subtle">Samples: {dailyReport?.sampleCount ?? 0}</p>
              </div>
            </div>

            <WeatherPanel weather={weather} weatherError={weatherError} />
          </section>

          <section className="panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="module-title">Historical Analytics & Comparisons</h2>
              <select
                className="input-shell w-auto rounded-xl px-2 py-1.5 text-sm"
                value={historyWindow}
                onChange={(event) => setHistoryWindow(event.target.value)}
              >
                {HISTORY_FILTERS.map((window) => (
                  <option key={window.value} value={window.value}>{window.label}</option>
                ))}
              </select>
            </div>
            <MonitorCharts
              history={filteredHistory}
              previousWindow={previousWindow}
              zoneComparison={zoneComparison}
              zoneMetric={zoneMetric}
              onZoneMetricChange={setZoneMetric}
            />
          </section>

          <section className="space-y-4">
            <div className="panel">
              <div className="flex items-center justify-between gap-2">
                <h2 className="module-title">4-Sensor Limits & Control</h2>
                <span className="text-xs text-subtle">Temperature, Humidity, Light, Air (CO2)</span>
              </div>
            </div>

            <SafeRangesPanel
              thresholds={thresholds}
              canEdit={canEditSettings}
              onSave={saveThresholds}
            />

            <AutomationControlPanel
              controlState={controlState}
              recommendation={autoControlRecommendation}
              canControl={canControlPanel}
              onModeChange={updateControlMode}
              onToggleDevice={toggleDevice}
              onApplyAuto={applyAutoRulesNow}
              onAutoRulesToggle={toggleAutoRules}
            />

            <ThresholdSettingsPanel
              thresholds={thresholds}
              canEdit={canEditSettings}
              onSave={saveThresholds}
              emailSettings={thresholds.notifications}
              onSaveEmail={saveEmailSettings}
              hideMetrics
              title="Email Notifications"
            />
          </section>

          <GreenhouseLayout zones={zones} nodeStatuses={nodeStatuses} />
        </div>

        <aside className="space-y-6 xl:sticky xl:top-4">
          <NotificationCenter
            notifications={notifications}
            onRead={handleMarkNotification}
            onClear={clearNotifications}
          />

          <section className="panel">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="module-title">Predictive Alerts</h2>
              <span className="text-xs text-subtle">Horizon: {forecastHorizon}h</span>
            </div>
            <div className="space-y-2">
              {alerts.length === 0
                ? <p className="text-sm text-subtle">No active alerts.</p>
                : alerts.slice(0, 8).map((alert) => (
                  <div key={alert.id} className="dashboard-card p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-subtle">{alert.source}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${alert.type === 'critical' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}>
                        {alert.type}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-dark">{alert.title}</p>
                    <p className="text-xs text-subtle">{alert.message}</p>
                  </div>
                ))}
            </div>
          </section>

          <section className="panel">
            <h2 className="module-title">AI Recommendations</h2>
            <ul className="mt-3 space-y-2 text-sm text-subtle">
              {aiInsights.map((insight, index) => (
                <li key={index} className="dashboard-card p-3">{insight}</li>
              ))}
            </ul>
          </section>

          <section className="panel">
            <h2 className="module-title">Zone Comparison Table</h2>
            <div className="mt-3 space-y-2">
              {zoneComparison.map((zone) => (
                <div key={zone.zoneId} className="dashboard-card p-3 text-xs">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-sm font-semibold text-dark">{zone.zoneId}</p>
                    <span className="text-subtle">Samples: {zone.samples}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-1">
                    {COMPARISON_METRIC_KEYS.map((key) => (
                      <React.Fragment key={`${zone.zoneId}-${key}`}>
                        <p className="text-subtle">{METRIC_DEFINITIONS[key].label}</p>
                        <p className="text-dark">{formatMetric(zone[key], key)}</p>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2 className="module-title">Visualization Comparison</h2>
            <div className="mt-3 space-y-2">
              {comparisonSummary.map((item) => {
                const metric = METRIC_DEFINITIONS[item.key];
                const delta = item.delta;
                return (
                  <div key={item.key} className="dashboard-card p-3 text-xs">
                    <div className="mb-1 flex items-center justify-between">
                      <p className="font-semibold text-dark">{metric.label}</p>
                      <span className={`font-bold ${delta === null ? 'text-subtle' : delta >= 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                        {delta === null ? '--' : `${delta >= 0 ? '+' : ''}${delta.toFixed(metric.decimals)} ${metric.unit}`}
                      </span>
                    </div>
                    <p className="text-subtle">
                      Current {formatMetric(item.current, item.key)} vs Previous {formatMetric(item.previous, item.key)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default EnvMonitor;
