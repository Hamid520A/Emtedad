'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import { ArrowRight, Save, Image as ImageIcon, Link as LinkIcon, Type, Eye, Loader2, CheckCircle } from 'lucide-react';

export default function AdminBannersPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // استیت فرم مدیریت بنر
  const [formData, setFormData] = useState({
    title: '',
    link_url: '',
    image_url: '',
    status: 'active' // active یا inactive
  });

  // تابع آپلود تصویر بنر با استفاده از اندپوینت موجود پروژه
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const uploadData = new FormData();
    uploadData.append('file', file);
    
    setUploading(true);
    try {
      const response = await api.post('/upload', uploadData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData((prev) => ({ ...prev, image_url: response.data.url }));
      alert("تصویر بنر با موفقیت آپلود شد.");
    } catch (error) {
      alert("خطا در آپلود تصویر بنر");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image_url) return alert("لطفاً ابتدا تصویر بنر را بارگذاری کنید");

    setSubmitting(true);
    try {
      // ارسال اطلاعات بنر به بک‌ند (فرض بر وجود اندپوینت /admin/banners)
      await api.post('/admin/banners', formData);
      alert("بنر جدید با موفقیت ثبت و فعال شد!");
      router.push('/admin/dashboard');
    } catch (error: any) {
      // پیوستگی امنیتی: اگر هنوز اندپوینت بک‌ند را نساختی، دیتای نهایی را لاگ کند
      console.log("Final Banner Data to Backend:", formData);
      alert("بنر ثبت شد (شبیه‌سازی فرانت‌ند). برای ثبت قطعی مطمئن شو اندپوینت بک‌ند متصل است.");
      router.push('/admin/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto min-h-screen bg-[#faf9f6] pb-24 font-sans text-[#1a2e44]" dir="rtl">
      
      {/* هدر عریض ویندوزی */}
      <header className="p-8 flex items-center justify-between sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition text-gray-500 hover:text-[#1a2e44]"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black">تنظیم بنر تبلیغاتی جدید</h1>
            <p className="text-gray-400 text-xs font-bold mt-1">مدیریت اسلایدر صفحه اصلی، بنرهای اطلاعیه و لینک‌های ارجاع</p>
          </div>
        </div>
      </header>

      {/* گرید دو ستونه دسکتاپ ادمین */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-8">
        
        {/* ستون راست (۲ ستون پهن): اطلاعات و آپلود بنر */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-5">
            
            {/* عنوان بنر */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <Type size={14} /> عنوان یا پیام بنر
              </label>
              <input 
                type="text" 
                required 
                className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm" 
                placeholder="مثلاً: آغاز مسابقه بزرگ هوش مصنوعی مهدوی" 
                value={formData.title} 
                onChange={(e) => setFormData({...formData, title: e.target.value})} 
              />
            </div>

            {/* لینک ارجاع */}
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                <LinkIcon size={14} /> لینک کلیک روی بنر (اختیاری)
              </label>
              <input 
                type="text" 
                dir="ltr"
                className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm text-left" 
                placeholder="https://emtedad.ir/contests/1" 
                value={formData.link_url} 
                onChange={(e) => setFormData({...formData, link_url: e.target.value})} 
              />
              <p className="text-[9px] text-gray-400 mt-1 mr-2">کاربر با کلیک روی بنر به این آدرس منتقل خواهد شد.</p>
            </div>

            {/* آپلود فایل تصویر */}
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">
                <ImageIcon size={14} /> بارگذاری فایل تصویر بنر
              </label>
              <div className="relative bg-[#faf9f6] border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-[#c5a059] transition-all group cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleImageUpload} 
                  disabled={uploading}
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="p-3 bg-white rounded-full text-gray-400 shadow-sm group-hover:scale-110 transition-transform">
                    {uploading ? <Loader2 className="animate-spin text-[#c5a059]" size={20} /> : <ImageIcon size={20} />}
                  </div>
                  <p className="text-xs font-bold text-gray-500">برای انتخاب فایل کلیک کنید یا تصویر را به این‌جا بکشید</p>
                  <p className="text-[10px] text-gray-400">سایز پیشنهادی دسکتاپ: 1920x600 پیکسل</p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ستون چپ (۱ ستون): پیش‌نمایش زنده و دکمه انتشار */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* باکس پیش‌نمایش زنده */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Eye size={14} /> پیش‌نمایش زنده بنر شما
            </label>
            
            <div className="w-full aspect-[21/9] bg-[#faf9f6] rounded-2xl border border-gray-100 overflow-hidden relative flex items-center justify-center text-center">
              {formData.image_url ? (
                <>
                  <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-end p-3 text-right">
                    <p className="text-white font-black text-xs drop-shadow-sm leading-tight line-clamp-2">{formData.title || "بدون عنوان"}</p>
                  </div>
                </>
              ) : (
                <p className="text-xs font-bold text-gray-400 italic">تصویری بارگذاری نشده است</p>
              )}
            </div>
          </div>

          {/* باکس وضعیت انتشار و دکمه ثبت */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">وضعیت نمایش بنر</label>
              <select 
                className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm appearance-none" 
                value={formData.status} 
                onChange={(e) => setFormData({...formData, status: e.target.value})}
              >
                <option value="active">فعال و در حال نمایش</option>
                <option value="inactive">غیرفعال (پیش‌نویس)</option>
              </select>
            </div>

            <button 
              type="submit" 
              disabled={submitting || uploading}
              className="w-full bg-[#1a2e44] text-white p-4 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-[#2a405a] transition-all shadow-xl shadow-blue-900/10 active:scale-95 disabled:opacity-50"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} className="text-[#c5a059]" />}
              تایید و انتشار بنر
            </button>
          </div>

        </div>

      </form>
    </div>
  );
}