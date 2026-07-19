import './globals.css';
import Script from 'next/script'; // 🌟 وارد کردن ابزار استاندارد نکست‌جی‌اس

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
    <html lang="fa" dir="rtl"> 
      <body>
        {/* تمام صفحات شما (مثل login یا dashboard) اینجا رندر می‌شوند */}
        {children}

        {/* 🌟 تزریق کاملاً استاندارد، ایمن و ضدکِشِ اسکریپت بدون آسیب زدن به لایوت نکست‌جی‌اس */}
        <Script id="eitaa-webview-shim" strategy="beforeInteractive">
          {`
            window.Eitaa = window.Eitaa || {};
            window.Eitaa.WebView = window.Eitaa.WebView || {};
            window.Eitaa.WebView.receiveEvent = window.Eitaa.WebView.receiveEvent || function(event, data) {
              console.log('📌 پیام ایتا بدون کرش دریافت شد:', event, data);
            };
          `}
        </Script>
      </body>
    </html>
  );
}