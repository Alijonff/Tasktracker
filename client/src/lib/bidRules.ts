import { calculateGrade } from "@shared/utils";
import type { AuctionTaskSummary, Grade } from "@/api/adapter";
import type { SessionUser } from "@/types/session";

const gradeWeights: Record<Grade, number> = {
  D: 0,
  C: 1,
  B: 2,
  A: 3,
};

export function resolveUserGrade(user: SessionUser | null | undefined): Grade | null {
  if (!user) return null;
  if (user.grade) return user.grade as Grade;

  const rawPoints = typeof user.points === "number" ? user.points : Number(user.points ?? 0);
  const safePoints = Number.isFinite(rawPoints) ? Number(rawPoints) : 0;
  return calculateGrade(safePoints);
}

export function getBidAvailability(
  task: AuctionTaskSummary,
  user: SessionUser | null | undefined,
  userGrade: Grade | null,
): { canBid: boolean; reason?: string } {
  if (!user) {
    return { canBid: false, reason: "Необходимо войти в систему" };
  }

  if (task.status !== "BACKLOG") {
    return { canBid: false, reason: "Торги доступны только в бэклоге" };
  }

  if (user.id === task.creatorId) {
    return { canBid: false, reason: "Создатель задачи не может делать ставки" };
  }

  if (user.role !== "admin") {
    if (!user.departmentId || user.departmentId !== task.departmentId) {
      return { canBid: false, reason: "Только для сотрудников департамента задачи" };
    }

    if (task.taskType === "UNIT") {
      if (task.divisionId && user.divisionId !== task.divisionId) {
        return { canBid: false, reason: "Только для отдела задачи" };
      }
    }
  }

  if (userGrade && gradeWeights[userGrade] < gradeWeights[task.minimumGrade]) {
    return { canBid: false, reason: `Ставка доступна с грейда ${task.minimumGrade}` };
  }

  return { canBid: true };
}

export function extractBidErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const [, ...rest] = error.message.split(":");
    const payload = rest.join(":").trim();
    if (payload) {
      try {
        const parsed = JSON.parse(payload);
        if (parsed?.error) return String(parsed.error);
      } catch (err) {
        console.debug("Не удалось распарсить ошибку ставки", err);
      }
      return payload;
    }
    return error.message;
  }
  return "Не удалось отправить ставку";
}
