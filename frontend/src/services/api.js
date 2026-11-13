import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (response.data && response.data.success !== undefined) {
      return response.data.data;
    }
    return response.data;
  },
  (error) => {
    const status = error.response?.status;
    const mensaje = error.response?.data?.message || error.message || 'Error en la solicitud';

    if (status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
    }

    if (
      status === 503 ||
      error.response?.data?.error === 'CLOUD_UNAVAILABLE' ||
      error.response?.data?.error === 'OFFLINE_FORBIDDEN' ||
      !error.response
    ) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('nextbyte:network-status', { detail: { online: false } }));
      }
    }

    const err = new Error(mensaje);
    err.status = status;
    err.response = error.response;
    err.code = error.code;
    err.isNetworkError = !error.response;
    return Promise.reject(err);
  }
);

export default api;

