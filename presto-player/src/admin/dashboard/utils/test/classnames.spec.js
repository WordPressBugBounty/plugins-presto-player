import classnames from "../classnames";

describe("classnames", () => {
  it("returns an empty string when called with no args", () => {
    expect(classnames()).toBe("");
  });

  it("joins string args with spaces", () => {
    expect(classnames("a", "b", "c")).toBe("a b c");
  });

  it("includes numeric args verbatim", () => {
    expect(classnames("col", 4, "row")).toBe("col 4 row");
  });

  it("flattens nested arrays recursively", () => {
    expect(classnames(["a", ["b", ["c"]]], "d")).toBe("a b c d");
  });

  it("includes object keys whose values are truthy", () => {
    expect(
      classnames({ active: true, disabled: false, primary: 1 })
    ).toBe("active primary");
  });

  it("ignores object keys whose values are falsy", () => {
    expect(
      classnames({ a: false, b: null, c: undefined, d: 0, e: "" })
    ).toBe("");
  });

  it("mixes strings, arrays, and objects in one call", () => {
    expect(
      classnames("base", ["foo", { bar: true, baz: false }], { qux: 1 })
    ).toBe("base foo bar qux");
  });
});
