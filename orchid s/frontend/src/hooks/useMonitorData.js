import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { db } from '../lib/firebase';

const normalizeSensor = (val) => {
    if (!val) return null;
    let ts = Number(val.timestamp) || Number(val.ts) || Date.now();

    // Heuristic: If timestamp is in seconds (less than 10 billion), convert to milliseconds
    if (ts < 10000000000) ts *= 1000;

    const temp = Number(val.temperature ?? val.temp ?? val.t ?? 0);
    const hum = Number(val.humidity ?? val.hum ?? val.h ?? 0);
    const luxVal = Number(val.lux ?? val.light ?? val.lx ?? 0);
    const mqVal = Number(val.mq135 ?? val.mq ?? 0);

    return {
        ...val,
        timestamp: ts,
        ts: ts, // for chart compatibility
        temperature: temp,
        humidity: hum,
        lux: luxVal,
        mq135: mqVal,
        t: temp, // shorthand for charts
        h: hum,
        lx: luxVal,
        mq: mqVal
    };
};

export const useMonitorData = (settings) => {
    const [latest, setLatest] = useState(null);
    const [history, setHistory] = useState([]);
    const [growthLogs, setGrowthLogs] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected', 'stale', 'offline'
    const [lastUpdate, setLastUpdate] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [aiTip, setAiTip] = useState(null);

    // Constants representing the "safe" ranges
    const SAFETY_DEFAULTS = useMemo(() => ({
        tMin: 18, tMax: 28,
        hMin: 40, hMax: 70,
        lMin: 1000, lMax: 25000,
        mqWarn: 150,
        staleSec: 15
    }), []);

    const config = useMemo(() => ({ ...SAFETY_DEFAULTS, ...settings }), [SAFETY_DEFAULTS, settings]);

    // Stitch the latest live point into history for ultra-real-time graphs
    const liveHistory = useMemo(() => {
        if (!latest) return history;
        // Don't duplicate if the latest point is already the last one in history
        if (history.length > 0 && history[history.length - 1].timestamp === latest.timestamp) {
            return history;
        }
        const combined = [...history, latest];
        return combined.slice(-100); // Keep last 100
    }, [history, latest]);

    useEffect(() => {
        // 1. Connection Status
        const connectedRef = ref(db, '.info/connected');
        const unsubConnected = onValue(connectedRef, (snap) => {
            const isConnected = !!snap.val();
            setConnectionStatus(isConnected ? 'connected' : 'offline');
        });

        // 2. Latest Data (Live Feed)
        const latestRef = ref(db, 'orchidData/latest');
        const unsubLatest = onValue(latestRef, (snap) => {
            const data = snap.val();
            if (data) {
                const normalized = normalizeSensor(data);
                setLatest(normalized);
                setLastUpdate(Date.now());
            }
        });

        // 3. History (Historical Logs)
        const historyRef = query(ref(db, 'orchidData/logs'), limitToLast(100));
        const unsubHistory = onValue(historyRef, (snap) => {
            const data = snap.val();
            if (data) {
                const rows = Object.values(data)
                    .map(normalizeSensor)
                    // Filter out 1970/junk data (Only keep points from 2025 onwards)
                    .filter(row => row && row.timestamp > 1735689600000)
                    .sort((a, b) => a.timestamp - b.timestamp);
                setHistory(rows);
            }
        });

        // 4. Growth Logs
        const growthRef = query(ref(db, 'growthLogs'), limitToLast(20));
        const unsubGrowth = onValue(growthRef, (snap) => {
            const data = snap.val();
            if (data) {
                const logs = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
                setGrowthLogs(logs);
            }
        });

        return () => {
            unsubConnected();
            unsubLatest();
            unsubHistory();
            unsubGrowth();
        };
    }, []);

    // Check for stale data
    useEffect(() => {
        const interval = setInterval(() => {
            if (lastUpdate && (Date.now() - lastUpdate) > (config.staleSec * 1000)) {
                setConnectionStatus('stale');
            } else {
                setConnectionStatus(prev => prev === 'stale' ? 'connected' : prev);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [lastUpdate, config.staleSec]);

    // Compute Alerts
    useEffect(() => {
        if (!latest) return;

        const newAlerts = [];

        if (latest.temperature < config.tMin || latest.temperature > config.tMax) {
            newAlerts.push({
                type: 'danger',
                icon: '🌡️',
                title: 'Temperature Alert',
                message: `${latest.temperature.toFixed(1)}°C is outside safe range (${config.tMin}-${config.tMax}°C)`
            });
        }

        if (latest.humidity < config.hMin || latest.humidity > config.hMax) {
            newAlerts.push({
                type: 'warning',
                icon: '💧',
                title: 'Humidity Alert',
                message: `${latest.humidity.toFixed(1)}% is outside safe range (${config.hMin}-${config.hMax}%)`
            });
        }

        if (latest.lux < config.lMin) {
            newAlerts.push({ type: 'info', icon: '☀️', title: 'Low Light', message: 'Light levels are low.' });
        } else if (latest.lux > config.lMax) {
            newAlerts.push({ type: 'warning', icon: '☀️', title: 'High Light', message: 'Risk of leaf burn.' });
        }

        if (latest.mq135 > config.mqWarn) {
            newAlerts.push({ type: 'danger', icon: '💨', title: 'Air Quality', message: 'High CO2/VOC levels detected.' });
        }

        setAlerts(newAlerts);
    }, [latest, config]);

    // AI Tip Generation
    useEffect(() => {
        const tips = [
            "Orchids bloom best with a 10°C temperature drop at night.",
            "Yellowing leaves might suggest overwatering.",
            "Good air circulation prevents fungal and bacterial diseases.",
            "Fertilize weakly, weekly!",
            "Repot every 1-2 years to keep roots healthy."
        ];
        setAiTip(tips[Math.floor(Math.random() * tips.length)]);
    }, []);

    return { latest, history: liveHistory, growthLogs, connectionStatus, lastUpdate, alerts, aiTip };
};
