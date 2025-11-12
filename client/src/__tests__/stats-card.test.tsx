import React from "react";
import test from "node:test";
import { renderToString } from "react-dom/server";

import StatsCard from "@/components/StatsCard";
import { CheckCircle2 } from "lucide-react";
import { expectToMatchSnapshot } from "./helpers/snapshot";

test("StatsCard snapshot", () => {
  const markup = renderToString(
    <StatsCard title="Активные аукционы" value={8} icon={CheckCircle2} subtitle="в работе" />,
  );
  expectToMatchSnapshot("stats-card", markup);
});
