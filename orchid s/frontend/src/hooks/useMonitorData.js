import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, query, limitToLast } from 'firebase/database';
import { db, resolvedDatabaseURL } from '../lib/firebase';

const LIVE_PATHS = ['Jar1', 'Jar2', 'Jar3', 'orchidData/latest'];

const toNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const normalizeSensor = (val) => {
    if (!val) return null;
    let ts = Number(val.timestamp) || Number(val.ts) || Date.now();

    // If timestamp is in seconds, convert to milliseconds.
    if (ts < 10000000000) ts *= 1000;

    const temp = toNumber(val.temperature ?? val.teperature ?? val.temp ?? val.t);
    const hum = toNumber(val.humidity ?? val.hum ?? val.humidty ?? val.h);
    const luxVal = toNumber(val.lux ?? val.light ?? val.lx);
    const mqVal = toNumber(val.mq135 ?? val.mq ?? val.gas);

    return {
        ...val,
        timestamp: ts,
        ts: ts,
        temperature: temp,
        humidity: hum,
        lux: luxVal,
        mq135: mqVal,
        t: temp,
        h: hum,
        lx: luxVal,
        mq: mqVal
    };
};

const extractLiveCandidate = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    // If payload already looks like a sensor object, use it directly.
    if (
        raw.temperature !== undefined || raw.teperature !== undefined || raw.temp !== undefined ||
        raw.humidity !== undefined || raw.hum !== undefined || raw.humidty !== undefined ||
        raw.lux !== undefined || raw.light !== undefined || raw.lx !== undefined ||
        raw.mq135 !== undefined || raw.mq !== undefined || raw.gas !== undefined
    ) {
        return raw;
    }
    // Common nested live keys.
    return raw.latest ?? raw.current ?? raw.live ?? null;
};

export const useMonitorData = (settings) => {
    const [latest, setLatest] = useState(null);
    const [history, setHistory] = useState([]);
    const [growthLogs, setGrowthLogs] = useState([]);
    const [connectionStatus, setConnectionStatus] = useState('connecting');
    const [lastUpdate, setLastUpdate] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [aiTip, setAiTip] = useState(null);

    const SAFETY_DEFAULTS = useMemo(() => ({
        tMin: 18, tMax: 35,
        hMin: 40, hMax: 80,
        lMin: 50, lMax: 800,
        mqWarn: 2500,
        staleSec: 25
    }), []);

    const config = useMemo(() => ({ ...SAFETY_DEFAULTS, ...settings }), [SAFETY_DEFAULTS, settings]);

    // Fallback polling uses the same resolved RTDB URL as realtime listeners.
    const DB_URL = resolvedDatabaseURL;

    // Stitch the latest live point into history for ultra-real-time graphs
    const liveHistory = useMemo(() => {
        if (!latest) return history;
        if (history.length > 0 && history[history.length - 1].timestamp === latest.timestamp) {
            return history;
        }
        const combined = [...history, latest];
        return combined.slice(-100);
    }, [history, latest]);

    useEffect(() => {
        const connectedRef = ref(db, '.info/connected');
        const unsubConnected = onValue(connectedRef, (snap) => {
            const isConnected = !!snap.val();
            setConnectionStatus(isConnected ? 'connected' : 'offline');
        });

        const unsubsLive = LIVE_PATHS.map((path) =>
            onValue(ref(db, path), (snap) => {
                const data = snap.val();
                const candidate = extractLiveCandidate(data);
                if (!candidate) return;
                const normalized = normalizeSensor(candidate);
                if (!normalized) return;

                setConnectionStatus('connected');
                setLastUpdate(Date.now());

                // Keep the freshest point across all known live paths.
                setLatest((prev) => {
                    if (!prev || normalized.timestamp >= prev.timestamp) return normalized;
                    return prev;
                });
            })
        );

        const historyRef = query(ref(db, 'orchidData/logs'), limitToLast(100));
        const unsubHistory = onValue(historyRef, (snap) => {
            const data = snap.val();
            if (data) {
                const rows = Object.values(data)
                    .map(normalizeSensor)
                    .filter((row) => row && row.timestamp > 1735689600000)
                    .sort((a, b) => a.timestamp - b.timestamp);
                setHistory(rows);
            }
        });

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
            unsubsLive.forEach((unsub) => unsub());
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
                setConnectionStatus((prev) => (prev === 'stale' ? 'connected' : prev));
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [lastUpdate, config.staleSec]);

    // Compute alerts
    useEffect(() => {
        if (!latest) return;

        const newAlerts = [];

        if (typeof latest.temperature === 'number') {
            if (latest.temperature < config.tMin) {
                newAlerts.push({
                    type: 'danger',
                    icon: 'Temperature',
                    title: 'Temperature Low',
                    message: `${latest.temperature.toFixed(1)}°C is below safe range (${config.tMin}-${config.tMax}°C)`
                });
            } else if (latest.temperature > config.tMax) {
                newAlerts.push({
                    type: 'info',
                    icon: 'Temperature',
                    title: 'Temperature High',
                    message: `${latest.temperature.toFixed(1)}°C is above safe range (${config.tMin}-${config.tMax}°C)`
                });
            }
        }

        if (typeof latest.humidity === 'number') {
            if (latest.humidity < config.hMin) {
                newAlerts.push({
                    type: 'danger',
                    icon: 'Humidity',
                    title: 'Humidity Low',
                    message: `${latest.humidity.toFixed(1)}% is below safe range (${config.hMin}-${config.hMax}%)`
                });
            } else if (latest.humidity > config.hMax) {
                newAlerts.push({
                    type: 'info',
                    icon: 'Humidity',
                    title: 'Humidity High',
                    message: `${latest.humidity.toFixed(1)}% is above safe range (${config.hMin}-${config.hMax}%)`
                });
            }
        }

        if (typeof latest.lux === 'number') {
            if (latest.lux < config.lMin) {
                newAlerts.push({ type: 'danger', icon: 'Light', title: 'Light Low', message: 'Light level is below safe range.' });
            } else if (latest.lux > config.lMax) {
                newAlerts.push({ type: 'info', icon: 'Light', title: 'Light High', message: 'Light level is above safe range.' });
            }
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
