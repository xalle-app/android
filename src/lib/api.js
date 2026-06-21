import { API_BASE } from "../config.js";
import { useAuthStore } from "../store/auth.js";

export async function api(path, { method = "GET", body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  const tok = token ?? useAuthStore.getState().token;
  if (tok) headers["Authorization"] = `Bearer ${tok}`;

  const needsBody = ["POST", "PUT", "PATCH"].includes(method.toUpperCase());
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : needsBody ? "{}" : undefined,
  });

  if (res.status === 401 && tok) {
    useAuthStore.getState().logout();
    throw new Error("session_expired");
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

export const assetUrl = (url) => {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return `${API_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
};
