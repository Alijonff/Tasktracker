import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GradeBadge from "@/components/GradeBadge";
import { getMyPoints, getMyPointsHistory, type PointsOverview } from "@/api/adapter";
import type { PointTransaction } from "@shared/schema";
import { formatDateTime } from "@/lib/formatters";
import { Award, Calendar, ArrowUp, ArrowDown } from "lucide-react";

const ITEMS_PER_PAGE = 10;

const typeLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  task_completion: { label: "Выполнение задачи", variant: "default" },
  overdue_penalty: { label: "Штраф", variant: "destructive" },
  position_assigned: { label: "Назначение", variant: "secondary" },
};

export default function PointHistory() {
  const [currentPage, setCurrentPage] = useState(1);

  const { data: overview } = useQuery<PointsOverview>({
    queryKey: ["points", "overview"],
    queryFn: getMyPoints,
  });

  const { data: history = [], isLoading } = useQuery<PointTransaction[]>({
    queryKey: ["points", "history"],
    queryFn: getMyPointsHistory,
  });

  const totalPages = Math.max(1, Math.ceil(history.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedHistory = useMemo(
    () => history.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [history, currentPage],
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">Мои баллы</h1>
        <p className="text-muted-foreground">Просматривайте историю начислений и свой грейд</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Текущий баланс
            </CardTitle>
            <CardDescription>Баллы и грейд</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold" data-testid="text-current-points">
                  {overview?.points ?? 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">баллов</p>
              </div>
              <GradeBadge grade={overview?.grade ?? "D"} className="text-lg px-4 py-2" data-testid="badge-current-grade" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Прогресс
            </CardTitle>
            <CardDescription>До следующего грейда</CardDescription>
          </CardHeader>
          <CardContent>
            {overview?.pointsToNext !== undefined ? (
              <div>
                <p className="text-sm text-muted-foreground">Осталось</p>
                <p className="text-2xl font-bold" data-testid="text-points-to-next">
                  {overview.pointsToNext} баллов
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Вы на максимальном грейде. Сохраняйте результат!</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>История транзакций</CardTitle>
          <CardDescription>Последние начисления и списания</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">Загрузка...</div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Award className="h-12 w-12 mb-4" />
              Нет данных
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead className="text-right">Баллы</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedHistory.map((transaction) => {
                    const typeConfig = typeLabels[transaction.type] ?? typeLabels.task_completion;
                    const delta = transaction.amount ?? 0;
                    return (
                      <TableRow key={transaction.id} data-testid={`row-transaction-${transaction.id}`}>
                        <TableCell data-testid={`cell-date-${transaction.id}`}>
                          {transaction.createdAt ? formatDateTime(transaction.createdAt) : "—"}
                        </TableCell>
                        <TableCell data-testid={`cell-type-${transaction.id}`}>
                          <Badge variant={typeConfig.variant}>{typeConfig.label}</Badge>
                        </TableCell>
                        <TableCell data-testid={`cell-comment-${transaction.id}`}>
                          <div>
                            {transaction.taskTitle && <p className="font-medium text-sm">{transaction.taskTitle}</p>}
                            {transaction.comment && (
                              <p className="text-sm text-muted-foreground">{transaction.comment}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right" data-testid={`cell-points-${transaction.id}`}>
                          <span
                            className={`inline-flex items-center gap-1 font-mono ${delta >= 0 ? "text-foreground" : "text-status-overdue"}`}
                          >
                            {delta >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                            {delta > 0 ? `+${delta}` : delta}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Страница {currentPage} из {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    Назад
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Вперёд
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
