// frontend/app/layout.tsx
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
      <body>
        {/* تمام صفحات شما (مثل login یا dashboard) اینجا رندر می‌شوند */}
        {children}
      </body>
    </html>
  );
}