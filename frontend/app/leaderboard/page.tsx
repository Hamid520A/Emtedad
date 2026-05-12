'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api'; 
import { Trophy, ArrowRight, Loader2, Crown, Medal, User } from 'lucide-react';

export default function GlobalLeaderboardPage() {
  const router = useRouter();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await api.get('/leaderboard/global');
        setLeaders(response.data);
      } catch (error) {
        console.error("خطا در دریافت لیست برترین‌ها", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  // توابعی برای استایل دادن به نفرات اول تا سوم
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={24} className="text-yellow-400 drop-shadow-md" />;
    if (rank === 2) return <Medal size={24} className="text-gray-300 drop-shadow-md" />;
    if (rank === 3) return <Medal size={24} className="text-amber-600 drop-shadow-md" />;
    return <span className="font-black text-gray-400 text-lg">{rank}</span>;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "bg-[#1a2e44] text-white border-yellow-400 border-2 shadow-xl scale-105 z-10";
    if (rank === 2) return "bg-white border-gray-300 border-2 shadow-md";
    if (rank === 3) return "bg-white border-amber-600 border-2 shadow-md";
    return "bg-white border-gray-100 shadow-sm hover:border-[#c5a059]";
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-[#faf9f6]">
      <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] font-sans pb-24" dir="rtl">
      {/* Header */}
      <header className="p-6 flex items-center gap-3 sticky top-0 bg-[#faf9f6]/90 backdrop-blur-md z-20">
        <button onClick={() => router.back()} className="p-2 bg-white rounded-full shadow-sm border border-gray-100">
          <ArrowRight size={20} className="text-[#1a2e44]" />
        </button>
        <h1 className="font-black text-xl text-[#1a2e44]">تالار افتخارات</h1>
      </header>

      <main className="p-6 space-y-4 pt-2">
        {/* Banner */}
        <div className="bg-gradient-to-br from-[#1a2e44] to-[#2a405a] rounded-[2rem] p-6 text-white mb-8 shadow-lg relative overflow-hidden flex items-center justify-between">
          <div className="relative z-10">
            <h2 className="text-xl font-black mb-1 text-[#c5a059]">۱۰ نفر برتر</h2>
            <p className="text-gray-300 text-xs font-medium">رقابت برای بالاترین امتیاز کل</p>
          </div>
          <Trophy size={60} className="text-white/10 absolute -left-4 -bottom-4 rotate-12" />
          <Trophy size={40} className="text-[#c5a059] relative z-10 drop-shadow-lg" />
        </div>

        {/* Leaderboard List */}
        <div className="space-y-3 flex flex-col">
          {leaders.length === 0 ? (
            <div className="text-center py-10 opacity-50 italic">هنوز کسی امتیازی کسب نکرده است.</div>
          ) : (
            leaders.map((user: any) => (
              <div 
                key={user.id} 
                className={`p-4 flex items-center justify-between rounded-[2rem] transition-all duration-300 ${getRankStyle(user.rank)}`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#faf9f6] flex items-center justify-center font-black flex-shrink-0">
                    {getRankIcon(user.rank)}
                  </div>
                  <div className="flex flex-col">
                    <h4 className={`font-bold text-sm mb-1 ${user.rank === 1 ? 'text-white' : 'text-[#1a2e44]'}`}>
                      {user.name}
                    </h4>
                    
                    {/* اطلاعات تکمیلی: رتبه، زمان کل، کد ملی */}
                    <div className="flex items-center gap-2 text-[9px] font-bold">
                      <span className={`uppercase tracking-widest ${user.rank === 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        رتبه {user.rank}
                      </span>
                      <span className="opacity-30">|</span>
                      <span className={user.rank === 1 ? 'text-gray-300' : 'text-gray-500'}>
                        زمان: <span className={user.rank === 1 ? 'text-white' : 'text-[#1a2e44]'}>{user.total_time || 0}s</span>
                      </span>
                      <span className="opacity-30">|</span>
                      <span dir="ltr" className={user.rank === 1 ? 'text-gray-300' : 'text-gray-500'}>
                        ******{user.last_four_id || '****'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* نمره کل */}
                <div className={`px-4 py-2 rounded-2xl font-black text-lg flex-shrink-0 ${user.rank === 1 ? 'bg-white/10 text-yellow-400' : 'bg-[#faf9f6] text-[#c5a059]'}`}>
                  {user.total_score}
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* منوی پایینی آپدیت شده */}
      <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-[#1a2e44] rounded-3xl shadow-xl p-2 flex justify-between items-center z-30">
        <button onClick={() => router.push('/dashboard')} className="flex-1 text-gray-400 hover:text-white transition flex flex-col items-center gap-1 p-2">
          <Trophy size={20} />
          <span className="text-[10px]">خانه</span>
        </button>
        {/* دکمه وسط جایگزین شد */}
        <button className="flex-1 text-[#c5a059] flex flex-col items-center gap-1 p-2 bg-white/10 rounded-2xl">
          <Crown size={20} />
          <span className="text-[10px] font-bold">برترین‌ها</span>
        </button>
        <button onClick={() => router.push('/profile')} className="flex-1 text-gray-400 hover:text-white transition flex flex-col items-center gap-1 p-2">
          <User size={20} />
          <span className="text-[10px]">پروفایل</span>
        </button>
      </nav>
    </div>
  );
}