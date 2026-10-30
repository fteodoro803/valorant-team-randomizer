import { describe, expect, it } from "vitest";
import { joinCodeOf, joinLink, parseRoute, routeHash } from "./route";
import type { Route } from "./route";

describe("parseRoute", () => {
  it("reads each page's address", () => {
    expect(parseRoute("#/")).toBe("entry");
    expect(parseRoute("#/host")).toBe("host");
    expect(parseRoute("#/party")).toBe("party");
  });

  it("treats no address, a bare # and anything unknown as the entry page", () => {
    expect(parseRoute("")).toBe("entry");
    expect(parseRoute("#")).toBe("entry");
    expect(parseRoute("#/nonsense")).toBe("entry");
  });

  it("forgives a missing slash and a trailing one", () => {
    expect(parseRoute("#host")).toBe("host");
    expect(parseRoute("#/party/")).toBe("party");
  });

  it("round-trips every page", () => {
    for (const route of ["entry", "host", "party"] as Route[]) expect(parseRoute(routeHash(route))).toBe(route);
  });
});

describe("join links", () => {
  it("are the party page with a code on the end", () => {
    expect(parseRoute("#/party/K7QD")).toBe("party");
    expect(joinLink("http://localhost:5173/", "k7qd")).toBe("http://localhost:5173/#/party/K7QD");
  });

  it("give back the code, in capitals", () => {
    expect(joinCodeOf("#/party/K7QD")).toBe("K7QD");
    expect(joinCodeOf("#/party/k7qd/")).toBe("K7QD");
  });

  it("give back nothing when there is no code or it can't be one", () => {
    expect(joinCodeOf("#/party")).toBeNull();
    expect(joinCodeOf("#/party/K7")).toBeNull();
    expect(joinCodeOf("#/party/K7QO")).toBeNull();
    expect(joinCodeOf("#/host/K7QD")).toBeNull();
  });
});
