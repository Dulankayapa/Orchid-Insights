import axios from "axios";
import { API_ROOT } from "./apiBase";

export const api = axios.create({
  baseURL: API_ROOT,
  headers: { "Content-Type": "application/json" },
});

export function fileApi() {
  return axios.create({
    baseURL: API_ROOT,
    headers: { "Content-Type": "multipart/form-data" },
  });
}
