const API_BASE_URL = window.OOH_API_BASE_URL || "http://127.0.0.1:8000/api/v1";

async function api(path, options = {}) {
  const token = localStorage.getItem("adspace_access_token");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "Request failed");
  return payload;
}
