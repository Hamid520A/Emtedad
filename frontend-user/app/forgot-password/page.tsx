// frontend-user/app/forgot-password/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { Phone, ArrowRight, ShieldAlert, ArrowLeft, Lock, MessageSquare, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const router = useRouter();
  
  // 🌟 استیت‌های کنترل مراحل
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [timer, setTimer] = useState(120);
  const [loading, setLoading] = useState(false);

  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1728))
      .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1584));
  };

  const toPersianDigits = (str: string | number) => {
    const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const isValidPhoneNumber = (p: string): boolean => {
    const cleanPhone = toEnglishDigits(p).trim();
    return /^09\d{9}$/.test(cleanPhone);
  };

  // 🌟 تایمر پیامک
  useEffect(() => {
    let interval: any;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // 🌟 مرحله اول: درخواست کد تایید
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValidPhoneNumber(phone)) {
      alert("⚠️ شماره موبایل معتبر نیست! (باید با ۰۹ شروع شود و ۱۱ رقم باشد)");
      return;
    }

    setLoading(true);
    try {
      await api.post('/send-otp', { phone_number: toEnglishDigits(phone) });
      setStep(2);
      setTimer(120);
    } catch (error: any) {
      alert("خطا در ارسال پیامک: " + (error.response?.data?.detail || "لطفاً دوباره تلاش کنید."));
    } finally {
      setLoading(false);
    }
  };

  // 🌟 مرحله دوم: تایید کد و تغییر رمز
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otpCode || otpCode.length < 4) return alert("لطفاً کد تایید را وارد کنید.");
    if (newPassword.length < 6) return alert("رمز عبور جدید باید حداقل ۶ کاراکتر باشد.");
    if (newPassword !== confirmPassword) return alert("رمز عبور جدید و تکرار آن مطابقت ندارند.");

    setLoading(true);
    try {
      await api.post('/reset-password', { 
        phone_number: toEnglishDigits(phone), 
        otp_code: toEnglishDigits(otpCode),
        new_password: newPassword
      });
      
      alert("✅ رمز عبور با موفقیت تغییر کرد! اکنون می‌توانید وارد حساب خود شوید.");
      router.push('/login');
    } catch (error: any) {
      alert("خطا: " + (error.response?.data?.detail || "ارتباط با سرور برقرار نشد."));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${toPersianDigits(m)}:${s < 10 ? '۰' : ''}${toPersianDigits(s)}`;
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 flex flex-col justify-center py-12 px-6 font-sans relative transition-colors duration-200" dir="rtl">
      
      <div className="absolute top-6 left-6 z-20">
        <button 
          onClick={() => {
            if (step === 2) setStep(1);
            else router.back();
          }}
          className="p-3 bg-white/40 dark:bg-[#182234] backdrop-blur-md rounded-full shadow-sm border border-gray-200/50 dark:border-slate-800 text-gray-600 dark:text-slate-100 hover:bg-white/60 transition-colors"
          title="بازگشت"
        >
          <ArrowRight size={20} />
        </button>
      </div>

      <div className="max-w-md w-full mx-auto relative z-10">
        
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#1a2e44] dark:bg-[#182234] text-[#c5a059] mx-auto rounded-3xl flex items-center justify-center shadow-lg rotate-3 mb-6 border border-transparent dark:border-slate-800 transition-transform">
            <ShieldAlert size={40} />
          </div>
          <h2 className="text-3xl font-black text-[#1a2e44] dark:text-slate-100">
            {step === 1 ? 'بازیابی رمز عبور' : 'تنظیم رمز جدید'}
          </h2>
          <p className="text-gray-600 dark:text-slate-400 text-sm mt-3 font-medium leading-relaxed px-4">
            {step === 1 
              ? 'شماره موبایل ثبت‌نامی خود را وارد کنید تا کد تایید برایتان ارسال شود.' 
              : `کد ۵ رقمی پیامک شده به ${toPersianDigits(phone)} را همراه با رمز عبور جدید وارد کنید.`}
          </p>
        </div>

        {/* 🌟 فرم مرحله اول */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="bg-white/80 dark:bg-[#182234] backdrop-blur-xl p-8 rounded-[2.5rem] shadow-lg border border-white/50 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-300">
            
            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">شماره موبایل</label>
              <div className="relative">
                <Phone className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
                <input 
                  type="text" required dir="ltr" maxLength={11}
                  className="w-full p-4 pr-12 bg-white/60 dark:bg-[#0b0f19] border border-gray-100 dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left transition-all backdrop-blur-sm"
                  placeholder="0912..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] p-5 rounded-[2rem] font-black text-base flex items-center justify-center gap-3 hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 mt-4 disabled:opacity-70"
            >
              {loading ? 'در حال ارسال پیامک...' : 'ارسال کد تایید'}
              {!loading && <ArrowLeft size={20} className="text-[#c5a059] dark:text-[#1a2e44]" />}
            </button>
          </form>
        )}

        {/* 🌟 فرم مرحله دوم */}
        {step === 2 && (
          <form onSubmit={handleResetPassword} className="bg-white/80 dark:bg-[#182234] backdrop-blur-xl p-8 rounded-[2.5rem] shadow-lg border border-white/50 dark:border-slate-800 space-y-5 animate-in slide-in-from-right-8 duration-300">
            
            <div className="text-center mb-2">
              <label className="block text-[10px] font-black text-[#c5a059] uppercase tracking-widest mb-2 text-center">کد تایید پیامکی</label>
              <div className="relative max-w-[200px] mx-auto">
                <MessageSquare className="absolute right-3 top-4 text-gray-400" size={20} />
                <input 
                  type="text" required dir="ltr" maxLength={5}
                  className="w-full p-4 pr-10 bg-white dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 border-2 border-gray-100 dark:border-slate-800 focus:border-[#c5a059] rounded-2xl font-black text-center text-xl tracking-[0.4em] outline-none transition-all shadow-inner"
                  placeholder="-----"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>
              <div className="text-center text-xs font-bold text-gray-500 mt-3">
                {timer > 0 ? (
                  <span dir="ltr">{formatTime(timer)} تا ارسال مجدد</span>
                ) : (
                  <button type="button" onClick={handleSendOtp} className="text-blue-600 dark:text-blue-400 hover:underline">ارسال مجدد کد تایید</button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-2">رمز عبور جدید</label>
              <div className="relative">
                <Lock className="absolute right-4 top-4 text-gray-400 dark:text-slate-500" size={18} />
                <input 
                  type="password" required dir="ltr"
                  className="w-full p-4 pr-12 bg-white/60 dark:bg-[#0b0f19] border border-gray-100 dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left transition-all"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-[#c5a059] uppercase tracking-widest mb-2">تکرار رمز عبور جدید</label>
              <div className="relative">
                <Lock className="absolute right-4 top-4 text-[#c5a059]" size={18} />
                <input 
                  type="password" required dir="ltr"
                  className="w-full p-4 pr-12 bg-white/60 dark:bg-[#0b0f19] border border-gray-100 dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left transition-all"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className="w-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] p-5 rounded-[2rem] font-black text-base flex items-center justify-center gap-2 hover:bg-[#2a405a] dark:hover:bg-[#b08e4a] transition-all shadow-xl active:scale-95 mt-4 disabled:opacity-70"
            >
              {loading ? 'در حال بررسی...' : 'ثبت رمز عبور جدید'}
              {!loading && <CheckCircle size={20} className="text-[#c5a059] dark:text-[#1a2e44]" />}
            </button>
          </form>
        )}

        <div className="text-center mt-6">
          <p className="text-sm font-bold text-gray-600 dark:text-slate-400">
            رمز عبور خود را به یاد آوردید؟{' '}
            <button onClick={() => router.push('/login')} className="text-[#1a2e44] dark:text-[#c5a059] hover:underline font-black drop-shadow-sm">
              بازگشت به ورود
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}