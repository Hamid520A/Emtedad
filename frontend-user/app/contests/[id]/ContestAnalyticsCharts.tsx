'use client';

import React from 'react';
import { Clock, BarChart3, MapPin, Users } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from 'recharts';

type ContestAnalyticsChartsProps = {
  analyticsData: {
    time_distribution?: any[];
    questions_stats?: any[];
    province_stats?: any[];
    gender_stats?: any[];
  };
  onQuestionClick?: (payload: any) => void;
  onProvinceClick?: (payload: any) => void;
};

export default function ContestAnalyticsCharts({
  analyticsData,
  onQuestionClick,
  onProvinceClick,
}: ContestAnalyticsChartsProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#182234] p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 pb-3">
          <Clock size={18} className="text-[#c5a059]" />
          <h3 className="font-black text-sm text-[#1a2e44] dark:text-slate-100">آنالیز توزیع زمانی حضور شرکت‌کنندگان</h3>
        </div>
        <div className="w-full h-64 text-xs font-bold font-sans">
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={analyticsData.time_distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTimeTheme" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c5a059" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#c5a059" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#faf9f6" />
              <XAxis dataKey="name" stroke="#9ca3af" tickLine={false} />
              <YAxis stroke="#9ca3af" tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a2e44',
                  color: '#fff',
                  borderRadius: '16px',
                  border: 'none',
                  textAlign: 'right',
                  fontSize: '11px',
                  fontFamily: 'sans-serif',
                }}
              />
              <Area
                type="monotone"
                dataKey="users"
                name="تعداد شرکت‌کننده"
                stroke="#1a2e44"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorTimeTheme)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-[#182234] p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 pb-3">
          <BarChart3 size={18} className="text-[#c5a059]" />
          <h3 className="font-black text-sm text-[#1a2e44] dark:text-slate-100">پاسخ‌های صحیح و اشتباه به تفکیک سوالات</h3>
        </div>
        <div className="w-full h-72 text-xs font-bold font-sans cursor-pointer">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analyticsData.questions_stats} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#faf9f6" />
              <XAxis dataKey="question_index" stroke="#9ca3af" tickLine={false} />
              <YAxis stroke="#9ca3af" tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1a2e44',
                  color: '#fff',
                  borderRadius: '16px',
                  border: 'none',
                  textAlign: 'right',
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Bar
                dataKey="correct"
                name="پاسخ صحیح"
                fill="#0f766e"
                radius={[4, 4, 0, 0]}
                barSize={9}
                onClick={(item) => {
                  if (item?.payload && onQuestionClick) onQuestionClick(item.payload);
                }}
              />
              <Bar
                dataKey="incorrect"
                name="پاسخ اشتباه"
                fill="#be123c"
                radius={[4, 4, 0, 0]}
                barSize={9}
                onClick={(item) => {
                  if (item?.payload && onQuestionClick) onQuestionClick(item.payload);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-[#182234] p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 pb-3">
          <MapPin size={18} className="text-[#c5a059]" />
          <h3 className="font-black text-sm text-[#1a2e44] dark:text-slate-100">پراکندگی جغرافیایی شرکت‌کنندگان (استان‌ها)</h3>
        </div>
        <div className="w-full h-72 text-xs font-bold font-sans cursor-pointer">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analyticsData.province_stats || []} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#faf9f6" />
              <XAxis dataKey="province" stroke="#9ca3af" tickLine={false} />
              <YAxis stroke="#9ca3af" tickLine={false} />
              <Tooltip
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{
                  backgroundColor: '#1a2e44',
                  color: '#fff',
                  borderRadius: '16px',
                  border: 'none',
                  textAlign: 'right',
                }}
              />
              <Bar
                dataKey="count"
                name="تعداد شرکت‌کننده"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                barSize={12}
                onClick={(item) => {
                  if (item?.payload && onProvinceClick) onProvinceClick(item.payload);
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-[#182234] p-5 sm:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-slate-800 space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 pb-3">
          <Users size={18} className="text-[#c5a059]" />
          <h3 className="font-black text-sm text-[#1a2e44] dark:text-slate-100">تفکیک جنسیت شرکت‌کنندگان</h3>
        </div>
        <div className="w-full h-72 text-xs font-bold font-sans">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analyticsData.gender_stats || []} margin={{ top: 10, right: 5, left: -25, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#faf9f6" />
              <XAxis dataKey="gender" stroke="#9ca3af" tickLine={false} />
              <YAxis stroke="#9ca3af" tickLine={false} />
              <Tooltip
                cursor={{ fill: '#f3f4f6' }}
                contentStyle={{
                  backgroundColor: '#1a2e44',
                  color: '#fff',
                  borderRadius: '16px',
                  border: 'none',
                  textAlign: 'right',
                }}
              />
              <Bar dataKey="count" name="تعداد شرکت‌کننده" radius={[4, 4, 0, 0]} barSize={40}>
                {(analyticsData.gender_stats || [])
                  .filter((e: any) => e.gender === 'مرد' || e.gender === 'زن')
                  .map((e: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={e.gender === 'مرد' ? '#3b82f6' : '#ec4899'} />
                  ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
