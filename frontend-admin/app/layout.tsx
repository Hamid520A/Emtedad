// frontend-admin/app/layout.tsx
import { Noto_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from './components/ThemeProvider';

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700', '900'],
  variable: '--font-noto-sans-arabic',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className={notoSansArabic.variable}>
      <body className={`${notoSansArabic.className} font-sans antialiased bg-[#faf9f6] text-[#1a2e44] dark:bg-[#0b0f19] dark:text-slate-100 transition-colors duration-200`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
