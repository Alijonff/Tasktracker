import { useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/StatsCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Wallet, Gavel, ListTodo, ArrowRight } from "lucide-react";
import { getDashboardMetrics, getMyPoints, getMyPointsHistory } from "@/api/adapter";
import { formatMoney, formatDateTime } from "@/lib/formatters";
import type { PointTransaction, SelectUser } from "@shared/schema";
import { calculateGrade } from "@shared/utils";

interface MetricsQueryResult {
  completedTasks: number;
  closedAuctionsAmount: number;
  activeAuctions: number;
  backlogTasks: number;
}

export const canCreateAuctionsForRole = (role?: SelectUser["role"] | null) => role === "director";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: userResponse } = useQuery<{ user: SelectUser | null }>({ queryKey: ["/api/auth/me"] });
  const currentUser = userResponse?.user;

  const { data: metrics, isLoading: metricsLoading } = useQuery<MetricsQueryResult>({
    queryKey: ["dashboard", "metrics"],
    queryFn: getDashboardMetrics,
  });

  const { data: points } = useQuery({
    queryKey: ["dashboard", "points"],
    queryFn: getMyPoints,
  });

  const { data: history = [] } = useQuery<PointTransaction[]>({
    queryKey: ["dashboard", "points-history"],
    queryFn: getMyPointsHistory,
  });

  const canCreateAuctions = canCreateAuctionsForRole(currentUser?.role);

  const dashboardCards = useMemo(() => {
    return [
      {
        title: "Выполненные задачи",
        icon: CheckCircle2,
        value: metrics?.completedTasks ?? 0,
        subtitle: "за текущий месяц",
      },
      {
        title: "Сумма закрытых аукционов",
        icon: Wallet,
        value: metrics ? formatMoney(metrics.closedAuctionsAmount) : formatMoney(0),
        subtitle: "за текущий месяц",
      },
      {
        title: "Активные аукционы",
        icon: Gavel,
        value: metrics?.activeAuctions ?? 0,
        subtitle: "в работе",
      },
      {
        title: "Задачи в бэклоге",
        icon: ListTodo,
        value: metrics?.backlogTasks ?? 0,
        subtitle: "ожидают запуска",
      },
    ];
  }, [metrics]);

  const topHistory = history.slice(0, 5);
  const grade = points?.grade ?? calculateGrade(points?.points ?? 0);
  const pointsToNext = points?.pointsToNext;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Панель управления</h1>
          <p className="text-muted-foreground">Актуальные показатели департамента</p>
        </div>
        {canCreateAuctions && (
          <Button onClick={() => setLocation("/create-task")} data-testid="button-create-task-header">
            Создать аукцион
            <ArrowRight size={18} />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardCards.map(({ title, icon, value, subtitle }) => (
          <StatsCard
            key={title}
            title={title}
            icon={icon}
            value={metricsLoading ? "—" : value}
            subtitle={subtitle}
            isEmpty={metricsLoading}
            emptyMessage="Загрузка..."
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Мои баллы</CardTitle>
            <CardDescription>Грейд и прогресс в аукционах</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold" data-testid="text-current-points">
                  {points?.points ?? 0}
                </p>
                <p className="text-sm text-muted-foreground">баллов</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Текущий грейд</span>
                <p className="text-2xl font-semibold">{grade}</p>
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-4">
              {pointsToNext !== undefined ? (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">До следующего грейда</p>
                  <p className="text-xl font-semibold">{pointsToNext} баллов</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Вы на максимальном грейде. Продолжайте удерживать показатели!</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История баллов</CardTitle>
            <CardDescription>Последние изменения</CardDescription>
          </CardHeader>
          <CardContent>
            {topHistory.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">
                Нет транзакций. Участвуйте в аукционах, чтобы заработать баллы.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead className="text-right">Баллы</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topHistory.map((item) => {
                    const delta = item.amount ?? 0;
                    return (
                    <TableRow key={item.id}>
                      <TableCell>{item.createdAt ? formatDateTime(item.createdAt) : "—"}</TableCell>
                      <TableCell>{item.type}</TableCell>
                      <TableCell className={`text-right ${delta >= 0 ? "text-foreground" : "text-status-overdue"}`}>
                        {delta > 0 ? `+${delta}` : delta}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
