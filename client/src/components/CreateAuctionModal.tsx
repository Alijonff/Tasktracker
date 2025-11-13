import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createAuctionTask, type CreateAuctionTaskPayload, type Grade } from "@/api/adapter";
import type { Department, SelectUser } from "@shared/schema";

interface CreateAuctionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormState {
  title: string;
  description: string;
  minimumGrade: Grade;
  startingPrice: string;
  deadlineDate: string;
  departmentId?: string;
}

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialFormState(): FormState {
  const defaultDeadline = new Date();
  defaultDeadline.setDate(defaultDeadline.getDate() + 3);
  return {
    title: "",
    description: "",
    minimumGrade: "D",
    startingPrice: "",
    deadlineDate: formatDateOnly(defaultDeadline),
    departmentId: undefined,
  };
}

function composeDeadline(dateValue: string): Date | null {
  if (!dateValue) return null;
  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  const deadline = new Date();
  deadline.setFullYear(year, month - 1, day);
  deadline.setHours(19, 0, 0, 0);
  if (Number.isNaN(deadline.getTime())) {
    return null;
  }
  return deadline;
}

function parseApiError(error: unknown): { status?: number; message?: string } {
  if (!error || typeof error !== "object" || !("message" in error)) {
    return {};
  }

  const rawMessage = String((error as { message?: string }).message ?? "");
  const [statusPart, ...rest] = rawMessage.split(":");
  const status = Number(statusPart.trim());
  const restMessage = rest.join(":").trim();

  if (!restMessage) {
    return { status: Number.isFinite(status) ? status : undefined };
  }

  let parsedMessage: string | undefined;
  try {
    const parsed = JSON.parse(restMessage);
    if (parsed && typeof parsed.error === "string") {
      parsedMessage = parsed.error;
    } else {
      parsedMessage = restMessage;
    }
  } catch {
    parsedMessage = restMessage;
  }

  return {
    status: Number.isFinite(status) ? status : undefined,
    message: parsedMessage,
  };
}

const gradeOptions: Array<{ value: Grade; label: string }> = [
  { value: "D", label: "Грейд D (до 44 баллов)" },
  { value: "C", label: "Грейд C (45–64 балла)" },
  { value: "B", label: "Грейд B (65–84 балла)" },
  { value: "A", label: "Грейд A (85+ баллов)" },
];

export default function CreateAuctionModal({ open, onOpenChange }: CreateAuctionModalProps) {
  const [formState, setFormState] = useState<FormState>(() => createInitialFormState());
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { data: authResponse } = useQuery<{ user: SelectUser | null }>({ queryKey: ["/api/auth/me"] });
  const currentUser = authResponse?.user;
  const isDirector = currentUser?.role === "director";
  const shouldLoadDepartments = open && isDirector;
  const { data: departments } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
    enabled: shouldLoadDepartments,
  });

  const directorDepartments = useMemo(() => {
    if (!currentUser) return [] as Department[];
    return (departments ?? []).filter((department) => department.leaderId === currentUser.id);
  }, [currentUser, departments]);

  useEffect(() => {
    if (!open) {
      setFormState(createInitialFormState());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (directorDepartments.length === 1 && !formState.departmentId) {
      setFormState((prev) => ({ ...prev, departmentId: directorDepartments[0].id }));
    }
  }, [open, directorDepartments, formState.departmentId]);

  const minDate = useMemo(() => formatDateOnly(new Date()), []);

  const mutation = useMutation({
    mutationFn: (payload: CreateAuctionTaskPayload) => createAuctionTask(payload),
    onSuccess: () => {
      toast({ title: "Аукцион создан" });
      queryClient.invalidateQueries({ queryKey: ["auctions"], exact: false });
      setFormState(createInitialFormState());
      onOpenChange(false);
      setLocation("/auctions");
    },
    onError: (error: unknown) => {
      const { status, message } = parseApiError(error);
      if (status === 403) {
        toast({
          title: message ?? "У вас нет прав создавать аукционы в этом департаменте",
          variant: "destructive",
        });
        return;
      }

      if (status === 400 || status === 422) {
        toast({
          title: "Ошибка при создании",
          description: message ?? "Проверьте введённые данные",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Не удалось создать аукцион, попробуйте позже",
        variant: "destructive",
      });
    },
  });

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormState(createInitialFormState());
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = formState.title.trim();
    const trimmedDescription = formState.description.trim();
    const amount = Number(formState.startingPrice);
    const deadline = composeDeadline(formState.deadlineDate);

    if (directorDepartments.length > 1 && !formState.departmentId) {
      toast({ title: "Выберите департамент", variant: "destructive" });
      return;
    }

    if (!trimmedTitle) {
      toast({ title: "Введите название", variant: "destructive" });
      return;
    }

    if (!trimmedDescription) {
      toast({ title: "Опишите задачу", variant: "destructive" });
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Укажите корректную начальную сумму", variant: "destructive" });
      return;
    }

    if (!deadline || deadline <= new Date()) {
      toast({ title: "Выберите корректный дедлайн", variant: "destructive" });
      return;
    }

    mutation.mutate({
      title: trimmedTitle,
      description: trimmedDescription,
      minimumGrade: formState.minimumGrade,
      startingPrice: amount,
      deadline: deadline.toISOString(),
      departmentId: formState.departmentId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl" data-testid="dialog-create-auction">
        <DialogHeader>
          <DialogTitle>Создать новый аукцион</DialogTitle>
        </DialogHeader>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="auction-title">Название задачи *</Label>
              <Input
                id="auction-title"
                value={formState.title}
                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Например, провести аудит инфраструктуры"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auction-description">Описание *</Label>
              <Textarea
                id="auction-description"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Опишите задачу подробно"
                required
                rows={5}
              />
            </div>

            {directorDepartments.length > 1 && (
              <div className="space-y-2">
                <Label htmlFor="auction-department">Департамент *</Label>
                <Select
                  value={formState.departmentId ?? ""}
                  onValueChange={(value) => setFormState((prev) => ({ ...prev, departmentId: value }))}
                  disabled={mutation.isPending}
                >
                  <SelectTrigger id="auction-department">
                    <SelectValue placeholder="Выберите департамент" />
                  </SelectTrigger>
                  <SelectContent>
                    {directorDepartments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Выберите департамент, от имени которого создаёте аукцион</p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="auction-minimum-grade">Минимальный грейд</Label>
                <Select
                  value={formState.minimumGrade}
                  onValueChange={(value: Grade) => setFormState((prev) => ({ ...prev, minimumGrade: value }))}
                >
                  <SelectTrigger id="auction-minimum-grade">
                    <SelectValue placeholder="Выберите минимальный грейд" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  К аукциону будут допущены сотрудники с указанным или более высоким грейдом
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="auction-starting-price">Начальная сумма (сум)</Label>
                <Input
                  id="auction-starting-price"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={formState.startingPrice}
                  onChange={(event) => setFormState((prev) => ({ ...prev, startingPrice: event.target.value }))}
                  placeholder="0"
                  required
                />
                <p className="text-xs text-muted-foreground">Укажите сумму, с которой начнутся торги</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auction-deadline">Дедлайн аукциона</Label>
              <Input
                id="auction-deadline"
                type="date"
                value={formState.deadlineDate}
                min={minDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, deadlineDate: event.target.value }))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Торги завершатся в выбранный день в 19:00 по вашей локальной таймзоне
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => handleDialogChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={mutation.isPending} data-testid="button-create-auction">
              {mutation.isPending ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
