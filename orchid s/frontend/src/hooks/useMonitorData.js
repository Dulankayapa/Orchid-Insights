import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, query, limitToLast, orderByKey } from 'firebase/database';
import { db } from '../lib/firebase'; // Correct path to firebase config

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
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [lastUpdate, setLastUpdate] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [aiTip, setAiTip] = useState(null);

    // Constants representing the "safe" ranges (can be passed via settings or hardcoded defaults)
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
        const connectedRef = ref(db, '.info/connected');
        const unsubConnected = onValue(connectedRef, (snap) => {
            const isConnected = !!snap.val();
            setConnectionStatus(isConnected ? 'connected' : 'offline');
        });

        // 2. Latest Data (Live Feed - updates cards every second/reading)
        const latestRef = ref(db, 'orchidData/latest');
        const unsubLatest = onValue(latestRef, (snap) => {
            const data = snap.val();
            console.log('Firebase latest data received:', data);
            if (data) {
                const normalized = normalizeSensor(data);
                setLatest(normalized);
                setLastUpdate(Date.now());
            }
        });

        // 3. History (Historical Logs - used for the bulk of the graph)
        const historyRef = query(ref(db, 'orchidData/logs'), limitToLast(100));
        const unsubHistory = onValue(historyRef, (snap) => {
            const data = snap.val();
            if (data) {
                const rows = Object.values(data)
                    .map(normalizeSensor)
                    // Filter out 1970/junk data (Only keep points from 2025 onwards)
                    .filter(row => row.timestamp > 1735689600000)
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

    // Live fallback history so graphs still move when logs are absent.
    useEffect(() => {
        if (!latest) return;
        setHistory((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.timestamp === latest.timestamp) return prev;
            return [...prev, latest].slice(-100);
        });
    }, [latest]);

    // Keep cards/alerts synced with the freshest history point as well.
    useEffect(() => {
        if (!history.length) return;

        const newest = history[history.length - 1];
        if (!newest) return;

        const newestTs = Number(newest.timestamp ?? newest.ts);
        if (!Number.isFinite(newestTs)) return;

        setLatest((prev) => {
            if (!prev) return newest;

            const prevTs = Number(prev.timestamp ?? prev.ts);
            if (!Number.isFinite(prevTs) || newestTs > prevTs) return newest;

            if (newestTs === prevTs) {
                const keys = ['temperature', 'humidity', 'lux', 'mq135'];
                const prevMissing = keys.some((key) => prev[key] === null || prev[key] === undefined);
                const newestHasValue = keys.some((key) => newest[key] !== null && newest[key] !== undefined);
                if (prevMissing && newestHasValue) return { ...prev, ...newest };
            }

            return prev;
        });
    }, [history]);

    // REST polling safety-net: keep polling RTDB endpoints so UI stays live even if realtime listeners fail.
    useEffect(() => {
        let pollId = null;

        const fetchLatestViaRest = async () => {
            try {
                const base = DB_URL.replace(/\/$/, '');
                for (const path of LIVE_PATHS) {
                    const res = await fetch(`${base}/${path}.json`);
                    if (!res.ok) continue;
                    const data = await res.json();
                    const candidate = extractLiveCandidate(data);
                    if (!candidate) continue;

                    const normalized = normalizeSensor(candidate);
                    if (!normalized) continue;

                    setLatest((prev) => {
                        if (!prev || normalized.timestamp >= prev.timestamp) return normalized;
                        return prev;
                    });
                    setLastUpdate(Date.now());
                    setConnectionStatus('connected');
                }
            } catch (err) {
                // ignore network errors
            }
        };

        const fetchHistoryViaRest = async () => {
            try {
                const base = DB_URL.replace(/\/$/, '');
                const res = await fetch(`${base}/orchidData/logs.json?orderBy="$key"&limitToLast=100`);
                if (!res.ok) return;
                const data = await res.json();
                if (data) {
                    const rows = Object.values(data)
                        .map(normalizeSensor)
                        .filter(Boolean)
                        .sort((a, b) => a.timestamp - b.timestamp);
                    setHistory(rows);
                }
            } catch (err) {
                // ignore
            }
        };
        fetchLatestViaRest();
        fetchHistoryViaRest();
        pollId = setInterval(() => {
            fetchLatestViaRest();
            fetchHistoryViaRest();
        }, 5000);

        return () => {
            if (pollId) clearInterval(pollId);
        };
    }, [DB_URL]);

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

        // Temperature
        if (latest.temperature < config.tMin || latest.temperature > config.tMax) {
            newAlerts.push({
                type: 'danger',
                icon: '🌡️',
                title: 'Temperature Alert',
                message: `${latest.temperature.toFixed(1)}°C is outside safe range (${config.tMin}-${config.tMax}°C)`
            });
        }

        // Humidity
        if (latest.humidity < config.hMin || latest.humidity > config.hMax) {
            newAlerts.push({
                type: 'warning',
                icon: '💧',
                title: 'Humidity Alert',
                message: `${latest.humidity.toFixed(1)}% is outside safe range (${config.hMin}-${config.hMax}%)`
            });
        }

        // Light
        if (latest.lux < config.lMin) {
            newAlerts.push({ type: 'info', icon: '☀️', title: 'Low Light', message: 'Light levels are low.' });
        } else if (latest.lux > config.lMax) {
            newAlerts.push({ type: 'warning', icon: '☀️', title: 'High Light', message: 'Risk of leaf burn.' });
        }

        if (typeof latest.mq135 === 'number') {
            if (latest.mq135 < 0) {
                newAlerts.push({ type: 'danger', icon: 'Air', title: 'CO2 Low', message: 'Gas/CO2 level is below safe range.' });
            } else if (latest.mq135 > config.mqWarn) {
                newAlerts.push({ type: 'info', icon: 'Air', title: 'CO2 High', message: 'Gas/CO2 level is above safe threshold.' });
            }
        }

        setAlerts(newAlerts);
    }, [latest, config]);

    // AI tip generation
    useEffect(() => {
        const tips = [
            'Orchids bloom best with a 10°C temperature drop at night.',
            'Yellowing leaves might suggest overwatering.',
            'Good air circulation prevents fungal and bacterial diseases.',
            'Fertilize weakly, weekly!',
            'Repot every 1-2 years to keep roots healthy.'
        ];
        setAiTip(tips[Math.floor(Math.random() * tips.length)]);
    }, []);

    return { latest, history: liveHistory, growthLogs, connectionStatus, lastUpdate, alerts, aiTip };
};
