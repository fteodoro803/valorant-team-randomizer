import { describe, expect, it } from "vitest";
import { describeRange, describeRules, fitMaximums, isFullRange, lowestMaximum, totalMaximums } from "./minimums";

const roles = (duelist: number, initiator: number, controller: number, sentinel: number) => ({
  duelist,
  initiator,
  controller,
  sentinel,
});

const rules = (minPerRole: ReturnType<typeof roles>, maxPerRole: ReturnType<typeof roles>) => ({
  minPerRole,
  maxPerRole,
});

const free = roles(5, 5, 5, 5);
const none = roles(0, 0, 0, 0);

describe("fitMaximums", () => {
  it("leaves maximums alone when they already leave room", () => {
    expect(fitMaximums(rules(none, roles(1, 1, 1, 1)), 4)).toEqual(roles(1, 1, 1, 1));
  });

  it("raises the lowest maximum first", () => {
    expect(fitMaximums(rules(none, roles(1, 1, 1, 1)), 5)).toEqual(roles(2, 1, 1, 1));
    expect(fitMaximums(rules(none, roles(2, 1, 1, 0)), 5)).toEqual(roles(2, 1, 1, 1));
  });

  it("raises the earlier role when two maximums are tied", () => {
    expect(fitMaximums(rules(none, none), 2)).toEqual(roles(1, 1, 0, 0));
  });

  it("never goes above the team limit", () => {
    expect(fitMaximums(rules(none, free), 5)).toEqual(free);
  });

  it("does not change the object it was given", () => {
    const original = rules(none, roles(1, 1, 1, 1));
    fitMaximums(original, 5);
    expect(original.maxPerRole).toEqual(roles(1, 1, 1, 1));
  });
});

describe("maximums", () => {
  it("adds up the maximums across roles", () => {
    expect(totalMaximums(roles(1, 2, 0, 1))).toBe(4);
  });

  it("lets a maximum drop while the rest still leave room", () => {
    expect(lowestMaximum(rules(none, free), "duelist", 5)).toBe(0);
  });

  it("stops a maximum where the total would no longer cover the team", () => {
    const settings = rules(none, roles(2, 1, 1, 1));
    expect(lowestMaximum(settings, "duelist", 5)).toBe(2);
    expect(lowestMaximum(settings, "initiator", 5)).toBe(1);
  });

  it("never goes below the role's own minimum", () => {
    expect(lowestMaximum(rules(roles(3, 0, 0, 0), free), "duelist", 5)).toBe(3);
  });
});

describe("isFullRange", () => {
  it("is true only for the full range", () => {
    expect(isFullRange(0, 5)).toBe(true);
    expect(isFullRange(1, 5)).toBe(false);
    expect(isFullRange(0, 4)).toBe(false);
  });
});

describe("describeRange", () => {
  it("says Any for the full range", () => {
    expect(describeRange(0, 5)).toBe("Any");
  });

  it("says what a minimum means for the team", () => {
    expect(describeRange(3, 5)).toBe("3 or more");
    expect(describeRange(1, 5)).toBe("1 or more");
  });

  it("says what a maximum means for the team", () => {
    expect(describeRange(0, 1)).toBe("Up to 1");
    expect(describeRange(0, 0)).toBe("None");
  });

  it("says exactly when both ends match, and gives a span otherwise", () => {
    expect(describeRange(2, 2)).toBe("Exactly 2");
    expect(describeRange(1, 3)).toBe("1 to 3");
  });
});

describe("describeRules", () => {
  it("says there are no rules when every role is at Any", () => {
    expect(describeRules(rules(none, free))).toBe("No rules. Any mix of roles.");
  });

  it("lists a clause for each role with a rule, in role order, and what is left over", () => {
    expect(describeRules(rules(roles(3, 0, 0, 0), roles(5, 5, 5, 1)))).toBe(
      "At least 3 duelists. At most 1 sentinel. Any mix for the rest.",
    );
  });

  it("uses the singular for one", () => {
    expect(describeRules(rules(roles(1, 0, 0, 0), free))).toBe("At least 1 duelist. Any mix for the rest.");
  });

  it("words exact counts, spans and a role kept out", () => {
    expect(describeRules(rules(roles(2, 1, 0, 0), roles(2, 3, 5, 0)))).toBe(
      "Exactly 2 duelists. 1 to 3 initiators. No sentinels. Any mix for the rest.",
    );
  });

  it("leaves out the leftover line when every role has a rule", () => {
    expect(describeRules(rules(roles(1, 1, 0, 0), roles(5, 5, 2, 2)))).toBe(
      "At least 1 duelist. At least 1 initiator. At most 2 controllers. At most 2 sentinels.",
    );
  });

  it("leaves a role at the full range out of the sentence", () => {
    expect(describeRules(rules(roles(0, 1, 0, 0), roles(5, 2, 5, 5)))).toBe(
      "1 to 2 initiators. Any mix for the rest.",
    );
  });

  it("says nothing extra when the minimums ask for more than the team holds", () => {
    expect(describeRules(rules(roles(1, 1, 1, 1), free))).toBe(
      "At least 1 duelist. At least 1 initiator. At least 1 controller. At least 1 sentinel.",
    );
  });
});
