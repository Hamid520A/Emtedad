// frontend-user/app/components/ThemeToggle.tsx
'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10 rounded-full bg-gray-100/50 dark:bg-[#2a405a]/50" />;
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="p-2.5 rounded-full bg-gray-100 dark:bg-[#2a405a] text-[#1a2e44] dark:text-[#c5a059] transition-all shadow-sm hover:scale-105 active:scale-95 cursor-pointer"
      title={isDark ? "تغییر به تم روشن" : "تغییر به تم تاریک"}
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}