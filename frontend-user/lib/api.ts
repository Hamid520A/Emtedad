import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api',
});

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

/** Single-flight refresh so concurrent 401s share one refresh call */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('NO_REFRESH_TOKEN');
      }

      // Bare axios — do not go through the interceptor (avoid refresh loops)
      const response = await axios.post('/api/auth/refresh', {
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

function forceLogoutToLogin() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('isAdmin');
  // Preserve exam drafts (exam_draft_*) for recovery after re-login
  window.location.href = '/login';
}

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
        // Network blip during refresh — do not force logout (exam safety)
        const refreshFailedWithoutHttp =
          !axios.isAxiosError(refreshError) || !refreshError.response;
        if (refreshFailedWithoutHttp && !(refreshError instanceof Error && refreshError.message === 'NO_REFRESH_TOKEN')) {
          return Promise.reject(refreshError);
        }
        forceLogoutToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { refreshAccessToken };
export default api;
