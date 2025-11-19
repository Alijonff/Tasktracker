import { type Task, type User, type Grade } from "@shared/schema";
import { type TaskMetadata } from "@shared/taskMetadata";

const gradePriority: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1 };

export const roleGradeMap: Record<"admin" | "director" | "manager" | "senior" | "employee", Grade> = {
  admin: "A",
  director: "A",
  manager: "B",
  senior: "C",
  employee: "D",
};

export function getRoleGrade(role: keyof typeof roleGradeMap): Grade {
  return roleGradeMap[role];
}

export function hasGradeAccess(userGrade: Grade, minimum: Grade): boolean {
  return gradePriority[userGrade] >= gradePriority[minimum];
}

export function evaluateAuctionVisibility(
  task: Task,
  user: Pick<User, "role" | "departmentId" | "divisionId">,
  metadata?: TaskMetadata,
): { visible: boolean; reason?: string } {
  if (user.role === "admin") {
    return { visible: false, reason: "Администраторы не участвуют в аукционах" };
  }

  if (!user.departmentId || user.departmentId !== task.departmentId) {
    return { visible: false, reason: "Ставки доступны только сотрудникам департамента задачи" };
  }

  const taskType = (metadata?.taskType ?? task.type) as TaskMetadata["taskType"];
  if (taskType === "UNIT" && task.divisionId && user.divisionId !== task.divisionId) {
    return { visible: false, reason: "Ставки доступны только сотрудникам отдела задачи" };
  }

  return { visible: true };
}

export function isAuctionVisibleToUser(
  task: Task,
  user: Pick<User, "role" | "departmentId" | "divisionId">,
  metadata?: TaskMetadata,
): boolean {
  return evaluateAuctionVisibility(task, user, metadata).visible;
}

export function canUserBidOnAuction(
  task: Task,
  metadata: TaskMetadata,
  user: Pick<User, "id" | "role" | "departmentId" | "divisionId" | "grade">,
): { allowed: boolean; reason?: string; userGrade?: Grade; minimumGrade?: Grade } {
  if (user.role === "admin") {
    return { allowed: false, reason: "Администраторы не могут делать ставки" };
  }

  if (user.id === task.creatorId) {
    return { allowed: false, reason: "Создатель задачи не может делать ставки" };
  }

  const visibility = evaluateAuctionVisibility(task, user, metadata);
  if (!visibility.visible) {
    return { allowed: false, reason: visibility.reason };
  }

  const roleForGrade = (roleGradeMap[user.role as keyof typeof roleGradeMap]
    ? (user.role as keyof typeof roleGradeMap)
    : "employee") as keyof typeof roleGradeMap;

  const userGrade: Grade = (user.grade as Grade) ?? getRoleGrade(roleForGrade);
  const minimumGrade = (task.minimumGrade as Grade) ?? "D";

  if (!hasGradeAccess(userGrade, minimumGrade)) {
    return {
      allowed: false,
      reason: `Ставки доступны с грейда ${minimumGrade}, ваш грейд: ${userGrade}`,
      userGrade,
      minimumGrade,
    };
  }

  return { allowed: true, userGrade, minimumGrade };
}
