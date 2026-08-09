import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get('token');
      const refreshTokenFromUrl = urlParams.get('refreshToken');
      const isAdminFromUrl = urlParams.get('isAdmin');

      if (tokenFromUrl) {
        localStorage.setItem('accessToken', tokenFromUrl);
        if (refreshTokenFromUrl) {
          localStorage.setItem('refreshToken', refreshTokenFromUrl);
        }
        if (isAdminFromUrl) {
          localStorage.setItem('isAdmin', isAdminFromUrl);
        }

        urlParams.delete('token');
        urlParams.delete('refreshToken');
        urlParams.delete('isAdmin');
        const newSearch = urlParams.toString();
        const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
        window.history.replaceState(null, '', newUrl);
      }
    }

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

        // 🌟 استفاده از پروکسی یکدست به جای شلیک مستقیم
        const response = await axios.post('/api/auth/refresh', {
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