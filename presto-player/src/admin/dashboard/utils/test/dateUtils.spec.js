import { startOfDay, subDays } from "date-fns";
import {
  ALL_TIME_START,
  getLastNDays,
  getAllTimeRange,
  getAnalyticsPresets,
  getRangeLabel,
  format,
  toAnalyticsDate,
} from "../dateUtils";

describe("dateUtils", () => {
  beforeAll(() => {
    // Freeze "now" so tests are deterministic. Picked an arbitrary
    // afternoon timestamp to make sure start-of-day math is exercised.
    jest.useFakeTimers().setSystemTime(new Date("2026-05-10T16:33:22"));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe("getLastNDays", () => {
    it("returns 30 days inclusive of today, both anchored at start-of-day", () => {
      const today = startOfDay(new Date());
      const r = getLastNDays(30);
      expect(r.from.getTime()).toBe(
        startOfDay(subDays(today, 29)).getTime()
      );
      expect(r.to.getTime()).toBe(today.getTime());
    });

    it("handles non-numeric input by returning empty strings", () => {
      const r = getLastNDays("not-a-number");
      expect(r).toEqual({ from: "", to: "" });
    });
  });

  describe("getAllTimeRange", () => {
    it("serializes to the same ISO start the all-time data path already uses", () => {
      // Wire-format invariant: matches what useTopPerforming.js sends as
      // its all-time fallback, so this default does not change the
      // request shape on the backend.
      const r = getAllTimeRange();
      expect(toAnalyticsDate(r.from)).toBe(ALL_TIME_START);
    });
  });

  describe("getAnalyticsPresets", () => {
    it("returns the All Time, Last 7/30/90 days and Last 12 months presets in order", () => {
      const presets = getAnalyticsPresets();
      expect(presets.map((p) => p.label)).toEqual([
        "All Time",
        "Last 7 days",
        "Last 30 days",
        "Last 90 days",
        "Last 12 months",
      ]);
    });

  });

  describe("getRangeLabel", () => {
    it("returns the All Time label for the all-time range", () => {
      expect(getRangeLabel(getAllTimeRange())).toBe("All Time");
    });

    it("returns the Last 30 days label for getLastNDays(30)", () => {
      expect(getRangeLabel(getLastNDays(30))).toBe("Last 30 days");
    });

    it("falls through to formatted dates for a custom range", () => {
      expect(
        getRangeLabel({
          from: new Date("2025-01-01T00:00:00"),
          to: new Date("2025-01-15T00:00:00"),
        })
      ).toBe("01/01/2025 - 01/15/2025");
    });

    it("returns empty string for an empty range", () => {
      expect(getRangeLabel({ from: null, to: null })).toBe("");
      expect(getRangeLabel(null)).toBe("");
    });
  });

  describe("toAnalyticsDate", () => {
    it("anchors the date to UTC midnight regardless of local time", () => {
      // The frozen system time is 16:33:22 local but the analytics wire
      // format must use 00:00:00.000Z so the backend's date-only window
      // doesn't drift by a day for east-of-UTC users.
      const out = toAnalyticsDate(new Date());
      expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });
  });

  describe("format", () => {
    it("returns 'No Date' for invalid input", () => {
      expect(format(null)).toBe("No Date");
      expect(format("not-a-date")).toBe("No Date");
    });

    it("formats dates per the supplied pattern", () => {
      const d = new Date("2026-05-10T00:00:00");
      expect(format(d, "MM/dd/yyyy")).toBe("05/10/2026");
      expect(format(d, "MMM dd, yyyy")).toBe("May 10, 2026");
    });
  });
});
