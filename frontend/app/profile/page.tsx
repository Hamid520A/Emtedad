'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { 
  User, Trophy, Medal, History, ArrowRight, 
  LogOut, Loader2, Star, Settings, ShieldCheck, 
  HelpCircle, ChevronLeft, Crown
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/users/me/profile');
        setProfile(response.data);
      } catch (error: any) {
        if (error.response?.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/login');
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf9f6]">
      <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
    </div>
  );

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-[#faf9f6] font-sans text-[#1a2e44]" dir="rtl">
      <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative flex flex-col">
        
        {/* Header */}
        <header className="p-6 flex items-center justify-between border-b border-gray-50">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowRight size={20} />
            </button>
            <span className="font-black text-xl">حساب کاربری</span>
          </div>
          <button onClick={handleLogout} className="p-2 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors">
            <LogOut size={20} />
          </button>
        </header>

        <main className="p-6 flex-1 space-y-8 pb-24">
          
          {/* User Info Card */}
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-[#faf9f6] rounded-full mx-auto flex items-center justify-center border-4 border-white shadow-lg">
              <User size={48} className="text-[#c5a059]" />
            </div>
            
            <div>
              <h2 className="text-2xl font-black">{profile.first_name} {profile.last_name}</h2>
              <p className="text-gray-400 font-medium" dir="ltr">{profile.phone}</p>
            </div>

            {/* اطلاعات تکمیلی اضافه شده */}
            <div className="bg-gray-50/50 rounded-3xl p-4 grid grid-cols-2 gap-y-4">
              <div className="space-y-1 text-center border-l border-gray-100">
                <span className="block text-[10px] text-gray-400 font-bold uppercase">کد ملی</span>
                <span className="text-sm font-black" dir="ltr">{profile.national_id || '---'}</span>
              </div>
              
              <div className="space-y-1 text-center">
                <span className="block text-[10px] text-gray-400 font-bold uppercase">تاریخ تولد</span>
                <span className="text-sm font-black" dir="ltr">{profile.birth_date || '---'}</span>
              </div>

              <div className="space-y-1 text-center border-t border-l border-gray-100 pt-3">
                <span className="block text-[10px] text-gray-400 font-bold uppercase">استان</span>
                <span className="text-sm font-black">{profile.province || '---'}</span>
              </div>

              <div className="space-y-1 text-center border-t border-gray-100 pt-3">
                <span className="block text-[10px] text-gray-400 font-bold uppercase">شهرستان</span>
                <span className="text-sm font-black">{profile.city || '---'}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="bg-[#1a2e44] p-4 rounded-[2rem] text-white shadow-lg">
                <Trophy className="mx-auto text-[#c5a059] mb-1" size={24} />
                <span className="block text-[10px] opacity-60 font-bold uppercase tracking-widest">امتیاز کل</span>
                <span className="text-2xl font-black">{profile.total_score}</span>
              </div>
              <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm">
                <Medal className="mx-auto text-[#c5a059] mb-1" size={24} />
                <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest">آزمون‌ها</span>
                <span className="text-2xl font-black">{profile.contests_count}</span>
              </div>
            </div>
          </div>

          {/* ====================================================== */}
          {/* بخش جدید: تنظیمات حساب (جایگزین پنل ادمین) */}
          {/* ====================================================== */}
          <section className="space-y-4">
            <h3 className="font-black text-lg px-2 flex items-center gap-2">
              <Settings size={20} className="text-[#c5a059]" />
              تنظیمات حساب
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <button onClick={() => router.push('/profile/edit')} className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] rounded-2xl text-blue-500 group-hover:bg-blue-50 transition-colors">
                    <User size={22} />
                  </div>
                  <span className="font-bold text-[#1a2e44]">ویرایش اطلاعات پروفایل</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 group-hover:text-[#c5a059]" />
              </button>

              <button onClick={() => router.push('/profile/change-password')} className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] rounded-2xl text-orange-500 group-hover:bg-orange-50 transition-colors">
                    <ShieldCheck size={22} />
                  </div>
                  <span className="font-bold text-[#1a2e44]">تغییر رمز عبور</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 group-hover:text-[#c5a059]" />
              </button>

              <button onClick={() => router.push('/profile/support')} className="w-full bg-white p-5 rounded-[2rem] border border-gray-100 flex items-center justify-between shadow-sm hover:border-[#c5a059] hover:shadow-md transition-all group">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-[#faf9f6] rounded-2xl text-green-500 group-hover:bg-green-50 transition-colors">
                    <HelpCircle size={22} />
                  </div>
                  <span className="font-bold text-[#1a2e44]">ارتباط با پشتیبانی</span>
                </div>
                <ChevronLeft size={20} className="text-gray-300 group-hover:text-[#c5a059]" />
              </button>
            </div>
          </section>

          {/* History Section */}
          <section className="space-y-4">
            <h3 className="font-black text-lg px-2 flex items-center gap-2">
              <History size={20} className="text-[#c5a059]" />
              تاریخچه افتخارات
            </h3>

            <div className="space-y-4">
              {profile.history.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-[2rem] border border-dashed border-gray-200">
                    <Star className="mx-auto text-gray-200 mb-2" size={32} />
                    <p className="text-gray-400 text-sm italic">هنوز رکوردی ثبت نشده است...</p>
                </div>
              ) : (
                profile.history.map((item: any, index: number) => (
                  <div key={index} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between group hover:border-[#c5a059] transition-all">
                    <div>
                      <h4 className="font-bold text-base mb-1">{item.contest_title}</h4>
                      <div className="flex gap-2 text-[10px] font-bold text-gray-400">
                        <span className="bg-gray-50 px-2 py-0.5 rounded-md">زمان: {item.time_taken} ثانیه</span>
                        <span className={item.status === 'active' ? 'text-green-500' : ''}>
                          {item.status === 'active' ? '● در حال برگزاری' : 'پایان یافته'}
                        </span>
                      </div>
                    </div>
                    <div className="text-center bg-[#faf9f6] py-2 px-4 rounded-2xl group-hover:bg-[#1a2e44] transition-colors">
                       <span className="block text-[9px] font-bold text-gray-400 group-hover:text-gray-300">نمره</span>
                       <span className="text-lg font-black text-[#c5a059]">{item.score}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        {/* Bottom Nav */}
        <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(28rem-3rem)] mx-auto bg-[#1a2e44] rounded-3xl shadow-xl p-2 flex justify-between items-center z-30">
          <button onClick={() => router.push('/dashboard')} className="flex-1 text-gray-400 hover:text-white transition flex flex-col items-center gap-1 p-2">
            <Trophy size={20} />
            <span className="text-[10px]">خانه</span>
          </button>
          
          <button onClick={() => router.push('/leaderboard')} className="flex-1 text-gray-400 hover:text-white transition flex flex-col items-center gap-1 p-2">
            <Crown size={20} />
            <span className="text-[10px]">برترین‌ها</span>
          </button>

          <button className="flex-1 text-[#c5a059] flex flex-col items-center gap-1 p-2 bg-white/10 rounded-2xl">
            <User size={20} />
            <span className="text-[10px] font-bold">پروفایل</span>
          </button>
        </nav>
      </div>
    </div>
  );
}