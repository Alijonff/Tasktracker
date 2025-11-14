import assert from "node:assert/strict";
import test from "node:test";

import { calculateGrade } from "@shared/utils";
import { formatMoney } from "@/lib/formatters";

const moneyCases: Array<[number | undefined, string]> = [
  [1_250_000, "1 250 000 сум"],
  [0, "0 сум"],
  [undefined, "0 сум"],
  [9_876_543.21, "9 876 543 сум"],
];

test("calculateGrade thresholds", () => {
  assert.equal(calculateGrade(20), "D");
  assert.equal(calculateGrade(60), "C");
  assert.equal(calculateGrade(75), "B");
  assert.equal(calculateGrade(100), "A");
});

test("formatMoney handles edge cases", () => {
  for (const [input, expected] of moneyCases) {
    assert.equal(formatMoney(input), expected);
  }
});
