import { renderHook, act } from "@testing-library/react-hooks";

// Stub the fetchers from ../utils so the hook's mount-time effect doesn't
// hit the network. Keep every other util (date helpers, formatters) real.
// Names must be `mock`-prefixed to satisfy jest.mock's out-of-scope rule.
const mockFetchViews = jest.fn();
const mockFetchWatchTime = jest.fn();

jest.mock("../../utils", () => {
  const actual = jest.requireActual("../../utils");
  return {
    __esModule: true,
    ...actual,
    fetchViews: (...args) => mockFetchViews(...args),
    fetchWatchTime: (...args) => mockFetchWatchTime(...args),
  };
});

import useEngagementChartData from "../useEngagementChartData";

const okViews = (overrides = {}) => ({
  total: 0,
  chartData: [],
  ...overrides,
});
const okWatch = (overrides = {}) => ({
  total: 0,
  chartData: [],
  average: 0,
  ...overrides,
});

beforeEach(() => {
  mockFetchViews.mockReset();
  mockFetchWatchTime.mockReset();
  global.window.prestoPlayer = { isPremium: true };
});

afterEach(() => {
  delete global.window.prestoPlayer;
});

describe("useEngagementChartData", () => {
  describe("free tier (isPremium=false)", () => {
    beforeEach(() => {
      window.prestoPlayer.isPremium = false;
    });

    it("does not fire mount-time fetches and is not in a loading state", async () => {
      const { result } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: false })
      );
      await act(async () => {});

      expect(mockFetchViews).not.toHaveBeenCalled();
      expect(mockFetchWatchTime).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.chartData).toEqual([]);
      expect(result.current.total).toBe(0);
      expect(result.current.error).toBeNull();
    });
  });

  describe("premium tier", () => {
    it("populates totals and clears loading after a successful mount fetch", async () => {
      mockFetchViews.mockResolvedValue(okViews({ total: 42 }));
      mockFetchWatchTime.mockResolvedValue(okWatch({ total: 360, average: 12 }));

      const { result, waitForNextUpdate } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: false })
      );

      expect(result.current.isLoading).toBe(true);
      await waitForNextUpdate();

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.total).toBe(42); // default tab is "views"
    });

    it("exposes the mount-fetch error only on the failing tab", async () => {
      mockFetchViews.mockResolvedValue(okViews({ total: 10 }));
      mockFetchWatchTime.mockRejectedValue(new Error("boom"));

      const { result, waitForNextUpdate } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: false })
      );
      await waitForNextUpdate();

      // Default tab (views) succeeded — no error shown so the user isn't
      // warned about data they aren't looking at.
      expect(result.current.activeTab).toBe("views");
      expect(result.current.error).toBeNull();
      expect(result.current.total).toBe(10);

      // Switching to the failing tab surfaces an explicit watch-time error
      // (rather than the previous generic "Some data could not be loaded").
      act(() => {
        result.current.setActiveTab("watch-time");
      });
      expect(result.current.error).toMatch(/watch[- ]?time/i);
      expect(result.current.total).toBe(0);
    });

    it("exposes the mount-fetch error on the views tab when views rejects", async () => {
      mockFetchViews.mockRejectedValue(new Error("nope"));
      mockFetchWatchTime.mockResolvedValue(okWatch({ total: 99 }));

      const { result, waitForNextUpdate } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: false })
      );
      await waitForNextUpdate();

      // Default tab is "views" → reads the failed-half fallback (0) and
      // surfaces the views-specific error.
      expect(result.current.total).toBe(0);
      expect(result.current.error).toMatch(/views/i);
    });

    it("fetches the all-time totals alongside the default-range chart data", async () => {
      // Distinct totals per call so we can prove which fetch fed which
      // field — `mockResolvedValueOnce` resolves in call order, so the
      // first call (default-range) maps to the chart KPI and the second
      // (all-time) maps to the summary card.
      mockFetchViews
        .mockResolvedValueOnce(okViews({ total: 100 }))
        .mockResolvedValueOnce(okViews({ total: 9999 }));
      mockFetchWatchTime
        .mockResolvedValueOnce(okWatch({ total: 300 }))
        .mockResolvedValueOnce(okWatch({ total: 8888 }));

      const { result, waitForNextUpdate } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: true })
      );
      await waitForNextUpdate();

      // The chart now defaults to the last-7-days window, so the
      // "All Time …" summary cards need their own dedicated fetch in
      // parallel — one call for the default range, one for all-time.
      expect(mockFetchViews).toHaveBeenCalledTimes(2);
      expect(mockFetchWatchTime).toHaveBeenCalledTimes(2);

      // Chart KPI reflects the default-range fetch …
      expect(result.current.total).toBe(100);
      // … and the summary card reflects the dedicated all-time fetch,
      // proving the two pipelines don't cross-wire.
      expect(result.current.allTimeViews).toBe(9999);
      expect(result.current.allTimeWatchTime).toBe(8888);

      // Same wiring holds after switching tabs — the watch-time KPI
      // should read from its own default-range total, not from all-time.
      act(() => {
        result.current.setActiveTab("watch-time");
      });
      expect(result.current.total).toBe(300);
    });

    it("keeps allTimeViews null when the all-time fetch fails, without surfacing a banner", async () => {
      // The default-range fetch succeeds (chart renders normally) but
      // the all-time fetch rejects. The Dashboard summary card should
      // gracefully render nothing rather than crash on a null total,
      // and the failure should be logged so it isn't entirely silent.
      const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

      mockFetchViews
        .mockResolvedValueOnce(okViews({ total: 100 }))
        .mockRejectedValueOnce(new Error("all-time views failed"));
      mockFetchWatchTime
        .mockResolvedValueOnce(okWatch({ total: 300 }))
        .mockRejectedValueOnce(new Error("all-time watch-time failed"));

      const { result, waitForNextUpdate } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: true })
      );
      await waitForNextUpdate();

      expect(result.current.total).toBe(100);
      expect(result.current.allTimeViews).toBeNull();
      expect(result.current.allTimeWatchTime).toBeNull();
      // Mount-level error banner is reserved for default-range failures,
      // so the summary-card failure shouldn't poison the chart UX.
      expect(result.current.error).toBeNull();
      expect(warn).toHaveBeenCalled();

      warn.mockRestore();
    });

    it("returns null all-time summary fields when showAllTimeSummary=false", async () => {
      mockFetchViews.mockResolvedValue(okViews());
      mockFetchWatchTime.mockResolvedValue(okWatch());

      const { result, waitForNextUpdate } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: false })
      );
      await waitForNextUpdate();

      expect(result.current.allTimeViews).toBeNull();
      expect(result.current.allTimeWatchTime).toBeNull();
    });
  });

  describe("public callbacks", () => {
    beforeEach(async () => {
      mockFetchViews.mockResolvedValue(okViews());
      mockFetchWatchTime.mockResolvedValue(okWatch());
    });

    it("setSelectedDates(null) clears the selected range and any filtered result", async () => {
      const { result, waitForNextUpdate } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: false })
      );
      await waitForNextUpdate();

      const from = new Date(2026, 0, 1);
      const to = new Date(2026, 0, 10);

      await act(async () => {
        result.current.setSelectedDates({ from, to });
      });
      // Wait for the date-filter fetch to settle so filteredResult is set.
      await act(async () => {});

      await act(async () => {
        result.current.setSelectedDates(null);
      });
      expect(result.current.selectedDates).toEqual({ from: null, to: null });
      // Cleared filteredResult means we fall back to the mount-data total.
      expect(result.current.error).toBeNull();
    });

    it("setActiveTab switches between views and watch-time", async () => {
      mockFetchViews.mockResolvedValueOnce(okViews({ total: 42 }));
      mockFetchWatchTime.mockResolvedValueOnce(okWatch({ total: 360 }));

      const { result, waitForNextUpdate } = renderHook(() =>
        useEngagementChartData({ showAllTimeSummary: false })
      );
      await waitForNextUpdate();
      expect(result.current.activeTab).toBe("views");
      expect(result.current.total).toBe(42);

      act(() => {
        result.current.setActiveTab("watch-time");
      });
      expect(result.current.activeTab).toBe("watch-time");
      expect(result.current.isWatchTime).toBe(true);
      expect(result.current.total).toBe(360);
    });

  });
});
