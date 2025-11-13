import test from "node:test";

import CreateTask from "@/pages/CreateTask";
import { renderWithQuery } from "./helpers/render";
import { expectToMatchSnapshot } from "./helpers/snapshot";
import { Router } from "wouter";
import React from "react";

test("CreateTask page matches snapshot", () => {
  const useTestLocation = () => React.useState("/create-task") as const;
  const markup = renderWithQuery(
    <Router hook={useTestLocation}>
      <CreateTask />
    </Router>,
  );
  expectToMatchSnapshot("create-task", markup);
});
