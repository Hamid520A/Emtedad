// frontend-admin/app/admin/create-contest/page.tsx
'use client';
import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import { ArrowRight, Save, Image as ImageIcon, FileText, Trophy, Settings, CalendarClock, Clock, Award, PlayCircle, Plus, Trash2, FileMinus } from 'lucide-react'; 
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
  
  const submitStatusRef = useRef<'upcoming' | 'draft'>('upcoming');

  const [awards, setAwards] = useState<{ rank: number; title: string }[]>([
    { rank: 1, title: '' }
  ]);

  const [formData, setFormData] = useState<any>({
    title: '',
    description: '',
    image_url: '',
    file_url: '',
    poster_url: '',
    start_time: null, 
    end_time: null, 
    time_limit: 10,
    question_limit: 15,
    certificate_type: 'none', 
    video_url: '',
    success_message: '',
    failure_message: '',
    sms_message: '',
  });

  const handleAwardChange = (index: number, field: 'rank' | 'title', value: string) => {
    const updated = [...awards];
    if (field === 'rank') {
      updated[index].rank = value === '' ? 1 : parseInt(toEnglishDigits(value), 10);
    } else {
      updated[index].title = value;
    }
    setAwards(updated);
  };

  const addAwardField = () => {
    const nextRank = awards.length > 0 ? Math.max(...awards.map(a => a.rank)) + 1 : 1;
    setAwards([...awards, { rank: nextRank, title: '' }]);
  };

  const removeAwardField = (index: number) => {
    setAwards(awards.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const now = new Date();
    const startTime = formData.start_time ? new Date(formData.start_time) : now;
    const endTime = formData.end_time ? new Date(formData.end_time) : null;
    const durationInMinutes = parseInt(formData.time_limit.toString(), 10) || 10;

    const validAwards = awards.filter(a => a.title.trim() !== "");
    const finalStatus = submitStatusRef.current;

    const finalData = {
      title: formData.title,
      description: formData.description || "",
      award: JSON.stringify(validAwards), 
      status: finalStatus, 
      image_url: formData.image_url || "",
      file_url: formData.file_url || "",
      poster_url: formData.poster_url || "",
      video_url: formData.video_url || "",
      time_limit: durationInMinutes,
      question_limit: parseInt(formData.question_limit.toString(), 10) || 0,
      certificate_type: formData.certificate_type || 'none',
      start_time: startTime.toISOString(),
      end_time: endTime ? endTime.toISOString() : null,
      success_message: formData.success_message?.trim() || null,
      failure_message: formData.failure_message?.trim() || null,
      sms_message: formData.sms_message?.trim() || null,
    };

    try {
      await api.post('/contests', finalData);
      if (finalStatus === 'draft') {
        alert("مسابقه با موفقیت به عنوان پیش‌نویس ذخیره شد.");
      } else {
        alert("مسابقه با موفقیت ساخته و منتشر شد!");
      }
      router.push('/admin/dashboard'); 
    } catch (error: any) {
      const serverError = error.response?.data?.detail?.[0]?.msg || error.response?.data?.detail || "مشکل فنی در سرور";
      alert("خطا: " + serverError);
    }
  };

  const getCleanImageUrl = (url: string) => {
    if (!url) return '';
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsedUrl = new URL(url);
        if (
          parsedUrl.hostname === 'localhost' ||
          parsedUrl.hostname === '127.0.0.1' ||
          parsedUrl.hostname === 'backend' ||
          parsedUrl.port === '8000' ||
          parsedUrl.port === '64000' ||
          parsedUrl.pathname.startsWith('/static/') ||
          parsedUrl.pathname.startsWith('/api/')
        ) {
          return parsedUrl.pathname + parsedUrl.search;
        }
        return url;
      }
    } catch (e) {
      console.error("Error parsing URL", e);
    }
    if (!url.startsWith('/') && !url.startsWith('http')) {
      return '/' + url;
    }
    return url;
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
      const cleanUrl = getCleanImageUrl(response.data.url);
      setFormData((prev: any) => ({ ...prev, [fieldName]: cleanUrl }));
      alert("فایل با موفقیت آپلود شد");
    } catch (error) {
      alert("خطا در آپلود فایل");
    }
  };

  return (
    <div className="max-w-5xl mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] pb-24 font-sans text-[#1a2e44] dark:text-slate-100 dark:text-slate-100" dir="rtl">
      <header className="p-8 flex items-center gap-4 sticky top-0 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234]/90 backdrop-blur-md z-20">
        <button onClick={() => router.back()} className="p-3 bg-white dark:bg-[#182234] dark:bg-[#182234] rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 dark:border-slate-800 hover:scale-105 transition text-gray-500 dark:text-slate-400 dark:text-slate-400 hover:text-[#1a2e44] dark:text-slate-100 dark:text-slate-100">
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="font-black text-2xl text-[#1a2e44] dark:text-slate-100 dark:text-slate-100">تعریف مسابقه جدید</h1>
          <p className="text-gray-400 dark:text-slate-400 dark:text-slate-400 text-xs font-bold mt-1">ایجاد رقابت جدید، تنظیم زمان‌بندی و جوایز رتبه‌بندی</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-[#182234] dark:bg-[#182234] p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 dark:border-slate-800 space-y-5">
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-2">عنوان مسابقه</label>
              <input type="text" required className="w-full p-4 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] border-none rounded-2xl text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm" placeholder="مثلاً: مسابقه هوش مصنوعی" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-2">توضیحات جامع</label>
              <textarea rows={4} className="w-full p-4 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] border-none rounded-2xl text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-medium text-sm leading-relaxed" placeholder="توضیحات و قوانین شرکت در این مسابقه را بنویسید..." value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </div>

            <div className="bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] p-5 rounded-2xl border border-gray-100 dark:border-slate-800 dark:border-slate-800 space-y-3">
              <div className="flex items-center gap-1.5 mb-1 text-gray-500 dark:text-slate-400 dark:text-slate-400">
                <Trophy size={16} className="text-[#c5a059]" />
                <label className="block text-[10px] font-black uppercase tracking-widest">تعیین جوایز بر اساس رتبه‌بندی</label>
              </div>
              
              {awards.map((award, index) => (
                <div key={index} className="flex gap-2 items-center animate-in fade-in duration-200">
                  <div className="w-24">
                    <input 
                      type="number" min="1" required
                      className="w-full p-3 bg-white dark:bg-[#182234] dark:bg-[#182234] border border-gray-200 dark:border-slate-800 dark:border-slate-800 rounded-xl text-center text-xs font-black text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#c5a059]" 
                      placeholder="رتبه" value={award.rank}
                      onChange={(e) => handleAwardChange(index, 'rank', e.target.value)}
                    />
                  </div>
                  <div className="flex-1">
                    <input 
                      type="text" required
                      className="w-full p-3 bg-white dark:bg-[#182234] dark:bg-[#182234] border border-gray-200 dark:border-slate-800 dark:border-slate-800 rounded-xl text-xs font-bold text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#c5a059]" 
                      placeholder={`جایزه رتبه ${award.rank}...`} value={award.title}
                      onChange={(e) => handleAwardChange(index, 'title', e.target.value)}
                    />
                  </div>
                  {awards.length > 1 && (
                    <button type="button" onClick={() => removeAwardField(index)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              
              <button type="button" onClick={addAwardField} className="w-full py-3 bg-white dark:bg-[#182234] dark:bg-[#182234] border border-dashed border-gray-300 rounded-xl text-xs font-black text-[#c5a059] flex items-center justify-center gap-1 hover:bg-gray-50 transition-all active:scale-95">
                <Plus size={14} /> افزودن جایزه برای رتبه بعدی
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">
                  پیام قبولی مسابقه (اختیاری)
                </label>
                <textarea
                  rows={3}
                  className="w-full p-4 bg-[#faf9f6] dark:bg-[#182234] border border-gray-100 dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-medium text-sm leading-relaxed"
                  placeholder="پیام سفارشی برای کاربرانی که نمره قبولی (۵۰٪ و بالاتر) کسب می‌کنند..."
                  value={formData.success_message}
                  onChange={(e) => setFormData({ ...formData, success_message: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">
                  پیام عدم قبولی مسابقه (اختیاری)
                </label>
                <textarea
                  rows={3}
                  className="w-full p-4 bg-[#faf9f6] dark:bg-[#182234] border border-gray-100 dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-medium text-sm leading-relaxed"
                  placeholder="پیام سفارشی برای کاربرانی که نمره قبولی کسب نمی‌کنند..."
                  value={formData.failure_message}
                  onChange={(e) => setFormData({ ...formData, failure_message: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">
                  متن پیامک اتمام آزمون (اختیاری)
                </label>
                <textarea
                  rows={3}
                  className="w-full p-4 bg-[#faf9f6] dark:bg-[#182234] border border-gray-100 dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-medium text-sm leading-relaxed"
                  placeholder="متن پیامکی که پس از اتمام آزمون برای شرکت‌کننده ارسال می‌شود..."
                  value={formData.sms_message}
                  onChange={(e) => setFormData({ ...formData, sms_message: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-[#182234] dark:bg-[#182234] p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 dark:border-slate-800 space-y-5">
            <div>
              <label className="block text-[10px] font-black text-[#c5a059] uppercase tracking-widest mb-2">گواهی دوره (اختیاری)</label>
              <div className="relative">
                <Award className="absolute right-4 top-4 text-gray-400 dark:text-slate-400 dark:text-slate-400" size={18} />
                <select className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] border-none rounded-2xl text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm appearance-none cursor-pointer" value={formData.certificate_type} onChange={(e) => setFormData({...formData, certificate_type: e.target.value})}>
                  <option value="none">بدون گواهی</option>
                  <option value="excellent">گواهی رتبه عالی</option>
                  <option value="very_good">گواهی رتبه خیلی خوب</option>
                  <option value="good">گواهی رتبه خوب</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-2">زمان (دقیقه)</label>
                <div className="relative">
                  <Clock className="absolute right-3 top-4 text-gray-400 dark:text-slate-400 dark:text-slate-400" size={16} />
                  <input type="number" min="0" required className="w-full p-4 pr-10 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] border-none rounded-2xl text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm" value={formData.time_limit} onChange={(e) => setFormData({...formData, time_limit: e.target.value === '' ? '' : parseInt(toEnglishDigits(e.target.value), 10)})} />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-2">تعداد سوالات</label>
                <input type="number" min="0" className="w-full p-4 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] border-none rounded-2xl text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm" value={formData.question_limit} onChange={(e) => setFormData({...formData, question_limit: e.target.value === '' ? '' : parseInt(toEnglishDigits(e.target.value), 10)})} />
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-5 transition-all duration-300 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-gray-400 dark:text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-2"><CalendarClock size={14} /> زمان شروع مسابقه</label>
                <div className="relative">
                  <CalendarClock className="absolute right-4 top-4 text-gray-400 dark:text-slate-400 dark:text-slate-400 z-10" size={18} />
                  <DatePickerComponent
                    calendar={persian} locale={persian_fa} calendarPosition="bottom-right" format="YYYY/MM/DD HH:mm"
                    plugins={[React.createElement(TimePickerPlugin, { position: "bottom", hideSeconds: true })]}
                    value={formData.start_time}
                    onChange={(date: any) => setFormData({ ...formData, start_time: date ? (date.toDate ? date.toDate() : new Date(date)) : null })}
                    containerClassName="w-full"
                    placeholder="همین الان"
                    render={(value: string, openCalendar: () => void) => (
                      <input
                        readOnly
                        value={value}
                        onFocus={openCalendar}
                        placeholder="همین الان"
                        className="w-full p-4 pr-12 bg-[#faf9f6] dark:bg-[#182234] border border-transparent dark:border-slate-800 rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm text-left cursor-pointer"
                      />
                    )}
                  />
                </div>
              </div>
              
              <div>
                <label className="flex items-center gap-2 text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2"><CalendarClock size={14} /> زمان بسته شدن و پایان مسابقه</label>
                <div className="relative">
                  <CalendarClock className="absolute right-4 top-4 text-rose-400 z-10" size={18} />
                  <DatePickerComponent
                    calendar={persian} locale={persian_fa} calendarPosition="bottom-right" format="YYYY/MM/DD HH:mm"
                    plugins={[React.createElement(TimePickerPlugin, { position: "bottom", hideSeconds: true })]}
                    value={formData.end_time}
                    onChange={(date: any) => setFormData({ ...formData, end_time: date ? (date.toDate ? date.toDate() : new Date(date)) : null })}
                    containerClassName="w-full"
                    placeholder="بدون محدودیت (باز)"
                    render={(value: string, openCalendar: () => void) => (
                      <input
                        readOnly
                        value={value}
                        onFocus={openCalendar}
                        placeholder="بدون محدودیت (باز)"
                        className="w-full p-4 pr-12 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-200 border border-red-100 dark:border-red-900/40 rounded-2xl focus:ring-2 focus:ring-rose-400 outline-none font-bold text-sm text-left cursor-pointer"
                      />
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#182234] dark:bg-[#182234] p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 dark:border-slate-800 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-2">ویدیو آپارات (اختیاری)</label>
              <div className="relative">
                <PlayCircle className="absolute right-3 top-3.5 text-gray-400 dark:text-slate-400 dark:text-slate-400" size={16} />
                <input type="text" className="w-full p-3 pr-9 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] border-none rounded-xl text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-xs" placeholder="https://www.aparat.com/v/xxxxx" value={formData.video_url} onChange={(e) => setFormData({...formData, video_url: e.target.value})} />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 dark:text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1.5"><ImageIcon size={14} /> تصویر بنر</label>
              <input type="file" accept="image/*" className="w-full p-2 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] border border-dashed border-gray-200 dark:border-slate-800 dark:border-slate-800 rounded-xl outline-none text-xs text-gray-500 dark:text-slate-400 dark:text-slate-400 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[#1a2e44] file:text-white cursor-pointer" onChange={(e) => handleFileUpload(e, 'image_url')} />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 dark:text-slate-400 dark:text-slate-400 uppercase tracking-widest mb-1.5"><FileText size={14} /> جزوه (PDF)</label>
              <input type="file" accept=".pdf" className="w-full p-2 bg-[#faf9f6] dark:bg-[#182234] dark:bg-[#182234] border border-dashed border-gray-200 dark:border-slate-800 dark:border-slate-800 rounded-xl outline-none text-xs text-gray-500 dark:text-slate-400 dark:text-slate-400 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[#c5a059] file:text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 cursor-pointer" onChange={(e) => handleFileUpload(e, 'file_url')} />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-1.5">
                <ImageIcon size={14} /> پوستر مسابقه (اختیاری)
              </label>
              <input
                type="file"
                accept="image/*"
                className="w-full p-2 bg-[#faf9f6] dark:bg-[#182234] border border-dashed border-gray-200 dark:border-slate-800 rounded-xl outline-none text-xs text-gray-500 dark:text-slate-400 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-[#1a2e44] file:text-white cursor-pointer"
                onChange={(e) => handleFileUpload(e, 'poster_url')}
              />
            </div>
          </div>

          <div className="space-y-3">
            <button 
              type="submit" 
              onClick={() => submitStatusRef.current = 'upcoming'}
              className="w-full bg-[#1a2e44] text-white p-4 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95"
            >
              <Save size={20} className="text-[#c5a059]" /> ذخیره و انتشار مسابقه
            </button>

            <button 
              type="submit" 
              onClick={() => submitStatusRef.current = 'draft'}
              className="w-full bg-white dark:bg-[#182234] dark:bg-[#182234] text-[#1a2e44] dark:text-slate-100 dark:text-slate-100 p-4 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-gray-50 transition-all border border-gray-200 dark:border-slate-800 dark:border-slate-800 active:scale-95"
            >
              <FileMinus size={20} className="text-gray-400 dark:text-slate-400 dark:text-slate-400" /> ذخیره به عنوان پیش‌نویس
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}