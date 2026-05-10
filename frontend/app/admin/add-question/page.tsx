'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { PlusCircle, ArrowRight, Save, Loader2, HelpCircle, LayoutList } from 'lucide-react';

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
        const response = await api.get('/contests');
        setContests(response.data);
      } catch (error) {
        console.error("خطا در بارگذاری لیست مسابقات", error);
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
      // ریست کردن فرم برای سوال بعدی
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
    <div className="min-h-screen bg-[#faf9f6] p-6 font-sans text-[#1a2e44]" dir="rtl">
      <div className="mx-auto max-w-xl">
        
        {/* Header */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="rounded-full bg-white p-2 shadow-sm border border-gray-100">
              <ArrowRight size={20} />
            </button>
            <h1 className="text-xl font-black">مدیریت بانک سوالات</h1>
          </div>
          <LayoutList className="text-[#c5a059]" size={28} />
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* انتخاب مسابقه */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
            <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">انتخاب مسابقه هدف</label>
            <select 
              required
              className="w-full p-4 rounded-2xl bg-[#faf9f6] border-none focus:ring-2 focus:ring-[#c5a059] font-bold text-sm"
              value={formData.contest_id}
              onChange={(e) => setFormData({...formData, contest_id: e.target.value})}
            >
              <option value="">انتخاب کنید...</option>
              {contests.map((c: any) => (
                <option key={c.id} value={c.id}>{c.title} (آیدی: {c.id})</option>
              ))}
            </select>
          </div>

          {/* متن سوال */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-xs font-black text-gray-400 mb-2">متن سوال</label>
              <textarea 
                required
                className="w-full p-4 rounded-2xl bg-[#faf9f6] border-none focus:ring-2 focus:ring-[#1a2e44] min-h-[100px] font-bold"
                placeholder="سوال خود را اینجا بنویسید..."
                value={formData.text}
                onChange={(e) => setFormData({...formData, text: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-black text-gray-400 mb-2">توضیحات یا راهنمایی (اختیاری)</label>
              <input 
                className="w-full p-4 rounded-2xl bg-[#faf9f6] border-none focus:ring-2 focus:ring-[#1a2e44] text-sm"
                placeholder="مثلاً: این سوال مربوط به بخش اول جزوه است"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </div>

          {/* گزینه‌ها */}
          <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-4">
             <label className="block text-xs font-black text-gray-400 mb-2">گزینه‌ها و پاسخ صحیح</label>
             {[1, 2, 3, 4].map((num) => (
               <div key={num} className="flex items-center gap-3">
                  <input 
                    type="radio" 
                    name="correct_option"
                    checked={formData.correct_option === num}
                    onChange={() => setFormData({...formData, correct_option: num})}
                    className="w-5 h-5 text-[#c5a059] focus:ring-[#c5a059]"
                  />
                  <input 
                    required
                    placeholder={`گزینه ${num}`}
                    className="flex-1 p-3 rounded-xl bg-[#faf9f6] border-none text-sm font-medium"
                    value={(formData as any)[`option_${num}`]}
                    onChange={(e) => setFormData({...formData, [`option_${num}`]: e.target.value})}
                  />
               </div>
             ))}
          </div>

          {/* دکمه ثبت */}
          <button 
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1a2e44] text-white py-5 rounded-[2rem] font-black shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 transition active:scale-95 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" /> : <Save size={22} />}
            ذخیره در بانک سوالات
          </button>
        </form>
      </div>
    </div>
  );
}