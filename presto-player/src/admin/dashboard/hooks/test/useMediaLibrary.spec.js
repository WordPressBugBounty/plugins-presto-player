import { renderHook } from "@testing-library/react-hooks";
import { useMediaLibrary } from "../useMediaLibrary";

const callGetFilename = (...args) => {
  const { result } = renderHook(() => useMediaLibrary(jest.fn()));
  return result.current.getFilename(...args);
};

describe("useMediaLibrary.getFilename", () => {
  it("returns an empty string for falsy input", () => {
    expect(callGetFilename("")).toBe("");
    expect(callGetFilename(null)).toBe("");
    expect(callGetFilename(undefined)).toBe("");
  });

  it("returns the original input verbatim when URL parsing fails", () => {
    expect(callGetFilename("not a url")).toBe("not a url");
  });

  it("returns the bare filename when at or under maxLength", () => {
    expect(callGetFilename("https://cdn.example.com/files/photo.jpg")).toBe(
      "photo.jpg"
    );
  });

  it("returns an empty string when the URL has no trailing path segment", () => {
    expect(callGetFilename("https://cdn.example.com/")).toBe("");
  });

  // Truncated total = (maxLength - ext.length - 3) + "..." + ext = maxLength.
  it.each([
    [30, `${"a".repeat(40)}.jpg`],
    [15, `${"a".repeat(50)}.jpg`],
  ])(
    "truncates long names to %i chars while preserving the extension",
    (maxLength, longName) => {
      const url = `https://cdn.example.com/files/${longName}`;
      const out = callGetFilename(url, maxLength);
      expect(out.length).toBe(maxLength);
      expect(out.endsWith(".jpg")).toBe(true);
      expect(out).toContain("...");
    }
  );
});
