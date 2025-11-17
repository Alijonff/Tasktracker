import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { AuctionBid, Task } from "@shared/schema";
import {
  calculateAuctionPrice,
  calculateOverduePenaltyHours,
  selectWinningBid,
  shouldAutoAssignToCreator,
} from "../businessRules";
import { reassignTasksFromTerminatedEmployee } from "../services/employeeLifecycle";

test("calculateAuctionPrice плавно увеличивает стоимость при отсутствии ставок", () => {
  const start = new Date("2024-01-01T09:00:00Z");
  const plannedEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const task = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
    auctionInitialSum: "100",
    auctionMaxSum: "150",
    auctionHasBids: false,
  });

  assert.equal(calculateAuctionPrice(task, start), 100);
  const midPoint = new Date(start.getTime() + 12 * 60 * 60 * 1000);
  const midPrice = calculateAuctionPrice(task, midPoint);
  assert.ok(midPrice !== null && Math.abs(midPrice - 125) < 0.01);
  const afterEnd = new Date(plannedEnd.getTime() + 60 * 60 * 1000);
  assert.equal(calculateAuctionPrice(task, afterEnd), 150);
});

test("calculateAuctionPrice возвращает стартовую цену если есть ставки", () => {
  const start = new Date("2024-01-01T09:00:00Z");
  const plannedEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const task = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
    auctionInitialSum: "200",
    auctionMaxSum: "300",
    auctionHasBids: true,
  });

  const later = new Date(start.getTime() + 20 * 60 * 60 * 1000);
  assert.equal(calculateAuctionPrice(task, later), 200);
});

test("selectWinningBid учитывает сумму, затем баллы и время ставки", () => {
  const bids: AuctionBid[] = [
    createBid({ id: "1", bidAmount: "90", bidderPoints: 120, createdAt: new Date("2024-01-02T09:00:00Z") }),
    createBid({ id: "2", bidAmount: "85", bidderPoints: 80, createdAt: new Date("2024-01-02T09:10:00Z") }),
    createBid({ id: "3", bidAmount: "85", bidderPoints: 95, createdAt: new Date("2024-01-02T09:05:00Z") }),
    createBid({ id: "4", bidAmount: "85", bidderPoints: 95, createdAt: new Date("2024-01-02T09:02:00Z") }),
  ];

  const winner = selectWinningBid(bids);
  assert.equal(winner?.id, "4", "Побеждает ставка с минимальной суммой, затем по баллам и времени");
});

test("shouldAutoAssignToCreator срабатывает только после истечения grace-периода", () => {
  const start = new Date("2024-03-01T09:00:00Z");
  const plannedEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const task = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
  });

  const beforeGrace = new Date(plannedEnd.getTime() + 2 * 60 * 60 * 1000);
  assert.equal(shouldAutoAssignToCreator(task, beforeGrace), false);
  const afterGrace = new Date(plannedEnd.getTime() + 4 * 60 * 60 * 1000);
  assert.equal(shouldAutoAssignToCreator(task, afterGrace), true);
});

test("calculateOverduePenaltyHours считает только рабочие часы", () => {
  const deadline = new Date("2024-05-06T09:00:00Z"); // Понедельник
  const completed = new Date("2024-05-06T13:30:00Z");
  assert.equal(calculateOverduePenaltyHours(deadline, completed), 5);

  const fridayDeadline = new Date("2024-05-10T18:00:00Z");
  const mondayCompletion = new Date("2024-05-13T10:00:00Z");
  assert.equal(
    calculateOverduePenaltyHours(fridayDeadline, mondayCompletion),
    1,
    "Выходные не должны добавлять штрафные часы",
  );
});

test("reassignTasksFromTerminatedEmployee переназначает задачи создателю", async () => {
  const calls: Array<{ id: string; updates: Partial<Task> }> = [];
  const assigneeId = "employee-123";
  const tasks: Task[] = [
    createAuctionTask({ id: "task-1", creatorId: "creator-1", creatorName: "Director" }),
    createAuctionTask({ id: "task-2", creatorId: "creator-2", creatorName: "Manager" }),
  ];

  const storageMock = {
    getAllTasks: async (filters: any) => {
      assert.deepEqual(filters, { assigneeId, statuses: ["inProgress", "underReview"] });
      return tasks;
    },
    updateTask: async (id: string, updates: Partial<Task>) => {
      calls.push({ id, updates });
      return undefined;
    },
    deleteEmployeeBids: async () => [],
  };

  await reassignTasksFromTerminatedEmployee(storageMock as any, assigneeId);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    id: "task-1",
    updates: {
      assigneeId: "creator-1",
      assigneeName: "Director",
      auctionWinnerId: "creator-1",
      auctionWinnerName: "Director",
    },
  });
});

function createAuctionTask(overrides: Partial<Task> = {}): Task {
  const now = new Date();
  return {
    id: overrides.id ?? "task-id",
    title: "Task",
    description: "Desc",
    status: "backlog",
    type: "auction",
    departmentId: "dept",
    managementId: null,
    divisionId: null,
    creatorId: overrides.creatorId ?? "creator",
    creatorName: overrides.creatorName ?? "Creator",
    assigneeId: overrides.assigneeId ?? null,
    assigneeName: overrides.assigneeName ?? null,
    minimumGrade: overrides.minimumGrade ?? "D",
    deadline: overrides.deadline ?? now,
    rating: overrides.rating ?? null,
    assignedPoints: overrides.assignedPoints ?? null,
    auctionStartAt: overrides.auctionStartAt ?? now,
    auctionPlannedEndAt: overrides.auctionPlannedEndAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000),
    auctionEndAt: overrides.auctionEndAt ?? null,
    auctionInitialSum: overrides.auctionInitialSum ?? "100",
    auctionMaxSum: overrides.auctionMaxSum ?? "150",
    auctionAssignedSum: overrides.auctionAssignedSum ?? null,
    auctionWinnerId: overrides.auctionWinnerId ?? null,
    auctionWinnerName: overrides.auctionWinnerName ?? null,
    auctionHasBids: overrides.auctionHasBids ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  } as Task;
}

function createBid(overrides: Partial<AuctionBid>): AuctionBid {
  return {
    id: overrides.id ?? randomUUID(),
    taskId: overrides.taskId ?? "task-id",
    bidderId: overrides.bidderId ?? "bidder",
    bidderName: overrides.bidderName ?? "Bidder",
    bidderRating: overrides.bidderRating ?? "0",
    bidderGrade: overrides.bidderGrade ?? "D",
    bidderPoints: overrides.bidderPoints ?? 0,
    bidAmount: overrides.bidAmount ?? "100",
    createdAt: overrides.createdAt ?? new Date(),
  } as AuctionBid;
}
