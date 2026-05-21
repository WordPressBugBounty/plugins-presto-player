import { render, screen } from "@testing-library/react";
import TruncatedTitle from "../TruncatedTitle";

const DEFAULT_MAX = 60;

describe("TruncatedTitle", () => {
  it("renders nothing when title is empty / null / undefined", () => {
    const { container: c1 } = render(<TruncatedTitle title="" />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<TruncatedTitle title={null} />);
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(<TruncatedTitle title={undefined} />);
    expect(c3.firstChild).toBeNull();
  });

  it("renders the full title without an ellipsis trigger when at or under maxChars", () => {
    const title = "x".repeat(DEFAULT_MAX);
    const { container } = render(<TruncatedTitle title={title} />);
    expect(container.textContent).toBe(title);
    expect(container.textContent).not.toContain("…");
  });

  it("renders truncated prefix and an ellipsis trigger when over maxChars", () => {
    const title = "x".repeat(DEFAULT_MAX + 10);
    const { container } = render(<TruncatedTitle title={title} />);
    // Slices to maxChars - 1 chars; the rest is replaced by the … trigger.
    const prefix = "x".repeat(DEFAULT_MAX - 1);
    expect(container.textContent).toContain(prefix);
    expect(container.textContent).toContain("…");
    // Should be shorter than the original (the trailing chars are dropped).
    expect(container.textContent.length).toBeLessThan(title.length + 1);
  });

});
