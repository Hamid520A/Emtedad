'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import { ArrowRight, Save, Loader2, HelpCircle, LayoutList } from 'lucide-react';

export default function AddQuestionPage() {
  const router = useRouter();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // استیت فرم
  const [formData, setFormData] = useState({
    contest_id: '',
    text: '',
    description: '',
    option_1: '',
    option_2: '',
    option_3: '',
    option_4: '',
    correct_option: 1
  });

  useEffect(() => {
    const fetchContests = async () => {
      try {
        // 🌟 فیکس نهایی: اتصال به روت اختصاصی ادمین همراه با فلش‌بک ضد کش زمان زنده
        const response = await api.get(`/admin/contests?t=${Date.now()}`);
        setContests(response.data);
      } catch (error) {
        console.error("خطا در دریافت اطلاعات زنده مسابقات", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contest_id) return alert("لطفاً ابتدا مسابقه را انتخاب کنید");
    
    setSubmitting(true);
    try {
      await api.post(`/contests/${formData.contest_id}/questions`, formData);
      alert("سوال با موفقیت به بانک سوالات اضافه شد.");
      setFormData({ ...formData, text: '', description: '', option_1: '', option_2: '', option_3: '', option_4: '' });
    } catch (error) {
      alert("خطا در ثبت سوال. مشخصات را بررسی کنید.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf9f6]">
      <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
    </div>
  );

  return (
    // 👈 تغییر عرض کل صفحه به max-w-5xl برای یکدست شدن کامل با دشبورد ویندوز ادمین
    <div className="max-w-5xl mx-auto min-h-screen bg-[#faf9f6] pb-24 font-sans text-[#1a2e44]" dir="rtl">
      
      {/* هدر پهن و تراز با حاشیه‌ها */}
      <header className="p-8 flex items-center justify-between sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition text-gray-500 hover:text-[#1a2e44]">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">مدیریت بانک سوالات</h1>
            <p className="text-gray-400 text-xs font-bold mt-1">طراحی سوال جدید، تعیین گزینه‌های تستی و پاسخ صحیح</p>
          </div>
        </div>
        <LayoutList className="text-[#c5a059]" size={28} />
      </header>

      {/* 👈 گریدبندی ۳ ستونه: ۲ ستون برای محتوای سوال، ۱ ستون برای تنظیمات مسابقه و دکمه ثبت */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-8">
        
        {/* ستون راست (۲ ستون پهن): محتوای سوال و گزینه‌ها */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* بخش متن اصلی سوال */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">متن صورت سوال</label>
              <textarea 
                required
                rows={4}
                className="w-full p-4 rounded-2xl bg-[#faf9f6] border-none focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm leading-relaxed"
                placeholder="سوال خود را اینجا بنویسید..."
                value={formData.text}
                onChange={(e) => setFormData({...formData, text: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">توضیحات یا راهنمایی (اختیاری)</label>
              <input 
                type="text"
                className="w-full p-4 rounded-2xl bg-[#faf9f6] border-none focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm"
                placeholder="مثلاً: این سوال مربوط به بخش اول جزوه است"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>

          {/* بخش چهارگزینه‌ای */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
             <div className="flex items-center gap-1.5 mb-2 text-gray-500">
               <HelpCircle size={16} className="text-[#c5a059]" />
               <label className="block text-[10px] font-black uppercase tracking-widest">تنظیم گزینه‌ها و انتخاب کلید پاسخ صحیح</label>
             </div>
             
             <div className="grid grid-cols-1 gap-3">
               {[1, 2, 3, 4].map((num) => (
                 <div key={num} className="flex items-center gap-4 bg-[#faf9f6] p-2.5 rounded-2xl border border-transparent focus-within:border-gray-200 transition-all">
                    <input 
                      type="radio" 
                      name="correct_option"
                      checked={formData.correct_option === num}
                      onChange={() => setFormData({...formData, correct_option: num})}
                      className="w-5 h-5 text-[#1a2e44] focus:ring-[#c5a059] cursor-pointer"
                    />
                    <input 
                      required
                      placeholder={`متن گزینه ${num}...`}
                      className="flex-1 p-2 bg-transparent border-none text-sm font-bold text-[#1a2e44] outline-none"
                      value={(formData as any)[`option_${num}`]}
                      onChange={(e) => setFormData({...formData, [`option_${num}`]: e.target.value})}
                    />
                 </div>
               ))}
             </div>
          </div>

        </div>

        {/* ستون چپ (۱ ستون): مدیریت انتساب و شلیک فرم */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* باکس انتخاب مسابقه هدف */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">انتخاب مسابقه هدف</label>
            <select 
              required
              className="w-full p-4 rounded-2xl bg-[#faf9f6] border-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm appearance-none outline-none"
              value={formData.contest_id}
              onChange={(e) => setFormData({...formData, contest_id: e.target.value})}
            >
              <option value="">انتخاب کنید...</option>
              {contests.map((c: any) => {
                const isLocked = c.status === 'active' || c.status === 'finished'; 
                let statusText = '';
                if (c.status === 'active') statusText = '(در حال اجرا 🔒)';
                if (c.status === 'finished') statusText = '(پایان یافته 🔒)';

                return (
                  <option 
                    key={c.id} 
                    value={c.id} 
                    disabled={isLocked}
                    className={isLocked ? 'text-gray-300' : ''}
                  >
                    #{c.id} - {c.title} {statusText}
                  </option>
                );
              })}
            </select>
            <p className="mt-3 text-[10px] text-gray-400 font-bold leading-relaxed">
              * لایه امنیتی سیستم: امکان افزودن سوال به مسابقات فعال یا بایگانی‌شده وجود ندارد.
            </p>
          </div>

          {/* دکمه ثبت نهایی کارت کناری */}
          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1a2e44] text-white p-4.5 py-4 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} className="text-[#c5a059]" />}
            ذخیره در بانک سوالات
          </button>

        </div>

      </form>
    </div>
  );
}