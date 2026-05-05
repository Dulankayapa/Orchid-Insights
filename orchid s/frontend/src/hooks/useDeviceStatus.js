import { useEffect, useState } from "react";
import { getDeviceStatus } from "../lib/deviceApi";

export default function useDeviceStatus(deviceId = "orchid-node-1", intervalMs = 5000) {
  const [status, setStatus] = useState({ state: "loading", last_seen: null });

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const data = await getDeviceStatus(deviceId);
        if (!active) return;
        setStatus({ state: data.status, last_seen: data.last_seen });
      } catch {
        if (!active) return;
        setStatus({ state: "offline", last_seen: null });
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [deviceId, intervalMs]);

  return status;
}
