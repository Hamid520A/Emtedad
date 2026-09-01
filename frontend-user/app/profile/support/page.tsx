// frontend-user/app/profile/support/page.tsx
'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, HelpCircle, MessageCircle, Mail } from 'lucide-react';

export default function SupportPage() {
  const router = useRouter();

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] font-sans text-[#1a2e44] dark:text-slate-100 transition-colors duration-200" dir="rtl">
      <header className="p-6 flex items-center gap-3 bg-white/80 dark:bg-[#182234]/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 dark:bg-[#0b0f19] rounded-full hover:bg-gray-100 dark:hover:bg-[#233044] transition-colors text-[#1a2e44] dark:text-slate-100">
          <ArrowRight size={20} />
        </button>
        <span className="font-black text-xl text-[#1a2e44] dark:text-slate-100">ارتباط با پشتیبانی</span>
      </header>

      <main className="p-6 space-y-6">
        
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-green-50 dark:bg-green-950/40 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <HelpCircle size={40} />
          </div>
          <h2 className="text-2xl font-black mb-2 text-[#1a2e44] dark:text-slate-100">چگونه می‌توانیم کمک کنیم؟</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm font-medium leading-relaxed px-4">
            تیم پشتیبانی ما همه روزه آماده پاسخگویی به سوالات و مشکلات شما در مسابقات است.
          </p>
        </div>

        <div className="space-y-4">
          <a href="https://eitaa.com/dallfa" target="_blank" className="bg-white dark:bg-[#182234] p-5 rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-blue-500 hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#faf9f6] dark:bg-[#0b0f19] text-gray-500 dark:text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-950/40 group-hover:text-blue-500 transition-colors">
                <MessageCircle size={24} />
              </div>
              <div>
                <span className="font-black text-[#1a2e44] dark:text-slate-100 block mb-1">پشتیبانی ایتا</span>
                <span className="text-xs text-gray-400 dark:text-slate-400 font-bold" dir="ltr">@dallfa</span>
              </div>
            </div>
          </a>
        </div>

      </main>
    </div>
  );
}