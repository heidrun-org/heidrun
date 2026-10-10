import { describe, expect, it } from "vitest";
import { applyOrder, moveId, reorderSubset } from "./reorder";

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

describe("applyOrder", () => {
  const key = (item: string) => item;

  it("puts the items in the saved order", () => {
    expect(applyOrder(["a", "b", "c"], key, ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("puts the new items after the saved ones, in their original order", () => {
    expect(applyOrder(["a", "n1", "b", "n2"], key, ["b", "a"])).toEqual(["b", "a", "n1", "n2"]);
  });

  it("ignores the saved keys that have no item", () => {
    expect(applyOrder(["a", "b"], key, ["gone", "b", "a"])).toEqual(["b", "a"]);
  });

  it("keeps the order when nothing is saved", () => {
    expect(applyOrder(["a", "b"], key, [])).toEqual(["a", "b"]);
  });
});
