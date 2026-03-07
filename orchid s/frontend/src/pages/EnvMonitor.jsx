import React from 'react';
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
  const { latest, history, connectionStatus, lastUpdate, alerts, aiTip } = useMonitorData();
  const safeHistory = Array.isArray(history)
    ? history.filter((row) => row && Number.isFinite(Number(row.ts ?? row.timestamp)))
    : [];
  const recentReadings = safeHistory.slice(-12).reverse();

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const formatDate = (timestamp) => {
    const ts = toNumber(timestamp);
    if (ts === null) return '--';
    return new Date(ts).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    });
  };

  const formatTime = (timestamp) => {
    const ts = toNumber(timestamp);
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

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleString();

    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Orchid Environmental Report', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${date}`, 14, 28);
    doc.text(`Status: ${connectionStatus.toUpperCase()}`, 14, 34);

    let y = 50;
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Current Snapshot', 14, y);
    y += 10;

    const headers = ['Metric', 'Value', 'Status'];
    const data = [
      ['Temperature', `${latest?.temperature ?? '--'} °C`,
        (latest?.temperature > 28 || latest?.temperature < 18) ? 'Out of Range' : 'Optimal'],
      ['Humidity', `${latest?.humidity ?? '--'} %`,
        (latest?.humidity < 40 || latest?.humidity > 70) ? 'Warning' : 'Good'],
      ['Light', `${latest?.lux ?? '--'} lx`, 'Normal'],
      ['Air Quality (MQ135)', `${latest?.mq135 ?? '--'}`, (latest?.mq135 > 150) ? 'High' : 'Good']
    ];

    doc.setFontSize(10);
    let rowY = y;
    doc.setFont('helvetica', 'bold');
    doc.text(headers[0], 14, rowY);
    doc.text(headers[1], 80, rowY);
    doc.text(headers[2], 140, rowY);
    rowY += 8;
    doc.line(14, rowY - 6, 190, rowY - 6);

    doc.setFont('helvetica', 'normal');
    data.forEach(row => {
      doc.text(row[0], 14, rowY);
      doc.text(row[1], 80, rowY);
      doc.text(row[2], 140, rowY);
      rowY += 8;
    });

    if (aiTip) {
      rowY += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('AI Insight:', 14, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const splitTip = doc.splitTextToSize(aiTip, 180);
      doc.text(splitTip, 14, rowY + 6);
    }

    doc.save(`Orchid_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-dark tracking-tight">Environmental Monitor</h1>
          <p className="text-subtle">Real-time sensor data and analytics.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 border ${connectionStatus === 'connected' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400' :
            connectionStatus === 'stale' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' :
              'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:text-rose-400'
            }`}>
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
              connectionStatus === 'stale' ? 'bg-amber-500' : 'bg-rose-500'
              }`}></span>
            {connectionStatus === 'connected' ? 'LIVE DATA' : connectionStatus.toUpperCase()}
          </div>

          <button onClick={handleExportPDF} className="btn-soft">
            Export report
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          {alerts.map((alert, idx) => (
            <div key={idx} className={`p-4 rounded-xl flex items-center gap-3 border ${alert.type === 'danger' ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400' :
              alert.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
                'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
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

      {/* AI Insight */}
      {aiTip && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 text-white shadow-lg shadow-teal-200 relative overflow-hidden"
        >
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold backdrop-blur-sm">
              AI
            </div>
            <div>
              <h3 className="font-bold text-white/90 text-sm uppercase tracking-wide mb-1">AI Insight</h3>
              <p className="font-medium text-lg leading-snug">"{aiTip}"</p>
            </div>
          </div>
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 right-20 w-20 h-20 bg-cyan-500/30 rounded-full blur-xl"></div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold text-dark">Current Status</h2>
            </div>
            <SectionErrorBoundary>
              <OverviewCards data={latest} lastUpdate={lastUpdate} />
            </SectionErrorBoundary>
          </section>

          {/* Charts */}
          <section className="panel">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-dark">Analytics Trends</h2>
              <select className="bg-paper border border-border text-sm font-medium rounded-lg px-3 py-1.5 text-subtle outline-none focus:ring-2 focus:ring-primary/20">
                <option>Last Hour</option>
                <option>Last 6 Hours</option>
                <option>Last 24 Hours</option>
              </select>
            </div>
            <SectionErrorBoundary>
              <MonitorCharts history={safeHistory} />
            </SectionErrorBoundary>
          </section>
        </div>

        <aside className="panel xl:sticky xl:top-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-dark">Reading Data</h2>
            <span className="text-xs text-subtle">{recentReadings.length} latest</span>
          </div>

          {recentReadings.length === 0 ? (
            <p className="text-sm text-subtle">No sensor readings yet.</p>
          ) : (
            <div className="space-y-3 max-h-[760px] overflow-y-auto pr-1">
              {recentReadings.map((reading, index) => {
                const readingTs = reading.timestamp ?? reading.ts;
                return (
                  <div
                    key={`${readingTs}-${index}`}
                    className="rounded-xl border border-border/80 bg-paper/60 p-3"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
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
                      <p className="text-dark font-medium">{formatFixed(reading.temperature, 'C', 1)}</p>
                      <p className="text-subtle">Humidity</p>
                      <p className="text-dark font-medium">{formatFixed(reading.humidity, '%', 1)}</p>
                      <p className="text-subtle">Light</p>
                      <p className="text-dark font-medium">{formatInt(reading.lux, 'lx')}</p>
                      <p className="text-subtle">Air (MQ135)</p>
                      <p className="text-dark font-medium">{formatInt(reading.mq135, 'AQI')}</p>
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
