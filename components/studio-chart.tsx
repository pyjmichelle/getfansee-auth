"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface StudioChartProps {
  data: Array<{ date: string; revenue: number; subscribers: number }>;
}

export function StudioChart({ data }: StudioChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#C41E3A" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#C41E3A" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSubscribers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" />
        <XAxis dataKey="date" stroke="#999999" />
        <YAxis stroke="#999999" />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0D0D0D",
            border: "1px solid #1F1F1F",
            borderRadius: "12px",
            color: "#E5E5E5",
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#F48FB1"
          fillOpacity={1}
          fill="url(#colorRevenue)"
        />
        <Area
          type="monotone"
          dataKey="subscribers"
          stroke="#9C27B0"
          fillOpacity={1}
          fill="url(#colorSubscribers)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
