import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";

import KanbanBoard, { type KanbanTask, isAllowedTransition, allowedTransitions } from "@/components/KanbanBoard";
import { expectToMatchSnapshot } from "./helpers/snapshot";

const tasks: KanbanTask[] = [
  {
    id: "t1",
    title: "Подготовка отчёта",
    description: "Собрать данные",
    status: "BACKLOG",
    creatorName: "Дилшод",
    minimumGrade: "D",
    deadline: "2024-01-01T10:00:00.000Z",
    startingPrice: 900_000,
    mode: "MONEY",
    taskType: "DEPARTMENT",
    bidsCount: 0,
    canBid: true,
  },
];

test("KanbanBoard snapshot", () => {
  const markup = renderToString(<KanbanBoard tasks={tasks} />);
  expectToMatchSnapshot("kanban-board", markup);
});

test("KanbanBoard enforces transition rules", () => {
  assert.equal(isAllowedTransition("BACKLOG", "IN_PROGRESS"), true);
  assert.equal(isAllowedTransition("BACKLOG", "DONE"), false);
  assert.ok(allowedTransitions.UNDER_REVIEW.includes("DONE"));
});
