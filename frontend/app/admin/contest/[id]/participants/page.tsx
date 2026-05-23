'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../../lib/api'; // مسیر دسترسی به api
import { ArrowRight, Users, Loader2, Search, Trophy, Medal, Crown } from 'lucide-react';

export default function ParticipantsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [participants, setParticipants] = useState<any[]>([]);
  // 👈 اضافه کردن استیت مسابقه برای حل مشکل عدم شناسایی contest
  const [contest, setContest] = useState<any>(null); 
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        // 👈 دریافت همزمان لیدربرد و جزئیات مسابقه با بهره‌گیری از Promise.all
        const [leaderboardRes, contestRes] = await Promise.all([
          api.get(`/contests/${params.id}/leaderboard`),
          api.get(`/contests/${params.id}`)
        ]);
        
        setParticipants(leaderboardRes.data);
        setContest(contestRes.data); // ذخیره اطلاعات مسابقه در استیت
      } catch (error) {
        console.error("خطا در دریافت اطلاعات صفحه مدیریت", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPageData();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f6]">
        <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
      </div>
    );
  }

  // فیلتر کردن لیست بر اساس جستجو
  const filteredParticipants = participants.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] pb-24 font-sans text-[#1a2e44]" dir="rtl">
      
      {/* هدر */}
      <header className="p-6 flex items-center justify-between sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100 hover:bg-gray-50 transition">
            <ArrowRight size={20} className="text-[#1a2e44]" />
          </button>
          <h1 className="font-black text-lg text-[#1a2e44]">لیست شرکت‌کنندگان</h1>
        </div>
        <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg flex items-center gap-1 font-bold text-sm border border-blue-100">
          <Users size={16} />
          {participants.length} نفر
        </div>
      </header>

      <main className="p-6 space-y-6">
        
        {/* باکس جستجو */}
        <div className="relative">
          <Search className="absolute right-4 top-4 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="جستجوی نام شرکت‌کننده..."
            className="w-full p-4 pr-12 bg-white border border-gray-100 shadow-sm rounded-2xl text-[#1a2e44] focus:ring-2 focus:ring-[#c5a059] outline-none transition-all font-bold text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* 👈 بخش رندر هوشمند جوایز رتبه‌بندی (با شرط وجود دیتای contest) */}
        {contest && (() => {
          try {
            const parsedAwards = JSON.parse(contest.award);
            if (Array.isArray(parsedAwards) && parsedAwards.length > 0) {
              return (
                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-2.5 text-right animate-in fade-in duration-300">
                  <h4 className="font-black text-xs text-amber-800 flex items-center gap-1.5 mb-3">
                    <Trophy size={14} className="text-[#c5a059]" /> لیست جوایز برندگان این مسابقه:
                  </h4>
                  {parsedAwards.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-xl border border-amber-100/50">
                      <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">رتبه {item.rank}</span>
                      <span className="font-bold text-[#1a2e44]">{item.title}</span>
                    </div>
                  ))}
                </div>
              );
            }
          } catch (e) {
            return contest.award && (
              <div className="p-4 bg-gray-50 rounded-2xl text-xs font-bold text-gray-600">جایزه: {contest.award}</div>
            );
          }
        })()}

        {/* لیست افراد */}
        <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100">
          {filteredParticipants.length === 0 ? (
            <div className="text-center py-10">
              <Users size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 font-bold text-sm">هیچ شرکت‌کننده‌ای یافت نشد.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredParticipants.map((user: any, index: number) => (
                <div 
                  key={user.user_id} 
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    user.rank === 1 ? 'bg-[#faf9f6] border-[#c5a059] shadow-sm' : 'border-gray-50 hover:border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* آیکون رتبه */}
                    <div className="w-8 flex justify-center">
                      {user.rank === 1 ? (
                        <Crown size={24} className="text-yellow-500 drop-shadow-sm" />
                      ) : user.rank === 2 ? (
                        <Medal size={22} className="text-gray-400 drop-shadow-sm" />
                      ) : user.rank === 3 ? (
                        <Medal size={22} className="text-amber-700 drop-shadow-sm" />
                      ) : (
                        <span className="font-black text-gray-400 text-sm">#{user.rank}</span>
                      )}
                    </div>
                    
                    <div>
                      <span className="font-bold text-sm text-[#1a2e44] block">{user.name}</span>
                      <div className="flex gap-2 items-center mt-1 text-[10px] text-gray-400 font-bold">
                        <span>زمان: {user.time || user.time_taken || 0} ثانیه</span>
                        <span className="text-gray-200">•</span>
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-black text-[9px]">
                          کد ملی: {user.last_four_id || '****'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 px-3 py-2 rounded-xl text-center min-w-[3rem]">
                    <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">نمره</span>
                    <span className={`font-black text-base ${user.score >= 50 ? 'text-[#1a2e44]' : 'text-red-500'}`}>
                      {user.score}
                    </span>
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