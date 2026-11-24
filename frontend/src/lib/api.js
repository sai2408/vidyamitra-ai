// Small fetch wrapper: adds the login token and turns API errors into readable messages.
const TOKEN_KEY = "vm_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload });
  } catch {
    throw new Error("Cannot reach the server. Make sure the backend is running on port 8000.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("vm-logout"));
  }
  if (!res.ok) {
    const d = data.detail;
    const message = Array.isArray(d) ? d.map((x) => x.msg).join(", ") : typeof d === "object" && d ? d.message : d;
    const err = new Error(message || `Request failed (${res.status})`);
    if (d && typeof d === "object" && !Array.isArray(d)) Object.assign(err, d); // e.g. code, retry_after, email
    err.status = res.status;
    throw err;
  }
  return data;
}

export const fmtDate = (iso) =>
  new Date(iso + (iso.endsWith("Z") ? "" : "Z")).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
