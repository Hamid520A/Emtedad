'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ServerCrash, RefreshCw, ShieldAlert } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Global Catch Error:", error);
  }, [error]);

  const is503 = error.message?.includes('503') || error.message?.includes('fetch failed');
  const is403 = error.message?.includes('403') || error.message?.includes('Security');

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] flex flex-col items-center justify-center p-6 text-center text-[#1a2e44] dark:text-slate-100 dark:text-slate-100" dir="rtl">
      <div className="bg-white dark:bg-[#182234] dark:bg-[#182234] p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 dark:border-slate-800 max-w-sm w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        <div className="w-16 h-16 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] rounded-2xl mx-auto flex items-center justify-center shadow-inner text-[#c5a059]">
          {is403 ? (
            <ShieldAlert size={32} className="text-rose-500" />
          ) : is503 ? (
            <ServerCrash size={32} className="text-orange-500 animate-pulse" />
          ) : (
            <AlertTriangle size={32} />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black">
            {is403 ? "عدم دسترسی (403)" : is503 ? "سرور در دسترس نیست (503)" : "خطای داخلی سرور (500)"}
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 dark:text-slate-400 font-bold leading-relaxed">
            {is403 
              ? "شما مجوزهای لازم برای ورود یا مشاهده این بخش امنیتی را ندارید." 
              : is503 
              ? "سرور امتداد در حال حاضر در حال به‌روزرسانی است. لطفاً چند لحظه دیگر تلاش کنید." 
              : "متأسفانه مشکلی در پردازش اطلاعات رخ داده است. در حال بررسی و رفع آن هستیم."}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="w-full py-4 bg-[#1a2e44] text-white hover:bg-[#2a405a] rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <RefreshCw size={14} className="text-[#c5a059]" /> تلاش مجدد بارگذاری
          </button>
          
          {/* 🌟 اصلاح شد: هدایت درست به دشبورد ادمین */}
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="w-full py-3.5 bg-gray-50 text-gray-500 dark:text-slate-400 dark:text-slate-400 hover:bg-gray-100 rounded-2xl text-xs font-bold transition-all"
          >
            بازگشت به دشبورد مدیریت
          </button>
        </div>
      </div>
    </div>
  );
}