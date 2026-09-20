import assert from "node:assert/strict";
import test from "node:test";
import { billableTradeChoices } from "../../src/features/timesheets/billable-trades.ts";

const trades = [
  {
    trade: "HELPER",
    clients: [
      { id: "mcc", name: "MCC" },
      { id: "tawasul", name: "AL TAWASUL" },
    ],
  },
  {
    trade: "MASON",
    clients: [{ id: "intergrande", name: "Intergrande BKC" }],
  },
];

test("known client only sees trades that have a rate rule for that client", () => {
  const choices = billableTradeChoices(trades, "mcc");
  assert.deepEqual(
    choices.map((item) => item.trade),
    ["HELPER"],
  );
  assert.equal(choices[0]?.label, "HELPER");
});

test("unresolved or unmatched client lists offering clients on each trade", () => {
  const unresolved = billableTradeChoices(trades, null);
  assert.equal(unresolved[0]?.label, "HELPER · AL TAWASUL, MCC");
  const ibex = billableTradeChoices(trades, "ibex-has-no-rules");
  assert.equal(ibex.length, 2);
  assert.ok(ibex[1]?.label.includes("Intergrande BKC"));
});
