import assert from "node:assert/strict";
import test from "node:test";

import { placeBidSchema } from "../schemas/auctionSchemas";

test("placeBidSchema принимает денежную ставку без времени", () => {
  const parsed = placeBidSchema.parse({ valueMoney: "999 000" });

  assert.equal(parsed.valueMoney, 999000);
  assert.equal(parsed.valueTimeMinutes, undefined);
});

test("placeBidSchema принимает ставку по времени без суммы", () => {
  const parsed = placeBidSchema.parse({ valueTimeMinutes: "15" });

  assert.equal(parsed.valueTimeMinutes, 15);
  assert.equal(parsed.valueMoney, undefined);
});

test("placeBidSchema отклоняет запрос без значений", () => {
  assert.throws(() => placeBidSchema.parse({}), /Укажите значение ставки/);
});
