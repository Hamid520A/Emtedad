// frontend-admin/lib/api.ts

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// 🌟 اصلاح اول: خواندن آدرس اصلی بک‌ند از فایل env
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) {
  console.warn("⚠️ متغیر NEXT_PUBLIC_API_URL در محیط تنظیم نشده است.");
}

const api = axios.create({
  baseURL: apiUrl, 
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('NO_REFRESH_TOKEN');
      }

      const response = await axios.post(`${apiUrl}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const newAccessToken = response.data.access_token as string;
      localStorage.setItem('accessToken', newAccessToken);
      if (response.data.refresh_token) {
        localStorage.setItem('refreshToken', response.data.refresh_token);
      }
      api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
      return newAccessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function forceLogoutToAdminLogin() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('isAdmin');
  window.location.href = '/admin/login';
}

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response, 
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const url = originalRequest.url || '';
    const isAuthEndpoint =
      url.includes('/login') ||
      url.includes('/auth/refresh') ||
      url.includes('/admin/login');

    if (error.response?.status === 401 && !isAuthEndpoint && !originalRequest._retry) {
      originalRequest._retry = true; 

      try {
        const newAccessToken = await refreshAccessToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        const refreshFailedWithoutHttp =
          !axios.isAxiosError(refreshError) || !refreshError.response;
        if (refreshFailedWithoutHttp && !(refreshError instanceof Error && refreshError.message === 'NO_REFRESH_TOKEN')) {
          return Promise.reject(refreshError);
        }
        forceLogoutToAdminLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
