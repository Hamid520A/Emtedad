'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../../../lib/api'; 
import { 
  ArrowRight, Users, Loader2, Search, Trophy, Medal, Crown, 
  X, Edit2, Save, ArrowUpDown, Smartphone, FileText, MapPin, Calendar, Download 
} from 'lucide-react';

export default function ParticipantsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [participants, setParticipants] = useState<any[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<any[]>([]); 
  const [contest, setContest] = useState<any>(null); 
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // استیت‌های سیستم مرتب‌سازی (Sorting)
  const [sortField, setSortField] = useState<string>('rank'); 
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // استیت‌های یکپارچه لایه مدیریت پرونده و مدال هوشمند کاربر
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  
  // استیت‌های حالت ویرایش لایو پرونده فردی
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saveLoading, setSaveLoading] = useState(false);

  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776))
              .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632));
  };

  // دریافت همزمان اطلاعات مسابقه و لیست لیدربرد
  const fetchPageData = async () => {
    try {
      const [leaderboardRes, contestRes] = await Promise.all([
        api.get(`/contests/${params.id}/leaderboard`),
        api.get(`/contests/${params.id}`)
      ]);
      
      setParticipants(leaderboardRes.data || []);
      setFilteredParticipants(leaderboardRes.data || []);
      setContest(contestRes.data);
    } catch (error) {
      console.error("خطا در دریافت اطلاعات صفحه مدیریت", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, [params.id]);

  // موتور هوشمند فیلترینگ، جستجو و مرتب‌سازی داده‌های جدول و دسکتاپ
  useEffect(() => {
    const normalizedQuery = toEnglishDigits(searchQuery.trim().toLowerCase());
    
    // ۱. مدیریت و اعمال منطق سرچ
    let result = participants.filter((p: any) => {
      if (!normalizedQuery) return true;
      const name = p.name?.toLowerCase() || '';
      const lastFour = toEnglishDigits(p.last_four_id || '');
      return name.includes(normalizedQuery) || lastFour.includes(normalizedQuery);
    });

    // ۲. مدیریت و اعمال منطق مرتب‌سازی الفبایی و عددی
    if (sortField) {
      result.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' 
            ? valA.localeCompare(valB, 'fa') 
            : valB.localeCompare(valA, 'fa');
        }

        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    setFilteredParticipants(result);
  }, [searchQuery, participants, sortField, sortOrder]);

  // فعال‌سازی و تغییر فیلد سورتر ستون‌ها
  const handleSortRequest = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 👈 🌟 موتور تولید خروجی Excel / CSV هوشمند هماهنگ با فیلترها
  const exportToCSV = () => {
    if (filteredParticipants.length === 0) {
      alert("هیچ داده‌ای برای خروجی گرفتن در جدول فعلی وجود ندارد.");
      return;
    }

    // تعریف هدرهای جدول فایل اکسل
    const headers = ["رتبه", "نام شرکت‌کننده", "زمان مصرفی (ثانیه)", "کد شناسایی (۴ رقم آخر)", "نمره نهایی"];
    if (contest?.certificate_type !== 'none') {
      headers.push("وضعیت گواهی");
    }

    // استخراج ردیف‌ها بر اساس لیست فیلتر شده فعلی ادمین
    const rows = filteredParticipants.map((user: any) => {
      const rowData = [
        user.rank || '',
        user.name || '',
        user.time || user.time_taken || 0,
        user.last_four_id || '---',
        `${user.score}%`
      ];
      if (contest?.certificate_type !== 'none') {
        const certStatus = user.score >= 85 ? 'عالی' : user.score >= 70 ? 'خیلی خوب' : user.score >= 50 ? 'خوب' : 'عدم احراز';
        rowData.push(certStatus);
      }
      return rowData;
    });

    // اضافه کردن بایت اوردر مارک (BOM) برای رفع به هم ریختگی فونت فارسی در اکسل
    let csvContent = "\uFEFF";
    csvContent += headers.join(",") + "\n";
    rows.forEach((row) => {
      const cleanRow = row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvContent += cleanRow + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `شرکت_کنندگان_مسابقه_${contest?.title || params.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // باز کردن پرونده کامل کاربر به محض کلیک روی سطر یا کارت مسابقه
  const handleUserClick = async (userId: number) => {
    if (!userId) return;
    setModalLoading(true);
    setModalOpen(true);
    setIsEditing(false); 
    try {
      const response = await api.get(`/admin/users/${userId}/detail`);
      setSelectedUser(response.data);
      
      setEditFormData({
        first_name: response.data.first_name || '',
        last_name: response.data.last_name || '',
        phone: response.data.phone || '',
        national_id: response.data.national_id || '',
        province: response.data.province || '',
        city: response.data.city || '',
        gender: response.data.gender || 'male',
        birth_date: response.data.birth_date || ''
      });
    } catch (error) {
      alert("خطا در دریافت پرونده کامل کاربر");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  // ذخیره نهایی تغییرات مشخصات فردی شرکت‌کننده
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveLoading(true);
    try {
      await api.put(`/admin/users/${selectedUser.id}/update`, editFormData);
      alert("تغییرات با موفقیت روی پرونده کاربر اعمال شد.");
      setIsEditing(false);
      
      setSelectedUser({
        ...selectedUser,
        first_name: editFormData.first_name,
        last_name: editFormData.last_name,
        phone: editFormData.phone,
        national_id: editFormData.national_id,
        province: editFormData.province,
        city: editFormData.city,
        gender: editFormData.gender,
        birth_date: editFormData.birth_date
      });
      
      fetchPageData();
    } catch (error) {
      alert("خطا در ذخیره‌سازی تغییرات پرونده");
    } finally {
      setSaveLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f6]">
        <Loader2 className="animate-spin text-[#1a2e44]" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      
      {/* هدر منعطف دسکتاپ و ویندوز */}
      <header className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100/50 bg-white/50 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]">
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
              <Users className="text-[#c5a059]" /> لیست شرکت‌کنندگان مسابقه
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm font-bold mt-1">
              مدیریت رتبه‌بندی، بررسی نمرات مکتسبه و ویرایش پرونده کاربران شرکت‌کننده
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* 👈 🌟 دکمه دانلود خروجی گزارش CSV بر اساس لیست فیلتر شده فعلی */}
          <button 
            onClick={exportToCSV}
            className="w-full sm:w-auto bg-emerald-600 text-white px-5 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/10 hover:bg-emerald-700 transition-all active:scale-95 shrink-0"
            title="دانلود فایل اکسل از لیست فیلتر شده فعلی"
          >
            <Download size={16} /> خروجی Excel / CSV
          </button>

          <div className="bg-blue-50 text-blue-600 px-5 py-3.5 rounded-2xl flex items-center gap-1.5 font-black text-xs border border-blue-100 shadow-sm shrink-0 w-full sm:w-auto justify-center">
            <Users size={16} />
            <span>کل شرکت‌کنندگان: {participants.length} نفر</span>
          </div>

          <div className="relative w-full sm:w-64">
            <input 
              type="text" 
              placeholder="جستجوی نام یا ۴ رقم کد ملی..."
              className="w-full bg-white border border-gray-200 text-[#1a2e44] placeholder-gray-400 text-xs font-bold rounded-2xl pl-4 pr-11 py-3.5 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] shadow-sm transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </header>

      <main className="p-4 sm:p-8 space-y-6">
        
        {/* بخش رندر جوایز رتبه‌بندی مسابقه */}
        {contest && (() => {
          try {
            const parsedAwards = JSON.parse(contest.award);
            if (Array.isArray(parsedAwards) && parsedAwards.length > 0) {
              return (
                <div className="p-5 bg-amber-50/40 rounded-[2rem] border border-amber-100 space-y-2.5 text-right max-w-3xl animate-in fade-in duration-300">
                  <h4 className="font-black text-xs text-amber-800 flex items-center gap-1.5 mb-2">
                    <Trophy size={14} className="text-[#c5a059]" /> لیست جوایز برندگان این مسابقه:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {parsedAwards.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center text-xs bg-white p-3 rounded-xl border border-amber-100/60 shadow-sm">
                        <span className="font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[10px]">رتبه {item.rank}</span>
                        <span className="font-bold text-[#1a2e44] truncate max-w-[120px]">{item.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
          } catch (e) {
            return contest.award && (
              <div className="p-4 bg-gray-50 rounded-2xl text-xs font-bold text-gray-600 max-w-3xl">جایزه: {contest.award}</div>
            );
          }
        })()}

        {/* 💻 نمای اول: جدول هوشمند مخصوص سیستم‌عامل ویندوز و دسکتاپ (مخفی در موبایل) */}
        <div className="hidden md:block bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase select-none">
                  <th onClick={() => handleSortRequest('rank')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors">
                    رتبه <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  <th onClick={() => handleSortRequest('name')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors">
                    نام شرکت‌کننده <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  <th onClick={() => handleSortRequest('time')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors">
                    زمان مصرفی <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  <th onClick={() => handleSortRequest('last_four_id')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors">
                    کد شناسایی <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  {contest?.certificate_type !== 'none' && <th className="pb-4 font-black">وضعیت گواهی</th>}
                  <th onClick={() => handleSortRequest('score')} className="pb-4 font-black text-center cursor-pointer hover:text-[#c5a059] transition-colors">
                    نمره نهایی <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={contest?.certificate_type !== 'none' ? 6 : 5} className="text-center py-12 text-gray-400 font-bold">هیچ شرکت‌کننده‌ای یافت نشد.</td>
                  </tr>
                ) : (
                  filteredParticipants.map((user: any) => (
                    <tr 
                      key={user.user_id}
                      onClick={() => handleUserClick(user.user_id)}
                      className="hover:bg-[#faf9f6] cursor-pointer transition-colors group"
                    >
                      <td className="py-4">
                        <div className="w-8 flex justify-center">
                          {user.rank === 1 ? <Crown size={20} className="text-yellow-500" /> : user.rank === 2 || user.rank === 3 ? <Medal size={18} className={user.rank === 2 ? "text-gray-400" : "text-amber-700"} /> : <span className="font-black text-gray-400">#{user.rank}</span>}
                        </div>
                      </td>
                      <td className="py-4 font-bold text-[#1a2e44] group-hover:text-[#c5a059] transition-colors">{user.name}</td>
                      <td className="py-4 font-bold text-blue-600 font-mono">{user.time || user.time_taken || 0} ثانیه</td>
                      <td className="py-4 font-mono text-gray-500">****{user.last_four_id || '****'}</td>
                      {contest?.certificate_type !== 'none' && (
                        <td className="py-4">
                          {user.score >= 50 ? (
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${user.score >= 85 ? 'bg-green-50 text-green-700' : user.score >= 70 ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                              لوح {user.score >= 85 ? 'عالی' : user.score >= 70 ? 'خیلی خوب' : 'خوب'}
                            </span>
                          ) : <span className="text-gray-300 text-xs">-</span>}
                        </td>
                      )}
                      <td className="py-4 text-center">
                        <span className={`font-black text-sm ${user.score >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>{user.score}%</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 📱 نمای دوم: کادرهای موبایلی مخصوص سیستم‌عامل اندروید و ابعاد کوچک (مخفی در دسکتاپ) */}
        <div className="block md:hidden bg-white rounded-[2rem] p-4 shadow-sm border border-gray-100 space-y-3">
          {filteredParticipants.length === 0 ? (
            <div className="text-center py-10">
              <Users size={40} className="mx-auto text-gray-200 mb-3" />
              <p className="text-gray-400 font-bold text-sm">هیچ شرکت‌کننده‌ای یافت نشد.</p>
            </div>
          ) : (
            filteredParticipants.map((user: any) => (
              <div 
                key={user.user_id} 
                onClick={() => handleUserClick(user.user_id)}
                className={`flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98] ${
                  user.rank === 1 ? 'bg-[#faf9f6] border-[#c5a059] shadow-sm' : 'border-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 flex justify-center">
                    {user.rank === 1 ? <Crown size={24} className="text-yellow-500" /> : user.rank === 2 || user.rank === 3 ? <Medal size={22} className={user.rank === 2 ? "text-gray-400" : "text-amber-700"} /> : <span className="font-black text-gray-400 text-sm">#{user.rank}</span>}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-[#1a2e44] block">{user.name}</span>
                    <div className="flex flex-wrap gap-2 items-center mt-1 text-[10px] text-gray-400 font-bold">
                      <span>زمان: {user.time || user.time_taken || 0}ثانیه</span>
                      <span className="text-gray-200">•</span>
                      <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-black text-[9px]">کد: {user.last_four_id || '****'}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-3 py-2 rounded-xl text-center min-w-[3rem]">
                  <span className="block text-[9px] font-bold text-gray-400 mb-0.5">نمره</span>
                  <span className={`font-black text-base ${user.score >= 50 ? 'text-[#1a2e44]' : 'text-red-500'}`}>{user.score}%</span>
                </div>
              </div>
            ))
          )}
        </div>

      </main>

      {/* مُدال نمایش جامع و ویرایش لایو پرونده فردی شرکت‌کننده */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-gray-100 max-h-[85vh] overflow-y-auto flex flex-col text-right">
            
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a2e44] text-[#c5a059] rounded-xl flex items-center justify-center shadow-md">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-[#1a2e44]">
                    {modalLoading ? "در حال فراخوانی پرونده..." : isEditing ? "اصلاح اطلاعات پرونده کاربر" : `پرونده آموزشی: ${selectedUser?.first_name} ${selectedUser?.last_name || ''}`}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">مشخصات هویتی سیستم و تاریخچه حضور در آزمون‌ها</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!modalLoading && selectedUser && !isEditing && (
                  <button 
                    type="button" onClick={() => setIsEditing(true)}
                    className="p-2 px-3 bg-[#faf9f6] text-[#c5a059] hover:bg-[#c5a059]/10 rounded-xl transition-all flex items-center gap-1 text-xs font-black"
                  >
                    <Edit2 size={14} /> ویرایش پرونده
                  </button>
                )}
                <button 
                  type="button" onClick={() => { setModalOpen(false); setSelectedUser(null); setIsEditing(false); }}
                  className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-red-500 rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {modalLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-gray-400 font-bold text-sm">
                <span className="w-8 h-8 border-4 border-[#1a2e44] border-t-transparent rounded-full animate-spin"></span>
                <span>لطفاً چند لحظه صبر کنید...</span>
              </div>
            ) : selectedUser && (
              <form onSubmit={handleSaveChanges} className="flex-1 flex flex-col m-0">
                <div className="p-6 space-y-6 flex-1">
                  
                  <div className="bg-[#faf9f6] p-5 rounded-2xl border border-gray-100">
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">نام</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] focus:ring-1 focus:ring-[#c5a059] outline-none" value={editFormData.first_name} onChange={(e)=>setEditFormData({...editFormData, first_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">نام خانوادگی</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] focus:ring-1 focus:ring-[#c5a059] outline-none" value={editFormData.last_name} onChange={(e)=>setEditFormData({...editFormData, last_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">شماره تماس</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-left font-mono text-[#1a2e44] focus:ring-1 focus:ring-[#c5a059] outline-none" value={editFormData.phone} onChange={(e)=>setEditFormData({...editFormData, phone: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">کد ملی</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-left font-mono text-[#1a2e44] focus:ring-1 focus:ring-[#c5a059] outline-none" value={editFormData.national_id} onChange={(e)=>setEditFormData({...editFormData, national_id: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">استان</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] focus:ring-1 focus:ring-[#c5a059] outline-none" value={editFormData.province} onChange={(e)=>setEditFormData({...editFormData, province: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">شهر</label>
                          <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] focus:ring-1 focus:ring-[#c5a059] outline-none" value={editFormData.city} onChange={(e)=>setEditFormData({...editFormData, city: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">تاریخ تولد</label>
                          <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] focus:ring-1 focus:ring-[#c5a059] outline-none" placeholder="مثال: ۱۳۸۰/۰۱/۱۵" value={editFormData.birth_date} onChange={(e)=>setEditFormData({...editFormData, birth_date: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">جنسیت</label>
                          <select className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] focus:ring-1 focus:ring-[#c5a059] outline-none" value={editFormData.gender} onChange={(e)=>setEditFormData({...editFormData, gender: e.target.value})}>
                            <option value="male">مرد</option>
                            <option value="female">زن</option>
                          </select>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2.5 text-xs">
                          <Smartphone size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">شماره تماس</span><span className="font-black font-mono text-gray-700">{selectedUser.phone}</span></div>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs">
                          <FileText size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">کد ملی</span><span className="font-black font-mono text-gray-700">{selectedUser.national_id}</span></div>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs">
                          <MapPin size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">محل سکونت</span><span className="font-black text-gray-700">{selectedUser.province} - {selectedUser.city || '---'}</span></div>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs">
                          <Calendar size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">تاریخ تولد</span><span className="font-black text-gray-700">{selectedUser.birth_date || '---'}</span></div>
                        </div>
                        <div className="flex items-center gap-2.5 text-xs">
                          <Users size={16} className="text-gray-400" />
                          <div><span className="block text-[9px] text-gray-400 font-bold mb-0.5">جنسیت</span><span className="font-black text-gray-700">{selectedUser.gender === 'male' || selectedUser.gender === 'مرد' ? 'مرد' : 'زن'}</span></div>
                        </div>
                      </div>
                    )}
                  </div>

                  {isEditing && (
                    <div className="flex items-center gap-2 justify-end">
                      <button type="button" onClick={() => setIsEditing(false)} className="p-2.5 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-500 transition-all">انصراف</button>
                      <button type="submit" disabled={saveLoading} className="p-2.5 px-5 bg-[#1a2e44] text-white hover:bg-[#2a405a] rounded-xl text-xs font-black flex items-center gap-1 transition-all shadow-md">
                        {saveLoading ? "در حال ذخیره..." : <><Save size={14} className="text-[#c5a059]" /> ذخیره تغییرات پرونده</>}
                      </button>
                    </div>
                  )}

                  {/* بخش سوم: لیست کامل مسابقاتی که شرکت کرده */}
                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-[#1a2e44] flex items-center gap-1.5 border-b border-gray-100 pb-2">
                      <Trophy size={14} className="text-[#c5a059]" /> تاریخچه مسابقات و کارنامه‌های آزمون
                    </h4>
                    {selectedUser.history?.length === 0 ? (
                      <p className="text-center text-xs text-gray-400 italic py-6 font-bold">این کاربر هنوز در هیچ مسابقه‌ای شرکت نکرده است.</p>
                    ) : (
                      <div className="border border-gray-100 rounded-2xl overflow-hidden bg-white">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-gray-50 text-gray-400 font-black">
                            <tr>
                              <th className="p-3">عنوان مسابقه</th>
                              <th className="p-3 text-center">امتیاز مکتسبه</th>
                              <th className="p-3 text-center">زمان مصرف شده</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 font-bold text-gray-600">
                            {selectedUser.history.map((h: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50/50">
                                <td className="p-3 text-[#1a2e44] font-black">{h.contest_title}</td>
                                <td className="p-3 text-center"><span className="bg-amber-50 text-[#c5a059] px-2 py-0.5 rounded font-black text-sm">{h.score}%</span></td>
                                <td className="p-3 text-center text-blue-600 font-mono">{h.time_taken} ثانیه</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}