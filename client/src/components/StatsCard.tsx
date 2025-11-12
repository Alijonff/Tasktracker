import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
  isEmpty = false,
  emptyMessage = "Нет данных за период",
}: StatsCardProps) {
  const formattedValue = typeof value === "number" ? value.toLocaleString("ru-RU") : value;
  const valueClassName = isEmpty ? "text-muted-foreground" : "text-foreground";

  return (
    <Card data-testid={`card-stats-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p
              className={`text-3xl font-bold font-mono ${valueClassName}`}
              data-testid="text-stats-value"
            >
              {formattedValue}
            </p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            {isEmpty && (
              <p className="text-xs text-muted-foreground" data-testid="text-stats-empty">
                {emptyMessage}
              </p>
            )}
            {!isEmpty && trend && (
              <div className={`text-sm font-medium ${trend.isPositive ? 'text-status-completed' : 'text-status-overdue'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}% from last month
              </div>
            )}
          </div>
          <div className="p-3 rounded-md bg-primary/10">
            <Icon className="text-primary" size={24} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
