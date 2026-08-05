import axios from 'axios';

const TOKEN_KEY = 'mkt_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

/** Axios instance. In dev, `/api` is proxied to the backend by Vite. */
export const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  // Unwrap the { success, data, meta } envelope → callers get { data, meta }.
  (res) => res.data,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && getToken()) {
      setToken(null);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1');
      }
    }
    const payload = error.response?.data?.error || { message: error.message || 'Request failed' };
    return Promise.reject(payload);
  }
);

/* Convenience helpers returning the payload directly. */
export const get = (url, config) => api.get(url, config).then((r) => r.data);
export const post = (url, body, config) => api.post(url, body, config).then((r) => r.data);
export const patch = (url, body, config) => api.patch(url, body, config).then((r) => r.data);
export const put = (url, body, config) => api.put(url, body, config).then((r) => r.data);
export const del = (url, config) => api.delete(url, config).then((r) => r.data);

/** Raw call returning the full envelope (for endpoints that use `meta`). */
export const getEnvelope = (url, config) => api.get(url, config);

export const API_ORIGIN = import.meta.env.VITE_API_URL || '';
