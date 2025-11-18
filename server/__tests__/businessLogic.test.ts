import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { AuctionBid, Task } from "@shared/schema";
import {
  calculateAuctionPrice,
  calculateEarnedValue,
  calculateOverduePenaltyHours,
  selectWinningBid,
  shouldAutoAssignToCreator,
} from "../businessRules";
import { reassignTasksFromTerminatedEmployee } from "../services/employeeLifecycle";

test("calculateAuctionPrice плавно увеличивает стоимость при отсутствии ставок", () => {
  const start = new Date("2024-01-01T09:00:00Z");
  const plannedEnd = new Date("2024-01-02T18:00:00Z");
  const task = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
    basePrice: "100",
    auctionMode: "MONEY",
    auctionHasBids: false,
  });

  assert.equal(calculateAuctionPrice(task, start), 100);
  const firstStep = new Date("2024-01-01T21:00:00Z");
  const firstStepPrice = calculateAuctionPrice(task, firstStep);
  assert.ok(firstStepPrice !== null && Math.abs(firstStepPrice - 106.25) < 0.01);
  const laterStep = new Date("2024-01-02T12:00:00Z");
  const laterStepPrice = calculateAuctionPrice(task, laterStep);
  assert.ok(laterStepPrice !== null && Math.abs(laterStepPrice - 137.5) < 0.01);
  const afterEnd = new Date(plannedEnd.getTime() + 60 * 60 * 1000);
  assert.equal(calculateAuctionPrice(task, afterEnd), 150);
});

test("calculateAuctionPrice возвращает сохранённую цену если есть ставки", () => {
  const start = new Date("2024-01-01T09:00:00Z");
  const plannedEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const task = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
    basePrice: "200",
    auctionMode: "MONEY",
    auctionHasBids: true,
    currentPrice: "230",
  });

  const later = new Date(start.getTime() + 20 * 60 * 60 * 1000);
  assert.equal(calculateAuctionPrice(task, later), 230);
});

test("calculateAuctionPrice использует базовую цену если сохранённое значение отсутствует", () => {
  const start = new Date("2024-01-01T09:00:00Z");
  const plannedEnd = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const task = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
    basePrice: "200",
    auctionMode: "MONEY",
    auctionHasBids: true,
    currentPrice: null,
  });

  const later = new Date(start.getTime() + 20 * 60 * 60 * 1000);
  assert.equal(calculateAuctionPrice(task, later), 200);
});

test("calculateEarnedValue использует текущую цену без ставок", () => {
  const start = new Date("2024-01-01T09:00:00Z");
  const plannedEnd = new Date("2024-01-02T18:00:00Z");
  const currentMoment = new Date("2024-01-02T12:00:00Z");
  const task = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
    basePrice: "120",
    auctionMode: "MONEY",
    auctionHasBids: false,
  });

  const expected = calculateAuctionPrice(task, currentMoment);
  const earned = calculateEarnedValue(task, null, "MONEY", currentMoment);

  assert.equal(earned, expected);
});

test("selectWinningBid учитывает сумму, затем баллы и время ставки", () => {
  const bids: AuctionBid[] = [
    createBid({ id: "1", valueMoney: "90", bidderPoints: 120, createdAt: new Date("2024-01-02T09:00:00Z") }),
    createBid({ id: "2", valueMoney: "85", bidderPoints: 80, createdAt: new Date("2024-01-02T09:10:00Z") }),
    createBid({ id: "3", valueMoney: "85", bidderPoints: 95, createdAt: new Date("2024-01-02T09:05:00Z") }),
    createBid({ id: "4", valueMoney: "85", bidderPoints: 95, createdAt: new Date("2024-01-02T09:02:00Z") }),
  ];

  const winner = selectWinningBid(bids, "MONEY");
  assert.equal(winner?.id, "4", "Побеждает ставка с минимальной суммой, затем по баллам и времени");
});

test("shouldAutoAssignToCreator учитывает наличие ставок при расчёте срока", () => {
  const start = new Date("2024-03-01T09:00:00Z");
  const plannedEnd = new Date("2024-03-02T18:00:00Z");

  const noBidsTask = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
    auctionHasBids: false,
  });

  const beforeGrace = new Date(plannedEnd.getTime() + 2 * 60 * 60 * 1000);
  assert.equal(shouldAutoAssignToCreator(noBidsTask, beforeGrace), false);
  const afterGrace = new Date(plannedEnd.getTime() + 4 * 60 * 60 * 1000);
  assert.equal(shouldAutoAssignToCreator(noBidsTask, afterGrace), true);

  const withBidsTask = createAuctionTask({
    auctionStartAt: start,
    auctionPlannedEndAt: plannedEnd,
    auctionHasBids: true,
  });

  const beforePlannedEnd = new Date(plannedEnd.getTime() - 60 * 60 * 1000);
  assert.equal(shouldAutoAssignToCreator(withBidsTask, beforePlannedEnd), false);
  assert.equal(shouldAutoAssignToCreator(withBidsTask, plannedEnd), true);
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
  const executorId = "employee-123";
  const tasks: Task[] = [
    createAuctionTask({ id: "task-1", creatorId: "creator-1", creatorName: "Director" }),
    createAuctionTask({ id: "task-2", creatorId: "creator-2", creatorName: "Manager" }),
  ];

  const storageMock = {
    getAllTasks: async (filters: any) => {
      assert.deepEqual(filters, { executorId, statuses: ["IN_PROGRESS", "UNDER_REVIEW"] });
      return tasks;
    },
    updateTask: async (id: string, updates: Partial<Task>) => {
      calls.push({ id, updates });
      return undefined;
    },
    deleteEmployeeBids: async () => [],
  };

  await reassignTasksFromTerminatedEmployee(storageMock as any, executorId);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], {
    id: "task-1",
    updates: {
      executorId: "creator-1",
      executorName: "Director",
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
    status: "BACKLOG",
    type: "DEPARTMENT",
    departmentId: "dept",
    managementId: null,
    divisionId: null,
    creatorId: overrides.creatorId ?? "creator",
    creatorName: overrides.creatorName ?? "Creator",
    executorId: overrides.executorId ?? null,
    executorName: overrides.executorName ?? null,
    minimumGrade: overrides.minimumGrade ?? "D",
    deadline: overrides.deadline ?? now,
    rating: overrides.rating ?? null,
    assignedPoints: overrides.assignedPoints ?? null,
    auctionStartAt: overrides.auctionStartAt ?? now,
    auctionPlannedEndAt: overrides.auctionPlannedEndAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000),
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

function createBid(overrides: Partial<AuctionBid>): AuctionBid {
  return {
    id: overrides.id ?? randomUUID(),
    taskId: overrides.taskId ?? "task-id",
    bidderId: overrides.bidderId ?? "bidder",
    bidderName: overrides.bidderName ?? "Bidder",
    bidderRating: overrides.bidderRating ?? "0",
    bidderGrade: overrides.bidderGrade ?? "D",
    bidderPoints: overrides.bidderPoints ?? 0,
    valueMoney: overrides.valueMoney ?? "100",
    valueTimeMinutes: overrides.valueTimeMinutes ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  } as AuctionBid;
}
