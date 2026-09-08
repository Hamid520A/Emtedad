"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toaster } from "react-hot-toast";

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: { direction: "rtl", fontFamily: "inherit", maxWidth: "28rem" },
        }}
      />
    </NextThemesProvider>
  );
}
