// frontend-user/app/providers.tsx
'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider 
      attribute="class" 
      defaultTheme="light" 
      enableSystem={false}
    >
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { direction: 'rtl', fontFamily: 'inherit', maxWidth: '28rem' },
        }}
      />
    </NextThemesProvider>
  );
}
