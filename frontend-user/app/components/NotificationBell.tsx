'use client';
// frontend-user/app/components/NotificationBell.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import api from '../../lib/api';

type UserNotification = {
  id: number;
  title: string;
  content: string;
  is_viewed: boolean;
  created_at: string | null;
};

const formatDate = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return '';
  }
};

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Items that were unread when the popup opened stay highlighted until it closes,
  // even though they are marked read (and the badge cleared) immediately.
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const pendingReadsRef = useRef<Set<number>>(new Set());

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.get<UserNotification[]>('/users/me/notifications');
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.warn('Notifications could not be loaded.', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = useCallback((ids: number[]) => {
    const toSend = ids.filter((id) => !pendingReadsRef.current.has(id));
    if (toSend.length === 0) return;
    toSend.forEach((id) => pendingReadsRef.current.add(id));

    const sending = new Set(toSend);
    setNotifications((prev) => prev.map((n) => (sending.has(n.id) ? { ...n, is_viewed: true } : n)));

    toSend.forEach(async (id) => {
      try {
        await api.patch(`/users/me/notifications/${id}/read`);
      } catch (error) {
        console.warn(`Marking notification ${id} as read failed.`, error);
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_viewed: false } : n)));
      } finally {
        pendingReadsRef.current.delete(id);
      }
    });
  }, []);

  const openPopup = () => {
    const unreadIds = notifications.filter((n) => !n.is_viewed).map((n) => n.id);
    setFreshIds(new Set(unreadIds));
    setIsOpen(true);
    markAsRead(unreadIds);
  };

  const closePopup = () => {
    setIsOpen(false);
    setFreshIds(new Set());
    setExpandedId(null);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePopup();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const handleItemClick = (notif: UserNotification) => {
    if (!notif.is_viewed) markAsRead([notif.id]);
    setExpandedId((current) => (current === notif.id ? null : notif.id));
  };

  const hasUnread = notifications.some((n) => !n.is_viewed);
  const freshCount = freshIds.size;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => (isOpen ? closePopup() : openPopup())}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={hasUnread ? 'اعلان‌ها (اعلان خوانده‌نشده دارید)' : 'اعلان‌ها'}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center shadow-sm border transition-all hover:scale-105 active:scale-95 ${
          isOpen
            ? 'bg-[#1a2e44] text-white border-[#1a2e44] dark:bg-[#c5a059] dark:text-[#1a2e44] dark:border-[#c5a059]'
            : 'bg-white text-[#1a2e44] border-gray-100 dark:bg-[#182234] dark:text-slate-100 dark:border-slate-800'
        }`}
        title="اعلان‌ها"
      >
        <Bell size={20} />
        {hasUnread && (
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-[#c5a059] rounded-full border-2 border-white dark:border-slate-900" />
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={closePopup} />
          <div className="absolute top-full left-0 mt-3 w-[min(20rem,calc(100vw-3rem))] bg-white dark:bg-[#182234] rounded-3xl shadow-xl border border-gray-100 dark:border-slate-800 z-50 p-5 origin-top-left">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50 dark:border-slate-800">
              <h3 className="text-sm font-black text-[#1a2e44] dark:text-slate-100">اعلان‌های شما</h3>
              {freshCount > 0 && (
                <span className="bg-red-50 dark:bg-red-950/40 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {freshCount.toLocaleString('fa-IR')} جدید
                </span>
              )}
            </div>

            {loading && notifications.length === 0 ? (
              <div className="py-8 flex justify-center">
                <Loader2 size={20} className="animate-spin text-[#1a2e44] dark:text-[#c5a059]" />
              </div>
            ) : loadError && notifications.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-xs text-gray-400 dark:text-slate-400 font-bold">دریافت اعلان‌ها با خطا مواجه شد.</p>
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="text-xs font-black text-[#c5a059] hover:underline"
                >
                  تلاش مجدد
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-gray-50 dark:bg-[#233044] rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell size={20} className="text-gray-300 dark:text-slate-500" />
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-400 font-bold">هیچ اعلانی ندارید.</p>
              </div>
            ) : (
              <ul className="space-y-3 max-h-80 overflow-y-auto no-scrollbar">
                {notifications.map((notif) => {
                  const highlighted = !notif.is_viewed || freshIds.has(notif.id);
                  const expanded = expandedId === notif.id;
                  return (
                    <li key={notif.id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(notif)}
                        className={`w-full text-right p-3 rounded-2xl border transition-colors ${
                          highlighted
                            ? 'bg-amber-50/70 border-amber-100 dark:bg-[#c5a059]/10 dark:border-[#c5a059]/30'
                            : 'bg-gray-50 border-gray-100 dark:bg-[#233044] dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {highlighted && <span className="mt-1.5 w-2 h-2 shrink-0 rounded-full bg-[#c5a059]" />}
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs leading-relaxed text-[#1a2e44] dark:text-slate-100 ${highlighted ? 'font-black' : 'font-bold'}`}>
                              {notif.title}
                            </p>
                            <p className={`mt-1 text-[11px] leading-relaxed text-gray-600 dark:text-slate-300 font-medium whitespace-pre-line ${expanded ? '' : 'line-clamp-3'}`}>
                              {notif.content}
                            </p>
                            {notif.created_at && (
                              <p className="mt-2 text-[10px] font-bold text-gray-400 dark:text-slate-500">{formatDate(notif.created_at)}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
