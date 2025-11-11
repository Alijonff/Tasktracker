import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import GradeBadge from "@/components/GradeBadge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowUp, ArrowDown, Award, Calendar, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import type { SelectUser, PointTransaction } from "@shared/schema";
import { calculateGrade } from "@shared/utils";

const ITEMS_PER_PAGE = 10;

export default function PointHistory() {
  const [currentPage, setCurrentPage] = useState(1);
  const { data: response } = useQuery<{ user: SelectUser | null }>({
    queryKey: ["/api/auth/me"],
  });

  const user = response?.user;

  const { data: transactions = [], isLoading } = useQuery<PointTransaction[]>({
    queryKey: ["/api/users", user?.id, "point-history"],
    enabled: !!user?.id,
  });

  const totalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  const currentGrade = calculateGrade(user.points);

  const getTransactionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      task_completion: "Выполнение задачи",
      overdue_penalty: "Штраф за просрочку",
      position_assigned: "Назначение на должность",
    };
    return labels[type] || type;
  };

  const getTransactionTypeVariant = (type: string) => {
    if (type === "overdue_penalty") return "destructive";
    if (type === "task_completion") return "default";
    return "secondary";
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold">История баллов</h1>
        <p className="text-muted-foreground">Отслеживайте свои достижения и грейд</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card data-testid="card-current-balance">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Текущий баланс
            </CardTitle>
            <CardDescription>Ваши баллы и грейд</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-4xl font-bold" data-testid="text-current-points">
                  {user.points}
                </p>
                <p className="text-sm text-muted-foreground mt-1">баллов</p>
              </div>
              <div data-testid="badge-current-grade">
                <GradeBadge grade={currentGrade} className="text-lg px-4 py-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-grade-progress">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Прогресс
            </CardTitle>
            <CardDescription>До следующего грейда</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {currentGrade === "D" && (
                <div>
                  <p className="text-sm text-muted-foreground">До грейда C:</p>
                  <p className="text-2xl font-bold" data-testid="text-points-to-next">
                    {Math.max(0, 45 - user.points)} баллов
                  </p>
                </div>
              )}
              {currentGrade === "C" && (
                <div>
                  <p className="text-sm text-muted-foreground">До грейда B:</p>
                  <p className="text-2xl font-bold" data-testid="text-points-to-next">
                    {Math.max(0, 65 - user.points)} баллов
                  </p>
                </div>
              )}
              {currentGrade === "B" && (
                <div>
                  <p className="text-sm text-muted-foreground">До грейда A:</p>
                  <p className="text-2xl font-bold" data-testid="text-points-to-next">
                    {Math.max(0, 85 - user.points)} баллов
                  </p>
                </div>
              )}
              {currentGrade === "A" && (
                <div className="flex items-center gap-2">
                  <Trophy className="h-8 w-8 text-status-completed" />
                  <div>
                    <p className="text-sm text-muted-foreground">Высший грейд достигнут!</p>
                    <p className="text-2xl font-bold text-status-completed">Превосходно</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-transaction-history">
        <CardHeader>
          <CardTitle>История транзакций</CardTitle>
          <CardDescription>Все начисления и списания баллов</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Загрузка...</p>
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Award className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Пока нет транзакций</p>
              <p className="text-sm text-muted-foreground mt-1">
                Выполняйте задачи, чтобы заработать баллы
              </p>
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
                {transactions
                  .slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
                  .map((transaction) => (
                  <TableRow 
                    key={transaction.id}
                    data-testid={`row-transaction-${transaction.id}`}
                  >
                    <TableCell data-testid={`cell-date-${transaction.id}`}>
                      <span className="text-sm">
                        {transaction.createdAt && format(new Date(transaction.createdAt), "dd MMM yyyy, HH:mm", {
                          locale: ru,
                        })}
                      </span>
                    </TableCell>
                    <TableCell data-testid={`cell-type-${transaction.id}`}>
                      <Badge variant={getTransactionTypeVariant(transaction.type)}>
                        {getTransactionTypeLabel(transaction.type)}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`cell-comment-${transaction.id}`}>
                      <div>
                        {transaction.taskTitle && (
                          <p className="font-medium text-sm">{transaction.taskTitle}</p>
                        )}
                        {transaction.comment && (
                          <p className="text-sm text-muted-foreground">{transaction.comment}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell 
                      className="text-right"
                      data-testid={`cell-amount-${transaction.id}`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {transaction.amount > 0 ? (
                          <>
                            <ArrowUp className="h-4 w-4 text-green-500" />
                            <span className="font-semibold text-green-500">
                              +{transaction.amount}
                            </span>
                          </>
                        ) : (
                          <>
                            <ArrowDown className="h-4 w-4 text-red-500" />
                            <span className="font-semibold text-red-500">
                              {transaction.amount}
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              </Table>
              
              {transactions.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-sm text-muted-foreground">
                    Показано {Math.min(((currentPage - 1) * ITEMS_PER_PAGE) + 1, transactions.length)}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, transactions.length)} из {transactions.length}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Назад
                    </Button>
                    <span className="text-sm" data-testid="text-current-page">
                      Страница {currentPage} из {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      data-testid="button-next-page"
                    >
                      Вперёд
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
