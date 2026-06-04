import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
  timeout: 30000,
});

// Token helpers (localStorage fallback for Safari/mobile)
const getToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
};
const getRefreshToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
};
export const saveTokens = (access, refresh) => {
  if (typeof window === 'undefined') return;
  if (access) localStorage.setItem('accessToken', access);
  if (refresh) localStorage.setItem('refreshToken', refresh);
};
export const clearTokens = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
};

// Add Authorization header from localStorage on every request
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let queue = [];

const processQueue = (error) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && err.response?.data?.code === 'TOKEN_EXPIRED' && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then(() => api(original))
          .catch((e) => Promise.reject(e));
      }
      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        const res = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: refreshToken ? { Authorization: `Bearer ${refreshToken}` } : {},
          }
        );
        if (res.data.accessToken) saveTokens(res.data.accessToken, res.data.refreshToken);
        processQueue(null);
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
        clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const formatCurrency = (amount) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(amount || 0);

export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export const formatDateTime = (date) =>
  date
    ? new Date(date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

export const statusColors = {
  pending: 'badge-yellow',
  confirmed: 'badge-blue',
  processing: 'badge-blue',
  readyToDispatch: 'badge-yellow',
  dispatched: 'badge-green',
  delivered: 'badge-green',
  cancelled: 'badge-red',
};

export const statusLabels = {
  pending: { ru: 'Ожидает', en: 'Pending' },
  confirmed: { ru: 'Принят', en: 'Accepted' },
  processing: { ru: 'Подготовка', en: 'Preparing' },
  readyToDispatch: { ru: 'Готов к отгрузке', en: 'Ready to Dispatch' },
  dispatched: { ru: 'Отгружен', en: 'Dispatched' },
  delivered: { ru: 'Доставлен', en: 'Delivered' },
  cancelled: { ru: 'Отменён', en: 'Cancelled' },
};
