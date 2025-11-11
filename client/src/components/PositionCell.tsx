import { Plus, UserCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import UserAvatar from "./UserAvatar";
import GradeBadge from "./GradeBadge";

export type PositionType = 
  | "director"          // Директор департамента
  | "deputy"            // Заместитель директора
  | "management_head"   // Руководитель управления
  | "division_head"     // Руководитель отдела
  | "senior"            // Старший сотрудник
  | "employee";         // Обычный сотрудник

interface PositionCellProps {
  positionType: PositionType;
  employee?: {
    id: string;
    name: string;
    rating?: number;
    points?: number;
  };
  onClick?: () => void;
  canEdit?: boolean;
}

export const positionLabels: Record<PositionType, string> = {
  director: "Директор",
  deputy: "Заместитель",
  management_head: "Руководитель",
  division_head: "Руководитель",
  senior: "Старший сотрудник",
  employee: "Сотрудник",
};

export default function PositionCell({ 
  positionType, 
  employee, 
  onClick, 
  canEdit = false 
}: PositionCellProps) {
  const isVacant = !employee;
  const label = positionLabels[positionType];

  return (
    <Card
      className={`p-3 ${canEdit ? 'cursor-pointer hover-elevate active-elevate-2' : ''}`}
      onClick={canEdit ? onClick : undefined}
      data-testid={`position-cell-${positionType}`}
    >
      <div className="flex items-center gap-3">
        <div>
          {isVacant ? (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              {canEdit ? (
                <Plus size={20} className="text-muted-foreground" />
              ) : (
                <UserCircle size={20} className="text-muted-foreground" />
              )}
            </div>
          ) : (
            <UserAvatar name={employee.name} size="md" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          {isVacant ? (
            <div className="text-sm text-muted-foreground">
              {canEdit ? "Добавить" : "Вакансия"}
            </div>
          ) : (
            <div className="font-medium truncate">{employee.name}</div>
          )}
        </div>

        {!isVacant && (
          <div className="flex items-center gap-2">
            {employee.points !== undefined && (
              <GradeBadge points={employee.points} showPoints />
            )}
            {employee.rating && (
              <div className="text-xs text-muted-foreground">
                ★ {Number(employee.rating).toFixed(1)}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
