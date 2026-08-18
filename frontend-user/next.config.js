/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 🌟 غیرفعال کردن ورق تِردها برای جلوگیری از کرش سشن موازی در داکر
    workerThreads: false, 
  },
  async rewrites() {
    // 🌟 آدرس واقعی و فیزیکی بک‌اند را مستقیماً اینجا وارد می‌کنیم
    // تا ترافیک به صورت مخفیانه و بدون مشکل CORS به این آی‌پی پاس داده شود
    const backendUrl = 'http://10.10.20.51:64000'; 
    
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