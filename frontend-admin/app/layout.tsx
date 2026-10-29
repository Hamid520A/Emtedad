// frontend-admin/app/layout.tsx
// Self-hosted from npm: next/font/google downloads at build time and the build server can't reach Google Fonts.
import '@fontsource-variable/noto-sans-arabic';
import './globals.css';
import { ThemeProvider } from './components/ThemeProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body className="font-sans antialiased bg-[#faf9f6] text-[#1a2e44] dark:bg-[#0b0f19] dark:text-slate-100 transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
