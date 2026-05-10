'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '../../lib/api'; 
import { Trophy, Clock, Download, ArrowRight, CheckCircle, FileText, Loader2, X, Medal } from 'lucide-react';
import { jwtDecode } from 'jwt-decode';

export default function ContestsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const status = searchParams.get('status') || 'active'; 
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // استیت‌های مربوط به رتبه‌بندی
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [selectedContestTitle, setSelectedContestTitle] = useState('');
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  useEffect(() => {
    // استخراج ID کاربر از توکن
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setCurrentUserId(decoded.sub_id || decoded.id || null); // بسته به نام فیلد در بک‌ند شما
      } catch (e) {
        console.error("Token decode error", e);
      }
    }

    const fetchContests = async () => {
      try {
        const response = await api.get('/contests');
        const filtered = response.data.filter((c: any) => c.status === status);
        setContests(filtered);
      } catch (error) {
        console.error("خطا در دریافت مسابقات", error);
      } finally {
        setLoading(false);
      }
    };
    fetchContests();
  }, [status]);

  // تابع دریافت رتبه‌بندی
  const handleOpenLeaderboard = async (contestId: number, title: string) => {
    setSelectedContestTitle(title);
    setShowLeaderboard(true);
    setLeaderboardData([]); // ریست کردن لیست قبلی
    try {
      const res = await api.get(`/contests/${contestId}/leaderboard`);
      setLeaderboardData(res.data);
    } catch (err) {
      console.error("Leaderboard error", err);
    }
  };

  const getHeaderInfo = () => {
    if (status === 'upcoming') return { title: 'مسابقات به زودی', color: 'text-orange-500' };
    if (status === 'ended' || status === 'finished') return { title: 'مسابقات پایان یافته', color: 'text-gray-600' };
    return { title: 'در حال برگزاری', color: 'text-green-600' };
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20 font-sans" dir="rtl">
      
      <header className="bg-white p-4 flex items-center gap-3 shadow-sm sticky top-0 z-10">
        <button onClick={() => router.push('/')} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
          <ArrowRight className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className={`font-bold text-lg ${headerInfo.color}`}>{headerInfo.title}</h1>
      </header>

      <main className="p-4 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center mt-20 gap-3 text-gray-400">
            <Loader2 className="animate-spin" />
            <p>در حال دریافت اطلاعات...</p>
          </div>
        ) : contests.length === 0 ? (
          <div className="text-center flex flex-col items-center justify-center mt-20 text-gray-500">
            <FileText className="w-16 h-16 text-gray-300 mb-4" />
            <p>فعلاً مسابقه‌ای در این دسته‌بندی وجود ندارد.</p>
          </div>
        ) : (
          contests.map((contest: any) => (
            <div key={contest.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition hover:shadow-md">
              <div className="h-36 bg-gray-200 w-full relative">
                 {contest.image_url && contest.image_url !== 'test' ? (
                   <img src={contest.image_url} alt={contest.title} className="w-full h-full object-cover" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-400 bg-blue-50 text-xs font-bold">{contest.title}</div>
                 )}
                 {contest.award && (
                   <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-lg shadow-sm">
                     جایزه: {contest.award}
                   </div>
                 )}
              </div>
              
              <div className="p-4">
                <h3 className="font-bold text-gray-800 mb-2">{contest.title}</h3>
                <p className="text-xs text-gray-600 mb-4 leading-relaxed line-clamp-2">{contest.description}</p>
                
                {status === 'active' && (
                  <div className="space-y-2">
                    <button 
                      onClick={() => router.push(`/exam/${contest.id}`)}
                      className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition"
                    >
                      <Trophy className="w-5 h-5" /> ورود به آزمون
                    </button>
                    <button 
                      onClick={() => handleOpenLeaderboard(contest.id, contest.title)}
                      className="w-full bg-blue-50 text-blue-600 py-2 rounded-xl text-xs font-bold"
                    >
                      مشاهده رتبه‌های لحظه‌ای
                    </button>
                  </div>
                )}
                
                {status === 'upcoming' && (
                  <div className="flex gap-2">
                    {contest.file_url && (
                      <a href={contest.file_url} target="_blank" className="flex-1 bg-blue-50 text-blue-600 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs transition">
                        <Download className="w-4 h-4" /> دانلود جزوه
                      </a>
                    )}
                    <div className="flex-1 bg-orange-50 text-orange-600 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 text-xs">
                      <Clock className="w-4 h-4" /> {new Date(contest.start_time).toLocaleDateString('fa-IR')}
                    </div>
                  </div>
                )}

                {(status === 'ended' || status === 'finished') && (
                  <button 
                    onClick={() => handleOpenLeaderboard(contest.id, contest.title)}
                    className="w-full bg-gray-50 text-gray-700 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition border border-gray-200"
                  >
                    <CheckCircle className="w-5 h-5" /> مشاهده کارنامه و رتبه‌ها
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </main>

      {/* مودال رتبه‌بندی (Leaderboard) */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-6 max-h-[80vh] overflow-y-auto relative shadow-2xl animate-in slide-in-from-bottom">
            <button onClick={() => setShowLeaderboard(false)} className="absolute left-4 top-4 p-1 bg-gray-100 rounded-full">
              <X size={20} className="text-gray-500" />
            </button>
            
            <div className="text-center mb-6">
              <Medal className="mx-auto text-yellow-500 mb-2" size={40} />
              <h2 className="font-black text-lg text-gray-800">جدول قهرمانان</h2>
              <p className="text-xs text-gray-500">{selectedContestTitle}</p>
            </div>

            <div className="space-y-3">
              {leaderboardData.length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">هنوز کسی در این مسابقه شرکت نکرده است.</p>
              ) : (
                leaderboardData.map((user: any, index: number) => (
                  <div 
                    key={index} 
                    className={`flex items-center justify-between p-3 rounded-2xl ${user.user_id === currentUserId ? 'bg-blue-600 text-white shadow-lg' : 'bg-gray-50'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${index < 3 ? 'bg-yellow-400 text-yellow-900' : 'bg-gray-200 text-gray-500'}`}>
                        {index + 1}
                      </span>
                      <span className="font-bold text-sm">{user.name} {user.user_id === currentUserId && "(شما)"}</span>
                    </div>
                    <div className="text-left">
                      <span className="block font-black text-sm">{user.score} امتیاز</span>
                      <span className="block text-[8px] opacity-70">{user.time} ثانیه</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}