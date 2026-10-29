import { describe, expect, it } from "vitest";
import { AGENTS, agentSlug, agentsInRole } from "./agents";

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

  it("lists a role's agents from A to Z, without touching the game's order in AGENTS", () => {
    const names = agentsInRole("initiator").map((a) => a.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(names).toContain("KAY/O");
    expect(AGENTS.filter((a) => a.role === "initiator")[0].name).toBe("Sova");
  });

  it("has an icon file for every agent", () => {
    const missing = AGENTS.filter((a) => !iconFiles.has(`${agentSlug(a.name)}.png`));
    expect(missing.map((a) => a.name)).toEqual([]);
  });
});
