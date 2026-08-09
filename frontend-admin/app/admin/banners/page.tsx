// frontend-admin/app/admin/banners/page.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import { 
  ArrowRight, Save, Image as ImageIcon, Link as LinkIcon, 
  Type, Eye, Loader2, Plus, Trash2, Power, XCircle, Megaphone, ExternalLink
} from 'lucide-react';

export default function AdminBannersPage() {
  const router = useRouter();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // استیت فرم ثبت بنر جدید
  const [formData, setFormData] = useState({
    title: '',
    link_url: '',
    image_url: '',
    status: 'active'
  });

  // تابع پاک‌سازی آدرس‌های مطلق داخلی به نسبی برای لود صحیح تصاویر
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

  // دریافت لیست تمام بنرها از بک‌ند
  const fetchBanners = async () => {
    try {
      const response = await api.get('/admin/banners');
      setBanners(response.data || []);
    } catch (error) {
      try {
        const fallbackRes = await api.get('/banners');
        setBanners(fallbackRes.data || []);
      } catch (err) {
        console.error("خطا در دریافت لیست بنرها", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  // آپلود تصویر بنر
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
      
      const rawUrl = response.data.url;
      const validUrl = getCleanImageUrl(rawUrl);
      
      setFormData((prev) => ({ ...prev, image_url: validUrl }));
      alert("تصویر بنر با موفقیت آپلود شد.");
    } catch (error) {
      alert("خطا در آپلود تصویر بنر");
    } finally {
      setUploading(false);
    }
  };

  // ثبت بنر جدید
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.image_url) return alert("لطفاً ابتدا تصویر بنر را بارگذاری کنید");

    setSubmitting(true);
    try {
      await api.post('/admin/banners', formData);
      alert("بنر جدید با موفقیت ثبت و فعال شد! 🎉");
      setFormData({ title: '', link_url: '', image_url: '', status: 'active' });
      setShowAddForm(false);
      fetchBanners();
    } catch (error: any) {
      alert("خطا در ثبت بنر.");
    } finally {
      setSubmitting(false);
    }
  };

  // تغییر وضعیت بنر (فعال/غیرفعال)
  const handleToggleStatus = async (bannerId: number) => {
    try {
      await api.patch(`/admin/banners/${bannerId}/toggle`);
      fetchBanners();
    } catch (error) {
      alert("خطا در تغییر وضعیت بنر");
    }
  };

  // حذف بنر
  const handleDeleteBanner = async (bannerId: number) => {
    if (!window.confirm("آیا از حذف این بنر مطمئن هستید؟")) return;
    try {
      await api.delete(`/admin/banners/${bannerId}`);
      fetchBanners();
    } catch (error) {
      alert("خطا در حذف بنر");
    }
  };

  return (
    <div className="max-w-5xl mx-auto min-h-screen bg-[#faf9f6] pb-24 font-sans text-[#1a2e44]" dir="rtl">
      
      {/* هدر صفحه مدیریت بنرها */}
      <header className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20 border-b border-gray-100">
        <div className="flex items-center gap-4">
          <button 
            type="button"
            onClick={() => router.back()} 
            className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition text-gray-500 hover:text-[#1a2e44]"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black flex items-center gap-2">
              <Megaphone size={22} className="text-[#c5a059]" /> مدیریت بنرهای تبلیغاتی
            </h1>
            <p className="text-gray-400 text-xs font-bold mt-1">مشاهده، فعال‌سازی، ویرایش و انتشار بنرهای اسلایدر صفحه اصلی</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-5 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 ${
            showAddForm 
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
              : 'bg-[#1a2e44] text-white hover:bg-[#2a405a]'
          }`}
        >
          {showAddForm ? <XCircle size={16} /> : <Plus size={16} className="text-[#c5a059]" />}
          <span>{showAddForm ? 'بستن فرم ایجاد' : 'افزودن بنر جدید'}</span>
        </button>
      </header>

      <main className="p-6 sm:p-8 space-y-8">

        {/* فرم ثبت بنر جدید (در صورت کلیک روی افزودن بنر) */}
        {showAddForm && (
          <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] shadow-md border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
            <h2 className="text-lg font-black mb-6 flex items-center gap-2 text-[#1a2e44] border-b border-gray-100 pb-4">
              <Plus className="text-[#c5a059]" size={20} /> ایجاد بنر تبلیغاتی جدید
            </h2>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* ورودی‌ها */}
              <div className="lg:col-span-2 space-y-5">
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
                      <p className="text-[10px] text-gray-400">سایز پیشنهادی: 1920x600 پیکسل</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* پیش‌نمایش و ثبت */}
              <div className="lg:col-span-1 space-y-5">
                <div className="bg-[#faf9f6] p-4 rounded-2xl space-y-2 border border-gray-100">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                    <Eye size={14} /> پیش‌نمایش بنر
                  </label>
                  <div className="w-full aspect-[21/9] bg-gray-200 rounded-xl overflow-hidden relative flex items-center justify-center text-center">
                    {formData.image_url ? (
                      <>
                        <img 
                          src={getCleanImageUrl(formData.image_url)} 
                          alt="Preview" 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-end p-3 text-right">
                          <p className="text-white font-black text-xs drop-shadow-md leading-tight line-clamp-2">
                            {formData.title || "بدون عنوان"}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs font-bold text-gray-400 italic">تصویری آپلود نشده است</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">وضعیت انتشار</label>
                  <select 
                    className="w-full p-4 bg-[#faf9f6] border-none rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-sm" 
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
                  className="w-full bg-[#1a2e44] text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:bg-[#2a405a] transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="animate-spin text-[#c5a059]" size={20} /> : <Save size={18} className="text-[#c5a059]" />}
                  <span>تایید و انتشار بنر</span>
                </button>
              </div>

            </form>
          </div>
        )}

        {/* لیست بنرهای ثبت شده */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-[#1a2e44] flex items-center gap-2">
              <ImageIcon size={18} className="text-[#c5a059]" /> لیست بنرهای فعال و ثبت شده در سیستم ({banners.length})
            </h2>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <Loader2 className="animate-spin mx-auto text-[#1a2e44]" size={36} />
              <p className="text-xs font-bold text-gray-400 mt-2">در حال بارگذاری بنرها...</p>
            </div>
          ) : banners.length === 0 ? (
            <div className="bg-white p-12 rounded-[2.5rem] text-center border border-dashed border-gray-200">
              <Megaphone className="mx-auto text-gray-300 mb-3" size={40} />
              <h3 className="font-black text-sm text-[#1a2e44] mb-1">هنوز بنری ثبت نشده است</h3>
              <p className="text-xs text-gray-400 mb-4">می‌توانید با کلیک روی دکمه «افزودن بنر جدید» نخستین بنر خود را ایجاد کنید.</p>
              <button 
                onClick={() => setShowAddForm(true)}
                className="bg-[#1a2e44] text-white px-6 py-3 rounded-2xl font-black text-xs inline-flex items-center gap-2 shadow-md hover:bg-[#2a405a] transition"
              >
                <Plus size={16} className="text-[#c5a059]" /> افزودن بنر جدید
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banners.map((banner) => {
                const isActive = banner.status === 'active' || banner.status === 'فعال و در حال نمایش';
                return (
                  <div 
                    key={banner.id}
                    className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between space-y-4 hover:shadow-md transition-all group"
                  >
                    <div className="flex gap-4">
                      {/* تصویر بنر */}
                      <div className="w-28 h-20 bg-[#faf9f6] rounded-2xl overflow-hidden border border-gray-100 shrink-0 relative">
                        {banner.image_url ? (
                          <img src={getCleanImageUrl(banner.image_url)} alt={banner.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={24} /></div>
                        )}
                      </div>

                      {/* اطلاعات بنر */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="font-black text-sm text-[#1a2e44] truncate">{banner.title || 'بدون عنوان'}</h4>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md shrink-0 ${
                            isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isActive ? '● فعال' : 'غیرفعال'}
                          </span>
                        </div>

                        {banner.link_url || banner.link ? (
                          <a 
                            href={banner.link_url || banner.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[11px] text-blue-600 font-bold hover:underline flex items-center gap-1 truncate"
                            dir="ltr"
                          >
                            <ExternalLink size={12} /> {banner.link_url || banner.link}
                          </a>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium block">بدون لینک ارجاع</span>
                        )}
                      </div>
                    </div>

                    {/* دکمه‌های عملیاتی بنر */}
                    <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                      <button 
                        onClick={() => handleToggleStatus(banner.id)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1.5 transition active:scale-95 ${
                          isActive 
                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100' 
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100'
                        }`}
                      >
                        <Power size={13} />
                        <span>{isActive ? 'غیرفعال کردن' : 'فعال‌سازی'}</span>
                      </button>

                      <button 
                        onClick={() => handleDeleteBanner(banner.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-[11px] font-black flex items-center gap-1 transition active:scale-95 border border-red-100"
                      >
                        <Trash2 size={13} />
                        <span>حذف بنر</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}