import axios from "axios";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: { "Content-Type": "application/json" },
});

export function fileApi() {
  return axios.create({
    baseURL: `${API_BASE}/api`,
    headers: { "Content-Type": "multipart/form-data" },
  });
}
