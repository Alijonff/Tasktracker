import assert from "node:assert/strict";
import test from "node:test";

import { canCreateAuctionsForRole } from "@/pages/Dashboard";

const cases: Array<[string | null, boolean]> = [
  ["director", true],
  ["employee", false],
  [null, false],
];

test("Dashboard permissions for create auction button", () => {
  for (const [role, expected] of cases) {
    assert.equal(canCreateAuctionsForRole(role), expected);
  }
});
