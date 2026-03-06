import { useState, useEffect } from 'react';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { db } from '../lib/firebase'; // Correct path to firebase config

const JAR_PATHS = ['Jar1', 'Jar2', 'Jar3'];
const PRIMARY_JAR = 'Jar1';

const toNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const normalizeJar = (data) => ({
    temperature: toNumber(data?.temperature ?? data?.temp),
    humidity: toNumber(data?.humidity ?? data?.hum),
    lux: toNumber(data?.lux ?? data?.light ?? data?.lx),
    mq135: toNumber(data?.mq135 ?? data?.mq),
    height: toNumber(data?.height ?? data?.height_mm ?? data?.heightCm),
    timestamp: toNumber(data?.timestamp) || Date.now()
});

export const useMonitorData = (settings) => {
    const [latest, setLatest] = useState(null);
    const [history, setHistory] = useState([]);
    const [growthLogs, setGrowthLogs] = useState([]);
    const [jarReadings, setJarReadings] = useState({});
    const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected', 'stale', 'offline'
    const [lastUpdate, setLastUpdate] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [aiTip, setAiTip] = useState(null);

    // Constants representing the "safe" ranges (can be passed via settings or hardcoded defaults)
    const SAFETY_DEFAULTS = {
        tMin: 18, tMax: 28,
        hMin: 40, hMax: 70,
        lMin: 1000, lMax: 25000,
        mqWarn: 150,
        staleSec: 15
    };

    const config = { ...SAFETY_DEFAULTS, ...settings };

    useEffect(() => {
        // 1. Connection Status
        const connectedRef = ref(db, '.info/connected');
        const unsubConnected = onValue(connectedRef, (snap) => {
            const isConnected = !!snap.val();
            setConnectionStatus(isConnected ? 'connected' : 'offline');
        });

        // 2. Latest Data
        const latestRef = ref(db, 'orchidData/latest');
        const unsubLatest = onValue(latestRef, (snap) => {
            const data = snap.val();
            if (data) {
                setLatest(data);
                setLastUpdate(Date.now());

                // Update history with new point
                setHistory(prev => {
                    const newPoint = {
                        ts: Date.now(),
                        t: data.temperature,
                        h: data.humidity,
                        lx: data.lux,
                        mq: data.mq135
                    };
                    // Keep last 100 points
                    const newHistory = [...prev, newPoint];
                    return newHistory.slice(-100);
                });
            }
        });

        // 2b. Jar Readings (Realtime DB)
        const jarUnsubs = JAR_PATHS.map((jarKey) => {
            const jarRef = ref(db, jarKey);
            return onValue(jarRef, (snap) => {
                const data = snap.val();
                if (!data) return;
                const normalized = normalizeJar(data);
                setJarReadings((prev) => ({ ...prev, [jarKey]: normalized }));

                if (jarKey === PRIMARY_JAR) {
                    setLatest(normalized);
                    setLastUpdate(Date.now());
                    setHistory(prev => {
                        const newPoint = {
                            ts: normalized.timestamp || Date.now(),
                            t: normalized.temperature,
                            h: normalized.humidity,
                            lx: normalized.lux,
                            mq: normalized.mq135
                        };
                        const newHistory = [...prev, newPoint];
                        return newHistory.slice(-100);
                    });
                }
            });
        });

        // 3. Growth Logs
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
            unsubGrowth();
            jarUnsubs.forEach((off) => off());
        };
    }, []);

    // Check for stale data
    useEffect(() => {
        const interval = setInterval(() => {
            if (lastUpdate && (Date.now() - lastUpdate) > (config.staleSec * 1000)) {
                setConnectionStatus('stale');
            } else if (connectionStatus === 'stale') {
                setConnectionStatus('connected');
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [lastUpdate, connectionStatus, config.staleSec]);

    // Compute Alerts & Tips
    useEffect(() => {
        if (!latest) return;

        const newAlerts = [];

        // Temperature
        if (latest.temperature < config.tMin || latest.temperature > config.tMax) {
            newAlerts.push({
                type: 'danger',
                icon: '🌡️',
                title: 'Temperature Alert',
                message: `${latest.temperature}°C is outside safe range (${config.tMin}-${config.tMax}°C)`
            });
        }

        // Humidity
        if (latest.humidity < config.hMin || latest.humidity > config.hMax) {
            newAlerts.push({
                type: 'warning',
                icon: '💧',
                title: 'Humidity Alert',
                message: `${latest.humidity}% is outside safe range (${config.hMin}-${config.hMax}%)`
            });
        }

        // Light
        if (latest.lux < config.lMin) {
            newAlerts.push({ type: 'info', icon: '☀️', title: 'Low Light', message: 'Light levels are low for active growth.' });
        } else if (latest.lux > config.lMax) {
            newAlerts.push({ type: 'warning', icon: '☀️', title: 'High Light', message: 'Risk of leaf burn.' });
        }

        // MQ135
        if (latest.mq135 > config.mqWarn) {
            newAlerts.push({ type: 'danger', icon: '💨', title: 'Air Quality', message: 'High CO2/VOC levels detected.' });
        }

        setAlerts(newAlerts);

    }, [latest, config]);

    // AI Tip Generation - Stable (Run once on mount)
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

    return { latest, history, growthLogs, jarReadings, connectionStatus, alerts, aiTip };
};
