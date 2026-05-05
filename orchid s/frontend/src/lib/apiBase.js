const DEFAULT_LOCAL_API_ORIGIN = "http://localhost:8000";

export const isLikelyLocalHost = (hostname = "") => {
  const value = String(hostname || "").trim().toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1";
};

const trimTrailingSlash = (value) => String(value || "").trim().replace(/\/$/, "");

const getRuntimeApiBase = () => {
  if (typeof globalThis === "undefined") return "";
  const candidate = globalThis.__ORCHID_API_URL__;
  return typeof candidate === "string" ? candidate : "";
};

const resolveFallbackApiBase = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LOCAL_API_ORIGIN;
  }

  const { hostname, protocol, origin } = window.location;
  if (isLikelyLocalHost(hostname)) {
    return `${protocol}//${hostname}:8000`;
  }

  return origin;
};

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API_URL ||
    getRuntimeApiBase() ||
    resolveFallbackApiBase()
);

export const API_ROOT = `${API_BASE_URL}/api`;

export const buildApiUrl = (path = "") => {
  const normalizedPath = path ? (String(path).startsWith("/") ? String(path) : `/${path}`) : "";
  return `${API_ROOT}${normalizedPath}`;
};
