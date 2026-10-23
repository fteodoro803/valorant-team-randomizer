import { describe, expect, it } from "vitest";
import { canRaiseMinimums, fitMinimums, totalMinimums } from "./minimums";

const mins = (duelist: number, initiator: number, controller: number, sentinel: number) => ({
  duelist,
  initiator,
  controller,
  sentinel,
});

describe("fitMinimums", () => {
  it("leaves minimums alone when they already fit", () => {
    expect(fitMinimums(mins(1, 1, 1, 0), 4)).toEqual(mins(1, 1, 1, 0));
  });

  it("lowers the largest minimum first", () => {
    expect(fitMinimums(mins(2, 1, 1, 0), 3)).toEqual(mins(1, 1, 1, 0));
  });

  it("drops the later role when two minimums are tied", () => {
    expect(fitMinimums(mins(1, 1, 1, 1), 3)).toEqual(mins(1, 1, 1, 0));
  });

  it("can turn roles off entirely for a small team", () => {
    expect(fitMinimums(mins(1, 1, 1, 1), 1)).toEqual(mins(1, 0, 0, 0));
  });

  it("does not change the object it was given", () => {
    const original = mins(1, 1, 1, 1);
    fitMinimums(original, 2);
    expect(original).toEqual(mins(1, 1, 1, 1));
  });
});

describe("minimums", () => {
  it("adds up the minimums across roles", () => {
    expect(totalMinimums(mins(1, 2, 0, 1))).toBe(4);
  });

  it("allows another one while the total is below the team size", () => {
    expect(canRaiseMinimums(mins(1, 1, 1, 0), 4)).toBe(true);
  });

  it("stops once the total equals the team size", () => {
    expect(canRaiseMinimums(mins(1, 1, 1, 1), 4)).toBe(false);
  });

  it("stops when the team is already smaller than the total", () => {
    expect(canRaiseMinimums(mins(2, 2, 1, 0), 4)).toBe(false);
  });
});
