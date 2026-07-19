import './globals.css';

// این بخش برای سئو و عنوان تب مرورگر است
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
    // زبان را فارسی و جهت را راست‌چین تنظیم کردیم
    <html lang="fa" dir="rtl"> 
      <head>
        {/* 🌟 سنگر امنیتی ضد کرش برای مینی‌اپ ایتا */}
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
        {/* تمام صفحات شما (مثل login یا dashboard) اینجا رندر می‌شوند */}
        {children}
      </body>
    </html>
  );
}