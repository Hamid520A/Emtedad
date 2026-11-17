// frontend-admin/app/admin/payments/page.tsx
'use client';

import toast from 'react-hot-toast';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import {
  ArrowRight, Wallet, Search, Clock, CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  RefreshCw, Bot, AlertTriangle, Copy, Check, Layers
} from 'lucide-react';

type TransactionStatus = 'pending' | 'paid' | 'mismatched' | 'expired' | 'failed';
type FilterTab = 'all' | TransactionStatus;

type Transaction = {
  id: string;
  user_id: string;
  user_name: string;
  phone_number: string | null;
  wallet_code: number | null;
  amount_irt: number;
  payload_id: string;
  tracking_code: string | null;
  status: TransactionStatus;
  created_at: string | null;
};

type StatusCounts = Record<TransactionStatus, number>;

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_META: Record<TransactionStatus, { label: string; icon: React.ElementType; badge: string; tabActive: string }> = {
  paid: {
    label: 'پرداخت موفق',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    tabActive: 'border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/10',
  },
  pending: {
    label: 'در انتظار پرداخت',
    icon: Clock,
    badge: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    tabActive: 'border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-500/10',
  },
  mismatched: {
    label: 'مغایرت مبلغ',
    icon: AlertTriangle,
    badge: 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
    tabActive: 'border-purple-400 text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-500/10',
  },
  expired: {
    label: 'منقضی شده',
    icon: XCircle,
    badge: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    tabActive: 'border-gray-400 text-gray-700 dark:text-slate-300 bg-gray-100/70 dark:bg-slate-800/60',
  },
  failed: {
    label: 'ناموفق',
    icon: XCircle,
    badge: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    tabActive: 'border-rose-400 text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-500/10',
  },
};

const TABS: { key: FilterTab; label: string; icon: React.ElementType; activeClass: string }[] = [
  {
    key: 'all',
    label: 'همه فاکتورها',
    icon: Layers,
    activeClass: 'border-[#c5a059] text-[#1a2e44] dark:text-[#c5a059] bg-[#c5a059]/10',
  },
  { key: 'paid', label: STATUS_META.paid.label, icon: STATUS_META.paid.icon, activeClass: STATUS_META.paid.tabActive },
  { key: 'pending', label: STATUS_META.pending.label, icon: STATUS_META.pending.icon, activeClass: STATUS_META.pending.tabActive },
  { key: 'mismatched', label: STATUS_META.mismatched.label, icon: STATUS_META.mismatched.icon, activeClass: STATUS_META.mismatched.tabActive },
  { key: 'expired', label: STATUS_META.expired.label, icon: STATUS_META.expired.icon, activeClass: STATUS_META.expired.tabActive },
];

const toPersianDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

const formatAmount = (amountIrt: number) => `${Number(amountIrt || 0).toLocaleString('fa-IR')} تومان`;

const formatDateTime = (iso: string | null) => {
  if (!iso) return '---';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '---';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

function StatusBadge({ status }: { status: TransactionStatus }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 w-max text-[10px] font-black px-2.5 py-1 rounded-lg border ${meta.badge}`}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({
    pending: 0,
    paid: 0,
    mismatched: 0,
    expired: 0,
    failed: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const latestRequestRef = useRef(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, totalCount);

  const totalAllStatuses = Object.values(counts).reduce((sum, val) => sum + (val || 0), 0);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`${label} کپی شد`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const fetchTransactions = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        skip: String((page - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE),
        t: String(Date.now()),
      });
      if (activeTab !== 'all') {
        params.set('status', activeTab);
      }
      if (searchTerm) {
        params.set('search', searchTerm);
      }
      const res = await api.get(`/admin/transactions?${params.toString()}`);
      if (requestId !== latestRequestRef.current) return;
      setTransactions(res.data?.items || []);
      setTotalCount(res.data?.total_count || 0);
      setCounts(
        res.data?.status_counts || {
          pending: 0,
          paid: 0,
          mismatched: 0,
          expired: 0,
          failed: 0,
        }
      );
    } catch (error: any) {
      if (requestId !== latestRequestRef.current) return;
      console.error('Error fetching transactions:', error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        toast.error('⚠️ خطای امنیتی: شما ادمین سیستم نیستید!');
        localStorage.clear();
        window.location.href = '/admin/login';
        return;
      }
      toast.error('خطا در دریافت لیست پرداخت‌ها');
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [activeTab, page, searchTerm]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = searchInput.trim();
      if (next !== searchTerm) {
        setSearchTerm(next);
        setPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput, searchTerm]);

  const changeTab = (tab: FilterTab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1);
  };

  const goToPage = (target: number) => {
    const next = Math.min(Math.max(1, target), totalPages);
    if (next === page) return;
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const emptyMessage = searchTerm
    ? 'هیچ فاکتوری با این جستجو یافت نشد.'
    : activeTab === 'all'
    ? 'هنوز هیچ فاکتور پرداختی در سیستم ثبت نشده است.'
    : `هیچ فاکتوری در وضعیت «${STATUS_META[activeTab]?.label}» وجود ندارد.`;

  return (
    <div className="min-h-screen bg-[#faf9f6] dark:bg-[#0b0f19] text-[#1a2e44] dark:text-slate-100 font-sans pb-10" dir="rtl">
      <header className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/dashboard')}
            className="p-3 bg-white dark:bg-[#182234] rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 hover:scale-105 transition-all text-gray-500 dark:text-slate-400 hover:text-[#1a2e44] dark:hover:text-slate-100"
          >
            <ArrowRight size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
              <Wallet className="text-[#c5a059]" /> تراکنش‌های درگاه مستقیم بله
            </h1>
            <p className="text-gray-400 dark:text-slate-400 text-sm font-bold mt-1 flex items-center gap-1.5">
              <Bot size={14} /> صدور فاکتور و شارژ کیف پول به صورت ۱۰۰٪ خودکار از طریق درگاه بانکی بله انجام می‌شود
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="جستجوی نام، موبایل، شناسه فاکتور یا کد رهگیری..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-white dark:bg-[#182234] border border-gray-200 dark:border-slate-800 text-[#1a2e44] dark:text-slate-100 placeholder-gray-400 text-xs font-bold rounded-2xl pl-4 pr-11 py-3.5 focus:outline-none focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059] shadow-sm transition-all"
            />
            <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-400" />
          </div>
          <button
            type="button"
            onClick={fetchTransactions}
            disabled={loading}
            className="w-full sm:w-auto bg-white dark:bg-[#182234] border border-gray-200 dark:border-slate-800 px-4 py-3.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-sm hover:border-[#c5a059] hover:text-[#c5a059] transition-all disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> بروزرسانی
          </button>
        </div>
      </header>

      <main className="px-8 space-y-6">
        {/* تب‌های وضعیت */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            const countVal = tab.key === 'all' ? totalAllStatuses : (counts[tab.key] ?? 0);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => changeTab(tab.key)}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 font-black text-xs sm:text-sm transition-all ${
                  isActive
                    ? tab.activeClass
                    : 'border-transparent bg-white dark:bg-[#182234] text-gray-500 dark:text-slate-400 shadow-sm hover:border-gray-200 dark:hover:border-slate-700'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <Icon size={17} className="shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </span>
                <span className={`min-w-[2rem] px-2 py-0.5 rounded-lg text-xs ${isActive ? 'bg-white/70 dark:bg-slate-900/40' : 'bg-gray-100 dark:bg-slate-800'}`}>
                  {toPersianDigits(countVal)}
                </span>
              </button>
            );
          })}
        </div>

        {/* جدول دسکتاپ */}
        <div className="hidden md:block bg-white dark:bg-[#182234] rounded-[2.5rem] p-8 shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-800 text-gray-400 dark:text-slate-400 text-xs font-black select-none">
                  <th className="pb-4 font-black">کاربر</th>
                  <th className="pb-4 font-black">شماره تماس</th>
                  <th className="pb-4 font-black">شناسه کیف پول</th>
                  <th className="pb-4 font-black">مبلغ</th>
                  <th className="pb-4 font-black">وضعیت</th>
                  <th className="pb-4 font-black">شناسه فاکتور (Payload)</th>
                  <th className="pb-4 font-black">کد رهگیری بله</th>
                  <th className="pb-4 font-black">تاریخ ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60 text-sm">
                {loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400 dark:text-slate-400 font-bold">در حال بارگذاری تراکنش‌ها...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400 dark:text-slate-400 font-bold">{emptyMessage}</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className={`transition-colors hover:bg-[#faf9f6] dark:hover:bg-slate-800/40 ${loading ? 'opacity-60' : ''}`}>
                      <td className="py-4 font-bold">{tx.user_name}</td>
                      <td className="py-4 font-bold text-gray-500 dark:text-slate-400 font-mono tracking-wider" dir="ltr">{tx.phone_number || '---'}</td>
                      <td className="py-4 font-mono text-gray-500 dark:text-slate-400">{tx.wallet_code ?? '---'}</td>
                      <td className="py-4 font-black text-[#c5a059]">{formatAmount(tx.amount_irt)}</td>
                      <td className="py-4">
                        <StatusBadge status={tx.status} />
                      </td>
                      <td className="py-4">
                        <button
                          type="button"
                          onClick={() => handleCopy(tx.payload_id, 'شناسه فاکتور')}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-slate-800/70 hover:bg-gray-100 dark:hover:bg-slate-800 text-xs font-mono text-gray-600 dark:text-slate-300 transition"
                          title="کپی شناسه کامل فاکتور"
                          dir="ltr"
                        >
                          {tx.payload_id.slice(0, 10)}...
                          {copiedText === tx.payload_id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} className="text-gray-400" />}
                        </button>
                      </td>
                      <td className="py-4">
                        {tx.tracking_code ? (
                          <button
                            type="button"
                            onClick={() => handleCopy(tx.tracking_code!, 'کد رهگیری')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 text-xs font-mono text-emerald-700 dark:text-emerald-300 transition"
                            dir="ltr"
                          >
                            {tx.tracking_code.slice(0, 12)}
                            {copiedText === tx.tracking_code ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300 dark:text-slate-600 font-bold">---</span>
                        )}
                      </td>
                      <td className="py-4 text-xs font-bold text-gray-500 dark:text-slate-400">{formatDateTime(tx.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* کارت‌های موبایل */}
        <div className="block md:hidden bg-white dark:bg-[#182234] rounded-[2rem] p-4 shadow-sm border border-gray-100 dark:border-slate-800 space-y-3">
          {loading && transactions.length === 0 ? (
            <p className="text-center py-10 text-gray-400 font-bold text-sm">در حال بارگذاری تراکنش‌ها...</p>
          ) : transactions.length === 0 ? (
            <div className="text-center py-10">
              <Wallet size={40} className="mx-auto text-gray-200 dark:text-slate-700 mb-3" />
              <p className="text-gray-400 font-bold text-sm">{emptyMessage}</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-bold text-sm block truncate">{tx.user_name}</span>
                    <span className="text-[11px] text-gray-400 font-mono tracking-wider" dir="ltr">{tx.phone_number || '---'}</span>
                  </div>
                  <StatusBadge status={tx.status} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-black text-[#c5a059]">{formatAmount(tx.amount_irt)}</span>
                  <span className="text-gray-400 font-bold">کیف پول: {tx.wallet_code ?? '---'}</span>
                </div>
                <div className="pt-2 border-t border-gray-50 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleCopy(tx.payload_id, 'شناسه فاکتور')}
                    className="inline-flex items-center gap-1 text-gray-500 dark:text-slate-400 font-mono"
                    dir="ltr"
                  >
                    #{tx.payload_id.slice(0, 8)} <Copy size={11} />
                  </button>
                  {tx.tracking_code && (
                    <button
                      type="button"
                      onClick={() => handleCopy(tx.tracking_code!, 'کد رهگیری')}
                      className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-mono"
                      dir="ltr"
                    >
                      رهگیری: {tx.tracking_code.slice(0, 8)} <Copy size={11} />
                    </button>
                  )}
                  <span className="text-[10px] text-gray-400 font-bold">{formatDateTime(tx.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#182234] rounded-2xl px-5 py-3 shadow-sm border border-gray-100 dark:border-slate-800">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
              نمایش {toPersianDigits(pageStart)} تا {toPersianDigits(pageEnd)} از {toPersianDigits(totalCount)} تراکنش
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={loading || page <= 1}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black border border-gray-200 dark:border-slate-700 hover:border-[#c5a059] hover:text-[#c5a059] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronRight size={14} /> قبلی
              </button>
              <span className="text-xs font-black px-2">
                صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={loading || page >= totalPages}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black border border-gray-200 dark:border-slate-700 hover:border-[#c5a059] hover:text-[#c5a059] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                بعدی <ChevronLeft size={14} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}