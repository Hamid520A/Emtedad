/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 🌟 غیرفعال کردن ورق تِردها برای جلوگیری از کرش سشن موازی در داکر
    workerThreads: false, 
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },
      {
        source: '/static/:path*',
        destination: `${backendUrl}/static/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;