/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://10.10.20.51:64000/:path*',
      },
      // 🌟 سنگر جدید: پروکسی کردن مسیر تصاویر استاتیک به بک‌ند واقعی سرور امتداد
      {
        source: '/static/:path*',
        destination: 'http://10.10.20.51:64000/static/:path*',
      },
    ];
  },
};

module.exports = nextConfig;