'use client';
// frontend-admin/app/admin/notifications/page.tsx

import toast from 'react-hot-toast';
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import {
  ArrowRight, Bell, Send, Globe, UserRound, Search, Loader2, CheckCircle2, X
} from 'lucide-react';

type Target = 'all' | 'user';

type UserMatch = {
  id: string;
  name: string;
  phone: string | null;
  national_id: string | null;
};

const TITLE_MAX = 255;
const SEARCH_DEBOUNCE_MS = 400;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const extractError = (error: any): string => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail[0]?.msg) {
    return String(detail[0].msg).replace(/^Value error,\s*/i, '');
  }
  return 'خطا در ارسال اعلان';
};

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState<Target>('all');
  const [userId, setUserId] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserMatch | null>(null);
  const [sending, setSending] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [matches, setMatches] = useState<UserMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRequestRef = useRef(0);

  const trimmedUserId = userId.trim();
  const userIdInvalid = target === 'user' && trimmedUserId !== '' && !UUID_PATTERN.test(trimmedUserId);
  const canSubmit =
    !sending &&
    title.trim() !== '' &&
    content.trim() !== '' &&
    (target === 'all' || UUID_PATTERN.test(trimmedUserId));

  useEffect(() => {
    const term = searchInput.trim();
    if (target !== 'user' || term.length < 2) {
      searchRequestRef.current++;
      setMatches([]);
      setSearching(false);
      return;
    }
    const handle = setTimeout(async () => {
      const requestId = ++searchRequestRef.current;
      setSearching(true);
      try {
        const res = await api.get('/admin/users', { params: { search: term, limit: 5 } });
        if (requestId !== searchRequestRef.current) return;
        setMatches(res.data?.items || []);
      } catch {
        if (requestId !== searchRequestRef.current) return;
        setMatches([]);
      } finally {
        if (requestId === searchRequestRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput, target]);

  const pickUser = (user: UserMatch) => {
    setUserId(user.id);
    setSelectedUser(user);
    setSearchInput('');
    setMatches([]);
  };

  const clearUser = () => {
    setUserId('');
    setSelectedUser(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (target === 'all' && !window.confirm('این اعلان برای همه کاربران ارسال می‌شود. ادامه می‌دهید؟')) {
      return;
    }

    setSending(true);
    try {
      await api.post('/admin/notifications', {
        title: title.trim(),
        content: content.trim(),
        is_global: target === 'all',
        user_id: target === 'user' ? trimmedUserId : null,
      });
      toast.success(target === 'all' ? 'اعلان برای همه کاربران ارسال شد.' : 'اعلان برای کاربر ارسال شد.');
      setTitle('');
      setContent('');
      clearUser();
    } catch (error: any) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        toast.error('⚠️ خطای امنیتی: شما ادمین سیستم نیستید!');
        localStorage.clear();
        window.location.href = '/admin/login';
        return;
      }
      toast.error(extractError(error));
    } finally {
      setSending(false);
    }
  };

  const inputClass =
    'w-full p-4 bg-gray-50 dark:bg-[#0b0f19] border border-gray-100 dark:border-slate-800 rounded-2xl text-sm font-bold text-[#1a2e44] dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 outline-none focus:border-[#c5a059] focus:ring-2 focus:ring-[#c5a059]/20 transition-colors';
  const labelClass = 'block text-xs font-black text-gray-500 dark:text-slate-400 mb-2';

  const targetOption = (value: Target, label: string, description: string, Icon: React.ElementType) => {
    const active = target === value;
    return (
      <label
        className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
          active
            ? 'border-[#c5a059] bg-[#c5a059]/10 dark:bg-[#c5a059]/10'
            : 'border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-[#0b0f19] hover:border-[#c5a059]/50'
        }`}
      >
        <input
          type="radio"
          name="target"
          value={value}
          checked={active}
          onChange={() => setTarget(value)}
          className="sr-only"
        />
        <span className={`flex items-center justify-center w-11 h-11 rounded-xl ${active ? 'bg-[#c5a059] text-white' : 'bg-white dark:bg-[#182234] text-gray-400 dark:text-slate-400'}`}>
          <Icon size={20} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-black text-[#1a2e44] dark:text-slate-100">{label}</span>
          <span className="block text-[11px] font-bold text-gray-400 dark:text-slate-400 mt-0.5">{description}</span>
        </span>
        <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-[#c5a059]' : 'border-gray-300 dark:border-slate-600'}`}>
          {active && <span className="w-2.5 h-2.5 rounded-full bg-[#c5a059]" />}
        </span>
      </label>
    );
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 font-sans pb-10" dir="rtl">
      <header className="p-8 flex items-center gap-4">
        <button
          onClick={() => router.push('/admin/dashboard')}
          aria-label="بازگشت به داشبورد"
          className="p-3 bg-white dark:bg-[#182234] rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 hover:scale-105 transition-all text-gray-500 dark:text-slate-400 hover:text-[#1a2e44] dark:hover:text-slate-100"
        >
          <ArrowRight size={20} />
        </button>
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Bell className="text-[#c5a059]" /> ارسال اعلان
          </h1>
          <p className="text-gray-400 dark:text-slate-400 text-sm font-bold mt-1">
            اعلان عمومی برای همه کاربران یا اعلان اختصاصی برای یک کاربر
          </p>
        </div>
      </header>

      <main className="px-4 sm:px-8">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-3xl mx-auto bg-white dark:bg-[#182234] rounded-[2rem] border border-gray-100 dark:border-slate-800 shadow-sm p-6 sm:p-8 space-y-6"
        >
          <fieldset>
            <legend className={labelClass}>گیرنده</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {targetOption('all', 'همه کاربران', 'نمایش در صندوق اعلان همه', Globe)}
              {targetOption('user', 'کاربر خاص', 'فقط برای یک کاربر مشخص', UserRound)}
            </div>
          </fieldset>

          {target === 'user' && (
            <div className="space-y-4 p-4 sm:p-5 rounded-2xl border border-dashed border-gray-200 dark:border-slate-700">
              <div>
                <label htmlFor="user-search" className={labelClass}>جستجوی کاربر (نام، موبایل یا کد ملی)</label>
                <div className="relative">
                  <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
                  <input
                    id="user-search"
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="حداقل ۲ حرف..."
                    autoComplete="off"
                    className={`${inputClass} pr-11`}
                  />
                  {searching && (
                    <Loader2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 animate-spin text-[#c5a059]" />
                  )}
                </div>
                {matches.length > 0 && (
                  <ul className="mt-2 rounded-2xl border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden">
                    {matches.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          onClick={() => pickUser(user)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-right hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors"
                        >
                          <span className="text-sm font-black text-[#1a2e44] dark:text-slate-100 truncate">{user.name}</span>
                          <span className="text-xs font-bold text-gray-400 dark:text-slate-400 shrink-0" dir="ltr">{user.phone || user.national_id || '---'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {!searching && searchInput.trim().length >= 2 && matches.length === 0 && (
                  <p className="mt-2 text-xs font-bold text-gray-400 dark:text-slate-500">کاربری یافت نشد.</p>
                )}
              </div>

              <div>
                <label htmlFor="user-id" className={labelClass}>شناسه کاربر (UUID)</label>
                <input
                  id="user-id"
                  type="text"
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setSelectedUser(null);
                  }}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  dir="ltr"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={userIdInvalid}
                  className={`${inputClass} font-mono text-left ${userIdInvalid ? 'border-rose-400 dark:border-rose-500/60' : ''}`}
                />
                {userIdInvalid && (
                  <p className="mt-2 text-xs font-bold text-rose-500">فرمت شناسه کاربر معتبر نیست.</p>
                )}
                {selectedUser && (
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-black">
                    <CheckCircle2 size={14} />
                    {selectedUser.name}
                    <button type="button" onClick={clearUser} aria-label="حذف کاربر انتخاب‌شده" className="p-0.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="notification-title" className="text-xs font-black text-gray-500 dark:text-slate-400">عنوان</label>
              <span className="text-[10px] font-bold text-gray-400 dark:text-slate-500">
                {title.length.toLocaleString('fa-IR')} / {TITLE_MAX.toLocaleString('fa-IR')}
              </span>
            </div>
            <input
              id="notification-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
              placeholder="مثلاً: شروع مسابقه جدید"
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="notification-content" className={labelClass}>متن اعلان</label>
            <textarea
              id="notification-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="متن کامل اعلان را بنویسید..."
              className={`${inputClass} resize-y leading-7`}
            />
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full md:w-auto md:min-w-[220px] flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] text-sm font-black shadow-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {sending ? 'در حال ارسال...' : 'ارسال اعلان'}
          </button>
        </form>
      </main>
    </div>
  );
}
