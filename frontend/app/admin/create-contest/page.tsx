'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { ArrowRight, Save, Image as ImageIcon, FileText, Trophy, Settings, CalendarClock, Clock, Award, PlayCircle } from 'lucide-react'; 
import DatePicker from "react-multi-date-picker";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
const DatePickerComponent = DatePicker as any;
const TimePickerPlugin = TimePicker as any;

export default function CreateContestPage() {
  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776))
              .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632));
  };
  const router = useRouter();
  const [formData, setFormData] = useState<any>({
    title: '',
    description: '',
    award: '',
    status: 'upcoming',
    image_url: '',
    file_url: '',
    start_time: null, // تغییر از رشته خالی به null برای سازگاری کامل با دیت‌پیکر
    time_limit: 10,
    question_limit: 15,
    certificate_type: 'none', 
    video_url: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const now = new Date();
    // ۱. محاسبه دقیق زمان شروع مسابقه
    const startTime = (formData.status === 'upcoming' && formData.start_time) 
                      ? new Date(formData.start_time) 
                      : now;

    // ۲. محاسبه هوشمند زمان پایان (زمان شروع + تعداد دقیقه‌های زمان آزمون)
    const durationInMinutes = parseInt(formData.time_limit.toString(), 10) || 10;
    const endTime = new Date(startTime.getTime() + durationInMinutes * 60 * 1000);

    const finalData = {
      title: formData.title,
      description: formData.description || "",
      award: formData.award || "",
      status: formData.status,
      image_url: formData.image_url || "",
      file_url: formData.file_url || "",
      video_url: formData.video_url || "",
      time_limit: durationInMinutes,
      question_limit: parseInt(formData.question_limit.toString(), 10) || 0,
      certificate_type: formData.certificate_type || 'none',
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString() // 👈 زمان پایان واقعی و در آینده ارسال می‌شود
    };

    try {
      await api.post('/contests', finalData);
      alert("مسابقه با موفقیت ساخته و منتشر شد!");
      router.push('/admin/dashboard'); 
    } catch (error: any) {
      const serverError = error.response?.data?.detail?.[0]?.msg || error.response?.data?.detail || "مشکل فنی در سرور";
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
      setFormData((prev: any) => ({ ...prev, [fieldName]: response.data.url }));
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
            <input type="text" required className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold" placeholder="مثلاً: مسابقه هوش مصنوعی" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">توضیحات جامع</label>
            <textarea rows={3} className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-medium text-sm leading-relaxed" placeholder="توضیحات و قوانین شرکت در این مسابقه را بنویسید..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">جوایز مسابقه</label>
              <div className="relative">
                <Trophy className="absolute right-4 top-4 text-gray-400" size={18} />
                <textarea rows={3} className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm" placeholder="جوایز..." value={formData.award} onChange={(e) => setFormData({...formData, award: e.target.value})} />
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
            <label className="block text-[10px] font-black text-[#c5a059] uppercase tracking-widest mb-2">گواهی دوره (اختیاری)</label>
            <div className="relative">
              <Award className="absolute right-4 top-4 text-gray-400" size={18} />
              <select 
                className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm appearance-none" 
                value={formData.certificate_type} 
                onChange={(e) => setFormData({...formData, certificate_type: e.target.value})}
              >
                <option value="none">بدون گواهی</option>
                <option value="level_1">گواهی رتبه ۱</option>
                <option value="level_2">گواهی رتبه ۲</option>
                <option value="level_3">گواهی رتبه ۳</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">زمان آزمون (دقیقه)</label>
              <div className="relative">
                <Clock className="absolute right-4 top-4 text-gray-400" size={18} />
                <input 
                  type="number" // 👈 فلش‌های نیتیو بالا و پایین برگشتند
                  min="0"
                  required 
                  className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm" 
                  value={formData.time_limit} 
                  onChange={(e) => {
                    const val = toEnglishDigits(e.target.value);
                    setFormData({
                      ...formData, 
                      // اجازه می‌دهد ورودی خالی شود تا کیبورد قفل نکند
                      time_limit: val === '' ? '' : parseInt(val, 10)
                    });
                  }} 
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">تعداد سوالات</label>
              <input 
                type="number" // 👈 فلش‌های نیتیو بالا و پایین برگشتند
                min="0"
                className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm" 
                value={formData.question_limit} 
                onChange={(e) => {
                  const val = toEnglishDigits(e.target.value);
                  setFormData({
                    ...formData, 
                    question_limit: val === '' ? '' : parseInt(val, 10)
                  });
                }} 
              />
            </div>
          </div>
          
          {formData.status === 'upcoming' && (
            <div className="transition-all duration-300 animate-in fade-in slide-in-from-top-2">
              <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <CalendarClock size={14} /> زمان شروع مسابقه
              </label>
              <div className="relative">
                <CalendarClock className="absolute right-4 top-4 text-gray-400 z-10" size={18} />
                <DatePickerComponent
                  calendar={persian}
                  locale={persian_fa}
                  calendarPosition="bottom-right"
                  format="YYYY/MM/DD HH:mm"
                  // با این روش فراخوانی شیء، تداخل کدهای لوکال و تایپ‌اسکریپت کاملاً برطرف می‌شود
                  plugins={[
                    React.createElement(TimePickerPlugin, { position: "bottom", hideSeconds: true })
                  ]}
                  value={formData.start_time}
                  onChange={(date: any) => {
                    if (date) {
                      const jsDate = date.toDate ? date.toDate() : new Date(date);
                      setFormData({ ...formData, start_time: jsDate });
                    } else {
                      setFormData({ ...formData, start_time: null });
                    }
                  }}
                  containerClassName="w-full"
                  inputClass="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left"
                  placeholder="انتخاب تاریخ و ساعت شروع"
                />
              </div>
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">لینک ویدیو آپارات (اختیاری)</label>
          <div className="relative">
            <PlayCircle className="absolute right-4 top-4 text-gray-400" size={18} />
            <input 
              type="text" 
              className="w-full p-4 pr-12 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm" 
              placeholder="https://www.aparat.com/v/xxxxx" 
              value={formData.video_url} 
              onChange={(e) => setFormData({...formData, video_url: e.target.value})} 
            />
          </div>
          <p className="text-[9px] text-gray-400 mt-1 mr-2">لینک صفحه ویدیو یا کد اشتراق‌گذاری آپارات را وارد کنید.</p>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-5">
          <h2 className="font-black text-[#1a2e44] flex items-center gap-2 mb-4 pb-4 border-b border-gray-50">
            <Settings size={20} className="text-[#c5a059]" /> محتوا و پیوست‌ها
          </h2>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              <ImageIcon size={14} /> بارگذاری تصویر بنر
            </label>
            <input type="file" accept="image/*" className="w-full p-3 bg-[#faf9f6] border-2 border-dashed border-gray-200 rounded-2xl outline-none text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#1a2e44] file:text-white cursor-pointer transition-all hover:border-[#c5a059]" onChange={(e) => handleFileUpload(e, 'image_url')} />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
              <FileText size={14} /> فایل جزوه (PDF)
            </label>
            <input type="file" accept=".pdf" className="w-full p-3 bg-[#faf9f6] border-2 border-dashed border-gray-200 rounded-2xl outline-none text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#c5a059] file:text-[#1a2e44] cursor-pointer transition-all hover:border-[#c5a059]" onChange={(e) => handleFileUpload(e, 'file_url')} />
          </div>
        </div>

        <button type="submit" className="w-full bg-[#1a2e44] text-white p-5 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 mt-4">
          <Save size={22} className="text-[#c5a059]" /> ذخیره و انتشار مسابقه
        </button>
      </form>
    </div>
  );
}