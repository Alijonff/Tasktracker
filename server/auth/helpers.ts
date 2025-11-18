import type { User, Task } from "@shared/schema";
import { calculateGrade } from "@shared/utils";

export function canCreateAuctionsForRole(role: string): boolean {
  return role === "admin" || role === "director";
}

export function canPlaceBidOnTask(user: User, task: Task): {
  canBid: boolean;
  reason?: string;
} {
  if (!task) {
    return { canBid: false, reason: "Task not found" };
  }

  if (task.type === "INDIVIDUAL") {
    return { canBid: false, reason: "Individual tasks are not auctioned" };
  }

  if (task.status !== "BACKLOG") {
    return { canBid: false, reason: "Auction is no longer accepting bids" };
  }

  if (task.assigneeId) {
    return { canBid: false, reason: "Auction already has a winner" };
  }

  const userGrade = calculateGrade(Number(user.points));
  const requiredGrade = task.minimumGrade;

  if (!requiredGrade) {
    return { canBid: true };
  }

  const gradeOrder: Record<string, number> = { D: 1, C: 2, B: 3, A: 4 };
  const userGradeValue = gradeOrder[userGrade] || 0;
  const requiredGradeValue = gradeOrder[requiredGrade] || 0;

  if (userGradeValue < requiredGradeValue) {
    return {
      canBid: false,
      reason: `Minimum grade required: ${requiredGrade}, your grade: ${userGrade}`,
    };
  }

  return { canBid: true };
}

export function canManageEntityInHierarchy(
  user: User,
  targetDepartmentId?: string | null,
  targetManagementId?: string | null,
  targetDivisionId?: string | null
): boolean {
  if (user.role === "admin") {
    return true;
  }

  if (user.role === "director") {
    return targetDepartmentId === user.departmentId;
  }

  if (user.role === "manager") {
    if (targetManagementId && targetManagementId === user.managementId) {
      return true;
    }
    if (targetDivisionId && targetDivisionId === user.divisionId) {
      return true;
    }
    return false;
  }

  return false;
}
