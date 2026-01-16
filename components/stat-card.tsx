"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  description?: string;
  className?: string;
  valueClassName?: string;
}

/**
 * StatCard - 统一的统计卡片组件
 *
 * @param title - 卡片标题
 * @param value - 统计值
 * @param change - 变化信息（包含值和趋势方向）
 * @param icon - 图标（可选）
 * @param description - 描述文本（可选）
 *
 * @example
 * <StatCard
 *   title="Total Revenue"
 *   value="$1,234.56"
 *   change={{ value: 12.5, trend: "up" }}
 *   icon={<DollarSign className="w-4 h-4" />}
 * />
 */
export function StatCard({
  title,
  value,
  change,
  icon,
  description,
  className,
  valueClassName,
}: StatCardProps) {
  const getTrendIcon = () => {
    if (!change) return null;

    switch (change.trend) {
      case "up":
        return <TrendingUp className="w-4 h-4" aria-hidden="true" />;
      case "down":
        return <TrendingDown className="w-4 h-4" aria-hidden="true" />;
      default:
        return <Minus className="w-4 h-4" aria-hidden="true" />;
    }
  };

  const getTrendColor = () => {
    if (!change) return "";

    switch (change.trend) {
      case "up":
        return "text-green-600 dark:text-green-400";
      case "down":
        return "text-destructive";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card className={cn("rounded-xl border-border", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold text-foreground", valueClassName)}>{value}</div>
        {change && (
          <div className={cn("flex items-center gap-1 mt-1 text-xs", getTrendColor())}>
            {getTrendIcon()}
            <span>
              {change.trend === "up" ? "+" : change.trend === "down" ? "-" : ""}
              {Math.abs(change.value)}%
            </span>
            <span className="text-muted-foreground ml-1">vs last period</span>
          </div>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}
