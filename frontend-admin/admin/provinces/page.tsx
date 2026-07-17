'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import { ArrowRight, Globe, Loader2, MapPin } from 'lucide-react';

export default function AdminProvincesPage() {
  const router = useRouter();
  const [provincesReport, setProvincesReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProvincesReport = async () => {
      try {
        const res = await api.get('/admin/provinces-report');
        setProvincesReport(res.data);
      } catch (error) {
        console.error("Error fetching provinces report:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProvincesReport();
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      {/* Header */}
      <header className="p-8 flex items-center gap-4">
        <button 
          onClick={() => router.push('/admin/dashboard')}
          className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]"
        >
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Globe className="text-[#c5a059]" /> گزارش جغرافیایی مسابقات
          </h1>
          <p className="text-gray-400 text-sm font-bold mt-1">بررسی میزان مشارکت و ثبت‌نام کاربران به تفکیک استان‌ها</p>
        </div>
      </header>

      {/* Content */}
      <main className="px-8">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400 font-bold">
              <Loader2 className="w-8 h-8 animate-spin text-[#1a2e44]" />
              <span>در حال بارگذاری آمار جغرافیایی...</span>
            </div>
          ) : provincesReport.length === 0 ? (
            <p className="text-center py-12 text-gray-400 font-bold">داده‌ای برای نمایش وجود ندارد.</p>
          ) : (
            <div className="space-y-6">
              {provincesReport.map((item: any, index: number) => (
                <div key={item.province} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-[#faf9f6] rounded-3xl border border-gray-100 gap-4">
                  
                  {/* اطلاعات استان و رتبه */}
                  <div className="flex items-center gap-4 min-w-[200px]">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm font-black text-[#c5a059]">
                      #{index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={18} className="text-gray-400" />
                      <span className="font-bold text-base text-[#1a2e44]">{item.province}</span>
                    </div>
                  </div>

                  {/* نوار پیشرفت گرافیکی میزان مشارکت */}
                  <div className="flex-1 max-w-xl bg-gray-200/60 h-3 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full bg-[#1a2e44] rounded-full transition-all duration-1000" 
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>

                  {/* آمار عددی */}
                  <div className="flex items-center gap-6 justify-end font-bold text-sm">
                    <div className="text-gray-500">
                      <span>{item.count.toLocaleString()} کاربر</span>
                    </div>
                    <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl font-black text-xs">
                      {item.percentage}% مشارکت
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}