import React from "react";
import test from "node:test";
import { renderToString } from "react-dom/server";

import TaskCard from "@/components/TaskCard";
import { expectToMatchSnapshot } from "./helpers/snapshot";

const taskCardMarkup = renderToString(
  <TaskCard
    id="auction-1"
    title="Интеграция UzPay"
    description="Настроить платёжный модуль"
    status="backlog"
    creator="Дилшод"
    deadline={"2025-01-01T12:00:00Z"}
    minimumGrade="B"
    startingPrice={1_800_000}
    currentPrice={1_950_000}
    bidsCount={6}
    leadingBidderName="Севинч"
    canBid
  />,
);

test("TaskCard snapshot", () => {
  expectToMatchSnapshot("task-card", taskCardMarkup);
});
