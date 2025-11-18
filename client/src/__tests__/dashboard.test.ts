import assert from "node:assert/strict";
import test from "node:test";

import { canCreateAuctionsForRole } from "@/pages/Dashboard";

const cases: Array<[Parameters<typeof canCreateAuctionsForRole>[0], boolean]> = [
  [{ role: "director", canCreateAuctions: true } as any, true],
  [{ role: "admin", canCreateAuctions: false } as any, false],
  [{ role: "employee", canCreateAuctions: false } as any, false],
  [null, false],
];

test("Dashboard permissions for create auction button", () => {
  for (const [user, expected] of cases) {
    assert.equal(canCreateAuctionsForRole(user), expected);
  }
});
