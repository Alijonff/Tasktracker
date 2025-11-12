import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createAuctionTask, type Grade } from "@/api/adapter";
import { formatMoney } from "@/lib/formatters";

interface FormState {
  title: string;
  description: string;
  minimumGrade: Grade;
  startingPrice: string;
  deadline: string;
}

const DEFAULT_FORM: FormState = {
  title: "",
  description: "",
  minimumGrade: "D",
  startingPrice: "1500000",
  deadline: "",
};

export default function CreateTask() {
  const [formData, setFormData] = useState<FormState>(DEFAULT_FORM);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () =>
      createAuctionTask({
        title: formData.title.trim(),
        description: formData.description.trim(),
        minimumGrade: formData.minimumGrade,
        startingPrice: Number(formData.startingPrice),
        deadline: new Date(formData.deadline).toISOString(),
      }),
    onSuccess: (task) => {
      toast({ title: "Аукцион создан", description: `Добавлена задача «${task.title}»` });
      setFormData(DEFAULT_FORM);
    },
    onError: () => {
      toast({
        title: "Не удалось создать аукцион",
        description: "Попробуйте ещё раз позже",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.deadline) {
      toast({
        title: "Укажите дедлайн",
        description: "Нужны дата и время окончания торгов",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  };

  const previewPrice = Number(formData.startingPrice) || 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-md bg-primary/10">
          <PlusCircle className="text-primary" size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Создать аукцион</h1>
          <p className="text-muted-foreground">Задача автоматически будет доступна всему департаменту</p>
        </div>
      </div>

      <Card data-testid="card-create-task-form">
        <CardHeader>
          <CardTitle>Детали аукциона</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Название задачи *</Label>
                <Input
                  id="title"
                  placeholder="Введите название задачи..."
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  required
                  data-testid="input-task-title"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание *</Label>
                <Textarea
                  id="description"
                  placeholder="Опишите задачу подробно..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  required
                  rows={6}
                  data-testid="textarea-task-description"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="minimumGrade">Минимальный грейд</Label>
                  <Select
                    value={formData.minimumGrade}
                    onValueChange={(value: Grade) => setFormData((prev) => ({ ...prev, minimumGrade: value }))}
                  >
                    <SelectTrigger id="minimumGrade" data-testid="select-minimum-grade">
                      <SelectValue placeholder="Выберите минимальный грейд" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="D">Грейд D (до 44 баллов)</SelectItem>
                      <SelectItem value="C">Грейд C (45–64 балла)</SelectItem>
                      <SelectItem value="B">Грейд B (65–84 балла)</SelectItem>
                      <SelectItem value="A">Грейд A (85+ баллов)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Ставку смогут сделать сотрудники с указанным или более высоким грейдом
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="startingPrice">Начальная ставка (сум)</Label>
                  <Input
                    id="startingPrice"
                    type="number"
                    min="1"
                    step="1000"
                    value={formData.startingPrice}
                    onChange={(e) => setFormData((prev) => ({ ...prev, startingPrice: e.target.value }))}
                    required
                    data-testid="input-starting-price"
                  />
                  <p className="text-xs text-muted-foreground">Будет отображаться в карточке аукциона</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Дедлайн *</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={formData.deadline}
                  onChange={(e) => setFormData((prev) => ({ ...prev, deadline: e.target.value }))}
                  required
                  data-testid="input-deadline"
                />
              </div>
            </div>

            <div className="rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Предпросмотр ставки</span>
                <span className="font-semibold text-foreground">{formatMoney(previewPrice)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={mutation.isPending} data-testid="button-create-task">
                <PlusCircle size={18} />
                {mutation.isPending ? "Создание..." : "Создать аукцион"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormData(DEFAULT_FORM)}
                data-testid="button-cancel"
              >
                Очистить
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
