import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import GradeBadge from "./GradeBadge";
import { calculateGrade } from "@shared/utils";

interface AssignPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    name: string;
    points: number;
  } | null;
}

export default function AssignPointsDialog({ open, onOpenChange, user }: AssignPointsDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    points: "",
    comment: "",
  });

  const assignPointsMutation = useMutation({
    mutationFn: async (data: { points: number; comment: string }) => {
      if (!user) throw new Error("User not selected");
      const res = await apiRequest("POST", `/api/users/${user.id}/assign-points`, data);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to assign points");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Баллы начислены",
        description: `Успешно начислено ${formData.points} баллов сотруднику ${user?.name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      if (user) {
        queryClient.invalidateQueries({ queryKey: ["/api/users", user.id, "point-history"] });
      }
      setFormData({ points: "", comment: "" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось начислить баллы",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const points = parseInt(formData.points);
    
    if (isNaN(points) || points <= 0) {
      toast({
        variant: "destructive",
        title: "Ошибка валидации",
        description: "Количество баллов должно быть положительным числом",
      });
      return;
    }

    assignPointsMutation.mutate({
      points,
      comment: formData.comment,
    });
  };

  if (!user) return null;

  const currentGrade = calculateGrade(user.points);
  const newPoints = user.points + parseInt(formData.points || "0");
  const newGrade = calculateGrade(newPoints);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-assign-points">
        <DialogHeader>
          <DialogTitle>Начислить баллы</DialogTitle>
          <DialogDescription>
            Начисление баллов сотруднику: {user.name}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-muted">
            <div>
              <p className="text-sm text-muted-foreground">Текущий грейд</p>
              <div className="flex items-center gap-2 mt-1">
                <GradeBadge grade={currentGrade} />
                <span className="text-sm font-mono">{user.points} баллов</span>
              </div>
            </div>
            {formData.points && parseInt(formData.points) > 0 && (
              <>
                <div className="text-muted-foreground">→</div>
                <div>
                  <p className="text-sm text-muted-foreground">Новый грейд</p>
                  <div className="flex items-center gap-2 mt-1">
                    <GradeBadge grade={newGrade} />
                    <span className="text-sm font-mono">{newPoints} баллов</span>
                  </div>
                </div>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="points">Количество баллов *</Label>
              <Input
                id="points"
                type="number"
                min="1"
                step="1"
                placeholder="Введите количество баллов"
                value={formData.points}
                onChange={(e) => setFormData({ ...formData, points: e.target.value })}
                required
                data-testid="input-points"
              />
              <p className="text-xs text-muted-foreground">
                Введите положительное число для начисления баллов
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="comment">Комментарий *</Label>
              <Textarea
                id="comment"
                placeholder="Укажите причину начисления баллов"
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                rows={3}
                required
                data-testid="textarea-comment"
              />
              <p className="text-xs text-muted-foreground">
                Комментарий будет виден в истории баллов сотрудника
              </p>
            </div>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={assignPointsMutation.isPending}
                data-testid="button-cancel"
              >
                Отмена
              </Button>
              <Button 
                type="submit"
                disabled={assignPointsMutation.isPending}
                data-testid="button-submit"
              >
                {assignPointsMutation.isPending ? "Начисление..." : "Начислить баллы"}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
