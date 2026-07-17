import './globals.css';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <body className="bg-[#0f172a] text-slate-100 min-h-screen">
        {/* این کانتینر جادویی صفحات را جمع کرده و پدینگ استاندارد می‌دهد */}
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </body>
    </html>
  );
}