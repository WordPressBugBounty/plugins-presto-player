import { renderHook, act } from "@testing-library/react-hooks";
import apiFetch from "@wordpress/api-fetch";
import useTopVideosPaginated from "../useTopVideosPaginated";
import useUserDetail from "../useUserDetail";

jest.mock("@wordpress/api-fetch");
jest.mock("../useTopVideosPaginated", () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mediaStub = (overrides = {}) => ({
  topMedia: [],
  page: 1,
  setPage: jest.fn(),
  pagination: { totalItems: 0, totalPages: 0 },
  perPage: 10,
  isLoading: false,
  error: null,
  ...overrides,
});

// Drains pending React state updates so trailing setStats/setIsLoading
// don't fire after the test completes (which would trip @wordpress/jest-
// console's "console.error not expected" guard via React's act warning).
const settle = () => act(async () => {});

// Freeze "now" so the default-range math is deterministic — and in
// particular doesn't flake when the suite happens to straddle local
// midnight while the hook and the test each call `new Date()`.
beforeAll(() => {
  jest.useFakeTimers().setSystemTime(new Date("2026-05-10T16:33:22"));
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  apiFetch.mockReset();
  useTopVideosPaginated.mockReset();
  useTopVideosPaginated.mockReturnValue(mediaStub());
});

describe("useUserDetail", () => {
  it("does not fetch when userId is falsy", async () => {
    const { result } = renderHook(() => useUserDetail(null));
    await settle();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("populates user metadata from /wp/v2/users + parallel analytics", async () => {
    apiFetch
      .mockResolvedValueOnce({
        id: 7,
        name: "Ada Lovelace",
        email: "ada@example.com",
        avatar_urls: { 48: "small.png", 96: "big.png" },
      })
      .mockResolvedValueOnce({ view: "12" })
      .mockResolvedValueOnce({ view: "30" })
      .mockResolvedValueOnce({ view: "180" });

    const { result, waitForNextUpdate } = renderHook(() => useUserDetail(7));
    await waitForNextUpdate();
    await settle();

    expect(result.current.user).toMatchObject({
      id: 7,
      name: "Ada Lovelace",
      email: "ada@example.com",
      avatarUrl: "big.png",
    });
    expect(result.current.user.profileUrl).toContain("user_id=7");

    expect(result.current.stats).toEqual({
      totalViews: 12,
      avgWatchTime: "30s",
      totalWatchTime: "3m",
    });
  });

  it("falls back to a generated name when the user has none", async () => {
    apiFetch
      .mockResolvedValueOnce({ id: 99, name: "" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" });

    const { result, waitForNextUpdate } = renderHook(() => useUserDetail(99));
    await waitForNextUpdate();
    await settle();

    expect(result.current.user.name).toBe("User #99");
  });

  it("uses the smaller avatar size when 96 isn't available", async () => {
    apiFetch
      .mockResolvedValueOnce({
        id: 1,
        name: "x",
        avatar_urls: { 48: "small.png" },
      })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" });

    const { result, waitForNextUpdate } = renderHook(() => useUserDetail(1));
    await waitForNextUpdate();
    await settle();
    expect(result.current.user.avatarUrl).toBe("small.png");
  });

  it("forces avg/total watch time to '0s' when totalViews is 0", async () => {
    apiFetch
      .mockResolvedValueOnce({ id: 1, name: "x" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "100" })
      .mockResolvedValueOnce({ view: "200" });

    const { result, waitForNextUpdate } = renderHook(() => useUserDetail(1));
    await waitForNextUpdate();
    await settle();

    expect(result.current.stats).toEqual({
      totalViews: 0,
      avgWatchTime: "0s",
      totalWatchTime: "0s",
    });
  });

  it("falls back to zero stats with a warn when analytics endpoints fail", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    apiFetch
      .mockResolvedValueOnce({ id: 1, name: "x" })
      .mockRejectedValueOnce(new Error("403"));

    const { result, waitForNextUpdate } = renderHook(() => useUserDetail(1));
    await waitForNextUpdate();
    await settle();

    expect(result.current.stats).toEqual({
      totalViews: 0,
      avgWatchTime: "0s",
      totalWatchTime: "0s",
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  // Both rest_user_invalid_id (non-existent user) and rest_no_route (REST
  // route disabled) collapse to the same user-facing error string.
  it.each([["rest_user_invalid_id"], ["rest_no_route"]])(
    "maps %s to a 'User not found' error",
    async (code) => {
      const errorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const err = new Error("nope");
      err.code = code;
      apiFetch.mockRejectedValueOnce(err);

      const { result, waitForNextUpdate } = renderHook(() =>
        useUserDetail(1)
      );
      await waitForNextUpdate();
      await settle();

      expect(result.current.error).toBe("User not found");
      errorSpy.mockRestore();
    }
  );

  it("surfaces other errors verbatim", async () => {
    const errorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    apiFetch.mockRejectedValueOnce(new Error("server down"));

    const { result, waitForNextUpdate } = renderHook(() => useUserDetail(1));
    await waitForNextUpdate();
    await settle();

    expect(result.current.error).toBe("server down");
    errorSpy.mockRestore();
  });

  it("refetch(from, to) re-runs analytics with the new date range", async () => {
    apiFetch
      .mockResolvedValueOnce({ id: 1, name: "x" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" });

    const { result, waitForNextUpdate } = renderHook(() => useUserDetail(1));
    await waitForNextUpdate();
    await settle();

    apiFetch.mockReset();
    apiFetch
      .mockResolvedValueOnce({ id: 1, name: "x" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" });

    await act(async () => {
      result.current.refetch(
        new Date(Date.UTC(2026, 0, 5)),
        new Date(Date.UTC(2026, 0, 10))
      );
    });
    await settle();

    const analyticsPaths = apiFetch.mock.calls
      .slice(1)
      .map((c) => c[0].path);
    expect(analyticsPaths.length).toBeGreaterThan(0);
    expect(analyticsPaths.every((p) => p.includes("start=2026-01-05"))).toBe(
      true
    );
    expect(analyticsPaths.every((p) => p.includes("end=2026-01-10"))).toBe(
      true
    );
  });

  it("refetch() with no args restores the default analytics range", async () => {
    // First mount with the default analytics range.
    apiFetch
      .mockResolvedValueOnce({ id: 1, name: "x" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" });

    const { result, waitForNextUpdate } = renderHook(() => useUserDetail(1));
    await waitForNextUpdate();
    await settle();

    // Switch to a custom range so a follow-up refetch() actually changes
    // dateRange (going from null → null wouldn't trigger a re-fetch).
    apiFetch.mockReset();
    apiFetch
      .mockResolvedValueOnce({ id: 1, name: "x" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" });

    await act(async () => {
      result.current.refetch(
        new Date(Date.UTC(2026, 0, 5)),
        new Date(Date.UTC(2026, 0, 10))
      );
    });
    await settle();

    apiFetch.mockReset();
    apiFetch
      .mockResolvedValueOnce({ id: 1, name: "x" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" })
      .mockResolvedValueOnce({ view: "0" });

    await act(async () => {
      result.current.refetch();
    });
    await settle();

    // After clearing back to the default (DEFAULT_ANALYTICS_DAYS = 90),
    // the start param should be the window's lower bound — frozen "today"
    // 2026-05-10 minus 89 days = 2026-02-10 — not the all-time 2020-01-01
    // sentinel. If DEFAULT_ANALYTICS_DAYS changes, recompute this date.
    expect(apiFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
    const analyticsPath = apiFetch.mock.calls[1][0].path;
    expect(analyticsPath).not.toContain("start=2020-01-01");
    expect(analyticsPath).toContain("start=2026-02-10");
  });
});
