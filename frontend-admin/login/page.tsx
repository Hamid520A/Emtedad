'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { Lock, Phone, Loader2, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 🌟 صدا زدن اندپوینت اختصاصی ادمین
      const res = await api.post('/admin/login', {
        phone_number: phone,
        password: password
      });

      // ذخیره توکن و پرچم ادمین در حافظه مرورگر
      localStorage.setItem('accessToken', res.data.access_token);
      localStorage.setItem('isAdmin', 'true');

      alert("ورود با موفقیت انجام شد. به پنل مدیریت خوش آمدید! 👑");
      
      // هدایت مستقیم به داشبورد ادمین
      router.push('/admin/dashboard'); 
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || "خطا در برقراری ارتباط با سرور مدیریت.";
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 text-right font-sans" dir="rtl">
      <div className="w-full max-w-md bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-6">
        
        {/* برندینگ و لوگوی پنل ادمین */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-inner animate-pulse">
            <ShieldCheck size={32} />
          </div>
          <h1 className="text-xl font-black text-white mt-3">درگاه ورود مدیران امتداد</h1>
          <p className="text-slate-400 text-[11px] font-medium">لطفاً اطلاعات محرمانه مدیریت را وارد کنید</p>
        </div>

        <form onSubmit={handleAdminSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">شماره تماس مدیر</label>
            <div className="relative">
              <Phone className="absolute right-4 top-4 text-slate-500" size={18} />
              <input 
                type="text" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                placeholder="09120000000" 
                dir="ltr"
                className="w-full p-4 pr-12 bg-[#0f172a] text-white border border-slate-800 rounded-2xl outline-none focus:border-red-500 text-sm font-bold placeholder-slate-600" 
                required 
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">رمز عبور امنیتی</label>
            <div className="relative">
              <Lock className="absolute right-4 top-4 text-slate-500" size={18} />
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••" 
                dir="ltr"
                className="w-full p-4 pr-12 bg-[#0f172a] text-white border border-slate-800 rounded-2xl outline-none focus:border-red-500 text-sm font-bold placeholder-slate-600" 
                required 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full mt-2 bg-gradient-to-r from-red-600 to-rose-600 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:from-red-700 hover:to-rose-700 active:scale-[0.98] transition-all shadow-lg shadow-red-950/20 disabled:opacity-70"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "بررسی هویت و ورود"}
          </button>
        </form>

      </div>
    </div>
  );
}