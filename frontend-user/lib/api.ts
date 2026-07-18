// frontend/lib/api.ts

import axios from 'axios';

// 🌟 اصلاح اول: خواندن آدرس اصلی بک‌ند از فایل env
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: '/api',
});

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
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest.url?.includes('/login') && !originalRequest._retry) {
      originalRequest._retry = true; 

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('isAdmin');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        // 🌟 اصلاح دوم: جایگزینی آدرس هاردکد شده با متغیر داینامیک env
        const response = await axios.post(`${apiUrl}/auth/refresh`, {
          refresh_token: refreshToken
        });

        const newAccessToken = response.data.access_token;
        localStorage.setItem('accessToken', newAccessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;