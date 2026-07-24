'use client';
import { useRouter } from 'next/navigation';
import { HelpCircle, ArrowRight } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] flex flex-col items-center justify-center p-6 text-center text-[#1a2e44] dark:text-slate-100 relative transition-colors duration-200" dir="rtl">
      <div className="bg-white dark:bg-[#182234] p-10 rounded-[2.5rem] shadow-xl border border-gray-100 dark:border-slate-800 max-w-sm w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
        
        {/* آیکون و المان گرافیکی ۴۰۴ */}
        <div className="w-20 h-24 mx-auto relative flex items-center justify-center">
          <span className="text-7xl font-black tracking-tighter opacity-10 dark:opacity-20 select-none text-[#1a2e44] dark:text-slate-100">404</span>
          <div className="absolute inset-0 flex items-center justify-center text-[#c5a059]">
            <HelpCircle size={48} className="animate-bounce" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-[#1a2e44] dark:text-slate-100">صفحه مورد نظر یافت نشد!</h2>
          <p className="text-xs text-gray-400 dark:text-slate-400 font-bold leading-relaxed">
            آدرسی که وارد کرده‌اید وجود ندارد یا این مسابقه ممکن است تغییر کرده باشد.
          </p>
        </div>

        {/* دکمه بازگشت */}
        <button
          onClick={() => router.push('/')}
          className="w-full py-4 bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md"
        >
          <ArrowRight size={16} className="text-[#c5a059] dark:text-[#1a2e44]" /> بازگشت به صفحه اصلی
        </button>
      </div>
    </div>
  );
}