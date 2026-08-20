// frontend-admin/app/layout.tsx
import './globals.css';
import { ThemeProvider } from './components/ThemeProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        {/* فونت وزیرمتن */}
        <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" />
      </head>
      <body className="bg-[#faf9f6] text-[#1a2e44] dark:bg-[#0b0f19] dark:text-slate-100 transition-colors duration-200">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
