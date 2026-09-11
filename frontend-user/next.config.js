/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 🌟 غیرفعال کردن ورق تِردها برای جلوگیری از کرش سشن موازی در داکر
    workerThreads: false, 
  },
  async rewrites() {
    // Docker network default; override via BACKEND_INTERNAL_URL at build/runtime
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:8000';

    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`, // هدایت ترافیک API به بک‌اند پایتون
      },
      {
        source: '/static/:path*',
        destination: `${backendUrl}/static/:path*`, // هدایت ترافیک برای لود شدن عکس‌ها و جزوه‌ها
      },
    ];
  },
};

module.exports = nextConfig;