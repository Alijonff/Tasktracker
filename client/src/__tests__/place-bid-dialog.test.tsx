import React from "react";
import assert from "node:assert/strict";
import test from "node:test";
import { renderToString } from "react-dom/server";

import PlaceBidDialog, { parseBidAmount } from "@/components/PlaceBidDialog";
import { expectToMatchSnapshot } from "./helpers/snapshot";

const task = {
  id: "auction-1",
  title: "Редизайн портала",
  currentPrice: 1_800_000,
  minimumGrade: "C" as const,
  bids: [
    { id: "bid-1", bidder: "Севинч", amount: 1_800_000, timestamp: "5 мин назад" },
  ],
};

test("PlaceBidDialog snapshot", () => {
  const markup = renderToString(<PlaceBidDialog open onOpenChange={() => {}} task={task} />);
  expectToMatchSnapshot("place-bid-dialog", markup);
});

test("parseBidAmount validates positive sums", () => {
  assert.equal(parseBidAmount("2500000"), 2_500_000);
  assert.equal(parseBidAmount("0"), null);
  assert.equal(parseBidAmount("-500"), null);
  assert.equal(parseBidAmount("not-a-number"), null);
});
