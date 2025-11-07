import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useState } from "react";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const [taskType, setTaskType] = useState<"individual" | "auction">("individual");
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    department: "",
    assignee: "",
    estimatedHours: "",
    deadline: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Creating task:", { ...formData, type: taskType });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-create-task">
        <DialogHeader>
          <DialogTitle>Создать новую задачу</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Тип задачи</Label>
              <RadioGroup value={taskType} onValueChange={(v: any) => setTaskType(v)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="individual" id="individual" data-testid="radio-individual" />
                  <Label htmlFor="individual" className="font-normal cursor-pointer">
                    Индивидуальная задача - Назначить конкретному сотруднику
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="auction" id="auction" data-testid="radio-auction" />
                  <Label htmlFor="auction" className="font-normal cursor-pointer">
                    Аукционная задача - Сотрудники смогут делать ставки
                  </Label>
                </div>
              </RadioGroup>
            </div>

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
                rows={4}
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

              {taskType === "individual" && (
                <div className="space-y-2">
                  <Label htmlFor="assignee">Исполнитель *</Label>
                  <Select value={formData.assignee} onValueChange={(v) => setFormData({ ...formData, assignee: v })}>
                    <SelectTrigger id="assignee" data-testid="select-assignee">
                      <SelectValue placeholder="Выберите исполнителя" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mike">Михаил Чен</SelectItem>
                      <SelectItem value="emma">Эмма Уилсон</SelectItem>
                      <SelectItem value="alex">Алекс Ривера</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedHours">
                  {taskType === "auction" ? "Начальное время (часы) *" : "Плановое время (часы) *"}
                </Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  min="1"
                  placeholder="0"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                  required
                  data-testid="input-estimated-hours"
                />
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Отмена
            </Button>
            <Button type="submit" data-testid="button-create-task">
              Создать задачу
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
