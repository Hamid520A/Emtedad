// frontend-user/app/layout.tsx
import { Noto_Sans_Arabic } from 'next/font/google';
import { ThemeProvider } from './providers';
import './globals.css';

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-sans-arabic',
  display: 'swap',
});

export const metadata = {
  title: 'اپلیکیشن مسابقات',
  description: 'سیستم برگزاری آزمون و مسابقات',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className={notoSansArabic.variable}>
      <head>
        {/* اسکریپت مینی‌اپ ایتا و تلگرام جهت پشتیبانی از باز کردن لینک‌ها و فایل‌ها در مرورگر نیتیو گوشی */}
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
        {/* 🌟 سنگر امنیتی بومی و ۱۰۰٪ سازگار با جاوااسکریپت بدون وابستگی به نکست‌جی‌اس */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.Eitaa = window.Eitaa || {};
              window.Eitaa.WebView = window.Eitaa.WebView || {};
              window.Eitaa.WebView.receiveEvent = window.Eitaa.WebView.receiveEvent || function(event, data) {
              };
              document.addEventListener('DOMContentLoaded', function() {
                try {
                  if (window.Telegram && window.Telegram.WebApp) {
                    window.Telegram.WebApp.ready();
                    window.Telegram.WebApp.expand();
                  }
                  if (window.Eitaa && window.Eitaa.WebApp) {
                    window.Eitaa.WebApp.ready();
                    window.Eitaa.WebApp.expand();
                  }
                } catch (e) {
                  console.warn('WebApp init error:', e);
                }
              });
            `,
          }}
        />
      </head>
      <body className={`${notoSansArabic.className} font-sans antialiased`}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}