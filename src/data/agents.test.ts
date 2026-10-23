import { describe, expect, it } from "vitest";
import { AGENTS, agentSlug } from "./agents";

/** The icon files that exist in public/agents, as "kayo.png" style names. */
const iconFiles = new Set(
  Object.keys(import.meta.glob("/public/agents/*.png")).map((path) => path.split("/").pop()),
);

describe("agent data", () => {
  it("has a different file name for every agent", () => {
    expect(new Set(AGENTS.map((a) => agentSlug(a.name))).size).toBe(AGENTS.length);
  });

  it("turns a name with punctuation into a plain file name", () => {
    expect(agentSlug("KAY/O")).toBe("kayo");
  });

  it("has an icon file for every agent", () => {
    const missing = AGENTS.filter((a) => !iconFiles.has(`${agentSlug(a.name)}.png`));
    expect(missing.map((a) => a.name)).toEqual([]);
  });
});
