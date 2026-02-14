import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { useMonitorData } from '../hooks/useMonitorData';
import OverviewCards from '../components/monitor/OverviewCards.jsx';
import MonitorCharts from '../components/monitor/MonitorCharts.jsx';
import GrowthPanel from '../components/monitor/GrowthPanel.jsx';
import { jsPDF } from 'jspdf';
// import html2canvas from 'html2canvas'; // Reserved for future chart export

const EnvMonitor = () => {
  const { latest, history, growthLogs, connectionStatus, alerts, aiTip } = useMonitorData();
  const pdfRef = useRef();

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const date = new Date().toLocaleString();

    // Title
    doc.setFontSize(20);
    doc.setTextColor(40, 40, 40);
    doc.text('Orchid Environmental Report', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${date}`, 14, 28);

    // Connection Status
    doc.text(`Status: ${connectionStatus.toUpperCase()}`, 14, 34);

    // Snapshot Data Table
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

    // Draw Table Manually (Simple version)
    doc.setFontSize(10);
    let rowY = y;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.text(headers[0], 14, rowY);
    doc.text(headers[1], 80, rowY);
    doc.text(headers[2], 140, rowY);
    rowY += 8;
    doc.line(14, rowY - 6, 190, rowY - 6); // Underline

    // Rows
    doc.setFont('helvetica', 'normal');
    data.forEach(row => {
      doc.text(row[0], 14, rowY);
      doc.text(row[1], 80, rowY);
      doc.text(row[2], 140, rowY);
      rowY += 8;
    });

    // Add Note
    if (aiTip) {
      rowY += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('AI Insight:', 14, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      // Text wrapping
      const splitTip = doc.splitTextToSize(aiTip, 180);
      doc.text(splitTip, 14, rowY + 6);
    }

    doc.save(`Orchid_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md://items-center justify-between gap-4">
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

          <button onClick={handleExportPDF} className="bg-paper border border-border text-subtle px-4 py-2 rounded-xl text-sm font-bold hover:bg-primary/5 hover:text-primary transition-colors shadow-sm">
            📄 Export Report
          </button>
        </div>
      </div>

      {/* Alerts Section (Only shows if active) */}
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
          className="bg-gradient-to-r from-fuchsia-600 to-purple-600 rounded-2xl p-6 text-white shadow-lg shadow-fuchsia-200 relative overflow-hidden"
        >
          <div className="relative z-10 flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl backdrop-blur-sm">
              🤖
            </div>
            <div>
              <h3 className="font-bold text-white/90 text-sm uppercase tracking-wide mb-1">AI Insight</h3>
              <p className="font-medium text-lg leading-snug">"{aiTip}"</p>
            </div>
          </div>
          {/* Decor tokens */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 right-20 w-20 h-20 bg-purple-500/30 rounded-full blur-xl"></div>
        </motion.div>
      )}

      {/* Key Metrics Grid */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-dark">Current Status</h2>
        </div>
        <OverviewCards data={latest} />
      </section>

      {/* Charts */}
      <section className="bg-paper/50 rounded-3xl p-6 border border-border/50">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-dark">Analytics Trends</h2>
          <select className="bg-paper border border-border text-sm font-medium rounded-lg px-3 py-1.5 text-subtle outline-none focus:ring-2 focus:ring-primary/20">
            <option>Last Hour</option>
            <option>Last 6 Hours</option>
            <option>Last 24 Hours</option>
          </select>
        </div>
        <MonitorCharts history={history} />
      </section>

      {/* Growth Logs */}
      <section>
        <h2 className="text-xl font-bold text-dark mb-4">Growth Journal</h2>
        <GrowthPanel logs={growthLogs} />
      </section>

    </div>
  );
};

export default EnvMonitor;
