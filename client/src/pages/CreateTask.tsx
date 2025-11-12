import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { PlusCircle } from "lucide-react";

export default function CreateTask() {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department: "",
    deadline: "",
    minimumGrade: "D",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Создание аукционной задачи:", formData);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-md bg-primary/10">
          <PlusCircle className="text-primary" size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Создать задачу</h1>
          <p className="text-muted-foreground">Создайте новую аукционную задачу для сотрудников</p>
        </div>
      </div>

      <Card data-testid="card-create-task-form">
        <CardHeader>
          <CardTitle>Детали задачи</CardTitle>
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
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={6}
                  data-testid="textarea-task-description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Подразделение *</Label>
                  <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                    <SelectTrigger id="department" data-testid="select-department">
                      <SelectValue placeholder="Выберите подразделение" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engineering">Инженерный отдел</SelectItem>
                      <SelectItem value="design">Отдел дизайна</SelectItem>
                      <SelectItem value="marketing">Отдел маркетинга</SelectItem>
                      <SelectItem value="sales">Отдел продаж</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">Дедлайн *</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={formData.deadline}
                    onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    required
                    data-testid="input-deadline"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="minimumGrade">Минимальный грейд</Label>
                <Select value={formData.minimumGrade} onValueChange={(v) => setFormData({ ...formData, minimumGrade: v })}>
                  <SelectTrigger id="minimumGrade" data-testid="select-minimum-grade">
                    <SelectValue placeholder="Выберите минимальный грейд" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="D">Грейд D - Все сотрудники</SelectItem>
                    <SelectItem value="C">Грейд C (≥45 баллов)</SelectItem>
                    <SelectItem value="B">Грейд B (≥65 баллов)</SelectItem>
                    <SelectItem value="A">Грейд A (≥85 баллов)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Только сотрудники с указанным или более высоким грейдом смогут делать ставки
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" data-testid="button-create-task">
                <PlusCircle size={18} />
                Создать задачу
              </Button>
              <Button type="button" variant="outline" data-testid="button-cancel">
                Отмена
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
