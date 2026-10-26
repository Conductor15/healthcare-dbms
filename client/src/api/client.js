import axios from 'axios';

export const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.endsWith('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an API error (server sends { error, details }). */
export function errorMessage(error) {
  const data = error.response?.data;
  if (data?.details?.length) return `${data.error}: ${data.details.map((d) => d.message).join('; ')}`;
  return data?.error ?? 'Không kết nối được máy chủ';
}
