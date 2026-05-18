'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { Trophy, ArrowRight, ArrowUpRight, Plus } from 'lucide-react';

export default function AdminContestsPage() {
  const router = useRouter();
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContests = async () => {
      try {
        const res = await api.get('/contests');
        setContests(res.data);
      } catch (error) {
        console.error("Error fetching contests:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContests();
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      {/* Header */}
      <header className="p-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/admin/dashboard')}
            className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Trophy className="text-[#c5a059]" /> مدیریت مسابقات
            </h1>
            <p className="text-gray-400 text-sm font-bold mt-1">لیست کامل رقابت‌ها، وضعیت اجرا و تنظیمات سوالات</p>
          </div>
        </div>
        
        <button 
          onClick={() => router.push('/admin/create-contest')}
          className="bg-[#1a2e44] text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
        >
          <Plus size={20} className="text-[#c5a059]" /> مسابقه جدید
        </button>
      </header>

      {/* Contests List */}
      <main className="px-8">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
          {loading ? (
            <p className="text-center py-8 text-gray-400 font-bold">در حال بارگذاری لیست مسابقات...</p>
          ) : contests.length === 0 ? (
            <p className="text-center py-8 text-gray-400 font-bold">هیچ مسابقه‌ای یافت نشد.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contests.map((c: any) => (
                <div key={c.id} className="group flex items-center justify-between p-5 bg-[#faf9f6] rounded-3xl border border-transparent hover:border-[#c5a059] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm font-black text-[#c5a059]">
                      #{c.id}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1a2e44]">{c.title}</h4>
                      <div className="flex gap-2 items-center mt-1">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${c.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                          {c.status === 'active' ? 'در حال اجرا' : 'آینده'}
                        </span>
                        <span className="text-[9px] text-gray-400 font-bold">{c.question_limit} سوال</span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => router.push(`/contests/${c.id}`)} 
                    className="p-3 bg-white rounded-xl shadow-sm text-gray-400 hover:text-[#1a2e44] hover:scale-110 transition-all"
                  >
                    <ArrowUpRight size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}