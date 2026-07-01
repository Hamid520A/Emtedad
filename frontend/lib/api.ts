// frontend/lib/api.ts

import axios from 'axios';

const api = axios.create({
  baseURL: 'https://emtedad.onrender.com', 
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

    // 🌟 اصلاح کلیدی ۳: خروج ایمن از لوپ ۴۰۱ و استثنا کردن روت لاگین
    if (error.response?.status === 401 && !originalRequest.url?.includes('/login') && !originalRequest._retry) {
      originalRequest._retry = true; 

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          // پاکسازی توکن‌های قدیمی برای جلوگیری از قفل شدن دکمه ورود
          localStorage.removeItem('accessToken');
          localStorage.removeItem('isAdmin');
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const response = await axios.post('http://127.0.0.1:8000/auth/refresh', {
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