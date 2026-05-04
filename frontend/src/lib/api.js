const BASE_URL = import.meta.env.VITE_API_URL || '';

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
  if (token) localStorage.setItem('sarego_access', token);
  else localStorage.removeItem('sarego_access');
}

export function getAccessToken() {
  if (accessToken) return accessToken;
  const stored = localStorage.getItem('sarego_access');
  if (stored) accessToken = stored;
  return accessToken;
}

export async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (res.status === 401 && !path.startsWith('/api/auth/refresh')) {
    // Try refresh once
    const refreshRes = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setAccessToken(data.access_token);
      headers.Authorization = `Bearer ${data.access_token}`;
      const retry = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: 'include',
      });
      if (!retry.ok) throw await asError(retry);
      return retry.json();
    }
  }

  if (!res.ok) throw await asError(res);
  return res.json();
}

async function asError(res) {
  let body = {};
  try { body = await res.json(); } catch { /* ignore */ }
  const err = new Error(body.error || `HTTP ${res.status}`);
  err.status = res.status;
  err.issues = body.issues;
  return err;
}
