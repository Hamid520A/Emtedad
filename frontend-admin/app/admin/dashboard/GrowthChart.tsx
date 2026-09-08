'use client';

import React from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

type GrowthChartProps = {
  chartData: any[];
  formatXAxis: (tickItem: any) => string;
  formatTooltipLabel: (label: any) => string;
};

export default function GrowthChart({
  chartData,
  formatXAxis,
  formatTooltipLabel,
}: GrowthChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#c5a059" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#c5a059" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tickFormatter={formatXAxis}
            tick={{ fontSize: 11, fontWeight: 'bold', fill: '#9ca3af' }}
            dy={10}
          />
          <YAxis hide />

          <Tooltip
            labelFormatter={formatTooltipLabel}
            contentStyle={{
              borderRadius: '20px',
              border: 'none',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              fontFamily: 'inherit',
              direction: 'rtl',
            }}
          />

          <Area
            type="monotone"
            dataKey="users"
            name="شرکت‌کنندگان"
            stroke="#c5a059"
            strokeWidth={4}
            fillOpacity={1}
            fill="url(#colorUsers)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
