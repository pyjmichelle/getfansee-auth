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
        {/* Revenue = wine, subscribers = premium gold — matches the brand
            palette instead of the previous ad-hoc pink/purple/crimson mix
            (whose gradient fill didn't even match its own line stroke). */}
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--wine)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--wine)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorSubscribers" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--premium)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--premium)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis dataKey="date" stroke="var(--text-muted)" />
        <YAxis stroke="var(--text-muted)" />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--bg-raised)",
            border: "1px solid var(--border-default)",
            borderRadius: "12px",
            color: "var(--text-primary)",
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--wine-hover)"
          fillOpacity={1}
          fill="url(#colorRevenue)"
        />
        <Area
          type="monotone"
          dataKey="subscribers"
          stroke="var(--premium)"
          fillOpacity={1}
          fill="url(#colorSubscribers)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
