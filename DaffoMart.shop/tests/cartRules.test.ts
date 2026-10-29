import test from "node:test";
import assert from "node:assert/strict";
import { clampQty, remainingStock } from "@/lib/cartRules";

test("remaining stock = stock minus what is in the cart, never negative", () => {
  assert.equal(remainingStock(10, 3), 7);
  assert.equal(remainingStock(5, 5), 0);
  assert.equal(remainingStock(5, 9), 0);
  assert.equal(remainingStock(0, 0), 0);
  assert.equal(remainingStock(NaN as any, 0), 0);
});

test("card quantity: never below 1, never above what is still available, 0 when sold out / maxed", () => {
  assert.equal(clampQty(0, 5), 1);
  assert.equal(clampQty(-3, 5), 1);
  assert.equal(clampQty(2.7, 5), 2);
  assert.equal(clampQty(9, 5), 5);
  assert.equal(clampQty(1, 0), 0);
  assert.equal(clampQty(3, remainingStock(4, 3)), 1); // 4 in stock, 3 already in cart → at most 1 more
});
