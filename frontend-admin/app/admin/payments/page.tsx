'use client';
// frontend-admin/app/admin/payments/page.tsx

import toast from 'react-hot-toast';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/app/lib/api';
import {
  ArrowRight, Wallet, Search, Clock, CheckCircle2, XCircle, ChevronRight, ChevronLeft,
  Image as ImageIcon, X, RefreshCw, ExternalLink, Bot
} from 'lucide-react';

type TransactionStatus = 'pending' | 'success' | 'rejected';

type Transaction = {
  id: number;
  user_id: string;
  user_name: string;
  phone_number: string | null;
  wallet_code: number;
  amount: number;
  status: TransactionStatus;
  has_receipt: boolean;
  created_at: string | null;
  processed_at: string | null;
  processed_by_bale_id: number | null;
};

type StatusCounts = Record<TransactionStatus, number>;

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_META: Record<TransactionStatus, { label: string; icon: React.ElementType; badge: string; tabActive: string }> = {
  pending: {
    label: 'در حال بررسی',
    icon: Clock,
    badge: 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    tabActive: 'border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-500/10',
  },
  success: {
    label: 'تایید شده',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    tabActive: 'border-emerald-400 text-emerald-600 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-500/10',
  },
  rejected: {
    label: 'رد شده',
    icon: XCircle,
    badge: 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    tabActive: 'border-rose-400 text-rose-600 dark:text-rose-400 bg-rose-50/60 dark:bg-rose-500/10',
  },
};

const STATUS_ORDER: TransactionStatus[] = ['pending', 'success', 'rejected'];

const toPersianDigits = (value: string | number) =>
  String(value).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

const formatAmount = (amount: number) => `${amount.toLocaleString('fa-IR')} ریال`;

const formatDateTime = (iso: string | null) => {
  if (!iso) return '---';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '---';
  return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

function StatusBadge({ status }: { status: TransactionStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 w-max text-[10px] font-black px-2.5 py-1 rounded-lg border ${meta.badge}`}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState<TransactionStatus>('pending');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [counts, setCounts] = useState<StatusCounts>({ pending: 0, success: 0, rejected: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const latestRequestRef = useRef(0);

  const [receiptTx, setReceiptTx] = useState<Transaction | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const receiptRequestRef = useRef(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const pageStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, totalCount);

  const fetchTransactions = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: activeStatus,
        skip: String((page - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE),
        t: String(Date.now()),
      });
      if (searchTerm) params.set('search', searchTerm);
      const res = await api.get(`/admin/transactions?${params.toString()}`);
      if (requestId !== latestRequestRef.current) return;
      setTransactions(res.data?.items || []);
      setTotalCount(res.data?.total_count || 0);
      setCounts(res.data?.status_counts || { pending: 0, success: 0, rejected: 0 });
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
  }, [activeStatus, page, searchTerm]);

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

  useEffect(() => {
    return () => {
      if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    };
  }, [receiptUrl]);

  const changeStatus = (status: TransactionStatus) => {
    if (status === activeStatus) return;
    setActiveStatus(status);
    setPage(1);
  };

  const goToPage = (target: number) => {
    const next = Math.min(Math.max(1, target), totalPages);
    if (next === page) return;
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openReceipt = async (tx: Transaction) => {
    const requestId = ++receiptRequestRef.current;
    setReceiptTx(tx);
    setReceiptUrl(null);
    setReceiptError(null);
    setReceiptLoading(true);
    try {
      const res = await api.get(`/admin/transactions/${tx.id}/receipt`, { responseType: 'blob' });
      if (requestId !== receiptRequestRef.current) return;
      setReceiptUrl(URL.createObjectURL(res.data));
    } catch (error: any) {
      if (requestId !== receiptRequestRef.current) return;
      setReceiptError(
        error.response?.status === 404
          ? 'تصویر این رسید در دسترس نیست.'
          : 'خطا در دریافت تصویر رسید.'
      );
    } finally {
      if (requestId === receiptRequestRef.current) setReceiptLoading(false);
    }
  };

  const closeReceipt = () => {
    receiptRequestRef.current++;
    setReceiptLoading(false);
    setReceiptTx(null);
    setReceiptUrl(null);
    setReceiptError(null);
  };

  const emptyMessage = searchTerm
    ? 'هیچ پرداختی با این جستجو یافت نشد.'
    : `هیچ پرداختی در وضعیت «${STATUS_META[activeStatus].label}» وجود ندارد.`;

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
              <Wallet className="text-[#c5a059]" /> وضعیت پرداخت‌ها
            </h1>
            <p className="text-gray-400 dark:text-slate-400 text-sm font-bold mt-1 flex items-center gap-1.5">
              <Bot size={14} /> رسیدهای ارسالی از ربات بله؛ تایید و رد از داخل ربات انجام می‌شود
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="جستجوی نام، موبایل، شناسه کیف پول یا شماره پیگیری..."
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {STATUS_ORDER.map((status) => {
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            const isActive = status === activeStatus;
            return (
              <button
                key={status}
                type="button"
                onClick={() => changeStatus(status)}
                className={`flex items-center justify-between p-4 rounded-2xl border-2 font-black text-sm transition-all ${
                  isActive
                    ? meta.tabActive
                    : 'border-transparent bg-white dark:bg-[#182234] text-gray-500 dark:text-slate-400 shadow-sm hover:border-gray-200 dark:hover:border-slate-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon size={18} /> {meta.label}
                </span>
                <span className={`min-w-[2rem] px-2 py-0.5 rounded-lg text-xs ${isActive ? 'bg-white/70 dark:bg-slate-900/40' : 'bg-gray-100 dark:bg-slate-800'}`}>
                  {toPersianDigits(counts[status] ?? 0)}
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
                  <th className="pb-4 font-black">شماره پیگیری</th>
                  <th className="pb-4 font-black">نام کاربر</th>
                  <th className="pb-4 font-black">شماره تماس</th>
                  <th className="pb-4 font-black">شناسه کیف پول</th>
                  <th className="pb-4 font-black">مبلغ</th>
                  <th className="pb-4 font-black">وضعیت</th>
                  <th className="pb-4 font-black">تاریخ ثبت</th>
                  <th className="pb-4 font-black text-center">رسید</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60 text-sm">
                {loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400 dark:text-slate-400 font-bold">در حال بارگذاری پرداخت‌ها...</td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400 dark:text-slate-400 font-bold">{emptyMessage}</td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className={`transition-colors hover:bg-[#faf9f6] dark:hover:bg-slate-800/40 ${loading ? 'opacity-60' : ''}`}>
                      <td className="py-4 font-black text-gray-400 dark:text-slate-400">#{toPersianDigits(tx.id)}</td>
                      <td className="py-4 font-bold">{tx.user_name}</td>
                      <td className="py-4 font-bold text-gray-500 dark:text-slate-400 font-mono tracking-wider" dir="ltr">{tx.phone_number || '---'}</td>
                      <td className="py-4 font-mono text-gray-500 dark:text-slate-400">{tx.wallet_code}</td>
                      <td className="py-4 font-black text-[#c5a059]">{formatAmount(tx.amount)}</td>
                      <td className="py-4">
                        <StatusBadge status={tx.status} />
                        {tx.processed_at && (
                          <span className="block text-[10px] text-gray-400 dark:text-slate-500 font-bold mt-1">
                            {formatDateTime(tx.processed_at)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-xs font-bold text-gray-500 dark:text-slate-400">{formatDateTime(tx.created_at)}</td>
                      <td className="py-4 text-center">
                        <button
                          type="button"
                          onClick={() => openReceipt(tx)}
                          disabled={!tx.has_receipt}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black border border-gray-200 dark:border-slate-700 hover:border-[#c5a059] hover:text-[#c5a059] transition-all disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <ImageIcon size={14} /> مشاهده
                        </button>
                      </td>
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
            <p className="text-center py-10 text-gray-400 font-bold text-sm">در حال بارگذاری پرداخت‌ها...</p>
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
                  <span className="font-black text-[#c5a059]">{formatAmount(tx.amount)}</span>
                  <span className="text-gray-400 font-bold">#{toPersianDigits(tx.id)} • کیف پول {tx.wallet_code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 font-bold">{formatDateTime(tx.created_at)}</span>
                  <button
                    type="button"
                    onClick={() => openReceipt(tx)}
                    disabled={!tx.has_receipt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black border border-gray-200 dark:border-slate-700 hover:border-[#c5a059] hover:text-[#c5a059] transition-all disabled:opacity-40"
                  >
                    <ImageIcon size={13} /> مشاهده رسید
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#182234] rounded-2xl px-5 py-3 shadow-sm border border-gray-100 dark:border-slate-800">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400">
              نمایش {toPersianDigits(pageStart)} تا {toPersianDigits(pageEnd)} از {toPersianDigits(totalCount)} پرداخت
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

      {/* مودال نمایش رسید */}
      {receiptTx && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in duration-200"
          onClick={closeReceipt}
        >
          <div
            className="bg-white dark:bg-[#182234] rounded-[2rem] w-full max-w-2xl shadow-2xl border border-gray-100 dark:border-slate-800 max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-black text-base truncate">رسید پرداخت #{toPersianDigits(receiptTx.id)} — {receiptTx.user_name}</h3>
                <p className="text-[11px] text-gray-400 font-bold mt-0.5">
                  {formatAmount(receiptTx.amount)} • {formatDateTime(receiptTx.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={receiptTx.status} />
                {receiptUrl && (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-full text-gray-400 hover:text-[#c5a059] hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                    title="باز کردن در تب جدید"
                  >
                    <ExternalLink size={18} />
                  </a>
                )}
                <button
                  type="button"
                  onClick={closeReceipt}
                  className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-gray-50 dark:bg-[#0b0f19] flex items-center justify-center min-h-[320px] p-4">
              {receiptLoading ? (
                <div className="flex flex-col items-center gap-3 text-gray-400 font-bold text-sm">
                  <span className="w-8 h-8 border-4 border-[#c5a059] border-t-transparent rounded-full animate-spin" />
                  در حال دریافت تصویر رسید...
                </div>
              ) : receiptError ? (
                <div className="flex flex-col items-center gap-2 text-gray-400 font-bold text-sm">
                  <ImageIcon size={36} className="text-gray-300 dark:text-slate-700" />
                  {receiptError}
                </div>
              ) : receiptUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={receiptUrl} alt={`رسید پرداخت ${receiptTx.id}`} className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-md" />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
