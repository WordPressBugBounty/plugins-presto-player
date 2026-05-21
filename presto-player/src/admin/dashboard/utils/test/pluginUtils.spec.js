// Mock the WordPress and Force UI imports so importing pluginUtils doesn't
// require a live REST endpoint or a real toast renderer. We only exercise
// generateSuggestions, which is pure, but the module-level imports still
// resolve at require() time.
jest.mock("@wordpress/api-fetch", () => jest.fn());
jest.mock("@bsf/force-ui", () => ({
  toast: { success: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import { generateSuggestions } from "../pluginUtils";

const makePlugins = (slugs) =>
  slugs.map((slug) => ({ slug, init: `${slug}/${slug}.php`, name: slug }));

describe("generateSuggestions", () => {
  it("lists non-active primaries first and stamps their status", () => {
    const statuses = { p1: "inactive", p2: "not-installed" };
    const out = generateSuggestions(
      statuses,
      makePlugins(["p1", "p2"]),
      []
    );
    expect(out.map((p) => p.slug)).toEqual(["p1", "p2"]);
    expect(out[0].status).toBe("inactive");
    expect(out[1].status).toBe("not-installed");
  });

  it("fills remaining slots with non-active secondaries", () => {
    const statuses = { p1: "inactive", s1: "inactive", s2: "inactive" };
    const out = generateSuggestions(
      statuses,
      makePlugins(["p1"]),
      makePlugins(["s1", "s2"])
    );
    expect(out.map((p) => p.slug)).toEqual(["p1", "s1", "s2"]);
  });

  it("skips active secondaries", () => {
    const statuses = { p1: "inactive", s1: "active", s2: "inactive" };
    const out = generateSuggestions(
      statuses,
      makePlugins(["p1"]),
      makePlugins(["s1", "s2"])
    );
    expect(out.map((p) => p.slug)).toEqual(["p1", "s2"]);
  });

  it("falls back to active primaries to fill remaining slots up to 4", () => {
    const statuses = { p1: "active", p2: "active" };
    const out = generateSuggestions(
      statuses,
      makePlugins(["p1", "p2"]),
      []
    );
    expect(out.map((p) => p.slug)).toEqual(["p1", "p2"]);
    expect(out.every((p) => p.status === "active")).toBe(true);
  });

  it("caps the result at 4 items", () => {
    const statuses = {
      p1: "inactive",
      p2: "inactive",
      p3: "inactive",
      p4: "inactive",
      p5: "inactive",
    };
    const out = generateSuggestions(
      statuses,
      makePlugins(["p1", "p2", "p3", "p4", "p5"]),
      []
    );
    expect(out).toHaveLength(4);
    expect(out.map((p) => p.slug)).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("preserves the original plugin fields alongside the status", () => {
    const statuses = { p1: "inactive" };
    const out = generateSuggestions(
      statuses,
      makePlugins(["p1"]),
      []
    );
    expect(out[0]).toMatchObject({
      slug: "p1",
      init: "p1/p1.php",
      name: "p1",
      status: "inactive",
    });
  });

  it("returns an empty array when both lists are empty", () => {
    expect(generateSuggestions({}, [], [])).toEqual([]);
  });
});
