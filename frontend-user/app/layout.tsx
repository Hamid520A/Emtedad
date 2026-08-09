// frontend-user/app/layout.tsx
import { ThemeProvider } from './providers';
import './globals.css';

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
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* فونت وزیرمتن */}
        {/* اسکریپت مینی‌اپ ایتا و تلگرام جهت پشتیبانی از باز کردن لینک‌ها و فایل‌ها در مرورگر نیتیو گوشی */}
        <script src="https://telegram.org/js/telegram-web-app.js" async></script>
        {/* 🌟 سنگر امنیتی بومی و ۱۰۰٪ سازگار با جاوااسکریپت بدون وابستگی به نکست‌جی‌اس */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.Eitaa = window.Eitaa || {};
              window.Eitaa.WebView = window.Eitaa.WebView || {};
              window.Eitaa.WebView.receiveEvent = window.Eitaa.WebView.receiveEvent || function(event, data) {
                console.log('📌 پیام ایتا بدون کرش دریافت شد:', event, data);
              };
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}