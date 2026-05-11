'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ArrowRight, Save, Image as ImageIcon, FileText, Trophy, Settings, CalendarClock, Clock } from 'lucide-react';

export default function CreateContestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    award: '',
    status: 'upcoming',
    image_url: '',
    file_url: '',
    start_time: '',
    time_limit: 10,
    question_limit: 15
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const now = new Date().toISOString();

    const finalData = {
      ...formData,
      start_time: (formData.status === 'upcoming' && formData.start_time && formData.start_time !== "") 
                  ? new Date(formData.start_time).toISOString() 
                  : now,
      end_time: now, 
      description: formData.description || "",
      award: formData.award || "",
      image_url: formData.image_url || "",
      file_url: formData.file_url || "",
      time_limit: parseInt(formData.time_limit.toString())
    };

    try {
      await api.post('/contests', finalData);
      alert("مسابقه با موفقیت ساخته و منتشر شد!");
      router.push('/dashboard');
    } catch (error: any) {
      const serverError = error.response?.data?.detail?.[0]?.msg || "مشکل فنی در سرور";
      alert("خطا: " + serverError);
    }
  };  

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);

    try {
      const response = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, [fieldName]: response.data.url }));
      alert("فایل با موفقیت آپلود شد");
    } catch (error) {
      alert("خطا در آپلود فایل");
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] pb-24 font-sans text-[#1a2e44]" dir="rtl">
      <header className="p-6 flex items-center gap-3 sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 hover:bg-gray-50 transition">
          <ArrowRight size={20} className="text-[#1a2e44]" />
        </button>
        <h1 className="font-black text-xl text-[#1a2e44]">تعریف مسابقه جدید</h1>
      </header>

      <form onSubmit={handleSubmit} className="px-6 space-y-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">عنوان مسابقه</label>
            <input type="text" required className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold" placeholder="مثلاً: مسابقه هوش مصنوعی" onChange={(e) => setFormData({...formData, title: e.target.value})} />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">توضیحات جامع</label>
            <textarea rows={3} className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-medium text-sm leading-relaxed" placeholder="توضیحات و قوانین شرکت در این مسابقه را بنویسید..." onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                جوایز مسابقه (هر کدام در یک خط)
              </label>
              <div className="relative">
                <Trophy className="absolute right-4 top-4 text-gray-400" size={18} />
                <textarea 
                  rows={3}
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm leading-relaxed"
                  placeholder="مثلاً:&#10;نفر اول: ۱ میلیون تومان&#10;نفر دوم: ۵۰۰ هزار تومان"
                  value={formData.award}
                  onChange={(e) => setFormData({...formData, award: e.target.value})}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">وضعیت انتشار</label>
              <select className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm appearance-none" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}>
                <option value="upcoming">به زودی</option>
                <option value="active">در حال برگزاری</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تعداد سوالات هر آزمون</label>
            <input 
              type="number" 
              className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold"
              value={formData.question_limit}
              onChange={(e) => setFormData({...formData, question_limit: parseInt(e.target.value)})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             {/* فیلد جدید تایمر */}
             <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">زمان آزمون (دقیقه)</label>
              <div className="relative">
                <Clock className="absolute right-4 top-4 text-gray-400" size={18} />
                <input type="number" min="1" required className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm" value={formData.time_limit} onChange={(e) => setFormData({...formData, time_limit: parseInt(e.target.value)})} />
              </div>
            </div>

            {formData.status === 'upcoming' && (
              <div className="transition-all duration-300 animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                  <CalendarClock size={14} /> زمان شروع
                </label>
                <input type="datetime-local" className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm" dir="ltr" value={formData.start_time} onChange={(e) => setFormData({...formData, start_time: e.target.value})} />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
          <h2 className="font-black text-[#1a2e44] flex items-center gap-2 mb-4 pb-4 border-b border-gray-50">
            <Settings size={20} className="text-[#c5a059]" /> محتوا و پیوست‌ها
          </h2>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              <ImageIcon size={14} /> بارگذاری تصویر بنر
            </label>
            <input type="file" accept="image/*" className="w-full p-3 bg-[#faf9f6] border-2 border-dashed border-gray-200 rounded-2xl outline-none text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1a2e44] file:text-white hover:file:bg-[#2a405a] cursor-pointer transition-all hover:border-[#c5a059]" onChange={(e) => handleFileUpload(e, 'image_url')} />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              <FileText size={14} /> فایل جزوه (PDF)
            </label>
            <input type="file" accept=".pdf" className="w-full p-3 bg-[#faf9f6] border-2 border-dashed border-gray-200 rounded-2xl outline-none text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#c5a059] file:text-[#1a2e44] hover:file:bg-[#d8b572] cursor-pointer transition-all hover:border-[#c5a059]" onChange={(e) => handleFileUpload(e, 'file_url')} />
          </div>
        </div>

        <button type="submit" className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 mt-4">
          <Save size={22} className="text-[#c5a059]" /> ذخیره و انتشار مسابقه
        </button>
      </form>
    </div>
  );
}