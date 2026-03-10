import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMonitorData } from '../hooks/useMonitorData';
import OverviewCards from '../components/monitor/OverviewCards.jsx';
import MonitorCharts from '../components/monitor/MonitorCharts.jsx';
import { jsPDF } from 'jspdf';

class SectionErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('EnvMonitor section render error:', error);
  }

  render() {
    if (this.state.hasError) {
      return <div className="text-sm text-rose-500">This section failed to render.</div>;
    }
    return this.props.children;
  }
}

const EnvMonitor = () => {
  const { latest, history, growthLogs, connectionStatus, lastUpdate, alerts, aiTip } = useMonitorData();
  const [showCharts, setShowCharts] = useState(true);
  const safeHistory = Array.isArray(history)
    ? history.filter((row) => row && Number.isFinite(Number(row.ts ?? row.timestamp)))
    : [];
  const recentReadings = safeHistory.slice(-12).reverse();

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toTimestampMs = (value) => {
    const ts = toNumber(value);
    if (ts === null) return null;
    return ts < 10000000000 ? ts * 1000 : ts;
  };

  const formatDate = (timestamp) => {
    const ts = toTimestampMs(timestamp);
    if (ts === null) return '--';
    return new Date(ts).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const formatTime = (timestamp) => {
    const ts = toTimestampMs(timestamp);
    if (ts === null) return '--';
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatFixed = (value, unit, digits = 1) => {
    const num = toNumber(value);
    if (num === null) return '--';
    return `${num.toFixed(digits)} ${unit}`;
  };

  const formatInt = (value, unit) => {
    const num = toNumber(value);
    if (num === null) return '--';
    return `${Math.round(num)} ${unit}`;
  };

  const formatDateTime = (timestamp) => {
    const ts = toTimestampMs(timestamp);
    if (ts === null) return '--';
    return new Date(ts).toLocaleString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getHeightMm = (entry) => {
    const mm = toNumber(entry?.height_mm ?? entry?.height ?? entry?.heightMm ?? entry?.heightMM ?? entry?.current_height);
    if (mm !== null) return mm;
    const cm = toNumber(entry?.height_cm ?? entry?.heightCm);
    return cm !== null ? cm * 10 : null;
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleString();
    const marginX = 14;
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentBottom = pageHeight - 16;
    let y = 50;

    const ensureSpace = (needed = 8) => {
      if (y + needed <= contentBottom) return;
      doc.addPage();
      y = 20;
    };

    const getLogTimestamp = (log) => {
      const direct = toTimestampMs(log?.timestamp ?? log?.ts ?? log?.time ?? log?.logged_at ?? log?.loggedAt);
      if (direct !== null) return direct;
      if (!log?.date) return null;
      const parsed = Date.parse(log.date);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const normalizedGrowthLogs = (Array.isArray(growthLogs) ? growthLogs : [])
      .map((log) => ({
        timestamp: getLogTimestamp(log),
        jarId: String(log?.jarId ?? log?.jar_id ?? log?.jar ?? log?.plantId ?? log?.plant_id ?? '--'),
        heightMm: getHeightMm(log),
        status: String(log?.predicted_label ?? log?.classification ?? log?.status ?? '--')
      }))
      .filter((log) => log.timestamp !== null || log.heightMm !== null || log.jarId !== '--')
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));

    const latestGrowthLogs = normalizedGrowthLogs.slice(0, 8);
    const loggedHeights = normalizedGrowthLogs
      .map((log) => log.heightMm)
      .filter((value) => value !== null);
    const latestSensorHeight = getHeightMm(latest || {});
    const latestLoggedHeight = latestGrowthLogs.find((log) => log.heightMm !== null)?.heightMm ?? null;
    const latestHeight = latestSensorHeight ?? latestLoggedHeight;
    const averageLoggedHeight = loggedHeights.length
      ? loggedHeights.reduce((sum, value) => sum + value, 0) / loggedHeights.length
      : null;

    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Orchid Environmental Report', marginX, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${date}`, marginX, 28);
    doc.text(`Status: ${connectionStatus.toUpperCase()}`, marginX, 34);

    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Current Snapshot', marginX, y);
    y += 10;

    const temp = toNumber(latest?.temperature);
    const humidity = toNumber(latest?.humidity);
    const lux = toNumber(latest?.lux);
    const air = toNumber(latest?.mq135);

    const headers = ['Metric', 'Value', 'Status'];
    const data = [
      ['Temperature', temp === null ? '--' : `${temp.toFixed(1)} \u00B0C`,
        temp === null ? 'No data' : (temp > 28 || temp < 18) ? 'Out of Range' : 'Optimal'],
      ['Humidity', humidity === null ? '--' : `${humidity.toFixed(1)} %`,
        humidity === null ? 'No data' : (humidity < 40 || humidity > 70) ? 'Warning' : 'Good'],
      ['Light', lux === null ? '--' : `${Math.round(lux)} lx`, lux === null ? 'No data' : 'Normal'],
      ['Air Quality (MQ135)', air === null ? '--' : `${Math.round(air)}`, air === null ? 'No data' : (air > 150) ? 'High' : 'Good'],
      ['Plant Height', latestHeight === null ? '--' : `${latestHeight.toFixed(1)} mm`, latestHeight === null ? 'No data' : 'Tracking']
    ];

    doc.setFontSize(10);
    let rowY = y;
    doc.setFont('helvetica', 'bold');
    doc.text(headers[0], marginX, rowY);
    doc.text(headers[1], 80, rowY);
    doc.text(headers[2], 140, rowY);
    rowY += 8;
    doc.line(marginX, rowY - 6, 190, rowY - 6);

    doc.setFont('helvetica', 'normal');
    data.forEach((row) => {
      doc.text(row[0], marginX, rowY);
      doc.text(row[1], 80, rowY);
      doc.text(row[2], 140, rowY);
      rowY += 8;
    });

    if (aiTip) {
      rowY += 10;
      if (rowY + 16 > contentBottom) {
        doc.addPage();
        rowY = 20;
      }
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('AI Insight:', marginX, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const splitTip = doc.splitTextToSize(aiTip, 180);
      doc.text(splitTip, marginX, rowY + 6);
      rowY += splitTip.length * 5 + 8;
    }

    y = rowY + 4;
    ensureSpace(12);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Growth Logs & Height', marginX, y);
    y += 8;

    if (!latestGrowthLogs.length) {
      ensureSpace(8);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('No growth logs available yet.', marginX, y);
      y += 8;
    } else {
      ensureSpace(9);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Date / Time', marginX, y);
      doc.text('Jar', 84, y);
      doc.text('Height', 114, y);
      doc.text('Status', 145, y);
      y += 6;
      doc.line(marginX, y - 4, 190, y - 4);
      doc.setFont('helvetica', 'normal');

      latestGrowthLogs.forEach((log) => {
        ensureSpace(8);
        const jarText = log.jarId.length > 12 ? `${log.jarId.slice(0, 12)}...` : log.jarId;
        const statusText = log.status.length > 20 ? `${log.status.slice(0, 20)}...` : log.status;

        doc.text(formatDateTime(log.timestamp), marginX, y);
        doc.text(jarText, 84, y);
        doc.text(log.heightMm === null ? '--' : `${log.heightMm.toFixed(1)} mm`, 114, y);
        doc.text(statusText || '--', 145, y);
        y += 7;
      });
    }

    const minHeight = loggedHeights.length ? Math.min(...loggedHeights) : null;
    const maxHeight = loggedHeights.length ? Math.max(...loggedHeights) : null;
    ensureSpace(26);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Height Summary', marginX, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    [
      `Latest recorded height: ${latestHeight === null ? '--' : `${latestHeight.toFixed(1)} mm`}`,
      `Average logged height: ${averageLoggedHeight === null ? '--' : `${averageLoggedHeight.toFixed(1)} mm`}`,
      `Height range: ${minHeight === null || maxHeight === null ? '--' : `${minHeight.toFixed(1)} mm to ${maxHeight.toFixed(1)} mm`}`,
      `Growth log count: ${normalizedGrowthLogs.length}`,
    ].forEach((line) => {
      ensureSpace(6);
      doc.text(line, marginX, y);
      y += 5;
    });

    ensureSpace(14);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Project Summary', marginX, y);
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    const projectSummary = [
      'Orchid Insights is a smart orchid-care platform that combines IoT monitoring, growth tracking, and AI-assisted guidance for hydroponic cultivation.',
      'The system monitors temperature, humidity, light, air quality, and plant height in real time using Firebase live data streams.',
      'Core modules in this project include Dashboard, Culture Details, Growth Tracker, Growth History, Plant Database, Firebase Table, Env Monitor, and Orchid Companion.',
      'The frontend is built with React, while FastAPI and ML services power growth analysis and predictive insights.',
      `Current system snapshot in this report: ${safeHistory.length} environmental readings, ${normalizedGrowthLogs.length} growth logs, ${alerts.length} active alert${alerts.length === 1 ? '' : 's'}, status ${connectionStatus.toUpperCase()}.`,
    ];
    const moduleDetails = [
      'Culture Details: Manage culture and reculture records, rack placement, orchid type, and nutrition notes.',
      'Growth Tracker: Analyze plant growth using age and height to generate predictive growth status.',
      'Growth History: View jar-wise historical height trends with comparison and rack-based analysis.',
      'Plant Database: Browse and search stored orchid plant records synced from backend and Firebase.',
      'Firebase Table: Inspect live sensor payloads and merged values from Firebase in tabular form.',
      'Env Monitor: Track real-time temperature, humidity, light, air quality, alerts, and AI tips.',
      'Orchid Companion: Get context-aware orchid care guidance using live monitor sensor data.'
    ];

    projectSummary.forEach((line) => {
      const wrapped = doc.splitTextToSize(`- ${line}`, 180);
      ensureSpace(wrapped.length * 5 + 1);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 5 + 1;
    });

    ensureSpace(12);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Module Details', marginX, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    moduleDetails.forEach((line) => {
      const wrapped = doc.splitTextToSize(`- ${line}`, 180);
      ensureSpace(wrapped.length * 5 + 1);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 5 + 1;
    });

    doc.save(`Orchid_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="title-lg">Environmental Monitor</h1>
          <p className="page-description">Real-time sensor data and analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' :
            connectionStatus === 'stale' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' :
              'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400'
            }`}>
            <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
              connectionStatus === 'stale' ? 'bg-amber-500' : 'bg-rose-500'
              }`}></span>
            {connectionStatus === 'connected' ? 'LIVE DATA' : connectionStatus.toUpperCase()}
          </div>

          <button onClick={handleExportPDF} className="btn-soft">
            Export report
          </button>
        </div>
      </div>

      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          {alerts.map((alert, idx) => (
            <div key={idx} className={`dashboard-card flex items-center gap-3 p-4 ${alert.type === 'danger' ? 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400' :
              alert.type === 'warning' ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
              }`}>
              <span className="text-xl">{alert.icon}</span>
              <div className="flex-1">
                <strong className="block text-sm font-bold">{alert.title}</strong>
                <span className="text-sm opacity-90">{alert.message}</span>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {aiTip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative overflow-hidden rounded-[18px] p-6 text-white shadow-[0_16px_36px_-16px_rgba(79,70,229,0.55)]"
          style={{ backgroundImage: 'linear-gradient(135deg, #00b496, #4f46e5)' }}
        >
          <div className="relative z-10 flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-sm font-bold backdrop-blur-sm">
              AI
            </div>
            <div>
              <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-white/90">AI Insight</h3>
              <p className="text-lg font-medium leading-snug">"{aiTip}"</p>
            </div>
          </div>
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute bottom-0 right-20 h-20 w-20 rounded-full bg-cyan-500/30 blur-xl"></div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="module-title">Current Status</h2>
            </div>
            <SectionErrorBoundary>
              <OverviewCards data={latest} lastUpdate={lastUpdate} />
            </SectionErrorBoundary>
          </section>

          <section className="panel">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="module-title">Analytics Trends</h2>
              <div className="flex items-center gap-2">
                <select className="input-shell w-auto rounded-xl px-3 py-1.5 text-subtle">
                  <option>Last Hour</option>
                  <option>Last 6 Hours</option>
                  <option>Last 24 Hours</option>
                </select>
                <button
                  type="button"
                  onClick={() => setShowCharts((prev) => !prev)}
                  className="btn-soft rounded-xl px-3 py-1.5 text-sm"
                  aria-expanded={showCharts}
                >
                  {showCharts ? 'Hide Charts' : 'Show Charts'}
                </button>
              </div>
            </div>
            {showCharts ? (
              <SectionErrorBoundary>
                <MonitorCharts history={safeHistory} />
              </SectionErrorBoundary>
            ) : (
              <div className="dashboard-card p-4 text-sm text-subtle">
                Charts are hidden. Click <span className="font-semibold text-dark">Show Charts</span> to view trends.
              </div>
            )}
          </section>
        </div>

        <aside className="panel xl:sticky xl:top-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="module-title">Reading Data</h2>
            <span className="text-xs text-subtle">{recentReadings.length} latest</span>
          </div>

          {recentReadings.length === 0 ? (
            <p className="text-sm text-subtle">No sensor readings yet.</p>
          ) : (
            <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
              {recentReadings.map((reading, index) => {
                const readingTs = reading.timestamp ?? reading.ts;
                return (
                  <div
                    key={`${readingTs}-${index}`}
                    className="dashboard-card dashboard-card-hover p-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-subtle">
                        Sensor reading
                      </p>
                      <div className="text-right">
                        <p className="text-xs font-medium text-dark">{formatTime(readingTs)}</p>
                        <p className="text-[11px] text-subtle">{formatDate(readingTs)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <p className="text-subtle">Temp</p>
                      <p className="font-medium text-dark">{formatFixed(reading.temperature, 'C', 1)}</p>
                      <p className="text-subtle">Humidity</p>
                      <p className="font-medium text-dark">{formatFixed(reading.humidity, '%', 1)}</p>
                      <p className="text-subtle">Light</p>
                      <p className="font-medium text-dark">{formatInt(reading.lux, 'lx')}</p>
                      <p className="text-subtle">Air (MQ135)</p>
                      <p className="font-medium text-dark">{formatInt(reading.mq135, 'AQI')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default EnvMonitor;
