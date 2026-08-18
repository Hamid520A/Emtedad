/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 🌟 غیرفعال کردن ورق تِردها برای جلوگیری از کرش سشن موازی در داکر
    workerThreads: false, 
  },
  async rewrites() {
    // 🌟 آدرس واقعی بک‌اند را مستقیماً اینجا وارد می‌کنیم
    // از آنجایی که بک‌اند و فرانت‌ند در یک سرور هستند، مستقیماً به آی‌پی و پورت بک‌اند پاس می‌دهیم
    const backendUrl = 'http://10.10.20.51:64000'; 
    
    // (اگر فرانت‌ند و بک‌اند در یک فایل docker-compose.yml هستند، حتی می‌توانید از 'http://backend:8000' هم استفاده کنید)
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`, // ترافیک به صورت مخفیانه به بک‌اند می‌رود
      },
      {
        source: '/static/:path*',
        destination: `${backendUrl}/static/:path*`, // برای لود شدن عکس‌ها و جزوه‌ها
      },
    ];
  },
};

module.exports = nextConfig;