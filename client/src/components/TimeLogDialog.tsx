import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface TimeLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle?: string;
}

export default function TimeLogDialog({ open, onOpenChange, taskTitle }: TimeLogDialogProps) {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: "",
    description: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Logging time:", formData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-time-log">
        <DialogHeader>
          <DialogTitle>Записать рабочее время</DialogTitle>
          {taskTitle && (
            <p className="text-sm text-muted-foreground">{taskTitle}</p>
          )}
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Дата *</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
              data-testid="input-log-date"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hours">Отработанные часы *</Label>
            <Input
              id="hours"
              type="number"
              min="0.5"
              step="0.5"
              placeholder="0.0"
              value={formData.hours}
              onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
              required
              data-testid="input-log-hours"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание деятельности</Label>
            <Textarea
              id="description"
              placeholder="Над чем вы работали?"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              data-testid="textarea-log-description"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
              Отмена
            </Button>
            <Button type="submit" data-testid="button-log-time">
              Записать время
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
