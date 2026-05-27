'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { 
  Users, ArrowRight, Search, Trophy, X, MapPin, Calendar, 
  Smartphone, FileText, Edit2, Save, Download, ArrowUpDown, ShieldCheck, UserCheck 
} from 'lucide-react'; 

export default function AdminUsersPage() {
  const router = useRouter();
  const [usersList, setUsersList] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]); 
  const [contests, setContests] = useState<any[]>([]); 
  const [selectedContest, setSelectedContest] = useState<string>(''); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [loading, setLoading] = useState(true);

  // 👈 استیت‌های جدید برای مدیریت سیستم مرتب‌سازی (Sorting)
  const [sortField, setSortField] = useState<string>('name'); // فیلد پیش‌فرض مرتب‌سازی بر اساس نام
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // صعودی (الف تا ی / کمترین به بیشترین)

  // استیت‌های مربوط به مدال و دیتای کاربر
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  
  // استیت‌های مربوط به ویرایش
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>({});
  const [saveLoading, setSaveLoading] = useState(false);

  const toEnglishDigits = (str: string) => {
    return str.replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776))
              .replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632));
  };

  const fetchInitialData = async () => {
    try {
      const [usersRes, contestsRes] = await Promise.all([
        api.get('/admin/users-list'),
        api.get('/contests')
      ]);
      setUsersList(usersRes.data);
      setFilteredUsers(usersRes.data);
      setContests(contestsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // 👈 ارتقای موتور فیلترینگ برای پشتیبانی همزمان از فیلتر، جستجو و مرتب‌سازی دقیق حروف و اعداد
  useEffect(() => {
    const normalizedQuery = toEnglishDigits(searchQuery.trim().toLowerCase());
    
    // ۱. فیلتر کردن بر اساس سرچ و مسابقه انتخاب شده
    let result = usersList.filter((user: any) => {
      const matchesContest = selectedContest === '' || 
        (user.all_contests ? user.all_contests.includes(selectedContest) : user.last_contest === selectedContest);

      if (!normalizedQuery) return matchesContest;

      const name = user.name?.toLowerCase() || '';
      const phone = toEnglishDigits(user.phone || '');
      const nationalId = toEnglishDigits(user.national_id || '');
      const province = user.province?.toLowerCase() || '';

      const matchesSearch = (
        name.includes(normalizedQuery) ||
        phone.includes(normalizedQuery) ||
        nationalId.includes(normalizedQuery) ||
        province.includes(normalizedQuery)
      );

      return matchesSearch && matchesContest;
    });

    // ۲. اعمال منطق مرتب‌سازی پویا بر اساس حروف الفبا و ارقام عددی صعودی/نزولی
    if (sortField) {
      result.sort((a: any, b: any) => {
        let valA = a[sortField];
        let valB = b[sortField];

        // مهار مقادیر خالی یا نال برای جلوگیری از کرش
        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        // در صورتی که فیلد متنی یا رشته فارسی باشد از localeCompare استفاده می‌کنیم
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' 
            ? valA.localeCompare(valB, 'fa') 
            : valB.localeCompare(valA, 'fa');
        }

        // در صورتی که عددی باشد
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
    }

    setFilteredUsers(result);
  }, [searchQuery, selectedContest, usersList, sortField, sortOrder]);

  // 👈 تابع کمکی برای سوئیچ یا فعال‌سازی وضعیت مرتب‌سازی ستون‌ها
  const handleSortRequest = (field: string) => {
    if (sortField === field) {
      // اگر روی همان ستون مجدد کلیک شد، جهت آن برعکس شود (صعودی به نزولی و برعکس)
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // اگر روی ستون جدید کلیک شد، روی فیلد جدید و به صورت صعودی تنظیم شود
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // 👈 موتور هوشمند تولید خروجی استاندارد اکسل/CSV هماهنگ با آخرین فیلترهای اعمال شده توسط ادمین
  const exportToCSV = () => {
    if (filteredUsers.length === 0) {
      alert("هیچ داده‌ای برای خروجی گرفتن در جدول فعلی وجود ندارد.");
      return;
    }

    const headers = ["نام و نام خانوادگی", "شماره تماس", "کد ملی", "استان", "شهرستان", "جنسیت", "نقش", "آخرین رقابت", "میانگین نمره"];
    
    const rows = filteredUsers.map((user: any) => [
      user.name || '',
      user.phone || '',
      user.national_id || '',
      user.province || '',
      user.city || '---',
      user.gender === 'male' || user.gender === 'مرد' ? 'مرد' : 'زن',
      user.is_admin ? 'مدیر سیستم' : 'کاربر عادی',
      user.last_contest || 'شرکت نکرده',
      user.average_score || '---'
    ]);

    // چسباندن کاراکتر ویژه برای جلوگیری از خرابی حروف فارسی در اکسل (\uFEFF)
    let csvContent = "\uFEFF";
    csvContent += headers.join(",") + "\n";
    rows.forEach((row) => {
      // مهار فیلدها با دابل کوتیشن جهت حفظ یکپارچگی ساختار کاماها
      const cleanRow = row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",");
      csvContent += cleanRow + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `گزارش_شرکت_کنندگان_امتداد_امام.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUserClick = async (userId: number) => {
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
      
      fetchInitialData();
    } catch (error) {
      alert("خطا در ذخیره‌سازی تغییرات پرونده");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] text-[#1a2e44] font-sans pb-10" dir="rtl">
      {/* Header */}
      <header className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push('/admin/dashboard')}
            className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 hover:scale-105 transition-all text-gray-500 hover:text-[#1a2e44]"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Users className="text-[#c5a059]" /> مدیریت و اطلاعات شرکت‌کنندگان
            </h1>
            <p className="text-gray-400 text-sm font-bold mt-1">مشاهده مشخصات فردی، کدملی و وضعیت آخرین آزمون کاربران</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          {/* 👈 دکمه دانلود گزارش اکسل/CSV منطبق بر فیلتر */}
          <button 
            onClick={exportToCSV}
            className="w-full sm:w-auto bg-emerald-600 text-white px-5 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-700/10 hover:bg-emerald-700 transition-all active:scale-95 shrink-0"
            title="دانلود فایل خروجی از لیست فیلتر شده فعلی"
          >
            <Download size={16} /> خروجی Excel / CSV
          </button>

          <div className="relative w-full sm:w-48">
            <select
              value={selectedContest}
              onChange={(e) => setSelectedContest(e.target.value)}
              className="w-full bg-white border border-gray-200 text-[#1a2e44] text-xs font-black rounded-2xl px-4 py-3.5 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] shadow-sm transition-all appearance-none cursor-pointer text-center"
            >
              <option value="">🔍 همه مسابقات</option>
              {contests.map((c: any) => (
                <option key={c.id} value={c.title}>{c.title}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="جستجوی نام، شماره تماس، کد ملی..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 text-[#1a2e44] placeholder-gray-400 text-xs font-bold rounded-2xl pl-4 pr-11 py-3.5 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] shadow-sm transition-all"
            />
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
      </header>

      {/* Table Content */}
      <main className="px-8">
        <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs font-black uppercase select-none">
                  {/* 👈 هدرهای جدول برای کلیک و مرتب‌سازی مجهز به آیکون ArrowUpDown شدند */}
                  <th onClick={() => handleSortRequest('name')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors items-center gap-1">
                    نام و نام خانوادگی <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  <th onClick={() => handleSortRequest('phone')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors">
                    شماره تماس <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  <th onClick={() => handleSortRequest('national_id')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors">
                    کد ملی <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  <th onClick={() => handleSortRequest('province')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors">
                    استان <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  <th onClick={() => handleSortRequest('gender')} className="pb-4 font-black cursor-pointer hover:text-[#c5a059] transition-colors">
                    جنسیت <ArrowUpDown size={12} className="inline-block mr-0.5 opacity-60" />
                  </th>
                  {/* 👈 اضافه شدن ستون نقش کاربری */}
                  <th className="pb-4 font-black">نقش سیستم</th>
                  <th className="pb-4 font-black">آخرین رقابت</th>
                  <th className="pb-4 font-black text-center">میانگین نمره</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400 font-bold">در حال بارگذاری اطلاعات کاربران...</td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400 font-bold">هیچ کاربری با فیلترهای اعمال شده یافت نشد.</td>
                  </tr>
                ) : (
                  filteredUsers.map((user: any) => (
                    <tr 
                      key={user.id} 
                      onClick={() => handleUserClick(user.id)}
                      className="hover:bg-[#faf9f6] cursor-pointer transition-colors group"
                      title="برای مشاهده پرونده کامل کلیک کنید"
                    >
                      <td className="py-4 font-bold text-[#1a2e44] group-hover:text-[#c5a059] transition-colors">{user.name}</td>
                      <td className="py-4 font-bold text-gray-500 tracking-wider font-mono">{user.phone}</td>
                      <td className="py-4 text-gray-500 font-mono">{user.national_id}</td>
                      <td className="py-4 font-bold text-gray-600">{user.province}</td>
                      <td className="py-4">
                        <span className={`text-[10px] font-black px-2 py-1 rounded-md ${user.gender === 'مرد' || user.gender === 'male' ? 'bg-blue-50 text-blue-600' : user.gender === 'زن' || user.gender === 'female' ? 'bg-pink-50 text-pink-600' : 'bg-gray-100 text-gray-500'}`}>
                          {user.gender === 'male' || user.gender === 'مرد' ? 'مرد' : 'زن'}
                        </span>
                      </td>
                      {/* رندر ستون تفکیک نقش با منطق اصلاح‌شده و ضد ضرب خطاهای تایپ بک‌ند */}
                      <td className="py-4">
                        {(() => {
                          // بررسی هوشمند تمام حالت‌های ممکن (boolean، عدد 1 یا رشته "true")
                          const checkIsAdmin = user.is_admin === true || user.is_admin === 1 || String(user.is_admin).toLowerCase() === 'true';
                          
                          return (
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-md flex items-center gap-1 w-max ${checkIsAdmin ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-slate-50 text-slate-600'}`}>
                              {checkIsAdmin ? (
                                <><ShieldCheck size={12} /> مدیر سیستم</>
                              ) : (
                                <><UserCheck size={12} /> کاربر عادی</>
                              )}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="py-4 text-gray-600 font-bold">{user.last_contest || 'شرکت نکرده'}</td>
                      <td className="py-4 text-center">
                        <span className={`font-black text-sm ${user.average_score !== '---' ? 'text-[#c5a059]' : 'text-gray-300'}`}>
                          {user.average_score}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* مُدال نمایش و ویرایش سوابق کاربر */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl shadow-2xl border border-gray-100 max-h-[85vh] overflow-y-auto flex flex-col animate-in zoom-in-95 duration-200 text-right">
            
            {/* هدر مدال */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1a2e44] text-[#c5a059] rounded-xl flex items-center justify-center shadow-md">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-[#1a2e44]">
                    {modalLoading ? "در حال فراخوانی پرونده..." : isEditing ? "اصلاح اطلاعات پرونده کاربر" : `پرونده آموزشی: ${selectedUser?.first_name} ${selectedUser?.last_name || ''}`}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-bold mt-0.5">مشخصات هویتی و تاریخچه کامل حضور در آزمون‌ها</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {!modalLoading && selectedUser && !isEditing && (
                  <button 
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="p-2 px-3 bg-[#faf9f6] text-[#c5a059] hover:bg-[#c5a059]/10 rounded-xl transition-all flex items-center gap-1 text-xs font-black"
                  >
                    <Edit2 size={14} /> ویرایش پرونده
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => { setModalOpen(false); setSelectedUser(null); setIsEditing(false); }}
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
                  
                  {/* لایه فرم ویرایش / نمایش اطلاعات مشخصات فردی */}
                  <div className="bg-[#faf9f6] p-5 rounded-2xl border border-gray-100">
                    {isEditing ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">نام</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.first_name} onChange={(e)=>setEditFormData({...editFormData, first_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">نام خانوادگی</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.last_name} onChange={(e)=>setEditFormData({...editFormData, last_name: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">شماره تماس</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-left font-mono text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.phone} onChange={(e)=>setEditFormData({...editFormData, phone: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">کد ملی</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-left font-mono text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.national_id} onChange={(e)=>setEditFormData({...editFormData, national_id: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">استان</label>
                          <input type="text" required className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.province} onChange={(e)=>setEditFormData({...editFormData, province: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">شهر</label>
                          <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.city} onChange={(e)=>setEditFormData({...editFormData, city: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">تاریخ تولد</label>
                          <input type="text" className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" placeholder="مثال: ۱۳۸۰/۰۱/۱۵" value={editFormData.birth_date} onChange={(e)=>setEditFormData({...editFormData, birth_date: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-gray-400 mb-1">جنسیت</label>
                          <select className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-[#1a2e44] outline-none focus:ring-1 focus:ring-[#c5a059]" value={editFormData.gender} onChange={(e)=>setEditFormData({...editFormData, gender: e.target.value})}>
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

                  {/* دکمه‌های تایید ویرایش فرم در زیر فیلدها */}
                  {isEditing && (
                    <div className="flex items-center gap-2 justify-end animate-in fade-in duration-200">
                      <button 
                        type="button" 
                        onClick={() => setIsEditing(false)} 
                        className="p-2.5 px-4 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-500 transition-all"
                      >
                        انصراف
                      </button>
                      <button 
                        type="submit" 
                        disabled={saveLoading}
                        className="p-2.5 px-5 bg-[#1a2e44] text-white hover:bg-[#2a405a] rounded-xl text-xs font-black flex items-center gap-1 transition-all shadow-md"
                      >
                        {saveLoading ? "در حال ذخیره..." : <><Save size={14} className="text-[#c5a059]" /> ذخیره تغییرات پرونده</>}
                      </button>
                    </div>
                  )}

                  {/* بخش دوم: لیست کامل مسابقاتی که شرکت کرده */}
                  <div className="space-y-3">
                    <h4 className="font-black text-xs text-[#1a2e44] flex items-center gap-1.5 border-b border-gray-100 pb-2">
                      <Trophy size={14} className="text-[#c5a059]" /> تاریخچه و کارنامه‌های آزمون
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