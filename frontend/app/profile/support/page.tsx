'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, HelpCircle, Phone, MessageCircle, Mail } from 'lucide-react';

export default function SupportPage() {
  const router = useRouter();

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] font-sans text-[#1a2e44]" dir="rtl">
      <header className="p-6 flex items-center gap-3 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowRight size={20} />
        </button>
        <span className="font-black text-xl">ارتباط با پشتیبانی</span>
      </header>

      <main className="p-6 space-y-6">
        
        <div className="text-center py-6">
          <div className="w-20 h-20 bg-green-50 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-sm">
            <HelpCircle size={40} />
          </div>
          <h2 className="text-2xl font-black mb-2">چگونه می‌توانیم کمک کنیم؟</h2>
          <p className="text-gray-500 text-sm font-medium leading-relaxed px-4">
            تیم پشتیبانی ما همه روزه آماده پاسخگویی به سوالات و مشکلات شما در مسابقات است.
          </p>
        </div>

        <div className="space-y-4">
          <a href="tel:02112345678" className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between hover:border-green-500 hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#faf9f6] text-gray-500 rounded-2xl flex items-center justify-center group-hover:bg-green-50 group-hover:text-green-500 transition-colors">
                <Phone size={24} />
              </div>
              <div>
                <span className="font-black text-[#1a2e44] block mb-1">تماس تلفنی</span>
                <span className="text-xs text-gray-400 font-bold" dir="ltr">021 - 1234 5678</span>
              </div>
            </div>
          </a>

          <a href="https://t.me/your_support" target="_blank" className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between hover:border-blue-500 hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#faf9f6] text-gray-500 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                <MessageCircle size={24} />
              </div>
              <div>
                <span className="font-black text-[#1a2e44] block mb-1">پشتیبانی تلگرام</span>
                <span className="text-xs text-gray-400 font-bold" dir="ltr">@Support_Bot</span>
              </div>
            </div>
          </a>

          <a href="mailto:support@yara.com" className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between hover:border-[#c5a059] hover:shadow-md transition-all group">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#faf9f6] text-gray-500 rounded-2xl flex items-center justify-center group-hover:bg-orange-50 group-hover:text-[#c5a059] transition-colors">
                <Mail size={24} />
              </div>
              <div>
                <span className="font-black text-[#1a2e44] block mb-1">ارسال ایمیل</span>
                <span className="text-xs text-gray-400 font-bold">پاسخگویی در ۲۴ ساعت</span>
              </div>
            </div>
          </a>
        </div>

      </main>
    </div>
  );
}