'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { 
  Users, Trophy, Layout, Plus, Settings, 
  BarChart3, ArrowUpRight, Activity, ChevronLeft, Award, TrendingUp
} from 'lucide-react';
// اضافه کردن المان‌های نمودار
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ users: 0, contests: 0, active: 0 });
  const [contests, setContests] = useState([]);
  const [chartData, setChartData] = useState([]);

  const exportToExcel = async () => {
    try {
      const res = await api.get('/admin/export-data');
      let data = res.data;

      console.log("Data received from API:", data); // چک کن در کنسول چی چاپ میشه

      // اگر دیتا خالی بود، برای تست این آرایه رو استفاده کن
      if (!data || data.length === 0) {
        console.warn("API returned empty data, using mock data for test.");
        data = [
          { "نام": "تست", "تلفن": "۰۹۱۲", "امتیاز": "۱۰۰" }
        ];
      }

      // ساخت شیت
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "شرکت‌کنندگان");

      // تنظیمات فارسی (RTL)
      if(!worksheet['!cols']) worksheet['!cols'] = [];
      worksheet['!dir'] = 'rtl';

      XLSX.writeFile(workbook, `گزارش_${new Date().getTime()}.xlsx`);
    } catch (error) {
      console.error("Export error:", error);
      alert("خطا در دریافت دیتا از سرور");
    }
  };

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const statsRes = await api.get('/admin/stats');
        const contestsRes = await api.get('/contests');
        
        setContests(contestsRes.data);
        setChartData(statsRes.data.chart_data); // دیتای واقعی نمودار
        
        setStats({
          users: statsRes.data.total_users, 
          contests: statsRes.data.total_contests,
          active: statsRes.data.active_contests
        });
      } catch (error) {
        console.error("Admin Dashboard Error:", error);
      }
    };
    fetchAdminData();
  }, []);

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      {/* Header */}
      <header className="p-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight">پنل مدیریت امتداد</h1>
          <p className="text-gray-400 text-sm font-bold mt-1">مانیتورینگ هوشمند سیستم</p>
        </div>
        <button 
          onClick={() => router.push('/admin/create-contest')}
          className="bg-[#1a2e44] text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-blue-900/20 active:scale-95 transition-all"
        >
          <Plus size={20} className="text-[#c5a059]" /> مسابقه جدید
        </button>
      </header>

      <main className="px-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="کل شرکت‌کنندگان" value={stats.users} icon={<Users />} color="blue" />
          <StatCard title="تعداد مسابقات" value={stats.contests} icon={<Trophy />} color="gold" />
          <StatCard title="رقابت‌های فعال" value={stats.active} icon={<Activity />} color="emerald" />
        </div>

        {/* بخش نمودار پیشرفت */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <h3 className="font-black text-xl flex items-center gap-2">
              <TrendingUp className="text-[#c5a059]" /> نمودار رشد شرکت‌کنندگان
            </h3>
            <span className="text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full">
              ۲۴٪ رشد نسبت به هفته گذشته
            </span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c5a059" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#c5a059" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 'bold'}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontFamily: 'inherit'}}
                />
                <Area type="monotone" dataKey="users" stroke="#c5a059" strokeWidth={4} fillOpacity={1} fill="url(#colorUsers)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* لیست مسابقات اخیر */}
          <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100">
            <h3 className="font-black text-xl mb-8 flex items-center gap-2">
              <Layout className="text-[#c5a059]" /> مدیریت مسابقات اخیر
            </h3>
            <div className="space-y-4">
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
                  <button onClick={() => router.push(`/contests/${c.id}`)} className="p-3 bg-white rounded-xl shadow-sm text-gray-400 hover:text-[#1a2e44] hover:scale-110 transition-all">
                    <ArrowUpRight size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ابزارهای مدیریتی */}
          <div className="bg-[#1a2e44] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
             <h3 className="font-black text-xl mb-8">ابزارهای سریع</h3>
             <div className="space-y-3">
               <QuickAction label="گزارش اکسل شرکت‌کنندگان" icon={<BarChart3 size={18} />}onClick={exportToExcel}/>
               <QuickAction label="تنظیمات گواهی‌ها" icon={<Award size={18} />} />
               <QuickAction label="تغییر رمز عبور مدیر" icon={<Settings size={18} />} />
             </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// کامپوننت‌های کمکی StatCard و QuickAction رو همون قبلی‌ها رو بذار (فقط مطمئن شو Award رو از lucide ایمپورت کردی)
function StatCard({ title, value, icon, color }: any) {
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center gap-5 transition-transform hover:-translate-y-1">
      <div className={`p-4 rounded-2xl ${color === 'blue' ? 'bg-blue-50 text-blue-500' : color === 'gold' ? 'bg-orange-50 text-orange-500' : 'bg-emerald-50 text-emerald-500'}`}>
        {React.cloneElement(icon, { size: 28 })}
      </div>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
        <p className="text-3xl font-black text-[#1a2e44]">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function QuickAction({ label, icon, onClick }: any) {
  return (
    <button 
      onClick={onClick} // اتصال کلیک به دکمه اصلی
      className="w-full flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-sm font-bold group"
    >
      <div className="flex items-center gap-3">
        <span className="text-[#c5a059] group-hover:scale-110 transition-transform">{icon}</span>
        {label}
      </div>
      <ChevronLeft size={16} className="text-gray-500 group-hover:translate-x-[-4px] transition-transform" />
    </button>
  );
}