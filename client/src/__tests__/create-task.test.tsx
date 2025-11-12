import React from "react";
import test from "node:test";

import CreateTask from "@/pages/CreateTask";
import { renderWithQuery } from "./helpers/render";
import { expectToMatchSnapshot } from "./helpers/snapshot";

test("CreateTask page matches snapshot", () => {
  const markup = renderWithQuery(<CreateTask />);
  expectToMatchSnapshot("create-task", markup);
});
