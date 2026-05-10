'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api'; 
import { User, Lock, Phone, ArrowRight, Trophy, CreditCard, MapPin, Calendar, Users } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    national_id: '',
    province: '',
    city: '',
    gender: 'male',
    birth_date: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert("⚠️ رمز عبور و تکرار آن با هم مطابقت ندارند!");
      return;
    }

    setLoading(true);
    try {
      await api.post('/register', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        national_id: formData.national_id,
        province: formData.province,
        city: formData.city,
        gender: formData.gender,
        birth_date: formData.birth_date,
        password: formData.password
      });
      alert("ثبت‌نام با موفقیت انجام شد! حالا می‌توانید وارد شوید.");
      router.push('/login');
    } catch (error: any) {
      console.error(error.response?.data);
      const detail = error.response?.data?.detail;
      let errorMsg = "مشکل ارتباط با سرور. اطلاعات را بررسی کنید.";
      
      if (detail === "شماره قبلاً ثبت شده") errorMsg = "این شماره موبایل قبلاً در سیستم ثبت شده است.";
      if (detail === "کد ملی قبلاً ثبت شده") errorMsg = "این کد ملی قبلاً در سیستم ثبت شده است.";
      
      alert("خطا در ثبت‌نام: " + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-center py-12 px-6 font-sans" dir="rtl">
      <div className="max-w-md w-full mx-auto">
        
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#1a2e44] text-[#c5a059] mx-auto rounded-3xl flex items-center justify-center shadow-lg rotate-3 mb-6">
            <Trophy size={40} />
          </div>
          <h2 className="text-3xl font-black text-[#1a2e44]">ساخت حساب جدید</h2>
          <p className="text-gray-500 text-sm mt-2 font-medium">برای شرکت در مسابقات اطلاعات خود را وارد کنید</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
          
          {/* نام و نام خانوادگی */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">نام</label>
              <div className="relative">
                <User className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" required
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm"
                  placeholder="علی"
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">نام خانوادگی</label>
              <div className="relative">
                <User className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" required
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm"
                  placeholder="احمدی"
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* کد ملی و شماره موبایل */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">کد ملی</label>
              <div className="relative">
                <CreditCard className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" required dir="ltr"
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="0012345678"
                  onChange={(e) => setFormData({...formData, national_id: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شماره موبایل</label>
              <div className="relative">
                <Phone className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" required dir="ltr"
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="0912..."
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* استان و شهرستان */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">استان</label>
              <div className="relative">
                <MapPin className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" required
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm"
                  placeholder="تهران"
                  onChange={(e) => setFormData({...formData, province: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">شهرستان</label>
              <div className="relative">
                <MapPin className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" required
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm"
                  placeholder="دماوند"
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* جنسیت و تاریخ تولد */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">جنسیت</label>
              <div className="relative">
                <Users className="absolute right-4 top-4 text-gray-400" size={18} />
                <select 
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm appearance-none"
                  onChange={(e) => setFormData({...formData, gender: e.target.value})}
                >
                  <option value="male">مرد</option>
                  <option value="female">زن</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تاریخ تولد</label>
              <div className="relative">
                <Calendar className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="text" required dir="ltr"
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="1380/01/01"
                  onChange={(e) => setFormData({...formData, birth_date: e.target.value})}
                />
              </div>
            </div>
          </div>

          {/* رمز عبور */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">رمز عبور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="password" required dir="ltr"
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="••••••••"
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تکرار رمز</label>
              <div className="relative">
                <Lock className="absolute right-4 top-4 text-[#c5a059]" size={18} />
                <input 
                  type="password" required dir="ltr"
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="••••••••"
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black text-lg flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 mt-4 disabled:opacity-70"
          >
            {loading ? 'در حال ثبت...' : 'ثبت‌نام در سیستم'}
            {!loading && <ArrowRight size={20} className="text-[#c5a059]" />}
          </button>

        </form>

        <div className="text-center mt-6">
          <p className="text-sm font-bold text-gray-500">
            قبلاً حساب کاربری ساخته‌اید؟{' '}
            <button onClick={() => router.push('/login')} className="text-[#c5a059] hover:underline">
              وارد شوید
            </button>
          </p>
        </div>

      </div>
    </div>
  );
}