'use client';
import { useRouter } from 'next/navigation';
import { HelpCircle, ArrowRight } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] flex flex-col items-center justify-center p-6 text-center text-[#1a2e44] dark:text-slate-100 dark:text-slate-100" dir="rtl">
      <div className="bg-white dark:bg-[#182234] dark:bg-[#182234] p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 dark:border-slate-800 max-w-sm w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* آیکون و المان گرافیکی ۴۰۴ */}
        <div className="w-20 h-24 mx-auto relative flex items-center justify-center">
          <span className="text-7xl font-black tracking-tighter opacity-10 select-none">404</span>
          <div className="absolute inset-0 flex items-center justify-center text-[#c5a059]">
            <HelpCircle size={48} className="animate-bounce" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black">صفحه مورد نظر یافت نشد!</h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 dark:text-slate-400 font-bold leading-relaxed">
            آدرسی که وارد کرده‌اید وجود ندارد یا این بخش منتقل شده است.
          </p>
        </div>

        {/* 🌟 اصلاح شد: هدایت درست ادمین به دشبورد اصلی مدیریت روی پورت 63001 */}
        <button
          onClick={() => router.push('/admin/dashboard')}
          className="w-full py-4 bg-[#1a2e44] text-white hover:bg-[#2a405a] rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md"
        >
          <ArrowRight size={16} className="text-[#c5a059]" /> بازگشت به دشبورد مدیریت
        </button>
      </div>
    </div>
  );
}