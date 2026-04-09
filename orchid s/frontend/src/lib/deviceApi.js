import { api } from "./api";

export async function getDeviceStatus(deviceId = "orchid-node-1") {
  const { data } = await api.get(`/devices/${deviceId}/status`);
  return data;
}

export async function sendTelemetry(deviceId, lastSeen, payload = {}) {
  const body = { device_id: deviceId, last_seen: lastSeen, ...payload };
  const { data } = await api.post("/devices/telemetry", body);
  return data;
}
