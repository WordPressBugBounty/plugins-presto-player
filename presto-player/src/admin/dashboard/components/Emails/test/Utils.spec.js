import { render, screen } from "@testing-library/react";
import {
  formatPublishDate,
  getBadge,
  renderTruncated,
  TRUNCATE_LENGTH,
} from "../Utils";

describe("Emails/Utils", () => {
  describe("formatPublishDate", () => {
    it('returns "Just Now" for empty / null / undefined input', () => {
      expect(formatPublishDate("")).toBe("Just Now");
      expect(formatPublishDate(null)).toBe("Just Now");
      expect(formatPublishDate(undefined)).toBe("Just Now");
    });

    it('returns "Just Now" for an unparseable date string', () => {
      expect(formatPublishDate("not-a-date")).toBe("Just Now");
    });

    it("formats a valid local date as YYYY/MM/DD at h:mm am/pm", () => {
      // Construct an unambiguous local-time date so getHours/getMinutes
      // are independent of the host timezone.
      const local = new Date(2026, 4, 10, 13, 5).toString();
      expect(formatPublishDate(local)).toBe("2026/05/10 at 1:05 pm");
    });

    it("renders midnight as 12:00 am", () => {
      const local = new Date(2026, 0, 1, 0, 0).toString();
      expect(formatPublishDate(local)).toBe("2026/01/01 at 12:00 am");
    });

    it("renders noon as 12:00 pm", () => {
      const local = new Date(2026, 0, 1, 12, 0).toString();
      expect(formatPublishDate(local)).toBe("2026/01/01 at 12:00 pm");
    });

    it("zero-pads single-digit months, days, and minutes", () => {
      const local = new Date(2026, 1, 3, 9, 7).toString();
      expect(formatPublishDate(local)).toBe("2026/02/03 at 9:07 am");
    });
  });

  describe("getBadge", () => {
    const cases = [
      ["publish", "Published"],
      ["draft", "Draft"],
      ["trash", "Trashed"],
      ["pending", "Pending Review"],
      ["private", "Private"],
      ["future", "Scheduled"],
    ];

    it.each(cases)('renders the "%s" status as label "%s"', (status, label) => {
      render(<>{getBadge(status)}</>);
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('falls back to "Unknown" for an unrecognized status', () => {
      render(<>{getBadge("nonsense")}</>);
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("renderTruncated", () => {
    it('returns "—" for empty input', () => {
      expect(renderTruncated("")).toBe("—");
      expect(renderTruncated(null)).toBe("—");
      expect(renderTruncated(undefined)).toBe("—");
    });

    it('returns "—" when input is already an em dash', () => {
      expect(renderTruncated("—")).toBe("—");
    });

    // Three branches in one table:
    //   - at-or-under threshold returns the input string verbatim
    //   - over threshold (default maxLen) renders prefix + ellipsis
    //   - over a custom maxLen behaves the same with maxLen wired through
    it.each([
      [
        "returns the full string when at the threshold",
        "x".repeat(TRUNCATE_LENGTH),
        undefined,
        { passthrough: "x".repeat(TRUNCATE_LENGTH) },
      ],
      [
        "truncates at the default threshold with an ellipsis trigger",
        "x".repeat(TRUNCATE_LENGTH + 5),
        undefined,
        { prefix: "x".repeat(TRUNCATE_LENGTH - 1) },
      ],
      [
        "respects a custom maxLen",
        "hello world",
        5,
        { prefix: "hell", absent: "world" },
      ],
    ])("renderTruncated: %s", (_label, input, maxLen, asserts) => {
      const out = maxLen === undefined
        ? renderTruncated(input)
        : renderTruncated(input, maxLen);

      if (asserts.passthrough !== undefined) {
        expect(out).toBe(asserts.passthrough);
        return;
      }
      const { container } = render(<>{out}</>);
      expect(container.textContent).toContain(asserts.prefix);
      expect(container.textContent).toContain("…");
      if (asserts.absent) {
        expect(container.textContent).not.toContain(asserts.absent);
      }
    });
  });
});
