import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface ReturnToWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comment: string) => void;
  isSubmitting?: boolean;
  taskTitle?: string;
}

export default function ReturnToWorkDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
  taskTitle,
}: ReturnToWorkDialogProps) {
  const [comment, setComment] = useState("");

  const handleSubmit = () => {
    if (comment.trim()) {
      onConfirm(comment.trim());
      setComment("");
    }
  };

  const handleCancel = () => {
    setComment("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-return-to-work">
        <DialogHeader>
          <DialogTitle>Вернуть задачу в работу</DialogTitle>
          <DialogDescription>
            Вы собираетесь вернуть задачу <span className="font-semibold">"{taskTitle}"</span> на доработку.
            Пожалуйста, укажите причину возврата.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="comment">Комментарий (обязательно)</Label>
          <Textarea
            id="comment"
            placeholder="Опишите, что нужно исправить..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            className="resize-none"
            data-testid="input-return-comment"
          />
          <p className="text-sm text-muted-foreground">
            {comment.trim().length} / минимум 1 символ
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            data-testid="button-cancel-return"
          >
            Отмена
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!comment.trim() || isSubmitting}
            data-testid="button-confirm-return"
          >
            {isSubmitting ? "Возврат..." : "Вернуть в работу"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
