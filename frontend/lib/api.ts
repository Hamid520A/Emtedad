import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000', // آدرس بک‌ند شما
});

// ۱. اینترسپتور درخواست: چسباندن خودکار Access Token به هدر تمام درخواست‌ها
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

// ۲. اینترسپتور پاسخ: مدیریت هوشمند خطای 401 و تمدید خودکار توکن
api.interceptors.response.use(
  (response) => response, // اگر پاسخ موفق بود که هیچ، برو جلو
  async (error) => {
    const originalRequest = error.config;

    // اگر ارور 401 بود و این درخواست قبلاً یک‌بار برای ریفرش تلاش نکرده بود
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // علامت‌گذاری برای جلوگیری از لوپ بی‌نهایت

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          // اگر اصلاً ریفرش توکن نداشتیم، کاربر را بفرست به صفحه لاگین
          window.location.href = '/login';
          return Promise.reject(error);
        }

        const response = await axios.post('http://127.0.0.1:8000/auth/refresh', {
          refresh_token: refreshToken
        });

        const newAccessToken = response.data.access_token;

        // ذخیره اکسس توکن جدید در حافظه مرورگر
        localStorage.setItem('accessToken', newAccessToken);

        // به‌روزرسانی هدر درخواست فعلی و پیش‌فرض سیستم
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;

        // 🌟 پرتاب مجدد درخواست قبلی کاربر با توکن جدید
        return api(originalRequest);
      } catch (refreshError) {
        // اگر خود ریفرش توکن هم منقضی شده بود، کل حافظه را پاک کن و بفرست لاگین
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;