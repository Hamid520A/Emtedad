'use client';
// frontend-user/app/profile/payments/page.tsx

import toast from 'react-hot-toast';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import {
  ArrowRight, Wallet, RefreshCw, Clock, CheckCircle2, XCircle, Loader2, Info
} from 'lucide-react';

type TransactionStatus = 'pending' | 'success' | 'rejected';

interface MyTransaction {
  id: number;
  amount: number;
  status: TransactionStatus;
  created_at: string | null;
  processed_at: string | null;
}

interface MyTransactionsResponse {
  wallet_balance: number;
  wallet_code: number | null;
  total_count: number;
  items: MyTransaction[];
}

const PAGE_SIZE = 20;

const FILTERS: { key: TransactionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'pending', label: 'در حال بررسی' },
  { key: 'success', label: 'تایید شده' },
  { key: 'rejected', label: 'رد شده' },
];

const STATUS_META: Record<TransactionStatus, { label: string; className: string; Icon: typeof Clock }> = {
  pending: {
    label: 'در حال بررسی',
    className: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40',
    Icon: Clock,
  },
  success: {
    label: 'تایید شده',
    className: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'رد شده',
    className: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40',
    Icon: XCircle,
  },
};

const toPersianDigits = (str: string | number) => {
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
};

const formatAmount = (value: number) => {
  try {
    return Number(value || 0).toLocaleString('fa-IR');
  } catch {
    return toPersianDigits(value || 0);
  }
};

const formatDate = (iso: string | null) => {
  if (!iso) return '---';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '---';
  try {
    return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return toPersianDigits(iso.slice(0, 16).replace('T', ' '));
  }
};

const TopUpHint = () => (
  <p className="text-[11px] leading-relaxed font-medium text-gray-500 dark:text-slate-400 flex items-start gap-1.5">
    <Info size={14} className="text-[#c5a059] shrink-0 mt-0.5" />
    <span>
      برای شارژ کیف پول، تصویر رسید واریز را به ربات بله ارسال کنید و در توضیح عکس «شناسه کاربری» و سپس با یک فاصله «مبلغ به ریال» را بنویسید.
    </span>
  </p>
);

export default function PaymentsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<TransactionStatus | 'all'>('all');
  const [items, setItems] = useState<MyTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [balance, setBalance] = useState<number | null>(null);
  const [walletCode, setWalletCode] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const latestRequestRef = useRef(0);

  const fetchPage = useCallback(async (status: TransactionStatus | 'all', skip: number) => {
    const requestId = ++latestRequestRef.current;
    if (skip === 0) {
      setLoading(true);
      setError(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const res = await api.get<MyTransactionsResponse>('/users/me/transactions', {
        params: {
          skip,
          limit: PAGE_SIZE,
          ...(status !== 'all' ? { status } : {}),
        },
      });
      if (requestId !== latestRequestRef.current) return;

      const data = res.data;
      setBalance(data.wallet_balance ?? 0);
      setWalletCode(data.wallet_code ?? null);
      setTotalCount(data.total_count ?? 0);
      setItems((prev) => (skip === 0 ? data.items : [...prev, ...data.items]));
    } catch (err) {
      if (requestId !== latestRequestRef.current) return;
      console.error('Error fetching transactions:', err);
      toast.error('خطا در دریافت تاریخچه پرداخت‌ها');
      if (skip === 0) setError(true);
    } finally {
      if (requestId === latestRequestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('accessToken')) {
      router.push('/login');
      return;
    }
    fetchPage(filter, 0);
  }, [filter, fetchPage, router]);

  const hasMore = items.length < totalCount;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] font-sans text-[#1a2e44] dark:text-slate-100 transition-colors duration-200" dir="rtl">
      <header className="p-6 flex items-center justify-between bg-white/80 dark:bg-[#182234]/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/profile')} aria-label="بازگشت به پروفایل" className="p-2 bg-gray-50 dark:bg-[#0b0f19] rounded-full hover:bg-gray-100 dark:hover:bg-[#233044] transition-colors text-[#1a2e44] dark:text-slate-100">
            <ArrowRight size={20} />
          </button>
          <span className="font-black text-xl text-[#1a2e44] dark:text-slate-100">کیف پول و پرداخت‌ها</span>
        </div>
        <button
          onClick={() => fetchPage(filter, 0)}
          disabled={loading}
          aria-label="بروزرسانی"
          className="p-2 bg-gray-50 dark:bg-[#0b0f19] rounded-full hover:bg-gray-100 dark:hover:bg-[#233044] transition-colors text-[#c5a059] disabled:opacity-50"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </header>

      <main className="p-6 space-y-6 pb-24">
        {/* موجودی کیف پول */}
        <section className="bg-[#1a2e44] dark:bg-[#182234] text-white rounded-[2rem] p-6 shadow-xl border border-[#1a2e44] dark:border-slate-800 relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-32 h-32 bg-[#c5a059]/10 rounded-full" />
          <div className="relative flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl text-[#c5a059]">
              <Wallet size={24} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-300">موجودی کیف پول</p>
              {balance === null ? (
                <div className="h-8 w-32 mt-1 rounded-lg bg-white/10 animate-pulse" />
              ) : (
                <p className="text-2xl font-black mt-0.5">
                  {formatAmount(balance)} <span className="text-sm font-bold text-[#c5a059]">ریال</span>
                </p>
              )}
            </div>
          </div>
          {walletCode !== null && (
            <div className="relative mt-4 inline-flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-300">شناسه کاربری:</span>
              <span className="font-black text-sm tracking-widest" dir="ltr">{walletCode}</span>
            </div>
          )}
        </section>

        {/* فیلتر وضعیت */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none]">
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 px-4 py-2 rounded-full text-xs font-black border transition-colors ${
                  active
                    ? 'bg-[#1a2e44] text-white border-[#1a2e44] dark:bg-[#c5a059] dark:text-[#1a2e44] dark:border-[#c5a059]'
                    : 'bg-white text-gray-500 border-gray-100 hover:border-[#c5a059] dark:bg-[#182234] dark:text-slate-300 dark:border-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* لیست تراکنش‌ها */}
        <section className="space-y-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#182234] p-5 rounded-[1.5rem] border border-gray-100 dark:border-slate-800 animate-pulse space-y-3">
                <div className="flex justify-between">
                  <div className="h-5 w-28 bg-gray-100 dark:bg-slate-700/50 rounded-lg" />
                  <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
                </div>
                <div className="h-3 w-40 bg-gray-100 dark:bg-slate-700/50 rounded" />
              </div>
            ))
          ) : error ? (
            <div className="text-center py-10 bg-white dark:bg-[#182234] rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-800 space-y-3">
              <p className="text-sm font-bold text-gray-500 dark:text-slate-400">دریافت اطلاعات با خطا مواجه شد.</p>
              <button
                onClick={() => fetchPage(filter, 0)}
                className="px-5 py-2 rounded-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] text-xs font-black active:scale-95 transition"
              >
                تلاش مجدد
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-10 px-6 bg-white dark:bg-[#182234] rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-800 space-y-4">
              <Wallet className="mx-auto text-gray-200 dark:text-slate-600" size={36} />
              <p className="text-gray-500 dark:text-slate-400 text-sm font-bold">
                {filter === 'all' ? 'هنوز پرداختی ثبت نکرده‌اید.' : 'پرداختی با این وضعیت وجود ندارد.'}
              </p>
              {filter === 'all' && <TopUpHint />}
            </div>
          ) : (
            <>
              {items.map((tx) => {
                const meta = STATUS_META[tx.status] ?? STATUS_META.pending;
                const StatusIcon = meta.Icon;
                return (
                  <div key={tx.id} className="bg-white dark:bg-[#182234] p-5 rounded-[1.5rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[#1a2e44] dark:text-slate-100">
                          {formatAmount(tx.amount)} <span className="text-xs font-bold text-gray-400 dark:text-slate-400">ریال</span>
                        </p>
                        <p className="text-[11px] font-bold text-gray-400 dark:text-slate-400 mt-0.5">
                          شماره پیگیری: <span className="text-[#c5a059]">#{toPersianDigits(tx.id)}</span>
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-black ${meta.className}`}>
                        <StatusIcon size={13} />
                        {meta.label}
                      </span>
                    </div>
                    <div className="pt-3 border-t border-gray-50 dark:border-slate-800 text-[11px] font-medium text-gray-500 dark:text-slate-400 space-y-1">
                      <p>ثبت شده در: {formatDate(tx.created_at)}</p>
                      {tx.processed_at && <p>بررسی شده در: {formatDate(tx.processed_at)}</p>}
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <button
                  onClick={() => fetchPage(filter, items.length)}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-[1.5rem] border border-gray-100 dark:border-slate-800 bg-white dark:bg-[#182234] text-sm font-black text-[#1a2e44] dark:text-slate-200 hover:border-[#c5a059] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loadingMore && <Loader2 size={16} className="animate-spin" />}
                  نمایش بیشتر
                </button>
              )}
            </>
          )}
        </section>

        {!loading && !error && items.length > 0 && (
          <div className="bg-white dark:bg-[#182234] p-4 rounded-[1.5rem] border border-gray-100 dark:border-slate-800">
            <TopUpHint />
          </div>
        )}
      </main>
    </div>
  );
}
