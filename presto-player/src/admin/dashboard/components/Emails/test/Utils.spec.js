import { render, screen } from "@testing-library/react";
import {
  formatPublishDate,
  getBadge,
  renderTruncated,
  TRUNCATE_LENGTH,
  togglePageSelection,
  isPageFullySelected,
  isPagePartiallySelected,
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

  // Helpers for the table's bulk-select header. The behavior contract:
  //   - togglePageSelection: scopes select-all to the current page; never touches
  //     ids that belong to other pages, so selections survive pagination.
  //   - isPageFullySelected:    "every visible row is selected"
  //   - isPagePartiallySelected: "some, but not all, visible rows are selected"
  // An empty current page reports as neither full nor partial — the header
  // checkbox must not render as checked when there's nothing to act on.
  describe("togglePageSelection", () => {
    const page = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it("adds current page ids to an empty selection on check", () => {
      expect(togglePageSelection([], page, true)).toEqual([1, 2, 3]);
    });

    it("preserves ids from other pages when checking the current page", () => {
      // 99 and 100 are off-page selections that must survive.
      expect(togglePageSelection([99, 100], page, true)).toEqual([
        99,
        100,
        1,
        2,
        3,
      ]);
    });

    it("dedupes when a current page id is already selected", () => {
      // Asserted by content + length, not order — the helper makes no
      // ordering guarantee and callers don't rely on one.
      const next = togglePageSelection([2, 99], page, true);
      expect(next).toHaveLength(4);
      expect(next).toEqual(expect.arrayContaining([1, 2, 3, 99]));
    });

    it("removes only current page ids on uncheck", () => {
      // Off-page ids (99) stay; on-page ids (1, 3) are stripped.
      expect(togglePageSelection([1, 3, 99], page, false)).toEqual([99]);
    });

    it("is a no-op uncheck when nothing on the current page was selected", () => {
      expect(togglePageSelection([99], page, false)).toEqual([99]);
    });

    it("handles a null/undefined prev selection", () => {
      expect(togglePageSelection(null, page, true)).toEqual([1, 2, 3]);
      expect(togglePageSelection(undefined, page, false)).toEqual([]);
    });

    it("handles an empty / missing page", () => {
      expect(togglePageSelection([99], [], true)).toEqual([99]);
      expect(togglePageSelection([99], undefined, false)).toEqual([99]);
    });
  });

  describe("isPageFullySelected", () => {
    const page = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it("is true when every page item is in the selection", () => {
      expect(isPageFullySelected(page, [1, 2, 3])).toBe(true);
    });

    it("is true when the selection is a superset of the page", () => {
      // Off-page selections (99) shouldn't block "fully selected" for this page.
      expect(isPageFullySelected(page, [1, 2, 3, 99])).toBe(true);
    });

    it("is false when one page item is missing from the selection", () => {
      expect(isPageFullySelected(page, [1, 3])).toBe(false);
    });

    it("is false when the selection is empty", () => {
      expect(isPageFullySelected(page, [])).toBe(false);
    });

    it("is false for an empty / missing page (nothing on screen to be 'fully selected')", () => {
      expect(isPageFullySelected([], [1, 2, 3])).toBe(false);
      expect(isPageFullySelected(undefined, [1, 2, 3])).toBe(false);
    });

    it("tolerates a null/undefined selection", () => {
      expect(isPageFullySelected(page, null)).toBe(false);
      expect(isPageFullySelected(page, undefined)).toBe(false);
    });
  });

  describe("isPagePartiallySelected", () => {
    const page = [{ id: 1 }, { id: 2 }, { id: 3 }];

    it("is true when some — but not all — page items are selected", () => {
      expect(isPagePartiallySelected(page, [1])).toBe(true);
      expect(isPagePartiallySelected(page, [2, 3])).toBe(true);
    });

    it("is false when no page items are selected (even if off-page items are)", () => {
      expect(isPagePartiallySelected(page, [])).toBe(false);
      expect(isPagePartiallySelected(page, [99])).toBe(false);
    });

    it("is false when every page item is selected (that's full, not partial)", () => {
      expect(isPagePartiallySelected(page, [1, 2, 3])).toBe(false);
      expect(isPagePartiallySelected(page, [1, 2, 3, 99])).toBe(false);
    });

    it("is false for an empty / missing page", () => {
      expect(isPagePartiallySelected([], [1])).toBe(false);
      expect(isPagePartiallySelected(undefined, [1])).toBe(false);
    });

    it("tolerates a null/undefined selection", () => {
      expect(isPagePartiallySelected(page, null)).toBe(false);
      expect(isPagePartiallySelected(page, undefined)).toBe(false);
    });
  });
});
