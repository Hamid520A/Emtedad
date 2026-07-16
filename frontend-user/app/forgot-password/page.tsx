'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, ArrowRight, ShieldAlert, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (phone.length < 10) {
      alert("لطفاً یک شماره موبایل معتبر وارد کنید.");
      return;
    }

    setLoading(true);
    try {
      // در آینده کد اتصال به بک‌ند اینجا قرار می‌گیرد:
      // await api.post('/users/forgot-password', { phone });
      
      // فعلا برای شبیه‌سازی یک تاخیر کوتاه ایجاد می‌کنیم
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      alert("✅ در صورتی که این شماره در سیستم ثبت شده باشد، لینک/کد بازیابی رمز عبور برای شما پیامک خواهد شد.");
      router.push('/login');
    } catch (error) {
      alert("خطا در برقراری ارتباط با سرور. لطفاً دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-6 font-sans relative" dir="rtl">
      
      {/* دکمه بازگشت به عقب */}
      <button 
        onClick={() => router.back()}
        className="absolute top-6 right-6 p-3 bg-white/20 backdrop-blur-md rounded-full shadow-sm border border-gray-200/50 text-gray-600 hover:bg-white/40 transition-colors z-20"
      >
        <ArrowRight size={20} />
      </button>

      <div className="max-w-md w-full mx-auto relative z-10">
        
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#1a2e44] text-[#c5a059] mx-auto rounded-3xl flex items-center justify-center shadow-lg rotate-3 mb-6">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-3xl font-black text-[#1a2e44]">بازیابی رمز عبور</h2>
          <p className="text-gray-600 text-sm mt-3 font-medium leading-relaxed px-4">
            شماره موبایل خود را وارد کنید تا دستورالعمل تغییر رمز عبور برای شما ارسال شود.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-lg border border-white/50 space-y-5">
          
          <div>
            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">شماره موبایل ثبت‌شده</label>
            <div className="relative">
              <Phone className="absolute right-4 top-4 text-gray-400" size={18} />
              <input 
                type="text" required dir="ltr"
                className="w-full p-4 pr-12 bg-white/60 border border-gray-100 rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left transition-all backdrop-blur-sm"
                placeholder="09123456789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 mt-4 disabled:opacity-70"
          >
            {loading ? 'در حال ارسال درخواست...' : 'ارسال لینک بازیابی'}
            {!loading && <ArrowLeft size={20} className="text-[#c5a059]" />}
          </button>

        </form>

        <div className="text-center mt-6">
          <p className="text-sm font-bold text-gray-600">
            رمز عبور خود را به یاد آوردید؟{' '}
            <button onClick={() => router.push('/login')} className="text-[#1a2e44] hover:underline font-black drop-shadow-sm">
              بازگشت به ورود
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}