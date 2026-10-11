import { describe, expect, it } from "vitest";
import { moveId, reorderSubset } from "./reorder";

describe("moveId", () => {
  it("moves an item forward and backward", () => {
    expect(moveId(["a", "b", "c"], "a", 3)).toEqual(["b", "c", "a"]);
    expect(moveId(["a", "b", "c"], "c", 0)).toEqual(["c", "a", "b"]);
  });

  it("keeps the order when the id is unknown", () => {
    expect(moveId(["a", "b"], "x", 0)).toEqual(["a", "b"]);
  });
});

describe("reorderSubset", () => {
  it("leaves the hidden items where they were", () => {
    const list = ["a", "x", "b", "y", "c"];
    const result = reorderSubset(list, (item) => item, ["a", "b", "c"], "c", 0);
    expect(result).toEqual(["c", "x", "a", "y", "b"]);
  });
});
