'use client';
// frontend-user/app/profile/payments/page.tsx

import toast from 'react-hot-toast';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import {
  ArrowRight, Wallet, RefreshCw, Clock, CheckCircle2, XCircle, Loader2, CreditCard, ExternalLink, AlertTriangle
} from 'lucide-react';
import { openExternalLink } from '../../../lib/utils/url';

type TransactionStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'mismatched';

interface MyTransaction {
  id: number;
  amount_irt: number;
  status: TransactionStatus;
  created_at: string | null;
  payload_id: string;
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
  { key: 'pending', label: 'در انتظار پرداخت' },
  { key: 'paid', label: 'موفق' },
  { key: 'mismatched', label: 'نیاز به پیگیری' },
];

const STATUS_META: Record<TransactionStatus, { label: string; className: string; Icon: typeof Clock }> = {
  pending: {
    label: 'در انتظار پرداخت',
    className: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40',
    Icon: Clock,
  },
  paid: {
    label: 'پرداخت موفق',
    className: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'ناموفق',
    className: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40',
    Icon: XCircle,
  },
  expired: {
    label: 'منقضی شده',
    className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    Icon: XCircle,
  },
  mismatched: {
    label: 'نیاز به پیگیری (مغایرت مبلغ)',
    className: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900/40',
    Icon: AlertTriangle,
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

  // وضعیت‌های فرم پرداخت جدید
  const [chargeAmount, setChargeAmount] = useState<string>('');
  const [initLoading, setInitLoading] = useState(false);

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

  // 🌟 تابع درخواست فاکتور جدید
  const handleInitPayment = async () => {
    const amountNum = parseInt(chargeAmount.replace(/,/g, ''), 10);
    if (!amountNum || amountNum < 1000) {
      toast.error('حداقل مبلغ شارژ ۱۰۰۰ تومان می‌باشد.');
      return;
    }

    setInitLoading(true);
    try {
      const res = await api.post('/bale/init', { amount: amountNum });
      const { deep_link } = res.data;
      
      toast.success('فاکتور با موفقیت ایجاد شد! در حال انتقال به درگاه پرداخت...');
      setChargeAmount('');
      
      // هدایت کاربر به دیپ‌لینک بات بله
      setTimeout(() => {
        openExternalLink(deep_link);
      }, 1000);
      
      // رفرش لیست پس از چند ثانیه تا رکورد pending اضافه شود
      setTimeout(() => fetchPage(filter, 0), 2000);
      
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'خطا در اتصال به درگاه پرداخت');
    } finally {
      setInitLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] font-sans text-[#1a2e44] dark:text-slate-100 transition-colors duration-200" dir="rtl">
      <header className="p-6 flex items-center justify-between bg-white/80 dark:bg-[#182234]/80 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/profile')} aria-label="بازگشت به پروفایل" className="p-2 bg-gray-50 dark:bg-[#0b0f19] rounded-full hover:bg-gray-100 dark:hover:bg-[#233044] transition-colors text-[#1a2e44] dark:text-slate-100">
            <ArrowRight size={20} />
          </button>
          <span className="font-black text-xl text-[#1a2e44] dark:text-slate-100">کیف پول و شارژ حساب</span>
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
        
        {/* باکس شارژ و موجودی ترکیب شده */}
        <section className="bg-white dark:bg-[#182234] rounded-[2rem] p-6 shadow-sm border border-gray-100 dark:border-slate-800 space-y-6">
          {/* نمایش موجودی */}
          <div className="flex items-center justify-between bg-[#1a2e44] dark:bg-[#182234] text-white p-5 rounded-3xl relative overflow-hidden border border-[#2a405a] dark:border-slate-700">
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-[#c5a059]/10 rounded-full" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="p-3 bg-white/10 rounded-2xl text-[#c5a059]">
                <Wallet size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-300">موجودی فعلی شما</p>
                {balance === null ? (
                  <div className="h-6 w-24 mt-1 rounded bg-white/10 animate-pulse" />
                ) : (
                  <p className="text-xl sm:text-2xl font-black mt-0.5">
                    {formatAmount(balance)} <span className="text-[10px] sm:text-xs font-bold text-[#c5a059]">تومان</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* فرم شارژ مستقیم */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-widest mb-2">
                مبلغ شارژ جدید (به تومان)
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  min="1000"
                  placeholder="مثلاً 50000"
                  className="w-full p-4 pl-16 bg-[#faf9f6] dark:bg-[#0b0f19] border-none rounded-2xl text-[#1a2e44] dark:text-slate-100 focus:ring-2 focus:ring-[#c5a059] outline-none font-bold text-lg text-left"
                  dir="ltr"
                  value={chargeAmount}
                  onChange={(e) => setChargeAmount(e.target.value)}
                />
                <span className="absolute left-4 text-xs font-bold text-gray-400">تومان</span>
              </div>
            </div>

            <button
              onClick={handleInitPayment}
              disabled={initLoading || !chargeAmount}
              className="w-full bg-[#c5a059] hover:bg-[#b08e4a] text-white p-4 rounded-2xl font-black text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
            >
              {initLoading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <CreditCard size={20} />
                  دریافت فاکتور پرداخت بانکی
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-gray-500 font-bold">پرداخت از طریق درگاه امن پیام‌رسان بله انجام می‌شود.</p>
          </div>
        </section>

        {/* فیلتر وضعیت تاریخچه */}
        <div className="pt-2">
          <h3 className="text-sm font-black text-[#1a2e44] dark:text-slate-100 mb-3 px-1">تاریخچه شارژ حساب</h3>
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
        </div>

        {/* لیست تراکنش‌ها */}
        <section className="space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#182234] p-5 rounded-[1.5rem] border border-gray-100 dark:border-slate-800 animate-pulse space-y-3">
                <div className="flex justify-between">
                  <div className="h-5 w-28 bg-gray-100 dark:bg-slate-700/50 rounded-lg" />
                  <div className="h-5 w-20 bg-gray-100 dark:bg-slate-700/50 rounded-full" />
                </div>
                <div className="h-3 w-40 bg-gray-100 dark:bg-slate-700/50 rounded" />
              </div>
            ))
          ) : error ? (
            <div className="text-center py-8 bg-white dark:bg-[#182234] rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-800 space-y-3">
              <p className="text-sm font-bold text-gray-500 dark:text-slate-400">دریافت اطلاعات با خطا مواجه شد.</p>
              <button
                onClick={() => fetchPage(filter, 0)}
                className="px-5 py-2 rounded-full bg-[#1a2e44] dark:bg-[#c5a059] text-white dark:text-[#1a2e44] text-xs font-black active:scale-95 transition"
              >
                تلاش مجدد
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 px-6 bg-white dark:bg-[#182234] rounded-[2rem] border border-dashed border-gray-200 dark:border-slate-800 space-y-3">
              <Wallet className="mx-auto text-gray-200 dark:text-slate-600" size={32} />
              <p className="text-gray-500 dark:text-slate-400 text-xs font-bold">
                {filter === 'all' ? 'هیچ فاکتور پرداختی ثبت نشده است.' : 'فاکتوری با این وضعیت وجود ندارد.'}
              </p>
            </div>
          ) : (
            <>
              {items.map((tx) => {
                const meta = STATUS_META[tx.status] ?? STATUS_META.pending;
                const StatusIcon = meta.Icon;
                return (
                  <div key={tx.id} className="bg-white dark:bg-[#182234] p-4 sm:p-5 rounded-[1.5rem] border border-gray-100 dark:border-slate-800 shadow-sm space-y-3 relative overflow-hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-lg font-black text-[#1a2e44] dark:text-slate-100">
                          {formatAmount(tx.amount_irt)} <span className="text-[10px] font-bold text-gray-400 dark:text-slate-400">تومان</span>
                        </p>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-slate-400 mt-1">
                          شناسه فاکتور: <span className="text-xs font-mono" dir="ltr">{tx.payload_id.slice(0, 8)}...</span>
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-black ${meta.className}`}>
                        <StatusIcon size={12} />
                        {meta.label}
                      </span>
                    </div>
                    
                    <div className="pt-3 border-t border-gray-50 dark:border-slate-800 text-[10px] font-bold text-gray-500 dark:text-slate-400 flex justify-between items-center">
                      <span>ثبت: {formatDate(tx.created_at)}</span>
                      {tx.status === 'pending' && (
                        <button 
                          onClick={(e) => openExternalLink(`https://ble.ir/emtedade_emam_bot?start=${tx.payload_id.replace(/-/g, '')}`, e)}
                          className="flex items-center gap-1 text-[#c5a059] hover:underline"
                        >
                          تکمیل پرداخت <ExternalLink size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {hasMore && (
                <button
                  onClick={() => fetchPage(filter, items.length)}
                  disabled={loadingMore}
                  className="w-full py-3 rounded-[1.5rem] border border-gray-100 dark:border-slate-800 bg-white dark:bg-[#182234] text-xs font-black text-[#1a2e44] dark:text-slate-200 hover:border-[#c5a059] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loadingMore && <Loader2 size={16} className="animate-spin" />}
                  نمایش فاکتورهای قدیمی‌تر
                </button>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}