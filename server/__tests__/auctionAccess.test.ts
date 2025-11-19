import assert from "node:assert/strict";
import test from "node:test";

import type { Task, User } from "@shared/schema";
import type { TaskMetadata } from "@shared/taskMetadata";
import { canUserBidOnAuction, evaluateAuctionVisibility } from "../utils/auctionAccess";

const departmentAuction: TaskMetadata = { taskType: "DEPARTMENT", mode: "MONEY" };
const unitAuction: TaskMetadata = { taskType: "UNIT", mode: "MONEY" };

test("руководители одного департамента видят одинаковые департаментские аукционы", () => {
  const task = createAuctionTask({ departmentId: "dept-1", type: "DEPARTMENT" });

  const director = createUser({ id: "director", role: "director", departmentId: "dept-1" });
  const manager = createUser({ id: "manager", role: "manager", departmentId: "dept-1", divisionId: "div-2" });

  assert.equal(evaluateAuctionVisibility(task, director, departmentAuction).visible, true);
  assert.equal(evaluateAuctionVisibility(task, manager, departmentAuction).visible, true);
});

test("admin и сотрудники чужого департамента не видят департаментский аукцион", () => {
  const task = createAuctionTask({ departmentId: "dept-1", type: "DEPARTMENT" });

  const admin = createUser({ id: "admin", role: "admin", departmentId: "dept-1" });
  const outsider = createUser({ id: "outsider", role: "manager", departmentId: "dept-2" });

  assert.equal(evaluateAuctionVisibility(task, admin, departmentAuction).visible, false);
  const outsiderVisibility = evaluateAuctionVisibility(task, outsider, departmentAuction);
  assert.equal(outsiderVisibility.visible, false);
  assert.match(outsiderVisibility.reason ?? "", /департамента/i);
});

test("аукцион отдела скрывается от сотрудников других отделов", () => {
  const task = createAuctionTask({ departmentId: "dept-1", divisionId: "div-1", type: "UNIT" });

  const sameUnit = createUser({ id: "member", role: "employee", departmentId: "dept-1", divisionId: "div-1" });
  const otherUnit = createUser({ id: "other", role: "employee", departmentId: "dept-1", divisionId: "div-2" });

  assert.equal(evaluateAuctionVisibility(task, sameUnit, unitAuction).visible, true);
  const otherUnitVisibility = evaluateAuctionVisibility(task, otherUnit, unitAuction);
  assert.equal(otherUnitVisibility.visible, false);
  assert.match(otherUnitVisibility.reason ?? "", /отдела/i);
});

test("недостаточный грейд или чужой департамент блокируют ставку", () => {
  const task = createAuctionTask({ departmentId: "dept-1", minimumGrade: "B" });

  const lowGradeUser = createUser({ id: "low", role: "employee", grade: "D", departmentId: "dept-1" });
  const bidCheckLow = canUserBidOnAuction(task, departmentAuction, lowGradeUser);
  assert.equal(bidCheckLow.allowed, false);
  assert.match(bidCheckLow.reason ?? "", /грейда B/);

  const foreignUser = createUser({ id: "foreign", role: "manager", grade: "A", departmentId: "dept-2" });
  const bidCheckForeign = canUserBidOnAuction(task, departmentAuction, foreignUser);
  assert.equal(bidCheckForeign.allowed, false);
  assert.match(bidCheckForeign.reason ?? "", /департамента/);
});

function createAuctionTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  return {
    id: overrides.id ?? "task-id",
    title: overrides.title ?? "Task",
    description: overrides.description ?? "Desc",
    status: overrides.status ?? "BACKLOG",
    type: overrides.type ?? "DEPARTMENT",
    departmentId: overrides.departmentId ?? "dept-1",
    managementId: overrides.managementId ?? null,
    divisionId: overrides.divisionId ?? null,
    creatorId: overrides.creatorId ?? "creator",
    creatorName: overrides.creatorName ?? "Creator",
    executorId: overrides.executorId ?? null,
    executorName: overrides.executorName ?? null,
    minimumGrade: overrides.minimumGrade ?? "D",
    deadline: overrides.deadline ?? now,
    reviewDeadline: overrides.reviewDeadline ?? null,
    doneAt: overrides.doneAt ?? null,
    rating: overrides.rating ?? null,
    assignedPoints: overrides.assignedPoints ?? null,
    auctionStartAt: overrides.auctionStartAt ?? now,
    auctionPlannedEndAt: overrides.auctionPlannedEndAt ?? new Date(now.getTime() + 3600_000),
    auctionEndAt: overrides.auctionEndAt ?? null,
    basePrice: overrides.basePrice ?? "100",
    currentPrice: overrides.currentPrice ?? null,
    baseTimeMinutes: overrides.baseTimeMinutes ?? null,
    earnedMoney: overrides.earnedMoney ?? null,
    earnedTimeMinutes: overrides.earnedTimeMinutes ?? null,
    auctionMode: overrides.auctionMode ?? "MONEY",
    auctionWinnerId: overrides.auctionWinnerId ?? null,
    auctionWinnerName: overrides.auctionWinnerName ?? null,
    auctionHasBids: overrides.auctionHasBids ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } as Task;
}

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: overrides.id ?? "user-id",
    username: overrides.username ?? "username",
    passwordHash: overrides.passwordHash ?? "hash",
    name: overrides.name ?? "Name",
    email: overrides.email ?? null,
    role: overrides.role ?? "employee",
    positionType: overrides.positionType ?? "employee",
    divisionId: overrides.divisionId ?? null,
    managementId: overrides.managementId ?? null,
    departmentId: overrides.departmentId ?? "dept-1",
    rating: overrides.rating ?? null,
    grade: overrides.grade ?? "C",
    points: overrides.points ?? 0,
    completedTasks: overrides.completedTasks ?? 0,
    totalHours: overrides.totalHours ?? "0",
    mustChangePassword: overrides.mustChangePassword ?? false,
    createdAt: overrides.createdAt ?? new Date(),
  } as User;
}
