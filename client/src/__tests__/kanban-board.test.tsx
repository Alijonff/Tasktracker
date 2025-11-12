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
    status: "backlog",
    creatorName: "Дилшод",
    minimumGrade: "D",
    deadline: "2024-01-01T10:00:00.000Z",
    startingPrice: 900_000,
    bidsCount: 0,
    canBid: true,
  },
];

test("KanbanBoard snapshot", () => {
  const markup = renderToString(<KanbanBoard tasks={tasks} />);
  expectToMatchSnapshot("kanban-board", markup);
});

test("KanbanBoard enforces transition rules", () => {
  assert.equal(isAllowedTransition("backlog", "inProgress"), true);
  assert.equal(isAllowedTransition("backlog", "completed"), false);
  assert.ok(allowedTransitions.underReview.includes("completed"));
});
