import {
  formatHMS,
  humanSeconds,
  humanSecondsCompact,
  formatChartData,
  padDailyPoints,
  decodeHTMLEntities,
} from "../formatters";

describe("formatters", () => {
  describe("formatHMS", () => {
    it("returns 00:00:00 for zero", () => {
      expect(formatHMS(0)).toBe("00:00:00");
    });

    it("formats sub-minute values with leading zeros", () => {
      expect(formatHMS(5)).toBe("00:00:05");
      expect(formatHMS(45)).toBe("00:00:45");
    });

    it("formats exact-hour values", () => {
      expect(formatHMS(3600)).toBe("01:00:00");
    });

    it("formats multi-hour values", () => {
      expect(formatHMS(3665)).toBe("01:01:05");
      expect(formatHMS(36000)).toBe("10:00:00");
    });

    it("rounds fractional seconds", () => {
      expect(formatHMS(5.4)).toBe("00:00:05");
      expect(formatHMS(5.6)).toBe("00:00:06");
    });

    it("treats null and NaN as zero", () => {
      expect(formatHMS(null)).toBe("00:00:00");
      expect(formatHMS(NaN)).toBe("00:00:00");
      expect(formatHMS(undefined)).toBe("00:00:00");
    });
  });

  describe("humanSeconds", () => {
    it("returns 0s for zero / null / undefined", () => {
      expect(humanSeconds(0)).toBe("0s");
      expect(humanSeconds(null)).toBe("0s");
      expect(humanSeconds(undefined)).toBe("0s");
    });

    it("returns seconds-only when under a minute", () => {
      expect(humanSeconds(45)).toBe("45s");
    });

    it("returns minutes + seconds when under an hour", () => {
      expect(humanSeconds(65)).toBe("1m 5s");
      expect(humanSeconds(120)).toBe("2m");
    });

    it("returns hours + minutes + seconds for multi-hour values", () => {
      expect(humanSeconds(3665)).toBe("1h 1m 5s");
    });

    it("includes hour-only when minutes/seconds are zero", () => {
      expect(humanSeconds(7200)).toBe("2h");
    });
  });

  describe("humanSecondsCompact", () => {
    it("stays in seconds up to (but not including) 90s", () => {
      expect(humanSecondsCompact(0)).toBe("0s");
      expect(humanSecondsCompact(89)).toBe("89s");
    });

    it("switches to minutes at 90s and up to 90m", () => {
      expect(humanSecondsCompact(90)).toBe("2m");
      expect(humanSecondsCompact(60 * 60)).toBe("60m");
    });

    it("switches to hours at 90 minutes", () => {
      expect(humanSecondsCompact(90 * 60)).toBe("2h");
      expect(humanSecondsCompact(7200)).toBe("2h");
    });

    it("coerces non-numeric input to 0s", () => {
      expect(humanSecondsCompact("not-a-number")).toBe("0s");
      expect(humanSecondsCompact(null)).toBe("0s");
      expect(humanSecondsCompact(undefined)).toBe("0s");
    });
  });

  // Local-time formatter so tests stay deterministic regardless of host TZ
  // (the helpers under test compute keys via local-time getters).
  const fmt = (d, _pattern) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  describe("formatChartData", () => {
    it("returns an empty array for empty / null input", () => {
      expect(formatChartData([], "total", false, fmt)).toEqual([]);
      expect(formatChartData(null, "total", false, fmt)).toEqual([]);
    });

    it("sorts ascending by date_time and maps to { month, count }", () => {
      const data = [
        { date_time: "2026-01-03T12:00:00", total: "5" },
        { date_time: "2026-01-01T12:00:00", total: "1" },
        { date_time: "2026-01-02T12:00:00", total: "3" },
      ];
      const out = formatChartData(data, "total", false, fmt);
      expect(out.map((p) => p.month)).toEqual([
        "2026-01-01",
        "2026-01-02",
        "2026-01-03",
      ]);
      expect(out.map((p) => p.count)).toEqual([1, 3, 5]);
    });

    it("divides by 60 and rounds to 2 dp when isWatchTime=true", () => {
      const data = [{ date_time: "2026-01-01T12:00:00", total: "150" }];
      const out = formatChartData(data, "total", true, fmt);
      expect(out[0].count).toBe(2.5);
    });

    it("falls back to 0 for non-numeric values via parseInt", () => {
      const data = [{ date_time: "2026-01-01T12:00:00", total: "n/a" }];
      const out = formatChartData(data, "total", false, fmt);
      expect(out[0].count).toBe(0);
    });
  });

  describe("padDailyPoints", () => {
    it("returns input unchanged when range is missing or incomplete", () => {
      const points = [{ month: "2026-01-01", count: 1 }];
      expect(padDailyPoints(points, undefined, fmt)).toBe(points);
      expect(padDailyPoints(points, { from: null, to: null }, fmt)).toBe(
        points
      );
    });

    it("returns input unchanged when formatDate is missing", () => {
      const points = [{ month: "2026-01-01", count: 1 }];
      expect(
        padDailyPoints(points, {
          from: new Date(2026, 0, 1),
          to: new Date(2026, 0, 3),
        })
      ).toBe(points);
    });

    it("fills missing days with zero counts and preserves existing counts", () => {
      const points = [
        { month: "2026-01-01", count: 5 },
        { month: "2026-01-03", count: 7 },
      ];
      const range = {
        from: new Date(2026, 0, 1, 10),
        to: new Date(2026, 0, 3, 20),
      };
      const out = padDailyPoints(points, range, fmt);
      expect(out).toEqual([
        { month: "2026-01-01", count: 5 },
        { month: "2026-01-02", count: 0 },
        { month: "2026-01-03", count: 7 },
      ]);
    });

    it("is inclusive of both range endpoints", () => {
      const range = {
        from: new Date(2026, 0, 1),
        to: new Date(2026, 0, 1),
      };
      const out = padDailyPoints([], range, fmt);
      expect(out).toHaveLength(1);
      expect(out[0].count).toBe(0);
    });

    it("treats null/undefined points as empty when range is given", () => {
      const range = {
        from: new Date(2026, 0, 1),
        to: new Date(2026, 0, 2),
      };
      const out = padDailyPoints(null, range, fmt);
      expect(out).toEqual([
        { month: "2026-01-01", count: 0 },
        { month: "2026-01-02", count: 0 },
      ]);
    });
  });

  describe("decodeHTMLEntities", () => {
    it("returns empty string for falsy input", () => {
      expect(decodeHTMLEntities("")).toBe("");
      expect(decodeHTMLEntities(null)).toBe("");
      expect(decodeHTMLEntities(undefined)).toBe("");
    });

    it("decodes numeric entities like &#039;", () => {
      expect(decodeHTMLEntities("John&#039;s Video")).toBe("John's Video");
    });

    it("decodes named entities like &amp;", () => {
      expect(decodeHTMLEntities("Sales &amp; Marketing")).toBe(
        "Sales & Marketing"
      );
    });
  });
});
