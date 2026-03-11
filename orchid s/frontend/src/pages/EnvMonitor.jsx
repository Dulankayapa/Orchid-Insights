import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { jsPDF } from 'jspdf';

import { useMonitorData } from '../hooks/useMonitorData';
import { useAuthRole } from '../hooks/useAuthRole';
import { useWeather } from '../hooks/useWeather';

import OverviewCards from '../components/monitor/OverviewCards.jsx';
import MonitorCharts from '../components/monitor/MonitorCharts.jsx';
import HealthGauge from '../components/monitor/HealthGauge.jsx';
import ThresholdSettingsPanel from '../components/monitor/ThresholdSettingsPanel.jsx';
import AutomationControlPanel from '../components/monitor/AutomationControlPanel.jsx';
import NotificationCenter from '../components/monitor/NotificationCenter.jsx';
import GreenhouseLayout from '../components/monitor/GreenhouseLayout.jsx';
import DeviceDiagnosticsPanel from '../components/monitor/DeviceDiagnosticsPanel.jsx';
import EnergyUsagePanel from '../components/monitor/EnergyUsagePanel.jsx';
import WeatherPanel from '../components/monitor/WeatherPanel.jsx';
import MaintenancePanel from '../components/monitor/MaintenancePanel.jsx';
import AuthRolePanel from '../components/monitor/AuthRolePanel.jsx';

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

const downloadBlob = (content, name, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const buildExportRows = (rows) => rows.map((row) => ({
  timestamp: row.ts,
  zone: row.zoneId,
  node: row.nodeId,
  temperature: row.temperature,
  humidity: row.humidity,
  light: row.light,
  co2: row.co2,
  ph: row.ph,
  soilMoisture: row.soilMoisture,
}));

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
    markMaintenanceDone,
    autoControlRecommendation,
  } = useMonitorData();

  const {
    user,
    role,
    capabilities,
    authLoading,
    authError,
    setAuthError,
    login,
    logout,
  } = useAuthRole();

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

  const exportRows = useMemo(() => buildExportRows(filteredHistory), [filteredHistory]);

  const handleExportCSV = () => {
    if (!capabilities.canExport) {
      setActionMessage('Your role cannot export reports.');
      return;
    }

    const headers = Object.keys(exportRows[0] ?? {
      timestamp: '', zone: '', node: '', temperature: '', humidity: '', light: '', co2: '', ph: '', soilMoisture: '',
    });

    const lines = [headers.join(',')];
    exportRows.forEach((row) => {
      const values = headers.map((key) => {
        const value = row[key];
        if (key === 'timestamp') return value ? new Date(value).toISOString() : '';
        if (value === null || value === undefined) return '';
        return `${value}`;
      });
      lines.push(values.join(','));
    });

    downloadBlob(lines.join('\n'), `orchid-history-${Date.now()}.csv`, 'text/csv;charset=utf-8');
    setActionMessage('CSV export generated.');
  };

  const handleExportExcel = () => {
    if (!capabilities.canExport) {
      setActionMessage('Your role cannot export reports.');
      return;
    }

    const headers = Object.keys(exportRows[0] ?? {
      timestamp: '', zone: '', node: '', temperature: '', humidity: '', light: '', co2: '', ph: '', soilMoisture: '',
    });

    const rows = [headers.join('\t')];
    exportRows.forEach((row) => {
      const values = headers.map((key) => {
        const value = row[key];
        if (key === 'timestamp') return value ? new Date(value).toISOString() : '';
        return value ?? '';
      });
      rows.push(values.join('\t'));
    });

    downloadBlob(rows.join('\n'), `orchid-history-${Date.now()}.xls`, 'application/vnd.ms-excel');
    setActionMessage('Excel export generated.');
  };

  const handleExportPdf = () => {
    if (!capabilities.canExport) {
      setActionMessage('Your role cannot export reports.');
      return;
    }

    const doc = new jsPDF();
    const now = new Date().toLocaleString();
    doc.setFontSize(18);
    doc.text('Orchid Environment Report', 14, 18);
    doc.setFontSize(10);
    doc.text(`Generated: ${now}`, 14, 25);
    doc.text(`Window: ${selectedFilter.label}`, 14, 31);
    doc.text(`Health Score: ${healthScore === null ? '--' : healthScore.toFixed(1)}`, 14, 37);

    let y = 46;
    doc.setFontSize(12);
    doc.text('Daily Summary', 14, y);
    y += 7;

    const summaryLines = [
      `Average Temperature: ${formatMetric(dailyReport?.averages?.temperature, 'temperature')}`,
      `Average Humidity: ${formatMetric(dailyReport?.averages?.humidity, 'humidity')}`,
      `Average Light: ${formatMetric(dailyReport?.averages?.light, 'light')}`,
      `Samples Today: ${dailyReport?.sampleCount ?? 0}`,
      `Active Alerts: ${alerts.length}`,
    ];

    summaryLines.forEach((line) => {
      doc.setFontSize(10);
      doc.text(line, 14, y);
      y += 6;
    });

    y += 2;
    doc.setFontSize(12);
    doc.text('Comparison Snapshot', 14, y);
    y += 7;

    comparisonSummary.forEach((item) => {
      doc.setFontSize(10);
      const metric = METRIC_DEFINITIONS[item.key];
      const delta = item.delta === null ? '--' : `${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(metric.decimals)} ${metric.unit}`;
      doc.text(`${metric.label}: now ${formatMetric(item.current, item.key)} | prev ${formatMetric(item.previous, item.key)} | delta ${delta}`, 14, y);
      y += 6;
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save(`orchid-report-${Date.now()}.pdf`);
    setActionMessage('PDF report generated.');
  };

  const saveThresholds = async (payload) => {
    try {
      if (!capabilities.canEditThresholds) {
        setActionMessage('Only Admin can update thresholds.');
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
      if (!capabilities.canEditThresholds) {
        setActionMessage('Only Admin can update notification settings.');
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
      if (!capabilities.canControlDevices) {
        setActionMessage('Your role cannot change control mode.');
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
      if (!capabilities.canControlDevices) {
        setActionMessage('Your role cannot toggle devices.');
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
      if (!capabilities.canControlDevices) {
        setActionMessage('Your role cannot apply automation rules.');
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
      if (!capabilities.canControlDevices) {
        setActionMessage('Your role cannot update automation rules.');
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

  const handleLogin = async (credentials) => {
    try {
      await login(credentials);
    } catch (error) {
      setAuthError(error?.message || 'Authentication failed');
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
          <button type="button" className="btn-soft rounded-xl px-3 py-2 text-sm" onClick={handleExportCSV}>
            CSV
          </button>
          <button type="button" className="btn-soft rounded-xl px-3 py-2 text-sm" onClick={handleExportExcel}>
            Excel
          </button>
          <button type="button" className="btn-soft rounded-xl px-3 py-2 text-sm" onClick={handleExportPdf}>
            PDF
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

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <HealthGauge score={healthScore} />

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

          <ThresholdSettingsPanel
            thresholds={thresholds}
            canEdit={capabilities.canEditThresholds}
            onSave={saveThresholds}
            emailSettings={thresholds.notifications}
            onSaveEmail={saveEmailSettings}
          />

          <AutomationControlPanel
            controlState={controlState}
            recommendation={autoControlRecommendation}
            canControl={capabilities.canControlDevices}
            onModeChange={updateControlMode}
            onToggleDevice={toggleDevice}
            onApplyAuto={applyAutoRulesNow}
            onAutoRulesToggle={toggleAutoRules}
          />

          <EnergyUsagePanel energyUsage={energyUsage} />

          <GreenhouseLayout zones={zones} nodeStatuses={nodeStatuses} />

          <MaintenancePanel tasks={maintenanceTasks} onMarkDone={markMaintenanceDone} />

          <DeviceDiagnosticsPanel diagnostics={diagnostics} nodeStatuses={nodeStatuses} />
        </div>

        <aside className="space-y-6 xl:sticky xl:top-4">
          <AuthRolePanel
            user={user}
            role={role}
            authLoading={authLoading}
            authError={authError}
            onLogin={handleLogin}
            onLogout={logout}
          />

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
