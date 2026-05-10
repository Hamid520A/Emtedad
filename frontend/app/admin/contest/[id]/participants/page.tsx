'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../../lib/api'; // مسیر دسترسی به api
import { ArrowRight, Users, Loader2, Search, Trophy, Medal, Crown } from 'lucide-react';

export default function ParticipantsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchParticipants = async () => {
      try {
        // از همون API لیدربورد برای گرفتن لیست افراد این مسابقه استفاده می‌کنیم
        const response = await api.get(`/contests/${params.id}/leaderboard`);
        setParticipants(response.data);
      } catch (error) {
        console.error("خطا در دریافت لیست شرکت‌کنندگان", error);
      } finally {
        setLoading(false);
      }
    };
    fetchParticipants();
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
                      <span className="text-[10px] text-gray-400 font-bold">زمان: {user.time_taken || '-'} ثانیه</span>
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